# Cooking Impulsively

## Build Plan

**Status:** active
**Last updated:** 2026-07-28
**Supersedes:** the staging in `PLAN.md` and the Stage 0–6 roadmap in `PRD.md`

This document is the execution layer. `PRD_V2.md` says *what* to build and *why*, `IMPLEMENTATION_GUIDE.md` says *with what*, `ENGINEERING.md` says *how* for the two hardest subsystems. This plan sequences the work, resolves the contradictions between those documents, and maps every phase onto tracked GitHub issues.

Read it alongside:

1. [`RESEARCH_AND_VALIDATION.md`](./RESEARCH_AND_VALIDATION.md) — the evidence
2. [`PRD_V2.md`](./PRD_V2.md) — the requirements
3. [`IMPLEMENTATION_GUIDE.md`](./IMPLEMENTATION_GUIDE.md) — the stack and staged path
4. [`../ENGINEERING.md`](../ENGINEERING.md) — prompt/token spec (§D), admin schema (§E), rendering layer (§F), eval harness (§G)

---

## 1. Where the code actually is today

Honest baseline, because several documents describe the destination as though parts of it exist.

**Built and working:**

- Next.js 16 App Router + TypeScript + Tailwind; production build passes
- Recipe extraction via schema.org JSON-LD with microdata fallback ([`src/lib/extract.ts`](../src/lib/extract.ts))
- Three-stage submission flow: URL → confirm → context ([`src/app/new/page.tsx`](../src/app/new/page.tsx))
- Anonymous shareable card pages at `/c/[slug]`
- Post-cook feedback with structured tags ([`src/components/FeedbackForm.tsx`](../src/components/FeedbackForm.tsx))
- Password-gated admin dashboard with aggregates and a community-notes queue
- SQLite via Node's built-in `node:sqlite` ([`src/lib/db.ts`](../src/lib/db.ts))

**Deliberately stubbed:**

- [`src/lib/llm.ts`](../src/lib/llm.ts) is a keyword-bucket heuristic, not a model call. It matches heat words to one of five buckets and returns a single card-level recommendation.

**Not built at all** (despite appearing in the docs as though specified means done):

- Any notion of a device — the app is implicitly Impulse-only with no device profile, no capability schema, no adapter layer
- Temperature tokens; temperatures are plain numbers and literal `°F` strings baked into prose
- Unit switching
- Per-step guidance; one card-level blob instead
- Adaptation versioning, prompt versioning, model stamping
- Completed-cook gating — feedback can be submitted by anyone who opens the page, cooked or not
- Cooking journal, personal history, auth of any kind
- Background jobs; extraction and generation run inline in the request

The gap between the prototype and `PRD_V2` is large but the prototype is not wasted — the extraction pipeline, the confirmation UX, and the card/feedback page structure all survive.

---

## 2. Decisions locked

### 2.1 AI provider: agnostic interface, decide after eval

`ENGINEERING.md` §D specifies Anthropic Claude with tool-use schema enforcement. `IMPLEMENTATION_GUIDE.md` §2 specifies the OpenAI Responses API. **Neither wins yet.**

Build `generateAdaptation()` against a thin provider interface with two implementations plus the existing heuristic as a dev fallback:

```
src/lib/ai/
  provider.ts      # interface + AI_PROVIDER env dispatch
  anthropic.ts     # tool-use structured output
  openai.ts        # Responses API structured output
  heuristic.ts     # current stub, dev/offline fallback
```

All three satisfy the same JSON Schema (`ENGINEERING.md` §D.4). The eval harness (§G) runs against whichever provider is configured, which turns the decision into a measurement instead of an argument. Pick the winner at the end of Phase D on pass rate, latency, and cost.

**Cost of this choice:** roughly a day of extra work and a doubled eval bill during Phase D. Accepted, because switching providers after the prompt is tuned is far more expensive.

### 2.2 Database: Supabase PostgreSQL

Resolves the open question in issue #10. `IMPLEMENTATION_GUIDE.md` §3 is decisive: serverless instances don't share a filesystem, and SQLite gives no row-level security for the user-owned records that `PRD_V2` §18 requires. SQLite stays as a local-dev option behind the same interface until Phase B completes.

### 2.3 Schema: `IMPLEMENTATION_GUIDE` §6 is canonical for the core, `ENGINEERING.md` §E for the learning layer

The two documents specify overlapping tables with different names. They are not alternatives — §6 is the transactional core, §E is the admin/learning layer that sits on top. Mapping:

