import { describe, it, expect } from "vitest";
import { isBlockedAddress, assertSafeUrl, UnsafeUrlError } from "./urlSafety";

function rejectionFor(url: string): string | null {
  try {
    assertSafeUrl(url);
    return null;
  } catch (e) {
    return e instanceof UnsafeUrlError ? e.reason : "unknown";
  }
}

describe("isBlockedAddress — IPv4", () => {
  it("blocks loopback", () => {
    expect(isBlockedAddress("127.0.0.1")).toBe(true);
    expect(isBlockedAddress("127.255.255.254")).toBe(true);
  });

  it("blocks the cloud metadata address", () => {
    // The single most important case: 169.254.169.254 serves instance
    // credentials on AWS, GCP, Azure, and DigitalOcean.
    expect(isBlockedAddress("169.254.169.254")).toBe(true);
  });

  it("blocks RFC1918 private ranges", () => {
    expect(isBlockedAddress("10.0.0.1")).toBe(true);
    expect(isBlockedAddress("172.16.0.1")).toBe(true);
    expect(isBlockedAddress("172.31.255.255")).toBe(true);
    expect(isBlockedAddress("192.168.1.1")).toBe(true);
  });

  it("allows public addresses adjacent to private ranges", () => {
    // 172.15 and 172.32 sit just outside 172.16/12 and must stay reachable.
    expect(isBlockedAddress("172.15.255.255")).toBe(false);
    expect(isBlockedAddress("172.32.0.0")).toBe(false);
    expect(isBlockedAddress("11.0.0.1")).toBe(false);
    expect(isBlockedAddress("9.255.255.255")).toBe(false);
  });

  it("blocks carrier-grade NAT, benchmarking, and documentation ranges", () => {
    expect(isBlockedAddress("100.64.0.1")).toBe(true);
    expect(isBlockedAddress("198.18.0.1")).toBe(true);
    expect(isBlockedAddress("192.0.2.1")).toBe(true);
    expect(isBlockedAddress("203.0.113.1")).toBe(true);
  });

  it("blocks multicast, reserved, and unspecified", () => {
    expect(isBlockedAddress("224.0.0.1")).toBe(true);
    expect(isBlockedAddress("255.255.255.255")).toBe(true);
    expect(isBlockedAddress("0.0.0.0")).toBe(true);
  });

  it("allows ordinary public addresses", () => {
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
    expect(isBlockedAddress("1.1.1.1")).toBe(false);
    expect(isBlockedAddress("151.101.1.140")).toBe(false);
  });
});

describe("isBlockedAddress — IPv6", () => {
  it("blocks loopback and unspecified", () => {
    expect(isBlockedAddress("::1")).toBe(true);
    expect(isBlockedAddress("::")).toBe(true);
  });

  it("unwraps IPv4-mapped addresses and applies the v4 rules", () => {
    // ::ffff:127.0.0.1 is loopback wearing a v6 costume.
    expect(isBlockedAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedAddress("::ffff:169.254.169.254")).toBe(true);
    expect(isBlockedAddress("::ffff:8.8.8.8")).toBe(false);
  });

  it("blocks unique-local and link-local", () => {
    expect(isBlockedAddress("fc00::1")).toBe(true);
    expect(isBlockedAddress("fd12:3456::1")).toBe(true);
    expect(isBlockedAddress("fe80::1")).toBe(true);
  });

  it("strips a zone index before deciding", () => {
    expect(isBlockedAddress("fe80::1%eth0")).toBe(true);
  });

  it("blocks tunnelling ranges that can encapsulate a v4 target", () => {
    expect(isBlockedAddress("2002:7f00:1::")).toBe(true); // 6to4
    expect(isBlockedAddress("64:ff9b::7f00:1")).toBe(true); // NAT64
  });

  it("allows ordinary public addresses", () => {
    expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false);
    expect(isBlockedAddress("2001:4860:4860::8888")).toBe(false);
  });

  it("treats an empty address as blocked", () => {
    expect(isBlockedAddress("")).toBe(true);
  });
});

describe("assertSafeUrl", () => {
  it("accepts ordinary public recipe URLs", () => {
    expect(
      assertSafeUrl("https://www.seriouseats.com/recipe").hostname
    ).toBe("www.seriouseats.com");
    expect(assertSafeUrl("http://example.com/x").protocol).toBe("http:");
  });

  it("rejects non-HTTP schemes", () => {
    expect(rejectionFor("file:///etc/passwd")).toBe("bad_scheme");
    expect(rejectionFor("ftp://example.com/x")).toBe("bad_scheme");
    expect(rejectionFor("gopher://example.com/")).toBe("bad_scheme");
    // data: URLs would otherwise let a caller inline arbitrary content.
    expect(rejectionFor("data:text/html,<h1>hi</h1>")).toBe("bad_scheme");
  });

  it("rejects localhost by name", () => {
    expect(rejectionFor("http://localhost:5432/")).toBe("blocked_host");
    expect(rejectionFor("http://app.localhost/")).toBe("blocked_host");
  });

  it("rejects cloud metadata hostnames", () => {
    expect(rejectionFor("http://metadata.google.internal/")).toBe(
      "blocked_host"
    );
  });

  it("rejects literal private and metadata addresses", () => {
    expect(rejectionFor("http://169.254.169.254/latest/meta-data/")).toBe(
      "blocked_address"
    );
    expect(rejectionFor("http://127.0.0.1:3000/")).toBe("blocked_address");
    expect(rejectionFor("http://[::1]:3000/")).toBe("blocked_address");
    expect(rejectionFor("http://192.168.0.1/")).toBe("blocked_address");
  });

  it("rejects malformed input", () => {
    expect(rejectionFor("not a url")).toBe("bad_url");
    expect(rejectionFor("")).toBe("bad_url");
  });

  it("does not block a public host whose name merely contains 'localhost'", () => {
    // "localhosting.com" is a real, public name; only exact matches and the
    // .localhost suffix should be refused.
    expect(rejectionFor("https://localhosting.com/recipe")).toBeNull();
  });
});
