import { NextResponse } from "next/server";
import { extractRequestSchema } from "@/lib/schemas";
import { extractRecipeFromUrl, type ExtractFailure } from "@/lib/extract";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";

/** Extraction makes an outbound request per call, so it is limited per client. */
const LIMIT = 10;
const WINDOW_MS = 60_000;

/**
 * Failures the caller is allowed to distinguish.
 *
 * Blocked-address and blocked-host rejections are deliberately collapsed into
 * a single generic reason. Reporting them separately would turn this endpoint
 * into an internal network scanner: the difference between "blocked" and
 * "connection refused" leaks whether a host exists.
 */
const CLIENT_SAFE: Record<ExtractFailure, { status: number; error: string }> = {
  no_recipe_found: { status: 422, error: "no_recipe_found" },
  bad_url: { status: 400, error: "invalid_url" },
  bad_scheme: { status: 400, error: "invalid_url" },
  blocked_host: { status: 400, error: "url_not_allowed" },
  blocked_address: { status: 400, error: "url_not_allowed" },
  too_many_redirects: { status: 422, error: "fetch_failed" },
  response_too_large: { status: 422, error: "fetch_failed" },
  bad_content_type: { status: 422, error: "fetch_failed" },
  timeout: { status: 504, error: "fetch_failed" },
  fetch_failed: { status: 422, error: "fetch_failed" },
};

export async function POST(req: Request) {
  const key = clientKey(req.headers);
  const limit = checkRateLimit(`extract:${key}`, LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = extractRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const result = await extractRecipeFromUrl(parsed.data.url);
  if (!result.ok) {
    const mapped = CLIENT_SAFE[result.reason] ?? {
      status: 422,
      error: "fetch_failed",
    };
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  return NextResponse.json({ recipe: result.recipe });
}
