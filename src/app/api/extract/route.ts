import { NextResponse } from "next/server";
import { extractRequestSchema } from "@/lib/schemas";
import { extractRecipeFromUrl } from "@/lib/extract";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = extractRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const result = await extractRecipeFromUrl(parsed.data.url);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 422 });
  }
  return NextResponse.json({ recipe: result.recipe });
}
