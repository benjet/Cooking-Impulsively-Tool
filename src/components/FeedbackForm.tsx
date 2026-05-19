"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FEEDBACK_TAGS, type FeedbackTag } from "@/lib/options";

type Props = {
  cardSlug: string;
  stepCount: number;
  ingredientCount: number;
};

export function FeedbackForm({ cardSlug, stepCount, ingredientCount }: Props) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<FeedbackTag[]>([]);
  const [actualTemp, setActualTemp] = useState("");
  const [stepIndex, setStepIndex] = useState("");
  const [ingredientIndex, setIngredientIndex] = useState("");
  const [technique, setTechnique] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(t: FeedbackTag) {
    setTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  async function submit() {
    if (rating < 1) {
      setError("Please pick a star rating.");
      return;
    }
    setBusy(true);
    setError(null);

    const body: Record<string, unknown> = {
      cardSlug,
      rating,
      tags,
    };
    const tempNum = parseInt(actualTemp, 10);
    if (Number.isFinite(tempNum)) body.actualTempF = tempNum;
    const si = parseInt(stepIndex, 10);
    if (Number.isFinite(si)) body.stepIndex = si - 1;
    const ii = parseInt(ingredientIndex, 10);
    if (Number.isFinite(ii)) body.ingredientIndex = ii - 1;
    if (technique.trim()) body.technique = technique.trim();
    if (notes.trim()) body.notes = notes.trim();

    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Couldn't save feedback.");
      setBusy(false);
      return;
    }
    router.push(`/c/${cardSlug}?thanks=1`);
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Did the adaptation work?
        </label>
        <div className="flex gap-1 text-2xl">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className={n <= rating ? "text-impulse-600" : "text-stone-300"}
              aria-label={`${n} stars`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          What happened? (pick any)
        </label>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_TAGS.map((t) => {
            const on = tags.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={
                  "text-sm px-3 py-1.5 rounded-full border " +
                  (on
                    ? "bg-impulse-600 text-white border-impulse-600"
                    : "bg-white text-stone-700 border-stone-300")
                }
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Actual temperature used (°F)">
          <input
            type="number"
            value={actualTemp}
            onChange={(e) => setActualTemp(e.target.value)}
            className="w-full rounded border border-stone-300 px-2 py-1.5"
            placeholder="e.g. 425"
          />
        </Field>
        <Field
          label={`Step this applies to (1–${stepCount})`}
          disabled={stepCount === 0}
        >
          <input
            type="number"
            min={1}
            max={stepCount}
            value={stepIndex}
            onChange={(e) => setStepIndex(e.target.value)}
            className="w-full rounded border border-stone-300 px-2 py-1.5"
          />
        </Field>
        <Field
          label={`Ingredient (1–${ingredientCount})`}
          disabled={ingredientCount === 0}
        >
          <input
            type="number"
            min={1}
            max={ingredientCount}
            value={ingredientIndex}
            onChange={(e) => setIngredientIndex(e.target.value)}
            className="w-full rounded border border-stone-300 px-2 py-1.5"
          />
        </Field>
      </div>

      <Field label="Technique (optional)">
        <input
          value={technique}
          onChange={(e) => setTechnique(e.target.value)}
          placeholder="e.g. sear, simmer, fond development"
          className="w-full rounded border border-stone-300 px-2 py-1.5"
        />
      </Field>

      <Field label="Notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full rounded border border-stone-300 px-2 py-1.5"
          placeholder="What would you tell the next cook?"
        />
      </Field>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 text-red-800 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={submit}
          disabled={busy}
          className="bg-impulse-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {busy ? "Saving…" : "Submit feedback"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className={"space-y-1 " + (disabled ? "opacity-50" : "")}>
      <label className="block text-sm font-medium text-stone-700">
        {label}
      </label>
      {children}
    </div>
  );
}
