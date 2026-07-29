# Cooking Impulsively — MVP Build Plan

## Context

This is a greenfield build (working directory is empty). The product is a web app that helps home cooks adapt arbitrary internet recipes to the Impulse induction cooktop. The user pastes a recipe URL, the app extracts structured recipe data, the user confirms the extraction and selects cooking context (pan, experience, goal), and the app generates an *adaptation card* — not a republished recipe, but a set of Impulse-specific notes: mode, temperature/power range, timing adjustments, sensory cues, pan cautions, and safety reminders. After cooking, users submit structured feedback; an admin can review aggregated feedback before promoting community-tested notes.

The product is independent and not affiliated with Impulse Labs. Every page and card must say so.

This plan covers a single-deployable MVP that runs locally on Windows and can be deployed to Vercel later.

## Stack (confirmed with user)

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS**
- **SQLite** via `better-sqlite3` (single file at `./data/app.db`)
- **LLM: stubbed** — `lib/llm.ts` exports `generateAdaptation()` returning a deterministic mock derived from heuristics over the recipe text. Real Claude/OpenAI call swaps in later behind the same interface.
- **Admin auth: single shared password** from `ADMIN_PASSWORD` env var; sets an httpOnly cookie via a server action.
- **Save/share: anonymous public slugs** (`/c/[slug]`). No user accounts.
- **Validation:** `zod` for all API inputs.
- **HTML parsing for recipe extraction:** `cheerio` + manual JSON-LD / microdata parsing (no external recipe-scraper dependency — schema.org/Recipe coverage is high and the surface is small).

## Routes

### Pages (App Router)
- `/` — Landing page. Hero, "how it works" 3-step blurb, big CTA to `/new`, prominent disclaimer.
- `/new` — Single client-driven flow with three stages held in URL state (`?stage=url|confirm|context`) so back-button works:
  1. **URL input** (with "paste manually instead" toggle revealing ingredients + instructions textareas).
  2. **Confirmation** — show extracted title, source, yield, ingredients (editable list), instructions (editable list). Allow add/remove/edit before continuing.
  3. **Context** — pan type (select), experience level (radio), cooking goal (select), optional free-text "anything else".
- `/c/[slug]` — Generated adaptation card. Also the feedback entry point: prominent "How did it go?" button → `/c/[slug]/feedback`. Card view includes share button (copies URL) and link back to original source. Disclaimer on every card.
- `/c/[slug]/feedback` — Post-cook feedback form: 5-star "did the adaptation work?", multi-select tags, optional actual temperature used (°F), optional step index this applies to, optional free-text. Submits and redirects to a thank-you state on the card page.
- `/admin/login` — Password form.
- `/admin` — Dashboard: list of feedback (most recent first, filterable by tag/pan/goal), aggregate counts grouped by `(pan_type, goal, suggested_temp_range)`, queue of pending community notes (approve/reject buttons).

### API / server actions
- `POST /api/extract` — `{ url: string }` → `{ title, source, sourceUrl, yieldText, ingredients[], instructions[] }` or `{ error: "extraction_failed" }`. Fetches URL server-side, parses with cheerio, returns first schema.org/Recipe found (JSON-LD preferred, microdata fallback).
- `POST /api/generate` — `{ recipe, context }` → `{ slug }`. Calls `generateAdaptation()`, persists `cards` row, returns slug.
- `POST /api/feedback` — `{ cardSlug, rating, tags[], actualTempF?, stepIndex?, ingredientIndex?, technique?, notes? }` → `{ ok: true }`. Persists `feedback` row.
- Admin actions are server actions on `/admin` pages (no separate API surface needed). Password check via cookie middleware on `/admin/*` (except `/admin/login`).

## Data model (`lib/db.ts`)

One SQLite file, three tables:

```sql
CREATE TABLE cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,            -- nanoid(10)
  title TEXT NOT NULL,
  source_name TEXT,
  source_url TEXT,
  yield_text TEXT,
  ingredients_json TEXT NOT NULL,       -- string[]
  instructions_json TEXT NOT NULL,      -- string[]
  pan_type TEXT NOT NULL,
  experience TEXT NOT NULL,
  goal TEXT NOT NULL,
  user_notes TEXT,
  adaptation_json TEXT NOT NULL,        -- AdaptationCard (see below)
  created_at INTEGER NOT NULL
);

CREATE TABLE feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id),
  rating INTEGER NOT NULL,              -- 1..5
  tags_json TEXT NOT NULL,              -- string[]
  actual_temp_f INTEGER,
  step_index INTEGER,
  ingredient_index INTEGER,
  technique TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE community_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER REFERENCES cards(id),
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|approved|rejected
  created_at INTEGER NOT NULL,
  decided_at INTEGER
);

CREATE INDEX idx_feedback_card ON feedback(card_id);
CREATE INDEX idx_feedback_tags ON feedback(tags_json);   -- still useful for substring scans
```

