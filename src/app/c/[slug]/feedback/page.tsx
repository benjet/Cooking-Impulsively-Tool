import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, type CardRow } from "@/lib/db";
import { FeedbackForm } from "@/components/FeedbackForm";

type PageProps = { params: Promise<{ slug: string }> };

export default async function FeedbackPage({ params }: PageProps) {
  const { slug } = await params;
  const row = getDb()
    .prepare("SELECT * FROM cards WHERE slug = ?")
    .get(slug) as CardRow | undefined;
  if (!row) notFound();

  const ingredients = JSON.parse(row.ingredients_json) as string[];
  const instructions = JSON.parse(row.instructions_json) as string[];

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/c/${row.slug}`}
          className="text-sm text-stone-600 hover:underline"
        >
          ← Back to card
        </Link>
      </div>
      <h1 className="text-2xl font-bold">How did it go?</h1>
      <p className="text-stone-600">
        Your feedback is stored against this card&apos;s recipe step,
        ingredient, technique, pan type, and suggested temperature. We
        aggregate it and review before promoting any community-tested notes —
        one review never changes the recommendation by itself.
      </p>
      <FeedbackForm
        cardSlug={row.slug}
        stepCount={instructions.length}
        ingredientCount={ingredients.length}
      />
    </div>
  );
}
