"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListEditor } from "@/components/IngredientEditor";
import {
  EXPERIENCE,
  GOALS,
  PAN_TYPES,
  type CookingContext,
  type ExtractedRecipe,
  type Experience,
  type Goal,
  type PanType,
} from "@/lib/options";

type Stage = "url" | "confirm" | "context";

export default function NewCardPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("url");
  const [url, setUrl] = useState("");
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recipe, setRecipe] = useState<ExtractedRecipe>({
    title: "",
    sourceName: null,
    sourceUrl: null,
    yieldText: null,
    ingredients: [""],
    instructions: [""],
  });

  const [panType, setPanType] = useState<PanType>(PAN_TYPES[0]);
  const [experience, setExperience] = useState<Experience>(EXPERIENCE[1]);
  const [goal, setGoal] = useState<Goal>(GOALS[0]);
  const [userNotes, setUserNotes] = useState("");

  async function handleExtract() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(
          j.error === "no_recipe_found"
            ? "We couldn't find structured recipe data on that page. Paste the ingredients and instructions below instead."
            : "Couldn't fetch that URL. Check the link or paste manually."
        );
        setManual(true);
        setRecipe((r) => ({ ...r, sourceUrl: url || null }));
        setStage("confirm");
        return;
      }
      const j = await res.json();
      setRecipe(j.recipe);
      setManual(false);
      setStage("confirm");
    } catch {
      setError("Network error. Try again or paste manually.");
      setManual(true);
      setRecipe((r) => ({ ...r, sourceUrl: url || null }));
      setStage("confirm");
    } finally {
      setBusy(false);
    }
  }

  function goManual() {
    setManual(true);
    setRecipe({
      title: "",
      sourceName: null,
      sourceUrl: url || null,
      yieldText: null,
      ingredients: [""],
      instructions: [""],
    });
    setStage("confirm");
  }

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    try {
      const cleaned: ExtractedRecipe = {
        ...recipe,
        title: recipe.title.trim(),
        ingredients: recipe.ingredients.map((s) => s.trim()).filter(Boolean),
        instructions: recipe.instructions.map((s) => s.trim()).filter(Boolean),
      };
      if (!cleaned.title) {
        setError("Please add a title.");
        setBusy(false);
        return;
      }
      if (!cleaned.ingredients.length || !cleaned.instructions.length) {
        setError("Need at least one ingredient and one instruction.");
        setBusy(false);
        return;
      }
      const context: CookingContext = {
        panType,
        experience,
        goal,
        userNotes: userNotes.trim() || undefined,
      };
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe: cleaned, context }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Generation failed.");
        setBusy(false);
        return;
      }
      const j = await res.json();
      router.push(`/c/${j.slug}`);
    } catch {
      setError("Network error during generation.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <StageBar stage={stage} />

      {stage === "url" && (
        <section className="space-y-4">
          <h1 className="text-2xl font-bold">Paste a recipe URL</h1>
          <p className="text-stone-600">
            We&apos;ll extract the title, ingredients, yield, and steps. The card
            we generate won&apos;t republish the recipe — it links back to the
            source.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.seriouseats.com/..."
              className="flex-1 rounded border border-stone-300 px-3 py-2"
            />
            <button
              onClick={handleExtract}
              disabled={busy || !url}
              className="bg-impulse-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {busy ? "Extracting…" : "Extract"}
            </button>
          </div>
          <div className="text-sm text-stone-500">
            Extraction failing?{" "}
            <button
              onClick={goManual}
              className="text-impulse-700 hover:underline"
            >
              Paste ingredients and instructions manually
            </button>
            .
          </div>
          {error && <ErrorBox>{error}</ErrorBox>}
        </section>
      )}

      {stage === "confirm" && (
        <section className="space-y-5">
          <h1 className="text-2xl font-bold">
            {manual ? "Paste recipe details" : "Confirm what we found"}
          </h1>
          {error && <ErrorBox>{error}</ErrorBox>}
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Title">
              <input
                value={recipe.title}
                onChange={(e) =>
                  setRecipe({ ...recipe, title: e.target.value })
                }
                className="w-full rounded border border-stone-300 px-2 py-1.5"
              />
            </Field>
            <Field label="Source URL">
              <input
                value={recipe.sourceUrl ?? ""}
                onChange={(e) =>
                  setRecipe({ ...recipe, sourceUrl: e.target.value || null })
                }
                className="w-full rounded border border-stone-300 px-2 py-1.5"
              />
            </Field>
            <Field label="Source name">
              <input
                value={recipe.sourceName ?? ""}
                onChange={(e) =>
                  setRecipe({ ...recipe, sourceName: e.target.value || null })
                }
                className="w-full rounded border border-stone-300 px-2 py-1.5"
              />
            </Field>
            <Field label="Yield">
              <input
                value={recipe.yieldText ?? ""}
                onChange={(e) =>
                  setRecipe({ ...recipe, yieldText: e.target.value || null })
                }
                placeholder="e.g. 4 servings"
                className="w-full rounded border border-stone-300 px-2 py-1.5"
              />
            </Field>
          </div>

          <ListEditor
            items={recipe.ingredients}
            onChange={(v) => setRecipe({ ...recipe, ingredients: v })}
            label="Ingredients"
            placeholder="e.g. 2 tbsp olive oil"
          />

          <ListEditor
            items={recipe.instructions}
            onChange={(v) => setRecipe({ ...recipe, instructions: v })}
            label="Instructions"
            placeholder="e.g. Heat the pan over medium-high heat…"
          />

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStage("url")}
              className="text-stone-600 hover:text-stone-900"
            >
              ← Back
            </button>
            <button
              onClick={() => setStage("context")}
              className="bg-impulse-600 text-white px-4 py-2 rounded"
            >
              Looks right →
            </button>
          </div>
        </section>
      )}

      {stage === "context" && (
        <section className="space-y-5">
          <h1 className="text-2xl font-bold">Your cooking context</h1>
          <p className="text-stone-600">
            This tells us how to tune the Impulse settings to your setup.
          </p>
          {error && <ErrorBox>{error}</ErrorBox>}

          <Field label="Pan type">
            <select
              value={panType}
              onChange={(e) => setPanType(e.target.value as PanType)}
              className="w-full rounded border border-stone-300 px-2 py-1.5"
            >
              {PAN_TYPES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Experience">
            <div className="flex flex-wrap gap-2">
              {EXPERIENCE.map((e) => (
                <label
                  key={e}
                  className={
                    "px-3 py-1.5 rounded border cursor-pointer text-sm " +
                    (experience === e
                      ? "bg-impulse-600 text-white border-impulse-600"
                      : "bg-white border-stone-300")
                  }
                >
                  <input
                    type="radio"
                    name="exp"
                    className="sr-only"
                    checked={experience === e}
                    onChange={() => setExperience(e)}
                  />
                  {e}
                </label>
              ))}
            </div>
          </Field>

          <Field label="What are you trying to do?">
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as Goal)}
              className="w-full rounded border border-stone-300 px-2 py-1.5"
            >
              {GOALS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Anything else? (optional)">
            <textarea
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              rows={3}
              className="w-full rounded border border-stone-300 px-2 py-1.5"
              placeholder="e.g. cooking for kids, want it a little less spicy"
            />
          </Field>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStage("confirm")}
              className="text-stone-600 hover:text-stone-900"
            >
              ← Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={busy}
              className="bg-impulse-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {busy ? "Generating…" : "Generate adaptation card"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-stone-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-red-300 bg-red-50 text-red-800 px-3 py-2 text-sm">
      {children}
    </div>
  );
}

function StageBar({ stage }: { stage: Stage }) {
  const stages: Stage[] = ["url", "confirm", "context"];
  const labels: Record<Stage, string> = {
    url: "Recipe URL",
    confirm: "Confirm",
    context: "Context",
  };
  return (
    <ol className="flex items-center gap-2 text-sm">
      {stages.map((s, i) => {
        const active = s === stage;
        const done = stages.indexOf(stage) > i;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className={
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold " +
                (active
                  ? "bg-impulse-600 text-white"
                  : done
                  ? "bg-impulse-200 text-impulse-900"
                  : "bg-stone-200 text-stone-500")
              }
            >
              {i + 1}
            </span>
            <span
              className={
                active ? "font-semibold text-stone-900" : "text-stone-500"
              }
            >
              {labels[s]}
            </span>
            {i < stages.length - 1 && (
              <span className="text-stone-300">›</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
