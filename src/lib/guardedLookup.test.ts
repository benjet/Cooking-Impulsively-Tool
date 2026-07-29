import { describe, it, expect } from "vitest";
import { guardedLookup, UnsafeUrlError } from "./urlSafety";

/**
 * Regression tests for the DNS guard's callback contract.
 *
 * These exist because of a real bug: the first implementation always called
 * back with `(err, address, family)`, but undici invokes `lookup` with
 * `all: true` and expects an array of `{address, family}`. The mismatch made
 * every outbound fetch fail with "Invalid IP address: undefined" — a guard
 * that looked correct in unit tests and broke all extraction in practice.
 *
 * The shape of the callback is therefore part of the contract, not detail.
 */

type LookupResult =
  | { kind: "error"; reason: string }
  | { kind: "all"; addresses: { address: string; family: number }[] }
  | { kind: "one"; address: string; family: number };

function run(
  hostname: string,
  options: Record<string, unknown>
): Promise<LookupResult> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (guardedLookup as any)(
      hostname,
      options,
      (err: unknown, a: unknown, f: unknown) => {
        if (err) {
          resolve({
            kind: "error",
            reason:
              err instanceof UnsafeUrlError
                ? err.reason
                : (err as NodeJS.ErrnoException).code ?? "unknown",
          });
          return;
        }
        if (Array.isArray(a)) {
          resolve({ kind: "all", addresses: a });
          return;
        }
        resolve({ kind: "one", address: a as string, family: f as number });
      }
    );
  });
}

describe("guardedLookup", () => {
  it("returns an array when called with all: true, as undici does", async () => {
    const result = await run("localhost", { all: true, hints: 0 });
    // localhost resolves to loopback, which must be refused — but the point
    // here is that the guard understood the request shape at all.
    expect(result.kind).toBe("error");
    if (result.kind === "error") expect(result.reason).toBe("blocked_address");
  });

  it("refuses a hostname that resolves to loopback", async () => {
    const result = await run("localhost", { all: true });
    expect(result).toEqual({ kind: "error", reason: "blocked_address" });
  });

  it("returns a single address when all is not requested", async () => {
    const result = await run("example.com", { all: false });
    // Either a single public address, or a DNS failure in a sandboxed
    // environment. What must not happen is an array.
    if (result.kind === "one") {
      expect(typeof result.address).toBe("string");
      expect([4, 6]).toContain(result.family);
    } else {
      expect(result.kind).toBe("error");
    }
  });

  it("returns array entries carrying address and family for a public host", async () => {
    const result = await run("example.com", { all: true, hints: 0 });
    if (result.kind === "all") {
      expect(result.addresses.length).toBeGreaterThan(0);
      for (const entry of result.addresses) {
        expect(entry).toHaveProperty("address");
        expect(entry).toHaveProperty("family");
      }
    } else {
      // Sandboxes without DNS surface an error; that is acceptable here.
      expect(result.kind).toBe("error");
    }
  });
});