| `ENGINEERING.md` §E | `IMPLEMENTATION_GUIDE.md` §6 | Resolution |
|---|---|---|
| `user_feedback` | `cook_sessions` + `step_feedback` | Use §6's split. §E conflates the cook session with per-step rows; PRD_V2 §16 needs both levels. |
| `adaptation_steps` | `adaptation_steps` | Same table. Use §6's column names, keep §E's `narrative_template` + `temps_json` token design. |
| `aggregated_learning` | `community_insights` | Use §6's name, §E's columns and nightly recompute logic. |
| `admin_review_queue`, `admin_decisions`, `recommendation_history`, `baseline_rule_suggestions`, `user_calibration`, `admin_users` | *(not specified)* | Keep §E as written. These are the moderation layer and have no §6 equivalent. |
| *(not specified)* | `profiles`, `recipe_sources`, `recipe_snapshots`, `device_profiles`, `adaptations` | Keep §6 as written. §E predates the device-neutral architecture. |

Net: 15 tables. §E's PostgreSQL syntax ports directly now that Supabase is the target — the partial indexes, `JSONB`, `GIN`, and `PERCENTILE_CONT` it relies on are all available.

### 2.4 Device-neutral analysis is architectural, not a feature flag

`PRD_V2` §10.1 requires the analysis engine to produce a device-neutral cooking plan that a separate adapter translates. This has to be true from the first model call in Phase D — retrofitting it after an Impulse-shaped output schema ships means rewriting the prompt, the schema, the eval rules, and the stored data.

```
recipe + context → [analysis] → DeviceNeutralPlan → [adapter] → DeviceSpecificPlan → card
```

Feedback attaches to the device-specific plan and the device profile version, per `PRD_V2` §16.

---

## 3. Build sequence

Phases come from `IMPLEMENTATION_GUIDE.md` §5 and are the GitHub milestones. They are ordered by dependency, not by user-visible value — Phase A and B produce nothing a user can see.

### Phase A — Stabilize the prototype

*No infrastructure. Make the data contracts explicit so later phases have something to migrate.*