`AdaptationCard` shape (TypeScript, also the JSON stored in `cards.adaptation_json`):

```ts
type AdaptationCard = {
  impulseMode: "Precise" | "Boost" | "Simmer" | "Sear" | "Custom";
  tempRangeF: { min: number; max: number } | null;
  powerLevel: number | null;          // 1..10 if temp not applicable
  timingNotes: string;                 // e.g. "Reduce sear time by ~20%"
  cues: { visual: string[]; auditory: string[]; smell: string[] };
  panCautions: string[];
  safetyReminders: string[];
  confidence: "low" | "medium" | "high";
  rationale: string;                   // 1-2 sentences explaining the suggestion
};
```

## Recipe extraction (`lib/extract.ts`)

1. `fetch(url)` server-side with a desktop User-Agent and 8s timeout.
2. Parse HTML with `cheerio`.
3. Find all `<script type="application/ld+json">`. JSON-parse each (tolerating arrays and `@graph`). Walk to find the first node with `@type` equal to `"Recipe"` (or array containing it).
4. Map fields: `name → title`, `recipeIngredient[] → ingredients`, `recipeInstructions → instructions` (handle string, `HowToStep`, and `HowToSection` shapes — flatten sections into prefixed steps).
5. `recipeYield`, `author.name` or site name from `og:site_name`, canonical URL.
6. If no JSON-LD Recipe, fallback: microdata via `[itemtype*="schema.org/Recipe"]` selectors.
7. If still nothing, return `{ error: "extraction_failed" }`. UI then surfaces the manual paste form, prefilled with `{ source: url, title: "" }`.

## LLM stub (`lib/llm.ts`)

```ts
export async function generateAdaptation(
  recipe: ExtractedRecipe,
  context: CookingContext
): Promise<AdaptationCard>
```

Stub heuristic (single function, easy to read, easy to replace):
- Concatenate instructions to lowercase text.
- Keyword buckets drive `impulseMode` and `tempRangeF`:
  - "sear", "blacken", "crust", "screaming hot" → `Sear`, 450–500°F, confidence high
  - "fry", "deep fry", "shallow fry" → `Precise`, 350–375°F
  - "sauté", "sweat", "soften" → `Precise`, 275–325°F
  - "simmer", "reduce", "low and slow" → `Simmer`, 180–210°F
  - "boil", "rolling boil" → `Boost`, no temp (power 10)
  - default → `Precise`, 300–350°F, confidence low
- Pan cautions: e.g. nonstick + sear keyword → "Avoid temperatures above 400°F in nonstick — switch pans for searing."
- Cues: pull short canned strings keyed off mode (e.g. Sear → visual "deep mahogany crust", auditory "active sizzle that fades as moisture leaves").
- Safety reminders: always include "Don't leave hot oil unattended"; add "Vent the hood — high-heat searing produces smoke" when mode is Sear.
- Timing: parse first integer-minute mentions per step and suggest "trim 15–20%" if mode is Boost or Sear (induction is faster than gas at high power).
- Confidence: high if ≥3 heat-word matches found, medium if 1–2, low otherwise.
- Rationale: 1-sentence summary string-templated from matched keywords.

The interface is what matters; the heuristic just needs to be plausible for demos.

## Cooking context options

Defined as constants in `lib/options.ts` and used everywhere:

```ts
PAN_TYPES = ["Cast iron", "Carbon steel", "Stainless clad (3-ply/5-ply)",
             "Enameled cast iron", "Induction-safe nonstick",
             "Aluminum-clad (induction-safe)"];
EXPERIENCE = ["Beginner", "Intermediate", "Confident"];
GOALS = ["Sear", "Sauté", "Simmer", "Shallow fry", "Deep fry",
         "Boil / pasta water", "Reduce sauce", "Melt / temper", "Stir-fry"];
FEEDBACK_TAGS = ["worked well", "too hot", "too cool", "timing off",
                 "browned too fast", "did not brown enough",
                 "stuck to pan", "scorched"];
```

## Admin dashboard

