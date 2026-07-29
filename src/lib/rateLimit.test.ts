import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimits, clientKey } from "./rateLimit";

beforeEach(() => resetRateLimits());

describe("checkRateLimit", () => {
  it("allows up to the limit then blocks", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("k", 3, 60_000, now).allowed).toBe(true);
    }
    expect(checkRateLimit("k", 3, 60_000, now).allowed).toBe(false);
  });

  it("reports remaining requests", () => {
    const now = 1_000_000;
    expect(checkRateLimit("k", 3, 60_000, now).remaining).toBe(2);
    expect(checkRateLimit("k", 3, 60_000, now).remaining).toBe(1);
    expect(checkRateLimit("k", 3, 60_000, now).remaining).toBe(0);
  });

  it("resets after the window elapses", () => {
    const now = 1_000_000;
    checkRateLimit("k", 1, 60_000, now);
    expect(checkRateLimit("k", 1, 60_000, now).allowed).toBe(false);
    expect(checkRateLimit("k", 1, 60_000, now + 60_001).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const now = 1_000_000;
    checkRateLimit("a", 1, 60_000, now);
    expect(checkRateLimit("a", 1, 60_000, now).allowed).toBe(false);
    expect(checkRateLimit("b", 1, 60_000, now).allowed).toBe(true);
  });

  it("reports a retry-after inside the window", () => {
    const now = 1_000_000;
    checkRateLimit("k", 1, 60_000, now);
    const blocked = checkRateLimit("k", 1, 60_000, now + 10_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(50);
  });
});

describe("clientKey", () => {
  it("takes the first hop of x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
    expect(clientKey(h)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip, then to a constant", () => {
    expect(clientKey(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe(
      "203.0.113.9"
    );
    expect(clientKey(new Headers())).toBe("unknown");
  });
});
