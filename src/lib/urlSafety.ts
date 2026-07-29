import { Agent, request, type Dispatcher } from "undici";
import type { LookupFunction } from "node:net";
import dns from "node:dns";

/**
 * Server-side request forgery guards for user-supplied recipe URLs.
 *
 * The extraction endpoint fetches whatever URL a visitor pastes. Without
 * these checks that is a request forgery primitive: a submitted URL pointing
 * at a cloud metadata endpoint or an internal service would be fetched by the
 * server and its body returned to the caller.
 *
 * Two layers:
 *
 *  1. `assertSafeUrl` rejects bad schemes and obviously non-public hosts
 *     before any network activity, and is applied to every redirect hop.
 *  2. The dispatcher validates the *resolved address at connect time*. This is
 *     the layer that matters, because checking DNS separately from connecting
 *     leaves a rebinding window: a hostname can resolve to a public address
 *     for the check and a private one for the connection. Validating inside
 *     the socket lookup means the address we approve is the address we talk
 *     to.
 *
 * See IMPLEMENTATION_GUIDE section 7.
 */

export type UrlRejection =
  | "bad_scheme"
  | "bad_url"
  | "blocked_host"
  | "blocked_address"
  | "too_many_redirects"
  | "response_too_large"
  | "bad_content_type"
  | "timeout"
  | "fetch_failed";

export class UnsafeUrlError extends Error {
  constructor(public readonly reason: UrlRejection, message?: string) {
    super(message ?? reason);
    this.name = "UnsafeUrlError";
  }
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Hostnames that must never be resolved, regardless of what DNS would say. */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
]);

function ipv4ToInt(parts: number[]): number {
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function parseIpv4(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const nums: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    nums.push(n);
  }
  return nums;
}

/** CIDR blocks that must never be contacted. */
const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // RFC1918
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, includes cloud metadata at 169.254.169.254
  ["172.16.0.0", 12], // RFC1918
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // RFC1918
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, includes broadcast
];

function isBlockedIpv4(value: string): boolean {
  const parts = parseIpv4(value);
  if (!parts) return false;
  const addr = ipv4ToInt(parts);
  for (const [base, bits] of BLOCKED_V4) {
    const baseParts = parseIpv4(base);
    if (!baseParts) continue;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((addr & mask) === (ipv4ToInt(baseParts) & mask)) return true;
  }
  return false;
}

function isBlockedIpv6(value: string): boolean {
  const v = value.toLowerCase().split("%")[0]; // strip zone index

  if (v === "::" || v === "::1") return true;

  // IPv4-mapped and IPv4-compatible forms embed a v4 address; unwrap and
  // apply the v4 rules so ::ffff:127.0.0.1 cannot slip through.
  const mapped = v.match(/^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isBlockedIpv4(mapped[1]);

  // Unique local (fc00::/7) and link-local (fe80::/10).
  if (/^f[cd]/.test(v)) return true;
  if (/^fe[89ab]/.test(v)) return true;

  // 6to4 (2002::/16) and NAT64 (64:ff9b::/96) can encapsulate a v4 target.
  if (v.startsWith("2002:")) return true;
  if (v.startsWith("64:ff9b:")) return true;

  return false;
}

/** True when an IP literal must not be contacted. */
export function isBlockedAddress(value: string): boolean {
  if (!value) return true;
  return value.includes(":") ? isBlockedIpv6(value) : isBlockedIpv4(value);
}

/**
 * Validate a URL before any network activity. Applied to the submitted URL and
 * to every redirect target.
 */
export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("bad_url");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeUrlError("bad_scheme");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost")) {
    throw new UnsafeUrlError("blocked_host");
  }

  // If the host is already a literal address, decide now rather than waiting
  // for the resolver.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    if (isBlockedAddress(host)) throw new UnsafeUrlError("blocked_address");
  }

  return url;
}

/**
 * DNS lookup that refuses to hand back a non-public address. Used as the
 * socket-level `lookup`, so the address validated here is the one connected
 * to — no rebinding window between check and connect.
 */