- Middleware: `/admin/*` (except `/admin/login`) requires `admin=1` httpOnly cookie. Cookie is set by a server action on `/admin/login` after comparing form input to `process.env.ADMIN_PASSWORD` with a constant-time check.
- Dashboard tabs (simple links, no SPA needed):
  - **Recent feedback** — table: time, card title, rating, tags, temp, notes.
  - **Aggregates** — for each `(pan_type, goal)` pair: count of feedback, average rating, most common tags, suggested-temp distribution. Computed in a single SQL query per pair group with `json_each` for tag expansion.
  - **Community notes queue** — pending notes with approve/reject buttons. Approving sets status=approved and surfaces the note on the related card page in a "community notes" section. No automatic recommendation changes — per the spec.

## Disclaimers

A `<Disclaimer />` component used in three places:
- Landing page footer.
- Above the generated card content.
- Inside the share preview / OG description.

Text: *"Cooking Impulsively is an independent project. It is not affiliated with, endorsed by, or sponsored by Impulse Labs. Always use this card alongside the original recipe and your own judgment."*

## Files to create

```
package.json
tsconfig.json
tailwind.config.ts
next.config.ts
postcss.config.mjs
.env.example                    # ADMIN_PASSWORD=
.gitignore                      # /data, /.next, /node_modules, /.env
src/app/layout.tsx              # Tailwind globals, footer disclaimer
src/app/page.tsx                # Landing
src/app/new/page.tsx            # Multi-stage flow (client component, URL-state driven)
src/app/c/[slug]/page.tsx       # Card view (server component)
src/app/c/[slug]/feedback/page.tsx
src/app/admin/login/page.tsx
src/app/admin/page.tsx
src/app/admin/layout.tsx        # cookie check
src/app/api/extract/route.ts
src/app/api/generate/route.ts
src/app/api/feedback/route.ts
src/components/Disclaimer.tsx
src/components/CardView.tsx
src/components/IngredientEditor.tsx
src/components/InstructionEditor.tsx
src/components/FeedbackForm.tsx
src/lib/db.ts                   # better-sqlite3 init + migrations
src/lib/extract.ts
src/lib/llm.ts                  # stub generateAdaptation
src/lib/options.ts              # PAN_TYPES, EXPERIENCE, GOALS, FEEDBACK_TAGS
src/lib/schemas.ts              # zod schemas
src/lib/slug.ts                 # nanoid wrapper
src/lib/admin.ts                # password / cookie helpers
src/app/globals.css
data/.gitkeep                   # SQLite file lives here at runtime
```

## Build order

1. **Bootstrap** — `package.json`, Next.js config, Tailwind, `.env.example`, `globals.css`, layout, Disclaimer component, landing page.
2. **DB + options + schemas** — `lib/db.ts` (auto-creates tables on import), `lib/options.ts`, `lib/schemas.ts`, `lib/slug.ts`.
3. **Extraction** — `lib/extract.ts` + `POST /api/extract` + tests against 3–4 known recipe sites (NYT Cooking, Serious Eats, Bon Appétit, a personal blog).
4. **New-recipe flow** — `/new` page with three stages, ingredient/instruction editors, "paste manually" fallback when extraction fails.
5. **LLM stub + generation** — `lib/llm.ts` heuristic, `POST /api/generate`, persist card, redirect to `/c/[slug]`.
6. **Card view** — `/c/[slug]/page.tsx` renders the AdaptationCard, share button, original-source link, "How did it go?" CTA.
7. **Feedback** — `/c/[slug]/feedback/page.tsx`, `POST /api/feedback`, thank-you state.
8. **Admin** — login, middleware, dashboard with recent/aggregate/notes tabs.

## Stage 3/4 enhancement build spec

The next build should prioritize trust in the generated card before database normalization or public-library work. The sequence is:

1. **Rendering layer first.**
   - Add `src/contexts/UnitContext.tsx` with `UnitProvider`, `useUnit`, `setUnit`, `toggle`, and `isExplicit`.
   - Add `src/lib/temperature.ts` with `fToC`, `cToF`, `formatTemp`, and `renderTemperature`.
   - Add `src/components/NarrativeText.tsx` to resolve `{{temp_n}}` tokens against a `temps` dictionary.
   - Add `src/components/UnitToggle.tsx` and place it on landing, confirmation, card view, feedback, and admin surfaces.
   - Update `CardView` so all temperatures render through `NarrativeText`; no component should format Fahrenheit/Celsius directly.
   - Acceptance: toggling units updates rendered temperatures without calling `/api/generate` again.

