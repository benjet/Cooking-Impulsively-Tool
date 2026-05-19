import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDb, type CardRow, type CommunityNoteRow } from "@/lib/db";
import type { AdaptationCard } from "@/lib/options";
import { CardView } from "@/components/CardView";
import { ShareButton } from "@/components/ShareButton";
import { Disclaimer } from "@/components/Disclaimer";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ thanks?: string }>;
};

function loadCard(slug: string): CardRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM cards WHERE slug = ?").get(slug) as
    | CardRow
    | undefined;
}

function loadCommunityNotes(cardId: number): CommunityNoteRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM community_notes WHERE card_id = ? AND status = 'approved' ORDER BY decided_at DESC"
    )
    .all(cardId) as CommunityNoteRow[];
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const row = loadCard(slug);
  if (!row) return { title: "Card not found · Cooking Impulsively" };
  return {
    title: `${row.title} · Cooking Impulsively`,
    description: `Impulse cooktop adaptation card for ${row.title}. Independent project — not affiliated with Impulse Labs. Use alongside the original recipe.`,
  };
}

export default async function CardPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { thanks } = await searchParams;
  const row = loadCard(slug);
  if (!row) notFound();

  const adaptation = JSON.parse(row.adaptation_json) as AdaptationCard;
  const notes = loadCommunityNotes(row.id);

  return (
    <div className="space-y-6">
      {thanks && (
        <div className="rounded border border-emerald-300 bg-emerald-50 text-emerald-900 px-4 py-3 text-sm">
          Thanks for the feedback — it&apos;s in the queue for review.
        </div>
      )}

      <Disclaimer />

      <CardView
        title={row.title}
        sourceName={row.source_name}
        sourceUrl={row.source_url}
        yieldText={row.yield_text}
        panType={row.pan_type}
        experience={row.experience}
        goal={row.goal}
        adaptation={adaptation}
      />

      {notes.length > 0 && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="font-semibold text-emerald-900 mb-2">
            Community-tested notes
          </h2>
          <ul className="space-y-2 text-sm text-emerald-900">
            {notes.map((n) => (
              <li key={n.id}>• {n.note}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
        <div className="flex gap-2">
          <Link
            href={`/c/${row.slug}/feedback`}
            className="bg-impulse-600 text-white px-4 py-2 rounded font-medium"
          >
            How did it go?
          </Link>
          <ShareButton slug={row.slug} />
        </div>
        <Link href="/new" className="text-sm text-stone-600 hover:underline">
          + Make another card
        </Link>
      </div>
    </div>
  );
}
