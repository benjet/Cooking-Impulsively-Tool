/**
 * Fixed-window rate limiter.
 *
 * IMPORTANT: this is in-memory and therefore per-instance. On a single dev or
 * single-server deployment it is a real limit; across serverless instances it
 * degrades to "roughly N per instance per window", which is a speed bump
 * rather than a control.
 *
 * It is here because extraction makes an outbound request on behalf of an
 * anonymous caller, so an unlimited endpoint is both a cost problem and a way
 * to use this server as a proxy for scanning third-party sites. Shared storage
 * (Upstash or Supabase) plus Cloudflare Turnstile replace this in Phase B/C —
 * see IMPLEMENTATION_GUIDE section 11.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Bound the map so a flood of distinct keys cannot grow it without limit. */
const MAX_TRACKED_KEYS = 10_000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
};

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    if (buckets.size >= MAX_TRACKED_KEYS) evictExpired(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.max(0, Math.ceil((existing.resetAt - now) / 1000));

  if (existing.count > limit) {
    return { allowed: false, remaining: 0, retryAfter };
  }
  return { allowed: true, remaining: limit - existing.count, retryAfter };
}

function evictExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
  // Still full of live entries: drop the oldest-resetting to bound memory.
  if (buckets.size >= MAX_TRACKED_KEYS) {
    const oldest = [...buckets.entries()]
      .sort((a, b) => a[1].resetAt - b[1].resetAt)
      .slice(0, Math.floor(MAX_TRACKED_KEYS / 10));
    for (const [key] of oldest) buckets.delete(key);
  }
}

/** Test seam. */
export function resetRateLimits() {
  buckets.clear();
}

/**
 * Best-effort client identity from proxy headers.
 *
 * These headers are attacker-controlled unless a trusted proxy sets them, so
 * this is not an identity for anything security-critical — only for spreading
 * out cost. Vercel sets x-forwarded-for reliably.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