| Work | Issue |
|---|---|
| Typed temperature tokens + rendering utilities + persistent °F/°C toggle (`ENGINEERING.md` §F) | [#1](https://github.com/benjet/Cooking-Impulsively-Tool/issues/1) |
| Stovetop-step detection + extraction confidence | [#5](https://github.com/benjet/Cooking-Impulsively-Tool/issues/5) (PR #11) |
| Device profile schema + Impulse profile record | [#13](https://github.com/benjet/Cooking-Impulsively-Tool/issues/13) |
| Adaptation versioning + prompt/model stamping | [#14](https://github.com/benjet/Cooking-Impulsively-Tool/issues/14) |
| Expanded cooking context: fat, pan size, scaling, desired outcome | [#15](https://github.com/benjet/Cooking-Impulsively-Tool/issues/15) |
| Extraction hardening: SSRF, canonical URL, dedup, rate limiting | [#16](https://github.com/benjet/Cooking-Impulsively-Tool/issues/16) |
| CI: typecheck, test, build | [#17](https://github.com/benjet/Cooking-Impulsively-Tool/issues/17) |

**Done when:** the app runs locally with explicit versioned data contracts, temperatures are tokens end to end, and CI is green on every PR.

### Phase B — Production database and auth

| Work | Issue |
|---|---|
| Supabase project, migrations, full 15-table schema, RLS | [#6](https://github.com/benjet/Cooking-Impulsively-Tool/issues/6) |
| Anonymous sessions with passwordless account linking | [#18](https://github.com/benjet/Cooking-Impulsively-Tool/issues/18) |
| Analytics events + error monitoring | [#19](https://github.com/benjet/Cooking-Impulsively-Tool/issues/19) |

**Done when:** data persists in Postgres across preview and production, users have identity without a registration wall, and RLS is enforced.

### Phase C — Background jobs

| Work | Issue |
|---|---|
| Trigger.dev setup, `extract-recipe` + `generate-adaptation` jobs, retries, processing states | [#20](https://github.com/benjet/Cooking-Impulsively-Tool/issues/20) |
| Scheduled backlink health checks + admin view | [#21](https://github.com/benjet/Cooking-Impulsively-Tool/issues/21) |

**Done when:** extraction and generation no longer block a request, and failures retry visibly instead of silently.

### Phase D — The structured AI pipeline

The hard one. `ENGINEERING.md` §D and §G exist entirely to serve this phase.

| Work | Issue |
|---|---|
| **Golden eval set: 30 recipes + rules + harness (§G). Build this first.** | [#22](https://github.com/benjet/Cooking-Impulsively-Tool/issues/22) |
| Provider-agnostic AI interface: Anthropic + OpenAI + heuristic | [#2](https://github.com/benjet/Cooking-Impulsively-Tool/issues/2) |
| Device-neutral plan → device adapter architecture | [#23](https://github.com/benjet/Cooking-Impulsively-Tool/issues/23) |
| Per-step adaptation output | [#3](https://github.com/benjet/Cooking-Impulsively-Tool/issues/3) |
| Food safety: pan-surface / liquid / oil / internal, both units always | [#4](https://github.com/benjet/Cooking-Impulsively-Tool/issues/4) |

§D.7 and §G are explicit that no token-emission code should be written before the eval set exists — the prompt needs 5–10 iterations and there is otherwise no way to detect regression.

**Done when:** a real recipe produces versioned per-step device-specific guidance, the eval set passes 100% of critical rules, and the provider decision from §2.1 is made on data.

### Phase E — Feedback and the cooking journal

| Work | Issue |
|---|---|
| Completed-cook gating; `cook_sessions` + `step_feedback`; feedback rewrite | [#24](https://github.com/benjet/Cooking-Impulsively-Tool/issues/24) |
| Personal cooking journal + previous-settings recall | [#25](https://github.com/benjet/Cooking-Impulsively-Tool/issues/25) |
| Community insights with moderation thresholds (`PRD_V2` §17) | [#7](https://github.com/benjet/Cooking-Impulsively-Tool/issues/7) |

**Done when:** only completed cooks generate evidence, that evidence attaches to an exact adaptation version, and returning users see what they did last time.

### Phase F — Breville Control Freak

| Work | Issue |
|---|---|
| Home + Commercial profiles, surface temp, intensity, probe control/monitoring, preset-ready sequences, device-segmented feedback | [#26](https://github.com/benjet/Cooking-Impulsively-Tool/issues/26) |

**Done when:** the same recipe yields correct, differently-shaped guidance on Impulse and Control Freak without forking the analysis engine.

### Later — not milestoned

Public adaptation library ([#8](https://github.com/benjet/Cooking-Impulsively-Tool/issues/8)) and community/social features ([#9](https://github.com/benjet/Cooking-Impulsively-Tool/issues/9)) come after the loop above is validated. `IMPLEMENTATION_GUIDE.md` §18 is right that these are premature until real cooks confirm the recommendations survive contact with real pans.

Tracking lives in the [GitHub milestones](https://github.com/benjet/Cooking-Impulsively-Tool/milestones), one per phase.

---

## 4. Phase ↔ PRD stage mapping

`PRD_V2` §24 stages are product-facing; the phases above are engineering-facing. They interleave rather than align 1:1.

| PRD_V2 stage | Engineering phases | Note |
|---|---|---|
| Stage 0 — Concierge validation | *(none)* | Can run today against the existing prototype with manual card authoring. Doesn't block Phase A. |
| Stage 1 — Impulse automated MVP | A + B + C + D | The bulk of the work. |
| Stage 2 — Control Freak support | F | Deliberately after Stage 3 in engineering order; the adapter layer is cheap once the journal proves the loop. |
| Stage 3 — Personal cooking memory | E | |
| Stage 4 — Community learning | E (moderation) + `ENGINEERING.md` §E tables | |
| Stage 5 — Presets and integrations | *(not planned)* | Requires manufacturer cooperation; out of scope until it exists. |

**Recommendation:** run Stage 0 concierge validation *in parallel* with Phase A. `RESEARCH_AND_VALIDATION.md` §10 wants 15–25 beta cooks; recruiting and hand-authoring cards for them costs nothing architecturally and answers the open questions in §8 before Phase D locks the output schema.

---

## 5. Risks specific to this plan

| Risk | Mitigation |
|---|---|
| Phase D is a research task priced as an engineering task. Prompt iteration is unbounded. | Eval set first (§G). Timebox to a pass-rate target, not a calendar date. |
| Two provider implementations doubles Phase D surface area. | Both conform to one JSON Schema; only the transport differs. Delete the loser immediately after the decision. |
| Device-neutral plan is speculative until a second device exists — Phase F is the first real test. | Write two adapters in Phase D even if Control Freak ships later; a second adapter written against a fake device catches Impulse-shaped leakage early. |
| Migrating SQLite → Supabase mid-build while the schema is still moving. | Phase B lands the full §6 + §E schema at once rather than incrementally. Existing card data is a prototype artifact; migrating it is optional. |
| Docs now outnumber code 5:1 and will drift. | This file is the only one that tracks status. The others are specifications and should be edited, not appended to, when they're wrong. |

---

## 6. Immediate next actions

1. Land PR #11 after addressing the two findings in its review (server-side recomputation, persistence).
2. Start Phase A with the temperature token work (#1) — it blocks per-step output, the card rendering, and feedback normalization.
3. Begin recruiting the Stage 0 beta cohort in parallel.
4. Do not start Phase D until the eval set exists.
