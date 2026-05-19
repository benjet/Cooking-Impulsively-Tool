import { NextResponse } from "next/server";
import { generateRequestSchema } from "@/lib/schemas";
import { generateAdaptation } from "@/lib/llm";
import { getDb } from "@/lib/db";
import { newSlug } from "@/lib/slug";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { recipe, context } = parsed.data;
  const adaptation = await generateAdaptation(recipe, context);

  const db = getDb();
  const slug = newSlug();
  db.prepare(
    `INSERT INTO cards (
       slug, title, source_name, source_url, yield_text,
       ingredients_json, instructions_json,
       pan_type, experience, goal, user_notes,
       adaptation_json, created_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    slug,
    recipe.title,
    recipe.sourceName,
    recipe.sourceUrl,
    recipe.yieldText,
    JSON.stringify(recipe.ingredients),
    JSON.stringify(recipe.instructions),
    context.panType,
    context.experience,
    context.goal,
    context.userNotes ?? null,
    JSON.stringify(adaptation),
    Date.now()
  );

  return NextResponse.json({ slug });
}