2. **Adapt the existing heuristic generator to the token schema.**
   - Extend `AdaptationCard` in `src/lib/options.ts` to include `summary.narrative_template`, `summary.temps`, and `steps[]`.
   - Refactor `src/lib/llm.ts` so the heuristic stub emits tokenized templates instead of plain-text temperatures.
   - Preserve the same exported `generateAdaptation(recipe, context)` interface.
   - Acceptance: generated cards contain no plain-text temperature strings in narrative fields; every token has a matching `temps` entry.

3. **Food safety layer.**
   - Add `src/lib/foodSafety.ts` with static USDA temperature guidance and ingredient keyword detection.
   - Add a dedicated food-safety section in `CardView`.
   - Food safety temps must set `force_both_units: true`.
   - Acceptance: chicken, turkey, fish, ground meat, whole-cut meat, eggs, leftovers, and casseroles surface the correct safety guidance in both units.

4. **Feedback conversion and storage.**
   - Update `FeedbackForm` with an explicit unit selector for the user-entered actual temperature.
   - Show a conversion preview before submit.
   - Update the feedback API/schema/database to store `actual_temp_input`, `actual_temp_unit`, `actual_temp_f`, and `actual_temp_c`.
   - Acceptance: a Celsius submission stores both canonical Fahrenheit and Celsius values, and the preview matches the stored conversion.

5. **Eval harness before real LLM integration.**
   - Add `eval/recipes`, `eval/expected`, `eval/runners`, `eval/reports`, and `eval/snapshots`.
   - Start with 5-10 recipes, then grow toward the 30-recipe corpus from `ENGINEERING.md`.
   - Implement schema validation, token-resolution checks, no-inline-temperature checks, food-safety checks, and no-copied-recipe-prose checks.
   - Add `npm run eval`.
   - Acceptance: the heuristic generator passes structural checks before the real model is introduced.

6. **Real model integration.**
   - Replace the heuristic internals in `src/lib/llm.ts` with Claude/structured-output integration.
   - Keep a deterministic local fallback when `ANTHROPIC_API_KEY` is absent.
   - Record `prompt_version` on generated cards.
   - Acceptance: evals pass at 100% for critical structural rules before the model-backed path ships.

7. **Normalize data after the output shape is stable.**
   - Split the current `cards` table into recipe source, extraction, adaptation card, adaptation step, feedback, and aggregate-learning tables.
   - Add versioned migrations under `src/lib/migrations/`.
   - Backfill existing `cards` rows.
   - Acceptance: old card URLs still resolve, and all read/write paths use the normalized tables.

8. **Admin and learning loop.**
   - Add the admin review queue schema from `ENGINEERING.md`.
   - Add conflict detection and aggregate-learning recomputation.
   - Add review states for accept/reject/defer and keep append-only decision history.
   - Acceptance: user feedback can create reviewable suggestions without automatically changing public guidance.

## Enhancement acceptance criteria

1. Unit toggling never regenerates a card.
2. No user-facing temperature narrative contains raw inline temperatures; all rendered values come from tokens.
3. Food safety temperatures always show both Fahrenheit and Celsius.
4. Feedback stores the user's original input unit and normalized values in both units.
5. Prompt/model changes cannot ship with critical eval failures.
6. Existing public card URLs continue to work through schema migration.
7. The admin workflow is review-first; user feedback never auto-promotes to recommendations without review.

## Verification

1. `npm install && npm run dev` — landing page loads at http://localhost:3000.
2. Paste a known-good recipe URL (e.g. a Serious Eats recipe) into `/new` → extraction returns ingredients and instructions → confirmation screen shows them editable.
3. Toggle "paste manually" with a junk URL → manual textareas appear → can proceed.
4. Pick pan/experience/goal → generate → redirects to `/c/[slug]` with a populated card. Verify no recipe ingredients/steps are reproduced verbatim on the card (the card shows only adaptation notes + a link to source).
5. Click share — URL copies; open in a private window, card renders the same.
6. Click "How did it go?" — submit feedback with 4 stars and tags `too hot` + `worked well` and actual temp 425 — confirm row appears in SQLite (`sqlite3 data/app.db "select * from feedback;"`).
7. Visit `/admin/login`, enter `ADMIN_PASSWORD` from `.env`, land on dashboard, see the new feedback row and the aggregate roll-up updating.
8. Wrong password → stays on login with error. Removing the cookie redirects `/admin` → `/admin/login`.
9. Confirm disclaimer is visible on landing, `/new`, `/c/[slug]`, and in the card's OG metadata.