export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  // undici asks for every address (`all: true`) and expects an array back.
  // Always resolve with `all: true` so we can inspect the full answer, then
  // shape the callback to whatever the caller asked for.
  const wantsAll = (options as dns.LookupAllOptions)?.all === true;

  dns.lookup(
    hostname,
    { ...(options as dns.LookupOptions), all: true },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => {
      const done = callback as unknown as (
        e: NodeJS.ErrnoException | null,
        a?: dns.LookupAddress[] | string,
        f?: number
      ) => void;

      if (err) return done(err);

      // Reject if *any* answer is non-public rather than filtering them out.
      // A name that resolves to both a public and a private address is a
      // known bypass: connection selection could still land on the private
      // one, so the safe response is to refuse the host entirely.
      const blocked = addresses.find((a) => isBlockedAddress(a.address));
      if (blocked) {
        return done(
          new UnsafeUrlError(
            "blocked_address",
            `refusing to connect to non-public address ${blocked.address}`
          )
        );
      }

      if (!addresses.length) {
        return done(new UnsafeUrlError("blocked_address", "no addresses"));
      }

      if (wantsAll) return done(null, addresses);
      return done(null, addresses[0].address, addresses[0].family);
    }
  );
};

const MAX_REDIRECTS = 5;
const MAX_BYTES = 2 * 1024 * 1024; // 2 MiB is generous for a recipe page
const HEADERS_TIMEOUT_MS = 5_000;
const BODY_TIMEOUT_MS = 8_000;

const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "text/plain",
];

function makeAgent(): Agent {
  return new Agent({
    connect: { lookup: guardedLookup },
    headersTimeout: HEADERS_TIMEOUT_MS,
    bodyTimeout: BODY_TIMEOUT_MS,
  });
}

export type SafeFetchResult = {
  html: string;
  /** URL of the final response, after redirects. */
  finalUrl: string;
};

/**
 * Fetch a public HTML page with SSRF, size, type, and timeout protections.
 * Redirects are followed manually so that every hop is validated.
 */
export async function safeFetchHtml(
  rawUrl: string,
  userAgent: string,
  /**
   * Test seam. Supplying a dispatcher bypasses the connect-time address guard,
   * so it must never be used in production paths — only to exercise redirect
   * and response handling without real network access.
   */
  injectedDispatcher?: Dispatcher
): Promise<SafeFetchResult> {
  const agent = injectedDispatcher ?? makeAgent();
  try {
    let current = assertSafeUrl(rawUrl);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      // undici's `request` does not follow redirects unless a redirect
      // interceptor is attached, so each hop surfaces here for validation.
      const res = await request(current.toString(), {
        method: "GET",
        dispatcher: agent,
        headers: { "user-agent": userAgent, accept: "text/html,*/*" },
      });

      const status = res.statusCode;

      if (status >= 300 && status < 400) {
        const location = res.headers["location"];
        const target = Array.isArray(location) ? location[0] : location;
        // Drain so the connection can be reused rather than left dangling.
        await res.body.dump();
        if (!target) throw new UnsafeUrlError("fetch_failed");
        // Resolve relative redirects against the current URL, then re-validate.
        current = assertSafeUrl(new URL(target, current).toString());
        continue;
      }

      if (status >= 400) {
        await res.body.dump();
        throw new UnsafeUrlError("fetch_failed", `upstream status ${status}`);
      }

      const contentType = String(res.headers["content-type"] ?? "").toLowerCase();
      if (
        contentType &&
        !ALLOWED_CONTENT_TYPES.some((t) => contentType.includes(t))
      ) {
        await res.body.dump();
        throw new UnsafeUrlError("bad_content_type", contentType);
      }

      const html = await readCapped(res.body, MAX_BYTES);
      return { html, finalUrl: current.toString() };
    }

    throw new UnsafeUrlError("too_many_redirects");
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw err;
    const code = (err as { code?: string })?.code;
    if (code === "UND_ERR_HEADERS_TIMEOUT" || code === "UND_ERR_BODY_TIMEOUT") {
      throw new UnsafeUrlError("timeout");
    }
    // A blocked address surfaces here when it is thrown from the lookup hook.
    const cause = (err as { cause?: unknown })?.cause;
    if (cause instanceof UnsafeUrlError) throw cause;
    throw new UnsafeUrlError("fetch_failed", String(code ?? err));
  } finally {
    if (!injectedDispatcher) await agent.close().catch(() => {});
  }
}

/**
 * Read a stream, aborting once it exceeds `limit`. Streaming rather than
 * buffering matters: a multi-gigabyte response should not be materialized just
 * to discover it is too large.
 */
async function readCapped(
  body: AsyncIterable<Buffer> & { destroy?: (e?: Error) => void },
  limit: number
): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of body) {
    total += chunk.length;
    if (total > limit) {
      body.destroy?.();
      throw new UnsafeUrlError("response_too_large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
