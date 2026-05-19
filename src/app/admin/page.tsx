import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";

type FeedbackJoinRow = {
  id: number;
  card_id: number;
  card_slug: string;
  card_title: string;
  rating: number;
  tags_json: string;
  actual_temp_f: number | null;
  step_index: number | null;
  ingredient_index: number | null;
  technique: string | null;
  notes: string | null;
  created_at: number;
};

type AggregateRow = {
  pan_type: string;
  goal: string;
  n: number;
  avg_rating: number;
  avg_temp: number | null;
};

type TagCountRow = { tag: string; n: number };

type PendingNoteRow = {
  id: number;
  card_id: number | null;
  card_title: string | null;
  card_slug: string | null;
  note: string;
  created_at: number;
};

export default async function AdminDashboard() {
  if (!(await isAdmin())) redirect("/admin/login");

  const db = getDb();

  const recent = db
    .prepare(
      `SELECT f.id, f.card_id, c.slug AS card_slug, c.title AS card_title,
              f.rating, f.tags_json, f.actual_temp_f, f.step_index,
              f.ingredient_index, f.technique, f.notes, f.created_at
         FROM feedback f
         JOIN cards c ON c.id = f.card_id
        ORDER BY f.created_at DESC
        LIMIT 50`
    )
    .all() as FeedbackJoinRow[];

  const aggregates = db
    .prepare(
      `SELECT c.pan_type, c.goal,
              COUNT(*) AS n,
              ROUND(AVG(f.rating), 2) AS avg_rating,
              ROUND(AVG(f.actual_temp_f), 0) AS avg_temp
         FROM feedback f
         JOIN cards c ON c.id = f.card_id
        GROUP BY c.pan_type, c.goal
        ORDER BY n DESC`
    )
    .all() as AggregateRow[];

  const tagCounts = db
    .prepare(
      `SELECT je.value AS tag, COUNT(*) AS n
         FROM feedback f, json_each(f.tags_json) je
        GROUP BY je.value
        ORDER BY n DESC`
    )
    .all() as TagCountRow[];

  const pending = db
    .prepare(
      `SELECT n.id, n.card_id, c.title AS card_title, c.slug AS card_slug,
              n.note, n.created_at
         FROM community_notes n
         LEFT JOIN cards c ON c.id = n.card_id
        WHERE n.status = 'pending'
        ORDER BY n.created_at DESC`
    )
    .all() as PendingNoteRow[];

  async function decide(formData: FormData) {
    "use server";
    if (!(await isAdmin())) redirect("/admin/login");
    const id = Number(formData.get("id"));
    const status = String(formData.get("status"));
    if (!Number.isFinite(id) || (status !== "approved" && status !== "rejected"))
      return;
    getDb()
      .prepare(
        "UPDATE community_notes SET status = ?, decided_at = ? WHERE id = ?"
      )
      .run(status, Date.now(), id);
  }

  async function logout() {
    "use server";
    const c = await cookies();
    c.delete(ADMIN_COOKIE);
    redirect("/admin/login");
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin dashboard</h1>
        <form action={logout}>
          <button className="text-sm text-stone-500 hover:text-red-600">
            Log out
          </button>
        </form>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Aggregates by pan × goal ({aggregates.length})
        </h2>
        {aggregates.length === 0 ? (
          <Empty>No feedback yet.</Empty>
        ) : (
          <div className="overflow-x-auto rounded border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-stone-600">
                <tr>
                  <Th>Pan</Th>
                  <Th>Goal</Th>
                  <Th>N</Th>
                  <Th>Avg rating</Th>
                  <Th>Avg actual temp °F</Th>
                </tr>
              </thead>
              <tbody>
                {aggregates.map((a, i) => (
                  <tr key={i} className="border-t border-stone-100">
                    <Td>{a.pan_type}</Td>
                    <Td>{a.goal}</Td>
                    <Td>{a.n}</Td>
                    <Td>{a.avg_rating ?? "—"}</Td>
                    <Td>{a.avg_temp ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tag counts</h2>
        {tagCounts.length === 0 ? (
          <Empty>No tagged feedback yet.</Empty>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tagCounts.map((t) => (
              <span
                key={t.tag}
                className="text-sm rounded-full bg-stone-100 border border-stone-200 px-3 py-1"
              >
                {t.tag} <span className="text-stone-500">· {t.n}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Pending community notes ({pending.length})
        </h2>
        <p className="text-xs text-stone-500">
          Approved notes appear on the related card. No notes are promoted
          automatically — every one is reviewed here first.
        </p>
        {pending.length === 0 ? (
          <Empty>Nothing pending.</Empty>
        ) : (
          <ul className="space-y-2">
            {pending.map((n) => (
              <li
                key={n.id}
                className="rounded border border-stone-200 bg-white p-3"
              >
                <div className="text-sm text-stone-600">
                  {n.card_slug ? (
                    <Link
                      href={`/c/${n.card_slug}`}
                      className="text-impulse-700 hover:underline"
                    >
                      {n.card_title}
                    </Link>
                  ) : (
                    <span>(no card)</span>
                  )}{" "}
                  · {new Date(n.created_at).toLocaleString()}
                </div>
                <div className="mt-1">{n.note}</div>
                <div className="mt-2 flex gap-2">
                  <form action={decide}>
                    <input type="hidden" name="id" value={n.id} />
                    <input type="hidden" name="status" value="approved" />
                    <button className="text-sm bg-emerald-600 text-white px-3 py-1 rounded">
                      Approve
                    </button>
                  </form>
                  <form action={decide}>
                    <input type="hidden" name="id" value={n.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <button className="text-sm bg-stone-200 text-stone-800 px-3 py-1 rounded">
                      Reject
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent feedback ({recent.length})</h2>
        {recent.length === 0 ? (
          <Empty>No feedback rows yet.</Empty>
        ) : (
          <div className="overflow-x-auto rounded border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-stone-600">
                <tr>
                  <Th>When</Th>
                  <Th>Card</Th>
                  <Th>Rating</Th>
                  <Th>Tags</Th>
                  <Th>Temp °F</Th>
                  <Th>Step</Th>
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => {
                  const tags = (JSON.parse(r.tags_json) as string[]).join(", ");
                  return (
                    <tr key={r.id} className="border-t border-stone-100 align-top">
                      <Td>{new Date(r.created_at).toLocaleString()}</Td>
                      <Td>
                        <Link
                          href={`/c/${r.card_slug}`}
                          className="text-impulse-700 hover:underline"
                        >
                          {r.card_title}
                        </Link>
                      </Td>
                      <Td>{r.rating}★</Td>
                      <Td>{tags || "—"}</Td>
                      <Td>{r.actual_temp_f ?? "—"}</Td>
                      <Td>
                        {r.step_index !== null ? r.step_index + 1 : "—"}
                      </Td>
                      <Td className="max-w-xs">{r.notes ?? "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left font-medium px-3 py-2 whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={"px-3 py-2 " + className}>{children}</td>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-500">
      {children}
    </div>
  );
}
