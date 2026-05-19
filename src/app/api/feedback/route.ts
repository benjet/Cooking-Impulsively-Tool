import { NextResponse } from "next/server";
import { feedbackRequestSchema } from "@/lib/schemas";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = feedbackRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const p = parsed.data;
  const db = getDb();
  const card = db
    .prepare("SELECT id FROM cards WHERE slug = ?")
    .get(p.cardSlug) as { id: number } | undefined;
  if (!card) {
    return NextResponse.json({ error: "card_not_found" }, { status: 404 });
  }
  db.prepare(
    `INSERT INTO feedback (
       card_id, rating, tags_json, actual_temp_f,
       step_index, ingredient_index, technique, notes, created_at
     ) VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    card.id,
    p.rating,
    JSON.stringify(p.tags),
    p.actualTempF ?? null,
    p.stepIndex ?? null,
    p.ingredientIndex ?? null,
    p.technique ?? null,
    p.notes ?? null,
    Date.now()
  );
  return NextResponse.json({ ok: true });
}
