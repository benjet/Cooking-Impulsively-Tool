import { describe, it, expect, afterEach } from "vitest";
import { MockAgent } from "undici";
import { safeFetchHtml, UnsafeUrlError } from "./urlSafety";

const UA = "TestBot/1.0";

let agent: MockAgent | null = null;

afterEach(async () => {
  await agent?.close();
  agent = null;
});

function mockAgent(): MockAgent {
  agent = new MockAgent();
  agent.disableNetConnect();
  return agent;
}

async function reasonFor(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "no_error";
  } catch (e) {
    return e instanceof UnsafeUrlError ? e.reason : `other:${e}`;
  }
}

describe("safeFetchHtml — redirect handling", () => {
  it("refuses a redirect that points at the cloud metadata address", async () => {
    // The attack this whole module exists to stop: a public URL that 302s to
    // the instance metadata endpoint. Validating only the submitted URL would
    // sail straight into it.
    const a = mockAgent();
    a.get("https://recipes.example")
      .intercept({ path: "/r" })
      .reply(302, "", {
        headers: { location: "http://169.254.169.254/latest/meta-data/" },
      });

    expect(
      await reasonFor(() => safeFetchHtml("https://recipes.example/r", UA, a))
    ).toBe("blocked_address");
  });

  it("refuses a redirect to a private RFC1918 address", async () => {
    const a = mockAgent();
    a.get("https://recipes.example")
      .intercept({ path: "/r" })
      .reply(301, "", { headers: { location: "http://192.168.1.1/admin" } });

    expect(
      await reasonFor(() => safeFetchHtml("https://recipes.example/r", UA, a))
    ).toBe("blocked_address");
  });

  it("refuses a redirect that changes scheme to file:", async () => {
    const a = mockAgent();
    a.get("https://recipes.example")
      .intercept({ path: "/r" })
      .reply(302, "", { headers: { location: "file:///etc/passwd" } });

    expect(
      await reasonFor(() => safeFetchHtml("https://recipes.example/r", UA, a))
    ).toBe("bad_scheme");
  });

  it("refuses a redirect to localhost", async () => {
    const a = mockAgent();
    a.get("https://recipes.example")
      .intercept({ path: "/r" })
      .reply(302, "", { headers: { location: "http://localhost:5432/" } });

    expect(
      await reasonFor(() => safeFetchHtml("https://recipes.example/r", UA, a))
    ).toBe("blocked_host");
  });

  it("follows a legitimate redirect and reports the final URL", async () => {
    const a = mockAgent();
    a.get("https://recipes.example")
      .intercept({ path: "/old" })
      .reply(301, "", { headers: { location: "https://recipes.example/new" } });
    a.get("https://recipes.example")
      .intercept({ path: "/new" })
      .reply(200, "<html><body>ok</body></html>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      });

    const result = await safeFetchHtml("https://recipes.example/old", UA, a);
    expect(result.html).toContain("ok");
    expect(result.finalUrl).toBe("https://recipes.example/new");
  });

  it("resolves a relative redirect against the current URL", async () => {
    const a = mockAgent();
    a.get("https://recipes.example")
      .intercept({ path: "/a/old" })
      .reply(302, "", { headers: { location: "/a/new" } });
    a.get("https://recipes.example")
      .intercept({ path: "/a/new" })
      .reply(200, "<html>fine</html>", {
        headers: { "content-type": "text/html" },
      });

    const result = await safeFetchHtml("https://recipes.example/a/old", UA, a);
    expect(result.finalUrl).toBe("https://recipes.example/a/new");
  });

  it("gives up after too many redirects", async () => {
    const a = mockAgent();
    // A loop: every request redirects back to the same path.
    for (let i = 0; i < 12; i++) {
      a.get("https://recipes.example")
        .intercept({ path: "/loop" })
        .reply(302, "", { headers: { location: "https://recipes.example/loop" } });
    }

    expect(
      await reasonFor(() => safeFetchHtml("https://recipes.example/loop", UA, a))
    ).toBe("too_many_redirects");
  });
});

describe("safeFetchHtml — response handling", () => {
  it("rejects a non-HTML content type", async () => {
    const a = mockAgent();
    a.get("https://recipes.example")
      .intercept({ path: "/img" })
      .reply(200, "binary", { headers: { "content-type": "image/png" } });

    expect(
      await reasonFor(() => safeFetchHtml("https://recipes.example/img", UA, a))
    ).toBe("bad_content_type");
  });

  it("rejects a response larger than the cap", async () => {
    const a = mockAgent();
    // 3 MiB against a 2 MiB cap.
    a.get("https://recipes.example")
      .intercept({ path: "/huge" })
      .reply(200, "x".repeat(3 * 1024 * 1024), {
        headers: { "content-type": "text/html" },
      });

    expect(
      await reasonFor(() => safeFetchHtml("https://recipes.example/huge", UA, a))
    ).toBe("response_too_large");
  });

  it("treats an upstream error status as a fetch failure", async () => {
    const a = mockAgent();
    a.get("https://recipes.example")
      .intercept({ path: "/404" })
      .reply(404, "nope", { headers: { "content-type": "text/html" } });

    expect(
      await reasonFor(() => safeFetchHtml("https://recipes.example/404", UA, a))
    ).toBe("fetch_failed");
  });

  it("accepts an ordinary HTML page", async () => {
    const a = mockAgent();
    a.get("https://recipes.example")
      .intercept({ path: "/ok" })
      .reply(200, "<html><h1>Pancakes</h1></html>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      });

    const result = await safeFetchHtml("https://recipes.example/ok", UA, a);
    expect(result.html).toContain("Pancakes");
  });

  it("rejects the submitted URL before any request is made", async () => {
    // disableNetConnect means any attempted request would throw; reaching the
    // blocked_address reason proves the check happened first.
    const a = mockAgent();
    expect(
      await reasonFor(() =>
        safeFetchHtml("http://169.254.169.254/latest/meta-data/", UA, a)
      )
    ).toBe("blocked_address");
  });
});
