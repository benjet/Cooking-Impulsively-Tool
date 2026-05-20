# Engineering Spec: Prompt, Rendering, Evals, and Admin Schema

This document covers the four load-bearing systems for Stage 3 and Stage 4:

- **Section D — Prompt engineering** for the recipe-analysis LLM. Upstream dependency: if the model doesn't emit clean tokens, nothing downstream works.
- **Section E — Admin queue database schema** in PostgreSQL. Downstream: the reconciliation surface that turns structured feedback into rule changes.
- **Section F — Rendering layer** for token-based templates, unit conversion, and the unit toggle UX.
- **Section G — Eval harness** for schema, structural, and cooking-regression checks.

> Note: this doc references "Section C" (outlier handling, cross-recipe pattern detection, user calibration) in places. Section C lives in the design notes that preceded this engineering write-up and is captured in the [admin reconciliation workflow](https://github.com/benjet/Cooking-Impulsively-Tool/issues) — read the dangling refs as forward links into the admin queue spec in Section E.

---

# D. Prompt Engineering for Token Emission

## D.1 The engineering goal

You need the model to do four things reliably, on every call:

1. Analyze a recipe and produce structured adaptation steps.
2. Never write a temperature as plain text inside narrative prose.
3. Emit every temperature as a token (`{{temp_n}}`) backed by a typed object in a `temps` dictionary.
4. Return valid JSON that passes schema validation.

The hardest of these is #2. Models trained on cooking content have a strong prior toward writing "350°F" inline. You have to override that prior with explicit instruction, a tight schema, and several few-shot examples showing the exact pattern you want.

## D.2 Model choice

For Stage 3, use Claude Sonnet 4 (`claude-sonnet-4-20250514`) or equivalent. Reasoning:

- Recipe analysis benefits from strong inference (intent detection, technique classification).
- Structured JSON output needs a model that follows schemas reliably.
- Cost matters because every card generation is a call; Sonnet is the right cost/quality balance.
- Opus is overkill for this; Haiku struggles with the token-emission discipline.

Use the API's tool-use / structured output feature if available — it enforces schema at the model layer rather than relying on instruction alone. For Anthropic's API, this means using tool definitions to constrain output.

## D.3 The system prompt

Below is a production-ready system prompt. Treat it as a starting point and iterate against your eval set.

```
You are the recipe analysis engine for Cooking Impulsively, a tool that
translates traditional stovetop recipes into Impulse cooktop guidance.

Your job is to analyze a recipe and produce structured adaptation steps in
JSON format. You will receive:
- The recipe title, ingredients, and instructions
- The user's pan type, experience level, and cooking goal
- The user's preferred temperature unit (informational only)

You will return a JSON object matching the schema provided in the tool definition.

CRITICAL RULES:

1. TEMPERATURES ARE NEVER WRITTEN AS PLAIN TEXT.
   Every temperature value — whether in narrative text, adjustment guidance,
   risk notes, or any other field — must be emitted as a placeholder token in
   the format {{temp_n}} where n is a unique identifier within the step
   (temp_1, temp_2, temp_oven, temp_safety_poultry, etc.).

   Each token must have a corresponding entry in the step's `temps` object.

   WRONG:   "Start at 335°F and increase toward 350°F if pale."
   WRONG:   "Start at 335 and increase toward 350 if pale."
   RIGHT:   "Start at {{temp_1}}. Increase toward {{temp_2}} if pale."

2. TEMPERATURE OBJECT SCHEMA.
   Every entry in `temps` must include:
   - `f`: Fahrenheit value (integer or decimal)
   - `kind`: one of "point", "range", "threshold", "safety"
   - `precision`: one of "whole", "decimal_1", "decimal_2"
   - `context`: short semantic label (e.g., "starting_temp", "simmer_target")

   For ranges, also include `f_max`.
   For safety temps (internal food temps), set `force_both_units: true`.

3. DO NOT INCLUDE CELSIUS VALUES.
   The frontend handles conversion. You only emit Fahrenheit.

4. PRESERVE SENSORY CUES.
   Never replace sensory cues with temperature alone. "Until shimmering,"
   "until fragrant," and "until golden" carry information temperature does not.
   Include both: the temperature target AND the sensory cue.

5. RESPECT THE PAN TYPE.
   Stainless, cast iron, carbon steel, nonstick, enameled cast iron, and woks
   behave differently. Adjust recommendations accordingly. Stainless retains
   heat poorly relative to cast iron at the same temperature.

6. ADMIT UNCERTAINTY.
   Each step has a `confidence_level` field: "high", "medium", or "low".
   Use "low" for unfamiliar techniques, vague original instructions, or
   high-risk operations (deep frying, candy, emulsions). Never present
   low-confidence guidance as certain.

7. FOOD SAFETY IS NON-NEGOTIABLE.
   When meat, poultry, seafood, or eggs are involved, include a food safety
   note with internal temperature thresholds. These temps use kind="safety"
   and force_both_units=true.

8. NO RECIPE REPUBLICATION.
   Do not copy original instructions verbatim into your output. Reference
   them by step number and paraphrase intent.

9. STAY WITHIN IMPULSE'S RANGE.
   The Impulse cooktop operates from 68°F to 482°F. Recommendations outside
   this range should be flagged in `risk_notes` and capped at the device
   limits.
```

## D.4 The tool/output schema

If you're using Anthropic's tool-use feature, define the output as a tool:

```json
{
  "name": "submit_adaptation_card",
  "description": "Submit the structured adaptation card for the recipe.",
  "input_schema": {
    "type": "object",
    "required": ["summary", "steps", "food_safety", "confidence_level"],
    "properties": {
      "summary": {
        "type": "object",
        "required": ["dish_name", "mode_strategy", "key_risks", "narrative_template", "temps"],
        "properties": {
          "dish_name": { "type": "string" },
          "mode_strategy": { "type": "string" },
          "key_risks": {
            "type": "array",
            "items": { "type": "string" }
          },
          "narrative_template": { "type": "string" },
          "temps": {
            "type": "object",
            "additionalProperties": { "$ref": "#/definitions/temperature" }
          }
        }
      },
      "steps": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "original_step_number",
            "detected_intent",
            "technique_category",
            "ingredient_focus",
            "impulse_mode",
            "narrative_template",
            "temps",
            "sensory_cues",
            "confidence_level"
          ],
          "properties": {
            "original_step_number": { "type": "integer" },
            "detected_intent": { "type": "string" },
            "technique_category": {
              "type": "string",
              "enum": ["preheat", "sweat", "saute", "brown", "sear", "simmer", "boil", "reduce", "fry", "melt", "toast", "finish", "hold_warm"]
            },
            "ingredient_focus": { "type": "string" },
            "impulse_mode": {
              "type": "string",
              "enum": ["temperature_control", "power_mode", "either"]
            },
            "narrative_template": { "type": "string" },
            "temps": {
              "type": "object",
              "additionalProperties": { "$ref": "#/definitions/temperature" }
            },
            "sensory_cues": {
              "type": "array",
              "items": { "type": "string" }
            },
            "risk_notes": { "type": "string" },
            "confidence_level": {
              "type": "string",
              "enum": ["high", "medium", "low"]
            }
          }
        }
      },
      "food_safety": {
        "type": "object",
        "properties": {
          "applicable": { "type": "boolean" },
          "narrative_template": { "type": "string" },
          "temps": {
            "type": "object",
            "additionalProperties": { "$ref": "#/definitions/temperature" }
          }
        }
      },
      "confidence_level": {
        "type": "string",
        "enum": ["high", "medium", "low"]
      }
    },
    "definitions": {
      "temperature": {
        "type": "object",
        "required": ["f", "kind", "precision", "context"],
        "properties": {
          "f": { "type": "number" },
          "f_max": { "type": "number" },
          "kind": {
            "type": "string",
            "enum": ["point", "range", "threshold", "safety"]
          },
          "precision": {
            "type": "string",
            "enum": ["whole", "decimal_1", "decimal_2"]
          },
          "context": { "type": "string" },
          "force_both_units": { "type": "boolean" }
        }
      }
    }
  }
}
```

This schema does a lot of the enforcement work for you. The model can't return `{"f": "335°F"}` because the type is `number`.

## D.5 Few-shot examples

This is where most teams under-invest. You need 4–6 strong examples covering the patterns that fail most often. Include them in the prompt as user/assistant turns before the actual request.

### Example 1: Simple point temperature

**User input:**

```
Recipe: "Heat a stainless steel skillet over medium-high heat. Add oil.
When shimmering, add diced onions and cook until golden, about 5 minutes."
Pan: stainless steel
Goal: sauté onions
```

**Model output:**

```json
{
  "steps": [{
    "original_step_number": 1,
    "detected_intent": "Preheat pan and brown onions",
    "technique_category": "saute",
    "ingredient_focus": "onions",
    "impulse_mode": "temperature_control",
    "narrative_template": "Preheat stainless skillet to {{temp_1}}. Add oil; when it shimmers and moves freely, add onions. Maintain {{temp_1}} for steady sizzling and gradual browning. If onions release water and stay pale, increase toward {{temp_2}}.",
    "temps": {
      "temp_1": {
        "f": 335,
        "kind": "point",
        "precision": "whole",
        "context": "saute_start"
      },
      "temp_2": {
        "f": 350,
        "kind": "point",
        "precision": "whole",
        "context": "saute_upper"
      }
    },
    "sensory_cues": [
      "Oil shimmers and moves freely when ready",
      "Steady sizzle, not aggressive popping",
      "Golden edges by minute 4 to 5"
    ],
    "confidence_level": "high"
  }]
}
```

### Example 2: Range temperature

**User input:**

```
Recipe step: "Simmer the sauce on low heat for 20 minutes, stirring
occasionally."
Pan: stainless
Goal: reduce tomato sauce
```

**Model output:**

```json
{
  "steps": [{
    "original_step_number": 4,
    "detected_intent": "Gentle simmer to reduce and meld flavors",
    "technique_category": "simmer",
    "ingredient_focus": "tomato_sauce",
    "impulse_mode": "either",
    "narrative_template": "Hold sauce at {{temp_1}} for a gentle simmer. You want small steady bubbles, not aggressive boiling. If sauce spits or thickens too fast, drop to the lower end of {{temp_1}}.",
    "temps": {
      "temp_1": {
        "f": 205,
        "f_max": 215,
        "kind": "range",
        "precision": "whole",
        "context": "simmer_target"
      }
    },
    "sensory_cues": [
      "Small steady bubbles across the surface",
      "Sauce slowly thickens, no aggressive splattering",
      "Gentle steam, not vigorous boiling"
    ],
    "risk_notes": "Tomato sauces scorch easily. Stir bottom every 3 to 4 minutes.",
    "confidence_level": "high"
  }]
}
```

### Example 3: Safety temperature (force_both_units)

**User input:**

```
Recipe step: "Cook chicken thighs in the skillet for 8 minutes per side,
until cooked through."
Pan: cast iron
Goal: sear chicken
```

**Model output:**

```json
{
  "steps": [{
    "original_step_number": 3,
    "detected_intent": "Sear and cook chicken thighs to safe internal temperature",
    "technique_category": "sear",
    "ingredient_focus": "chicken_thighs",
    "impulse_mode": "temperature_control",
    "narrative_template": "Preheat cast iron to {{temp_1}}. Place thighs skin-side down; do not move for 5 to 6 minutes. Flip and continue until internal temperature reaches {{temp_safety_poultry}}.",
    "temps": {
      "temp_1": {
        "f": 425,
        "kind": "point",
        "precision": "whole",
        "context": "sear_target"
      },
      "temp_safety_poultry": {
        "f": 165,
        "kind": "safety",
        "precision": "whole",
        "context": "internal_poultry",
        "force_both_units": true
      }
    },
    "sensory_cues": [
      "Skin releases easily from pan when ready to flip",
      "Deep golden-brown crust",
      "Juices run clear at the thickest point"
    ],
    "risk_notes": "Pan temperature does not equal food doneness. Use a probe thermometer.",
    "confidence_level": "high"
  }]
}
```

### Example 4: Decimal precision (sugar work)

**User input:**

```
Recipe step: "Cook sugar until hard crack stage."
Pan: heavy-bottomed saucepan
Goal: caramel
```

**Model output:**

```json
{
  "steps": [{
    "original_step_number": 2,
    "detected_intent": "Bring sugar to hard crack stage",
    "technique_category": "melt",
    "ingredient_focus": "sugar",
    "impulse_mode": "temperature_control",
    "narrative_template": "Cook sugar to {{temp_hard_crack}}. Use a candy thermometer; do not rely on visual cues alone for this stage.",
    "temps": {
      "temp_hard_crack": {
        "f": 300,
        "kind": "threshold",
        "precision": "decimal_1",
        "context": "sugar_hard_crack"
      }
    },
    "sensory_cues": [
      "Sugar turns deep amber",
      "Dropped into cold water, forms brittle threads that snap"
    ],
    "risk_notes": "Sugar work is unforgiving. Hot sugar burns skin severely. Do not stir aggressively.",
    "confidence_level": "medium"
  }]
}
```

### Example 5: Low-confidence step (vague original)

**User input:**

```
Recipe step: "Cook until done."
Pan: nonstick
Goal: scrambled eggs
```

**Model output:**

```json
{
  "steps": [{
    "original_step_number": 2,
    "detected_intent": "Gently cook scrambled eggs to desired doneness",
    "technique_category": "saute",
    "ingredient_focus": "eggs",
    "impulse_mode": "temperature_control",
    "narrative_template": "Hold pan at {{temp_1}} for soft curds, or {{temp_2}} for firmer eggs. Stir continuously with a silicone spatula; pull eggs from edges to center.",
    "temps": {
      "temp_1": {
        "f": 250,
        "kind": "point",
        "precision": "whole",
        "context": "eggs_soft"
      },
      "temp_2": {
        "f": 275,
        "kind": "point",
        "precision": "whole",
        "context": "eggs_firm"
      }
    },
    "sensory_cues": [
      "Soft glossy curds form slowly",
      "Eggs should look slightly underdone when you remove from heat — they continue cooking off-heat"
    ],
    "risk_notes": "The original recipe says only 'cook until done,' which is ambiguous. Doneness for eggs is personal. Pull early and let residual heat finish.",
    "confidence_level": "low"
  }]
}
```

### Example 6: Multiple temps in one narrative (the failure case)

This is the example specifically designed to show the model what *not* to do.

**User input:**

```
Recipe step: "Heat oil over medium-high. Add garlic and cook 30 seconds until
fragrant. Add onions, reduce to medium, and cook 5 minutes."
Pan: stainless
Goal: aromatic base
```

**Model output:**

```json
{
  "steps": [{
    "original_step_number": 1,
    "detected_intent": "Build aromatic base without burning garlic",
    "technique_category": "saute",
    "ingredient_focus": "aromatics",
    "impulse_mode": "temperature_control",
    "narrative_template": "Preheat oil at {{temp_1}}. Add garlic — it should sizzle gently, not aggressively. Drop to {{temp_2}} within 30 seconds, then add onions. Hold {{temp_2}} for 5 minutes, stirring occasionally.",
    "temps": {
      "temp_1": {
        "f": 305,
        "kind": "point",
        "precision": "whole",
        "context": "garlic_start"
      },
      "temp_2": {
        "f": 285,
        "kind": "point",
        "precision": "whole",
        "context": "onion_hold"
      }
    },
    "sensory_cues": [
      "Garlic sizzles gently and turns fragrant within 30 seconds — never brown",
      "Onions soften and turn translucent, not golden"
    ],
    "risk_notes": "Garlic burns fast. If it browns before you add onions, restart — burnt garlic ruins the dish.",
    "confidence_level": "high"
  }]
}
```

## D.6 The user-message template

For each generation, the user message should follow a strict template:

```
RECIPE
======
Title: {recipe_title}
Source: {source_domain}
Yield: {yield}

INGREDIENTS
-----------
{ingredients_list}

INSTRUCTIONS
------------
{numbered_instructions}

USER CONTEXT
============
Pan type: {pan_type}
Pan size: {pan_size}
Experience level: {experience_level}
Cooking goal: {cooking_goal}
Preferred temp unit: {preferred_unit}
Additional preferences: {optional_preferences}

Please analyze this recipe and produce an Impulse adaptation card following
the schema. Remember:
- All temperatures as tokens, never as plain text.
- Preserve sensory cues alongside temperatures.
- Flag low-confidence steps explicitly.
- Include food safety temps for meat/poultry/seafood/eggs.
```

Keeping this template stable makes evals easier — you can A/B-test prompt variations against a fixed corpus of recipe inputs.

## D.7 The eval set

You need an eval set before you ship Stage 3. Minimum 30 recipes covering:

- 5 simple single-technique recipes (eggs, pancakes, grilled cheese)
- 5 multi-phase recipes (pasta with sauce, stir-fry, braises that start on stovetop)
- 5 protein-heavy recipes (steak, chicken thighs, fish)
- 5 high-risk recipes (caramel, deep frying, hollandaise)
- 5 vague-instruction recipes ("cook until done")
- 5 non-U.S. recipes (Celsius source, metric measurements)

For each recipe, define the success criteria:

- Did the output validate against schema? (binary)
- Did all temperatures use tokens? (binary)
- Did temperatures fall within reasonable range for the technique? (binary)
- Did sensory cues survive alongside temperatures? (binary)
- Did confidence level match the recipe's actual difficulty? (subjective, admin review)
- Did food safety temps appear when required? (binary)
- Did the output republish recipe prose verbatim? (binary, failure if yes)

Run this eval after every prompt change. A regression on any binary metric blocks deploy.

## D.8 Common failure modes and fixes

| Failure | Symptom | Fix |
|---|---|---|
| Plain-text temps in narrative | "Start at 335°F..." appears in `narrative_template` | Add more emphasis in system prompt; add a validator that rejects any output where `narrative_template` contains a digit + °F pattern |
| Missing tokens in temps dict | `{{temp_2}}` referenced but not defined | Schema validation; reject and retry |
| Celsius values appearing | Model emits both F and C | Explicit "DO NOT include Celsius" in system prompt; reject if `c` field appears |
| Forgotten safety temps | Chicken recipe with no internal temp | Post-generation check: if ingredient list contains poultry/meat/fish/eggs and `food_safety.applicable !== true`, reject and retry |
| Verbatim recipe prose | Original instruction copied into narrative | Similarity check against source instructions; flag for admin review if >40% overlap |
| Out-of-range temps | Recommendation above 482°F | Validator caps at 482°F and adds note to `risk_notes` |
| Over-confident on hard recipes | High confidence on caramel | Hard-coded rule: techniques in `[fry, melt with sugar]` cap at "medium" confidence |

## D.9 Cost and latency

A typical recipe is 500–1500 tokens of input. The output is 800–2500 tokens of JSON. Sonnet 4 pricing makes each generation roughly 1–3 cents. At MVP scale (hundreds of recipes), this is negligible. At 10K recipes/month, it's $100–300/month — still cheap.

Latency: 8–20 seconds per generation. Show a progress state. Don't make the user wait on a blank screen.

For production, cache generations by `(recipe_id, pan_type, experience_level, cooking_goal)`. The same recipe + same context shouldn't re-generate. Cache hit rate will be high once the public library has volume.

---

# E. Admin Queue Database Schema

## E.1 Design principles

Three principles guide the schema:

1. **Append-only feedback.** User feedback is never mutated. Aggregations are computed views, not mutations of source data.
2. **Snapshots, not references.** Admin decisions snapshot the data state at decision time so the audit trail survives later data changes.
3. **Read-optimized for admin views.** Admin queries are infrequent but complex. Pre-compute aggregations rather than running heavy joins on every dashboard load.

I'm specifying this in PostgreSQL syntax because it's the default for projects at this stage and the JSON support is mature. Adjust for your stack if needed.

## E.2 Core tables (referenced from Section 13)

These exist already from Section 13 — I'm restating the relevant fields for context, then adding what's new for the admin workflow.

### `user_feedback` (existing, with indexes added)

```sql
CREATE TABLE user_feedback (
  feedback_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(user_id),
  card_id            UUID NOT NULL REFERENCES adaptation_cards(card_id),
  step_id            UUID REFERENCES adaptation_steps(step_id),
  overall_rating     TEXT NOT NULL CHECK (overall_rating IN ('worked_well', 'mixed', 'did_not_work')),
  feedback_tags      TEXT[] NOT NULL DEFAULT '{}',
  actual_temp_input  NUMERIC,
  actual_temp_unit   CHAR(1) CHECK (actual_temp_unit IN ('F', 'C')),
  actual_temp_f      NUMERIC,
  actual_temp_c      NUMERIC,
  actual_pan_type    TEXT,
  timing_feedback    TEXT,
  notes              TEXT,
  photo_url          TEXT,
  is_uncalibrated    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_card ON user_feedback(card_id);
CREATE INDEX idx_feedback_step ON user_feedback(step_id);
CREATE INDEX idx_feedback_user ON user_feedback(user_id);
CREATE INDEX idx_feedback_created ON user_feedback(created_at DESC);
CREATE INDEX idx_feedback_tags ON user_feedback USING GIN(feedback_tags);
CREATE INDEX idx_feedback_calibrated ON user_feedback(is_uncalibrated) WHERE is_uncalibrated = FALSE;
```

The `is_uncalibrated` flag is the outlier handling from Section C.5. Setting it true excludes the feedback from aggregation views without deleting the data.

### `adaptation_steps` (existing, with reference fields added)

```sql
-- Adding only the new fields here, assuming the rest exists from Section 13
ALTER TABLE adaptation_steps ADD COLUMN technique_category TEXT NOT NULL;
ALTER TABLE adaptation_steps ADD COLUMN ingredient_focus TEXT NOT NULL;
ALTER TABLE adaptation_steps ADD COLUMN pan_type TEXT NOT NULL;
ALTER TABLE adaptation_steps ADD COLUMN suggested_temp_min_f NUMERIC;
ALTER TABLE adaptation_steps ADD COLUMN suggested_temp_max_f NUMERIC;
ALTER TABLE adaptation_steps ADD COLUMN narrative_template TEXT NOT NULL;
ALTER TABLE adaptation_steps ADD COLUMN temps_json JSONB NOT NULL;

CREATE INDEX idx_steps_tuple ON adaptation_steps(technique_category, ingredient_focus, pan_type);
CREATE INDEX idx_steps_temps ON adaptation_steps USING GIN(temps_json);
```

## E.3 New tables for the admin workflow

### `aggregated_learning` (existing, restated and expanded)

```sql
CREATE TABLE aggregated_learning (
  learning_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technique_category     TEXT NOT NULL,
  ingredient_focus       TEXT NOT NULL,
  pan_type               TEXT NOT NULL,
  current_temp_min_f     NUMERIC,
  current_temp_max_f     NUMERIC,
  total_reports          INTEGER NOT NULL DEFAULT 0,
  positive_count         INTEGER NOT NULL DEFAULT 0,
  too_hot_count          INTEGER NOT NULL DEFAULT 0,
  too_cool_count         INTEGER NOT NULL DEFAULT 0,
  changed_temp_count     INTEGER NOT NULL DEFAULT 0,
  mean_actual_temp_f     NUMERIC,
  median_actual_temp_f   NUMERIC,
  std_actual_temp_f      NUMERIC,
  confidence_score       NUMERIC,
  last_recomputed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (technique_category, ingredient_focus, pan_type)
);

CREATE INDEX idx_learning_tuple ON aggregated_learning(technique_category, ingredient_focus, pan_type);
CREATE INDEX idx_learning_recomputed ON aggregated_learning(last_recomputed_at);
```

This table is recomputed nightly by a batch job (Section E.7). It's the precomputed view that drives both community notes and the admin queue.

### `admin_review_queue`

```sql
CREATE TABLE admin_review_queue (
  queue_item_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_id          UUID NOT NULL REFERENCES aggregated_learning(learning_id),
  flag_reason          TEXT NOT NULL CHECK (flag_reason IN (
    'low_positive_rate',
    'bimodal_distribution',
    'high_variance',
    'temp_drift',
    'cross_recipe_pattern',
    'manual_flag'
  )),
  flag_data_snapshot   JSONB NOT NULL,
  flagged_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status               TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'in_review', 'resolved', 'deferred', 'dismissed'
  )),
  priority             INTEGER NOT NULL DEFAULT 0,
  assigned_admin_id    UUID REFERENCES admin_users(admin_id),
  resolved_at          TIMESTAMPTZ,
  resolution_id        UUID REFERENCES admin_decisions(decision_id)
);

CREATE INDEX idx_queue_status ON admin_review_queue(status) WHERE status IN ('open', 'in_review');
CREATE INDEX idx_queue_priority ON admin_review_queue(priority DESC, flagged_at ASC) WHERE status = 'open';
CREATE INDEX idx_queue_learning ON admin_review_queue(learning_id);
```

`flag_data_snapshot` is a JSONB blob that captures the full state of the aggregated_learning row at the moment of flagging. This is important: if more feedback arrives between flagging and admin review, you still see what the data looked like when the system raised the flag. Example contents:

```json
{
  "total_reports": 14,
  "positive_count": 5,
  "too_hot_count": 6,
  "too_cool_count": 1,
  "mean_actual_temp_f": 318.4,
  "median_actual_temp_f": 320.0,
  "std_actual_temp_f": 18.2,
  "current_temp_min_f": 340,
  "current_temp_max_f": 360,
  "tag_distribution": {
    "too_hot": 6,
    "browned_too_fast": 3,
    "scorched": 2,
    "worked_well": 5,
    "changed_temp_worked_better": 4
  },
  "deltas_from_recommendation": [-20, -25, -15, -30, -18]
}
```

### `admin_decisions`

```sql
CREATE TABLE admin_decisions (
  decision_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id        UUID REFERENCES admin_review_queue(queue_item_id),
  admin_id             UUID NOT NULL REFERENCES admin_users(admin_id),
  decision_type        TEXT NOT NULL CHECK (decision_type IN (
    'approve_community_note',
    'adjust_recommendation',
    'split_by_pan_type',
    'flag_subclassification',
    'suppress_as_noise',
    'defer'
  )),
  reasoning            TEXT NOT NULL,
  before_state         JSONB NOT NULL,
  after_state          JSONB,
  decided_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_decisions_admin ON admin_decisions(admin_id, decided_at DESC);
CREATE INDEX idx_decisions_queue ON admin_decisions(queue_item_id);
CREATE INDEX idx_decisions_type ON admin_decisions(decision_type, decided_at DESC);
```

`before_state` and `after_state` snapshot the recommendation before and after the decision. This is your audit trail. Even if the recommendation changes again later, you can trace every change back to a specific admin decision with reasoning attached.

### `recommendation_history`

```sql
CREATE TABLE recommendation_history (
  history_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technique_category   TEXT NOT NULL,
  ingredient_focus     TEXT NOT NULL,
  pan_type             TEXT NOT NULL,
  temp_min_f           NUMERIC,
  temp_max_f           NUMERIC,
  source               TEXT NOT NULL CHECK (source IN (
    'initial_baseline', 'admin_decision', 'baseline_rule_change'
  )),
  source_ref_id        UUID,
  effective_from       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to         TIMESTAMPTZ
);

CREATE INDEX idx_history_tuple ON recommendation_history(technique_category, ingredient_focus, pan_type, effective_from DESC);
CREATE INDEX idx_history_active ON recommendation_history(technique_category, ingredient_focus, pan_type)
  WHERE effective_to IS NULL;
```

Type-2 slowly-changing-dimension pattern. Every recommendation change writes a new row, sets the previous row's `effective_to`, and lets you reconstruct the recommendation that was active at any point in history. Important for: "this card said 350°F when I cooked it three months ago, what changed?"

### `community_notes`

```sql
CREATE TABLE community_notes (
  note_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_id          UUID NOT NULL REFERENCES aggregated_learning(learning_id),
  technique_category   TEXT NOT NULL,
  ingredient_focus     TEXT NOT NULL,
  pan_type             TEXT NOT NULL,
  note_text            TEXT NOT NULL,
  reports_at_promotion INTEGER NOT NULL,
  promoted_by_admin_id UUID NOT NULL REFERENCES admin_users(admin_id),
  promoted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  retired_at           TIMESTAMPTZ,
  retired_reason       TEXT
);

CREATE INDEX idx_notes_tuple ON community_notes(technique_category, ingredient_focus, pan_type)
  WHERE status = 'active';
CREATE INDEX idx_notes_learning ON community_notes(learning_id);
```

### `baseline_rule_suggestions`

For the cross-recipe pattern detection from Section C.7.

```sql
CREATE TABLE baseline_rule_suggestions (
  suggestion_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technique_category   TEXT NOT NULL,
  ingredient_focus     TEXT NOT NULL,
  pan_type             TEXT NOT NULL,
  current_temp_min_f   NUMERIC,
  current_temp_max_f   NUMERIC,
  suggested_temp_min_f NUMERIC,
  suggested_temp_max_f NUMERIC,
  supporting_reports   INTEGER NOT NULL,
  affected_card_count  INTEGER NOT NULL,
  delta_summary        JSONB NOT NULL,
  detected_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'deferred'
  )),
  reviewed_by_admin_id UUID REFERENCES admin_users(admin_id),
  reviewed_at          TIMESTAMPTZ,
  review_notes         TEXT
);

CREATE INDEX idx_suggestions_status ON baseline_rule_suggestions(status) WHERE status = 'pending';
CREATE INDEX idx_suggestions_impact ON baseline_rule_suggestions(affected_card_count DESC) WHERE status = 'pending';
```

`affected_card_count` is the impact preview from Section C.7 — admin can see "approving this changes 247 existing cards" before deciding.

### `user_calibration`

For the outlier handling from Section C.5.

```sql
CREATE TABLE user_calibration (
  user_id              UUID PRIMARY KEY REFERENCES users(user_id),
  total_feedback       INTEGER NOT NULL DEFAULT 0,
  outlier_count        INTEGER NOT NULL DEFAULT 0,
  outlier_rate         NUMERIC,
  mean_deviation_f     NUMERIC,
  is_uncalibrated      BOOLEAN NOT NULL DEFAULT FALSE,
  flagged_at           TIMESTAMPTZ,
  flagged_reason       TEXT,
  reviewed_by_admin_id UUID REFERENCES admin_users(admin_id),
  reviewed_at          TIMESTAMPTZ,
  review_decision      TEXT CHECK (review_decision IN ('confirm_exclude', 'reinclude', 'investigating'))
);

CREATE INDEX idx_calibration_uncalibrated ON user_calibration(is_uncalibrated) WHERE is_uncalibrated = TRUE;
CREATE INDEX idx_calibration_outlier_rate ON user_calibration(outlier_rate DESC NULLS LAST);
```

### `admin_users`

```sql
CREATE TABLE admin_users (
  admin_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT UNIQUE NOT NULL,
  display_name         TEXT NOT NULL,
  role                 TEXT NOT NULL CHECK (role IN ('reviewer', 'senior_reviewer', 'admin')),
  preferred_temp_unit  CHAR(1) NOT NULL DEFAULT 'F' CHECK (preferred_temp_unit IN ('F', 'C')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at       TIMESTAMPTZ
);
```

Roles matter for the two-approval requirement on baseline rule changes (Section C.7): only `senior_reviewer` and `admin` can approve baseline rule suggestions, and you can enforce two distinct approvers via a check at the application layer.

## E.4 Query patterns

The admin dashboard runs four primary queries. Each should be sub-200ms.

### Query 1: Open queue items, sorted by priority

```sql
SELECT
  q.queue_item_id,
  q.flag_reason,
  q.flagged_at,
  q.priority,
  al.technique_category,
  al.ingredient_focus,
  al.pan_type,
  al.total_reports,
  al.positive_count,
  al.too_hot_count,
  al.too_cool_count,
  al.mean_actual_temp_f,
  al.current_temp_min_f,
  al.current_temp_max_f,
  q.flag_data_snapshot
FROM admin_review_queue q
JOIN aggregated_learning al ON q.learning_id = al.learning_id
WHERE q.status = 'open'
ORDER BY q.priority DESC, q.flagged_at ASC
LIMIT 50;
```

Backed by `idx_queue_priority`. Should be fast even at 10K+ queue items.

### Query 2: Single queue item with full feedback detail

```sql
SELECT
  uf.feedback_id,
  uf.overall_rating,
  uf.feedback_tags,
  uf.actual_temp_f,
  uf.actual_pan_type,
  uf.notes,
  uf.created_at,
  uf.is_uncalibrated,
  u.display_name,
  uc.is_uncalibrated AS user_uncalibrated,
  uc.outlier_rate
FROM user_feedback uf
JOIN users u ON uf.user_id = u.user_id
LEFT JOIN user_calibration uc ON uf.user_id = uc.user_id
JOIN adaptation_steps s ON uf.step_id = s.step_id
WHERE s.technique_category = $1
  AND s.ingredient_focus = $2
  AND s.pan_type = $3
  AND uf.is_uncalibrated = FALSE
ORDER BY uf.created_at DESC
LIMIT 200;
```

This is the detail view. Uses `idx_steps_tuple` and `idx_feedback_calibrated`.

### Query 3: Histogram data for scatter plot

```sql
SELECT
  uf.actual_temp_f,
  uf.overall_rating,
  array_length(
    array(SELECT unnest(uf.feedback_tags) INTERSECT SELECT unnest(ARRAY['too_hot', 'too_cool', 'worked_well'])),
    1
  ) AS relevant_tag_count,
  uf.feedback_tags
FROM user_feedback uf
JOIN adaptation_steps s ON uf.step_id = s.step_id
WHERE s.technique_category = $1
  AND s.ingredient_focus = $2
  AND s.pan_type = $3
  AND uf.actual_temp_f IS NOT NULL
  AND uf.is_uncalibrated = FALSE;
```

For client-side rendering of the scatter plot. Returns raw points; the admin UI bins them.

### Query 4: Cross-recipe pattern detection (nightly batch)

```sql
WITH tuple_aggregates AS (
  SELECT
    s.technique_category,
    s.ingredient_focus,
    s.pan_type,
    COUNT(uf.feedback_id) AS report_count,
    AVG(uf.actual_temp_f) AS mean_temp,
    STDDEV(uf.actual_temp_f) AS std_temp,
    AVG(uf.actual_temp_f - (s.suggested_temp_min_f + s.suggested_temp_max_f) / 2) AS mean_delta,
    COUNT(DISTINCT s.card_id) AS distinct_cards
  FROM user_feedback uf
  JOIN adaptation_steps s ON uf.step_id = s.step_id
  WHERE uf.is_uncalibrated = FALSE
    AND uf.actual_temp_f IS NOT NULL
    AND uf.created_at > NOW() - INTERVAL '90 days'
  GROUP BY s.technique_category, s.ingredient_focus, s.pan_type
)
SELECT *
FROM tuple_aggregates
WHERE report_count >= 15
  AND distinct_cards >= 3
  AND ABS(mean_delta) > 15;
```

This runs nightly and writes results to `baseline_rule_suggestions`.

## E.5 Indexes recap

The indexes that matter most:

```sql
-- Hot path: admin queue dashboard
CREATE INDEX idx_queue_priority ON admin_review_queue(priority DESC, flagged_at ASC) WHERE status = 'open';

-- Hot path: tuple lookup for any aggregation
CREATE INDEX idx_steps_tuple ON adaptation_steps(technique_category, ingredient_focus, pan_type);
CREATE INDEX idx_learning_tuple ON aggregated_learning(technique_category, ingredient_focus, pan_type);

-- Hot path: feedback filtering
CREATE INDEX idx_feedback_calibrated ON user_feedback(is_uncalibrated) WHERE is_uncalibrated = FALSE;
CREATE INDEX idx_feedback_tags ON user_feedback USING GIN(feedback_tags);

-- Audit queries
CREATE INDEX idx_decisions_admin ON admin_decisions(admin_id, decided_at DESC);
CREATE INDEX idx_history_active ON recommendation_history(technique_category, ingredient_focus, pan_type)
  WHERE effective_to IS NULL;
```

The partial indexes (`WHERE status = 'open'`, `WHERE is_uncalibrated = FALSE`, `WHERE effective_to IS NULL`) keep these tight even as the underlying tables grow.

## E.6 Migration discipline

When you change a recommendation, the full sequence is:

```sql
BEGIN;

-- 1. Close the previous active recommendation
UPDATE recommendation_history
SET effective_to = NOW()
WHERE technique_category = $1
  AND ingredient_focus = $2
  AND pan_type = $3
  AND effective_to IS NULL;

-- 2. Insert the new recommendation
INSERT INTO recommendation_history (
  technique_category, ingredient_focus, pan_type,
  temp_min_f, temp_max_f,
  source, source_ref_id
) VALUES (
  $1, $2, $3,
  $4, $5,
  'admin_decision', $6
);

-- 3. Update the current value in aggregated_learning
UPDATE aggregated_learning
SET current_temp_min_f = $4,
    current_temp_max_f = $5,
    last_recomputed_at = NOW()
WHERE technique_category = $1
  AND ingredient_focus = $2
  AND pan_type = $3;

-- 4. Mark the queue item resolved
UPDATE admin_review_queue
SET status = 'resolved',
    resolved_at = NOW(),
    resolution_id = $6
WHERE queue_item_id = $7;

-- 5. Insert the decision record
INSERT INTO admin_decisions (
  decision_id, queue_item_id, admin_id,
  decision_type, reasoning,
  before_state, after_state
) VALUES (
  $6, $7, $8,
  'adjust_recommendation', $9,
  $10::jsonb, $11::jsonb
);

COMMIT;
```

The transaction ensures all five updates land together or none do. The `before_state` and `after_state` JSONB blobs capture the full context for audit.

## E.7 The nightly batch job

A single PostgreSQL function, run on cron:

```sql
CREATE OR REPLACE FUNCTION recompute_aggregated_learning()
RETURNS void AS $$
BEGIN
  -- Recompute aggregates for all tuples with new feedback
  INSERT INTO aggregated_learning (
    technique_category, ingredient_focus, pan_type,
    total_reports, positive_count, too_hot_count, too_cool_count,
    changed_temp_count,
    mean_actual_temp_f, median_actual_temp_f, std_actual_temp_f,
    last_recomputed_at
  )
  SELECT
    s.technique_category,
    s.ingredient_focus,
    s.pan_type,
    COUNT(uf.feedback_id),
    COUNT(*) FILTER (WHERE uf.overall_rating = 'worked_well'),
    COUNT(*) FILTER (WHERE 'too_hot' = ANY(uf.feedback_tags)),
    COUNT(*) FILTER (WHERE 'too_cool' = ANY(uf.feedback_tags)),
    COUNT(*) FILTER (WHERE 'changed_temp_worked_better' = ANY(uf.feedback_tags)),
    AVG(uf.actual_temp_f),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY uf.actual_temp_f),
    STDDEV(uf.actual_temp_f),
    NOW()
  FROM user_feedback uf
  JOIN adaptation_steps s ON uf.step_id = s.step_id
  WHERE uf.is_uncalibrated = FALSE
  GROUP BY s.technique_category, s.ingredient_focus, s.pan_type
  ON CONFLICT (technique_category, ingredient_focus, pan_type) DO UPDATE
  SET
    total_reports = EXCLUDED.total_reports,
    positive_count = EXCLUDED.positive_count,
    too_hot_count = EXCLUDED.too_hot_count,
    too_cool_count = EXCLUDED.too_cool_count,
    changed_temp_count = EXCLUDED.changed_temp_count,
    mean_actual_temp_f = EXCLUDED.mean_actual_temp_f,
    median_actual_temp_f = EXCLUDED.median_actual_temp_f,
    std_actual_temp_f = EXCLUDED.std_actual_temp_f,
    last_recomputed_at = NOW();

  -- Flag new conflicts
  INSERT INTO admin_review_queue (learning_id, flag_reason, flag_data_snapshot, priority)
  SELECT
    al.learning_id,
    CASE
      WHEN al.total_reports >= 5 AND al.positive_count::numeric / al.total_reports < 0.5
        THEN 'low_positive_rate'
      WHEN al.too_hot_count::numeric / al.total_reports > 0.3
        AND al.too_cool_count::numeric / al.total_reports > 0.3
        THEN 'bimodal_distribution'
      WHEN al.std_actual_temp_f > 25
        THEN 'high_variance'
      WHEN ABS(al.mean_actual_temp_f - (al.current_temp_min_f + al.current_temp_max_f) / 2) > 20
        THEN 'temp_drift'
    END AS flag_reason,
    jsonb_build_object(
      'total_reports', al.total_reports,
      'positive_count', al.positive_count,
      'too_hot_count', al.too_hot_count,
      'too_cool_count', al.too_cool_count,
      'mean_actual_temp_f', al.mean_actual_temp_f,
      'std_actual_temp_f', al.std_actual_temp_f,
      'current_temp_min_f', al.current_temp_min_f,
      'current_temp_max_f', al.current_temp_max_f
    ),
    CASE
      WHEN al.total_reports >= 20 THEN 100
      WHEN al.total_reports >= 10 THEN 50
      ELSE 10
    END
  FROM aggregated_learning al
  WHERE al.total_reports >= 5
    AND NOT EXISTS (
      SELECT 1 FROM admin_review_queue q
      WHERE q.learning_id = al.learning_id
        AND q.status IN ('open', 'in_review')
    )
    AND (
      al.positive_count::numeric / al.total_reports < 0.5
      OR (al.too_hot_count::numeric / al.total_reports > 0.3 AND al.too_cool_count::numeric / al.total_reports > 0.3)
      OR al.std_actual_temp_f > 25
      OR ABS(al.mean_actual_temp_f - (al.current_temp_min_f + al.current_temp_max_f) / 2) > 20
    );

  -- Recompute user calibration
  INSERT INTO user_calibration (user_id, total_feedback, outlier_count, outlier_rate, mean_deviation_f)
  SELECT
    uf.user_id,
    COUNT(*),
    COUNT(*) FILTER (
      WHERE ABS(uf.actual_temp_f - al.mean_actual_temp_f) > 2 * al.std_actual_temp_f
    ),
    COUNT(*) FILTER (
      WHERE ABS(uf.actual_temp_f - al.mean_actual_temp_f) > 2 * al.std_actual_temp_f
    )::numeric / COUNT(*),
    AVG(uf.actual_temp_f - al.mean_actual_temp_f)
  FROM user_feedback uf
  JOIN adaptation_steps s ON uf.step_id = s.step_id
  JOIN aggregated_learning al ON
    s.technique_category = al.technique_category
    AND s.ingredient_focus = al.ingredient_focus
    AND s.pan_type = al.pan_type
  WHERE uf.actual_temp_f IS NOT NULL
    AND al.std_actual_temp_f IS NOT NULL
  GROUP BY uf.user_id
  ON CONFLICT (user_id) DO UPDATE
  SET
    total_feedback = EXCLUDED.total_feedback,
    outlier_count = EXCLUDED.outlier_count,
    outlier_rate = EXCLUDED.outlier_rate,
    mean_deviation_f = EXCLUDED.mean_deviation_f;

  -- Auto-flag users with high outlier rates
  UPDATE user_calibration
  SET is_uncalibrated = TRUE,
      flagged_at = NOW(),
      flagged_reason = 'outlier_rate > 0.4 over 10+ reports'
  WHERE total_feedback >= 10
    AND outlier_rate > 0.4
    AND is_uncalibrated = FALSE
    AND review_decision IS NULL;
END;
$$ LANGUAGE plpgsql;
```

Run nightly via pg_cron or an external scheduler:

```sql
SELECT cron.schedule(
  'recompute-learning',
  '0 3 * * *',
  $$ SELECT recompute_aggregated_learning() $$
);
```

3 AM is intentional — minimal user traffic, full day of new feedback to process.

## E.8 What this gets you

End-to-end:

1. User submits feedback. Stored append-only.
2. Nightly job recomputes aggregates and flags new conflicts.
3. Admin sees prioritized queue with full data snapshots.
4. Admin makes a decision; every change is logged with reasoning and state snapshots.
5. Recommendation history preserves every change for audit and "what did this card say when I cooked it?" reconstruction.
6. Outlier users are flagged automatically, reviewed manually, and never silently silenced.
7. Cross-recipe patterns surface in a separate suggestion queue for baseline rule changes.

The schema is roughly 9 tables, ~200 lines of SQL, and should handle the first few hundred thousand feedback entries without sharding or performance tuning beyond the indexes shown.

---

## Where to go from here

These sections give you the upstream (AI emits clean tokens), the middle (the rendering layer consumes them cleanly), the guardrails (evals catch drift), and the downstream (admin reconciles structured feedback) of the system.

Three things worth deciding before you start building:

1. **Eval set first.** Don't write a single line of token-emission code until you have 30 recipes with success criteria defined. The prompt will need 5–10 iterations to hit acceptable accuracy, and you need a way to measure regression.
2. **Decide on the cache key.** Cards generated for `(recipe_id, pan_type, experience_level, cooking_goal)` should be cached. But what about minor variations? Do "comfortable" and "nerd_mode" share a generation? My recommendation: yes, generate once at the highest detail level and degrade in the UI for less-experienced users. Cheaper and more consistent.
3. **Plan for prompt versioning.** Every generated card should record which prompt version produced it. When you update the prompt and the model behavior shifts, you need to know which cards came from which version. Add a `prompt_version` field to `adaptation_cards` and store the actual prompt template alongside.

## Recommended implementation order

The build should move from the surface users touch toward the systems that protect it from drift:

1. **Make the card trustworthy first.** The product value is the rendered adaptation card: per-step notes, unit switching, food-safety guidance, confidence language, and clear source attribution. Treat this as the center of the system.
2. **Implement the rendering layer before the real LLM.** Build `UnitProvider`, `temperature.ts`, `NarrativeText`, `UnitToggle`, and the feedback conversion preview while the generator is still deterministic. Then refactor the existing heuristic generator to emit `narrative_template + temps`.
3. **Add the eval harness before prompt iteration.** Start with a smaller 5-10 recipe corpus, but include schema validation, token-resolution checks, no-inline-temperature checks, food-safety checks, and copied-prose checks from day one.
4. **Replace the LLM stub only after rendering and evals exist.** Keep the `generateAdaptation(recipe, context)` interface stable and keep a local deterministic fallback when API keys are absent.
5. **Normalize data after the card schema is stable.** The database split in Section E is important, but doing it before the output shape settles risks migrating into the wrong structure.
6. **Improve the user flow where it reduces cooking mistakes.** Prioritize extraction-confidence warnings, visible stovetop-step detection, step-specific feedback, and the temperature conversion preview.

This sequence deliberately delays the database migration until the card contract is proven. The expensive mistake is not changing tables later; it is locking in a schema before the user-facing output and feedback loop have stabilized.

---

# F. Rendering Layer: React Patterns for Token-Based Templates

## F.1 Architecture overview

The rendering layer has three jobs:

1. Parse a `narrative_template` and resolve `{{temp_n}}` tokens against the `temps` dictionary.
2. Format each temperature according to its kind, precision, and `force_both_units` settings, in the user's current unit preference.
3. React to unit-toggle changes without re-fetching data or re-generating the card.

The architecture is a single source of truth: the user's unit preference lives in React context and feeds a pure rendering function called by every component that displays temperatures. No prop drilling, no duplicated formatters, and no synchronized local state.

## F.2 The unit context

A single React context manages the user's unit preference and provides the toggle handler. Every temperature-displaying component subscribes to it.

```tsx
// src/contexts/UnitContext.tsx
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type TempUnit = "F" | "C";

interface UnitContextValue {
  unit: TempUnit;
  setUnit: (unit: TempUnit) => void;
  toggle: () => void;
  isExplicit: boolean;
}

const UnitContext = createContext<UnitContextValue | null>(null);

interface UnitProviderProps {
  children: ReactNode;
  initialUnit?: TempUnit;
  userId?: string;
  onUnitChange?: (unit: TempUnit) => void;
}

export function UnitProvider({
  children,
  initialUnit,
  onUnitChange,
}: UnitProviderProps) {
  const [unit, setUnitState] = useState<TempUnit>(() => {
    if (initialUnit) return initialUnit;
    return detectInitialUnit();
  });
  const [isExplicit, setIsExplicit] = useState(false);

  const setUnit = (next: TempUnit) => {
    setUnitState(next);
    setIsExplicit(true);
    localStorage.setItem("temp_unit", next);
    onUnitChange?.(next);
  };

  const toggle = () => setUnit(unit === "F" ? "C" : "F");

  return (
    <UnitContext.Provider value={{ unit, setUnit, toggle, isExplicit }}>
      {children}
    </UnitContext.Provider>
  );
}

export function useUnit() {
  const ctx = useContext(UnitContext);
  if (!ctx) throw new Error("useUnit must be used within a UnitProvider");
  return ctx;
}

function detectInitialUnit(): TempUnit {
  const stored = localStorage.getItem("temp_unit");
  if (stored === "F" || stored === "C") return stored;

  const lang = navigator.language || "en-US";
  const region = lang.split("-")[1]?.toUpperCase();
  const fahrenheitRegions = new Set(["US", "LR", "BS", "BZ", "KY", "PW"]);

  if (region && fahrenheitRegions.has(region)) return "F";
  if (region) return "C";
  return "F";
}
```

Three things worth noting:

1. `isExplicit` lets the UI distinguish users who chose a unit from users who received a locale default.
2. Server-side detection happens before the provider mounts. If the server passes `initialUnit`, it overrides client detection.
3. `onUnitChange` is the persistence escape hatch. Authenticated users can persist to `user.preferred_temp_unit`; anonymous users can rely on `localStorage`.

## F.3 The conversion utilities

Pure functions, no React, fully testable.

```ts
// src/lib/temperature.ts
export interface TemperatureObject {
  f: number;
  f_max?: number;
  kind: "point" | "range" | "threshold" | "safety";
  precision: "whole" | "decimal_1" | "decimal_2";
  context: string;
  force_both_units?: boolean;
}

export type TempUnit = "F" | "C";

export function fToC(f: number): number {
  return (f - 32) / 1.8;
}

export function cToF(c: number): number {
  return c * 1.8 + 32;
}

export function formatTemp(
  value: number,
  unit: TempUnit,
  precision: TemperatureObject["precision"]
): string {
  switch (precision) {
    case "whole":
      return `${Math.round(value)}°${unit}`;
    case "decimal_1":
      return `${value.toFixed(1)}°${unit}`;
    case "decimal_2":
      return `${value.toFixed(2)}°${unit}`;
  }
}

export interface RenderOptions {
  unit: TempUnit;
  nerdMode?: boolean;
}

export function renderTemperature(
  temp: TemperatureObject,
  opts: RenderOptions
): string {
  const showBoth = temp.force_both_units || opts.nerdMode;
  const fStr = formatTemp(temp.f, "F", temp.precision);
  const cStr = formatTemp(fToC(temp.f), "C", temp.precision);

  if (temp.kind === "range" && temp.f_max !== undefined) {
    const fMaxStr = formatTemp(temp.f_max, "F", temp.precision);
    const cMaxStr = formatTemp(fToC(temp.f_max), "C", temp.precision);

    if (showBoth) {
      return opts.unit === "F"
        ? `${fStr} to ${fMaxStr} (${cStr} to ${cMaxStr})`
        : `${cStr} to ${cMaxStr} (${fStr} to ${fMaxStr})`;
    }

    return opts.unit === "F"
      ? `${fStr} to ${fMaxStr}`
      : `${cStr} to ${cMaxStr}`;
  }

  if (showBoth) {
    return opts.unit === "F" ? `${fStr} (${cStr})` : `${cStr} (${fStr})`;
  }

  return opts.unit === "F" ? fStr : cStr;
}
```

These functions are the entire conversion math. Everything downstream is presentation.

## F.4 The narrative renderer

The narrative renderer takes a `narrative_template` plus a `temps` dictionary and produces rendered output.

```tsx
// src/components/NarrativeText.tsx
import { useMemo, type ReactNode } from "react";
import { useUnit } from "@/contexts/UnitContext";
import { renderTemperature, type TemperatureObject } from "@/lib/temperature";

interface NarrativeTextProps {
  template: string;
  temps: Record<string, TemperatureObject>;
  nerdMode?: boolean;
  className?: string;
}

const TOKEN_REGEX = /\{\{(temp_[a-z0-9_]+)\}\}/g;

export function NarrativeText({
  template,
  temps,
  nerdMode = false,
  className,
}: NarrativeTextProps) {
  const { unit } = useUnit();

  const rendered = useMemo<ReactNode[]>(() => {
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    TOKEN_REGEX.lastIndex = 0;

    while ((match = TOKEN_REGEX.exec(template)) !== null) {
      const [fullMatch, tokenKey] = match;
      const start = match.index;
      const end = start + fullMatch.length;

      if (start > lastIndex) {
        parts.push(template.slice(lastIndex, start));
      }

      const tempObj = temps[tokenKey];
      if (tempObj) {
        parts.push(
          <TemperatureSpan key={`${tokenKey}-${start}`} temp={tempObj}>
            {renderTemperature(tempObj, { unit, nerdMode })}
          </TemperatureSpan>
        );
      } else {
        console.error(`Missing temperature token: ${tokenKey}`);
        parts.push(
          <span key={`missing-${start}`} className="text-red-500">
            {fullMatch}
          </span>
        );
      }

      lastIndex = end;
    }

    if (lastIndex < template.length) {
      parts.push(template.slice(lastIndex));
    }

    return parts;
  }, [template, temps, unit, nerdMode]);

  return <span className={className}>{rendered}</span>;
}

function TemperatureSpan({
  temp,
  children,
}: {
  temp: TemperatureObject;
  children: ReactNode;
}) {
  const label =
    temp.kind === "safety"
      ? `Food safety temperature: ${temp.context}`
      : `Temperature: ${temp.context}`;

  return (
    <span
      className={`temp-token temp-${temp.kind}`}
      aria-label={label}
      data-context={temp.context}
    >
      {children}
    </span>
  );
}
```

Wrapping each temperature in `TemperatureSpan` gives you accessibility labels, differential styling for safety temperatures, click-to-copy hooks in nerd mode, and analytics hooks for hover/copy behavior.

## F.5 The card components

The full cooking card composes the narrative renderer at several levels: summary, per-step notes, and food safety.

```tsx
// src/components/CookingCard.tsx
import { NarrativeText } from "./NarrativeText";
import { UnitToggle } from "./UnitToggle";
import type { TemperatureObject } from "@/lib/temperature";

interface AdaptationStep {
  step_id: string;
  original_step_number: number;
  detected_intent: string;
  technique_category: string;
  ingredient_focus: string;
  impulse_mode: "temperature_control" | "power_mode" | "either";
  narrative_template: string;
  temps: Record<string, TemperatureObject>;
  sensory_cues: string[];
  risk_notes?: string;
  confidence_level: "high" | "medium" | "low";
}

interface AdaptationCard {
  card_id: string;
  recipe_title: string;
  source_url: string;
  source_domain: string;
  pan_type: string;
  confidence_level: "high" | "medium" | "low";
  summary: {
    dish_name: string;
    mode_strategy: string;
    key_risks: string[];
    narrative_template: string;
    temps: Record<string, TemperatureObject>;
  };
  steps: AdaptationStep[];
  food_safety: {
    applicable: boolean;
    narrative_template?: string;
    temps?: Record<string, TemperatureObject>;
  };
  nerd_mode: boolean;
}

export function CookingCard({ card }: { card: AdaptationCard }) {
  return (
    <article className="cooking-card">
      <header className="card-header">
        <h1>{card.recipe_title}</h1>
        <div className="card-meta">
          <a href={card.source_url} target="_blank" rel="noopener noreferrer">
            Original recipe at {card.source_domain}
          </a>
          <UnitToggle />
        </div>
      </header>

      <section className="card-summary">
        <h2>Strategy</h2>
        <p>
          <NarrativeText
            template={card.summary.narrative_template}
            temps={card.summary.temps}
            nerdMode={card.nerd_mode}
          />
        </p>
        <ConfidenceBadge level={card.confidence_level} />
      </section>

      <section className="card-steps">
        <h2>Step-by-step</h2>
        {card.steps.map((step) => (
          <StepCard key={step.step_id} step={step} nerdMode={card.nerd_mode} />
        ))}
      </section>

      {card.food_safety.applicable && (
        <FoodSafetySection
          template={card.food_safety.narrative_template!}
          temps={card.food_safety.temps!}
        />
      )}
    </article>
  );
}

function StepCard({
  step,
  nerdMode,
}: {
  step: AdaptationStep;
  nerdMode: boolean;
}) {
  return (
    <div className={`step-card confidence-${step.confidence_level}`}>
      <header>
        <span className="step-number">Step {step.original_step_number}</span>
        <span className="step-intent">{step.detected_intent}</span>
      </header>

      <ImpulseModeBadge mode={step.impulse_mode} />

      <p className="step-narrative">
        <NarrativeText
          template={step.narrative_template}
          temps={step.temps}
          nerdMode={nerdMode}
        />
      </p>

      <ul className="step-cues">
        {step.sensory_cues.map((cue, i) => (
          <li key={i}>{cue}</li>
        ))}
      </ul>

      {step.risk_notes && (
        <aside className="step-risk">
          <strong>Watch out:</strong> {step.risk_notes}
        </aside>
      )}
    </div>
  );
}

function FoodSafetySection({
  template,
  temps,
}: {
  template: string;
  temps: Record<string, TemperatureObject>;
}) {
  return (
    <section className="food-safety">
      <h2>Food safety</h2>
      <p>
        <NarrativeText template={template} temps={temps} nerdMode={true} />
      </p>
    </section>
  );
}

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const labels = {
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence — adjust by feel",
  };
  return <span className={`confidence-badge confidence-${level}`}>{labels[level]}</span>;
}

function ImpulseModeBadge({
  mode,
}: {
  mode: "temperature_control" | "power_mode" | "either";
}) {
  const labels = {
    temperature_control: "Temperature Control",
    power_mode: "Power Mode",
    either: "Either mode",
  };
  return <span className={`mode-badge mode-${mode}`}>{labels[mode]}</span>;
}
```

`FoodSafetySection` hardcodes `nerdMode={true}`. That implements the product rule that food safety always shows both units, regardless of user preference.

## F.6 The unit toggle component

```tsx
// src/components/UnitToggle.tsx
import { useUnit } from "@/contexts/UnitContext";

export function UnitToggle({ className }: { className?: string }) {
  const { unit, setUnit } = useUnit();

  return (
    <div
      className={`unit-toggle ${className ?? ""}`}
      role="group"
      aria-label="Temperature unit"
    >
      <button
        type="button"
        className={`unit-toggle-button ${unit === "F" ? "active" : ""}`}
        onClick={() => setUnit("F")}
        aria-pressed={unit === "F"}
      >
        °F
      </button>
      <button
        type="button"
        className={`unit-toggle-button ${unit === "C" ? "active" : ""}`}
        onClick={() => setUnit("C")}
        aria-pressed={unit === "C"}
      >
        °C
      </button>
    </div>
  );
}
```

Use two buttons rather than a checkbox or switch because the options are equally weighted after the user chooses, `aria-pressed` makes the active state clear, and the control maps to how cooks think: "I want Celsius" or "I want Fahrenheit."

## F.7 The feedback form

The feedback form needs careful handling because the user is reporting a temperature they used, and that unit may differ from their display preference.

```tsx
// src/components/FeedbackForm.tsx
import { useState } from "react";
import { useUnit } from "@/contexts/UnitContext";
import { cToF, fToC } from "@/lib/temperature";

interface FeedbackPayload {
  card_id: string;
  step_id?: string;
  overall_rating: "worked_well" | "mixed" | "did_not_work";
  feedback_tags: string[];
  actual_temp_input?: number;
  actual_temp_unit?: "F" | "C";
  actual_temp_f?: number;
  actual_temp_c?: number;
  actual_pan_type?: string;
  notes?: string;
}

export function FeedbackForm({
  cardId,
  stepId,
  onSubmit,
}: {
  cardId: string;
  stepId?: string;
  onSubmit: (feedback: FeedbackPayload) => Promise<void>;
}) {
  const { unit: displayUnit } = useUnit();
  const [overallRating, setOverallRating] =
    useState<FeedbackPayload["overall_rating"]>("worked_well");
  const [tags, setTags] = useState<string[]>([]);
  const [actualTempInput, setActualTempInput] = useState("");
  const [actualTempUnit, setActualTempUnit] = useState<"F" | "C">(displayUnit);
  const [actualPanType, setActualPanType] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: FeedbackPayload = {
      card_id: cardId,
      step_id: stepId,
      overall_rating: overallRating,
      feedback_tags: tags,
      actual_pan_type: actualPanType || undefined,
      notes: notes || undefined,
    };

    if (actualTempInput) {
      const inputValue = parseFloat(actualTempInput);
      if (!Number.isNaN(inputValue)) {
        payload.actual_temp_input = inputValue;
        payload.actual_temp_unit = actualTempUnit;

        if (actualTempUnit === "F") {
          payload.actual_temp_f = inputValue;
          payload.actual_temp_c = fToC(inputValue);
        } else {
          payload.actual_temp_c = inputValue;
          payload.actual_temp_f = cToF(inputValue);
        }
      }
    }

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="feedback-form">
      <fieldset>
        <legend>What temperature worked best?</legend>
        <div className="temp-input-group">
          <input
            type="number"
            step="1"
            value={actualTempInput}
            onChange={(e) => setActualTempInput(e.target.value)}
            placeholder={`e.g., ${actualTempUnit === "F" ? "325" : "163"}`}
            aria-label={`Actual temperature in degrees ${actualTempUnit}`}
          />
          <select
            value={actualTempUnit}
            onChange={(e) => setActualTempUnit(e.target.value as "F" | "C")}
            aria-label="Temperature unit for this entry"
          >
            <option value="F">°F</option>
            <option value="C">°C</option>
          </select>
        </div>
        {actualTempInput && (
          <p className="conversion-preview">
            Recording: {actualTempInput}°{actualTempUnit}
            {actualTempUnit === "F"
              ? ` (${Math.round(fToC(parseFloat(actualTempInput)))}°C)`
              : ` (${Math.round(cToF(parseFloat(actualTempInput)))}°F)`}
          </p>
        )}
      </fieldset>

      <button type="submit">Submit feedback</button>
    </form>
  );
}
```

The conversion preview is the safeguard. A user who types `163` with the Celsius selector immediately sees `(325°F)` and can catch a unit mistake before submitting.

## F.8 Test patterns

Pure functions are tested directly. Components are tested with the unit context wrapper.

```ts
// src/lib/temperature.test.ts
import { cToF, fToC, renderTemperature } from "./temperature";

describe("temperature conversion", () => {
  it("converts F to C correctly", () => {
    expect(fToC(212)).toBeCloseTo(100, 5);
    expect(fToC(32)).toBeCloseTo(0, 5);
    expect(fToC(335)).toBeCloseTo(168.33, 2);
  });

  it("converts C to F correctly", () => {
    expect(cToF(100)).toBeCloseTo(212, 5);
    expect(cToF(0)).toBeCloseTo(32, 5);
    expect(cToF(168)).toBeCloseTo(334.4, 2);
  });
});

describe("renderTemperature", () => {
  it("renders a point temperature in Fahrenheit", () => {
    const temp = {
      f: 335,
      kind: "point" as const,
      precision: "whole" as const,
      context: "test",
    };
    expect(renderTemperature(temp, { unit: "F" })).toBe("335°F");
  });

  it("renders a point temperature in Celsius", () => {
    const temp = {
      f: 335,
      kind: "point" as const,
      precision: "whole" as const,
      context: "test",
    };
    expect(renderTemperature(temp, { unit: "C" })).toBe("168°C");
  });

  it("renders a range with both endpoints converted", () => {
    const temp = {
      f: 330,
      f_max: 350,
      kind: "range" as const,
      precision: "whole" as const,
      context: "test",
    };
    expect(renderTemperature(temp, { unit: "F" })).toBe("330°F to 350°F");
    expect(renderTemperature(temp, { unit: "C" })).toBe("166°C to 177°C");
  });

  it("forces both units for safety temps", () => {
    const temp = {
      f: 165,
      kind: "safety" as const,
      precision: "whole" as const,
      context: "internal_poultry",
      force_both_units: true,
    };
    expect(renderTemperature(temp, { unit: "F" })).toBe("165°F (74°C)");
    expect(renderTemperature(temp, { unit: "C" })).toBe("74°C (165°F)");
  });

  it("shows both units in nerd mode for non-safety temps", () => {
    const temp = {
      f: 335,
      kind: "point" as const,
      precision: "whole" as const,
      context: "test",
    };
    expect(renderTemperature(temp, { unit: "F", nerdMode: true })).toBe(
      "335°F (168°C)"
    );
    expect(renderTemperature(temp, { unit: "C", nerdMode: true })).toBe(
      "168°C (335°F)"
    );
  });

  it("preserves decimal precision when specified", () => {
    const temp = {
      f: 300,
      kind: "threshold" as const,
      precision: "decimal_1" as const,
      context: "sugar_hard_crack",
    };
    expect(renderTemperature(temp, { unit: "F" })).toBe("300.0°F");
    expect(renderTemperature(temp, { unit: "C" })).toBe("148.9°C");
  });
});
```

## F.9 Performance notes

The `useMemo` in `NarrativeText` recomputes only when `template`, `temps`, `unit`, or `nerdMode` change. With dozens of steps per card, React batches the unit-toggle re-render and the work is cheap regex plus string concatenation.

Worth doing:

1. Debounce `localStorage` writes if users toggle rapidly.
2. Avoid running the regex on every render. The `useMemo` does this already.
3. Consider server-prefetched formatted strings only if profiling shows a real bottleneck.

Not worth doing:

1. Memoizing individual temperature renders; the cache overhead exceeds the work.
2. Server-side conversion; the client owns the user's unit preference.

---

# G. Eval Harness Structure

## G.1 What we're evaluating

Three layers of correctness, in order of stringency:

1. **Schema correctness.** The output validates against the JSON schema. Binary pass/fail.
2. **Structural correctness.** Tokens resolve, ranges have endpoints, safety temps are flagged, recipe prose is not republished. Binary pass/fail per rule.
3. **Cooking correctness.** Temperatures and techniques make sense for the dish. Partly automated, partly human reviewed.

The harness automates layers 1 and 2 fully. Layer 3 combines automated checks, such as sensible temperature ranges by technique, with human review against a fixed eval set.

## G.2 Architecture

```text
eval/
├── recipes/
│   ├── 001-simple-pancakes.json
│   ├── 002-pasta-carbonara.json
│   └── ...
├── expected/
│   ├── 001-simple-pancakes.rules.json
│   └── ...
├── runners/
│   ├── run-eval.ts
│   ├── schema-validator.ts
│   ├── structural-checker.ts
│   └── cooking-checker.ts
├── reports/
│   ├── 2026-05-19-prompt-v3/
│   │   ├── summary.json
│   │   ├── per-recipe.json
│   │   └── failures.md
└── snapshots/
    ├── 2026-05-15-prompt-v2/
    └── 2026-05-19-prompt-v3/
```

Every run produces a timestamped, prompt-version-tagged report directory. Reports are checked into git so regressions are visible in diffs.

## G.3 The recipe input format

Each test recipe is a JSON file containing the input to the AI plus metadata.

```json
{
  "id": "002-pasta-carbonara",
  "name": "Pasta Carbonara",
  "category": "multi_phase",
  "difficulty_class": "medium",
  "expected_features": ["multiple_techniques", "egg_safety", "stainless_pan"],
  "input": {
    "recipe_title": "Pasta Carbonara",
    "source_url": "https://example.com/carbonara",
    "source_domain": "example.com",
    "ingredients": [
      "1 lb spaghetti",
      "6 oz guanciale or pancetta, diced",
      "4 large egg yolks",
      "1 whole egg",
      "1 cup grated Pecorino Romano",
      "Freshly cracked black pepper"
    ],
    "instructions": [
      "Bring a large pot of salted water to a boil. Cook pasta until al dente.",
      "Meanwhile, render guanciale in a stainless skillet over medium heat until crisp.",
      "In a bowl, whisk eggs, yolks, cheese, and pepper.",
      "Drain pasta, reserving 1 cup of pasta water. Add pasta to skillet off heat.",
      "Pour egg mixture over pasta, tossing constantly. Add pasta water as needed to create a creamy sauce."
    ],
    "user_context": {
      "pan_type": "stainless",
      "pan_size": "12-inch",
      "experience_level": "comfortable",
      "cooking_goal": "render_and_emulsify",
      "preferred_temp_unit": "F"
    }
  }
}
```

## G.4 The expected-rules format

Each recipe has a corresponding rules file specifying what must be true of the output. These are rules, not literal expected outputs.

```json
{
  "id": "002-pasta-carbonara",
  "schema_validation": "required",
  "rules": [
    {
      "id": "no_plain_text_temps",
      "description": "No narrative_template field contains a plain-text temperature",
      "type": "no_match",
      "field": "**.narrative_template",
      "pattern": "\\d+\\s*°?\\s*[FC]\\b",
      "severity": "critical"
    },
    {
      "id": "all_tokens_resolved",
      "description": "Every {{temp_n}} token has a matching entry in temps",
      "type": "tokens_resolved",
      "severity": "critical"
    },
    {
      "id": "safety_temp_present",
      "description": "Food safety section is applicable and includes egg internal temp",
      "type": "field_equals",
      "field": "food_safety.applicable",
      "value": true,
      "severity": "high"
    },
    {
      "id": "safety_temp_both_units",
      "description": "Egg safety temperature uses force_both_units",
      "type": "temp_attribute",
      "context_match": "internal_egg",
      "attribute": "force_both_units",
      "value": true,
      "severity": "critical"
    },
    {
      "id": "render_temp_sensible",
      "description": "Render guanciale temp should be 275-340°F",
      "type": "temp_range_check",
      "context_match": "render_guanciale",
      "f_min": 275,
      "f_max": 340,
      "severity": "medium"
    },
    {
      "id": "no_recipe_prose_copy",
      "description": "Output does not contain verbatim original instruction text",
      "type": "similarity_check",
      "max_similarity": 0.4,
      "severity": "critical"
    }
  ]
}
```

The rule types are extensible. Adding a new rule type is a small change to the structural checker.

## G.5 The runner

The runner writes `summary.json`, `per-recipe.json`, `failures.md`, checks regressions against the latest snapshot, and exits non-zero on critical failures.

```ts
// eval/runners/run-eval.ts
import fs from "fs/promises";
import path from "path";
import { callAdaptationAPI } from "./api-client";
import { checkCooking } from "./cooking-checker";
import { validateSchema } from "./schema-validator";
import { checkStructure } from "./structural-checker";

async function runEval(promptVersion: string) {
  const recipesDir = path.join(__dirname, "..", "recipes");
  const rulesDir = path.join(__dirname, "..", "expected");
  const reportsDir = path.join(
    __dirname,
    "..",
    "reports",
    `${new Date().toISOString().split("T")[0]}-${promptVersion}`
  );

  await fs.mkdir(reportsDir, { recursive: true });
  const results = [];

  for (const file of await fs.readdir(recipesDir)) {
    if (!file.endsWith(".json")) continue;

    const recipe = JSON.parse(
      await fs.readFile(path.join(recipesDir, file), "utf-8")
    );
    const rules = JSON.parse(
      await fs.readFile(
        path.join(rulesDir, file.replace(".json", ".rules.json")),
        "utf-8"
      )
    );

    const start = Date.now();
    const output = await callAdaptationAPI(recipe.input, promptVersion);
    const duration_ms = Date.now() - start;

    const schema = validateSchema(output);
    const rule_results = checkStructure(output, rules);
    const cooking_checks = checkCooking(output, recipe, rules);

    results.push({
      recipe_id: recipe.id,
      prompt_version: promptVersion,
      timestamp: new Date().toISOString(),
      schema_valid: schema.valid,
      schema_errors: schema.errors,
      rule_results,
      cooking_checks,
      raw_output: output,
      duration_ms,
    });
  }

  const summary = computeSummary(results);
  await fs.writeFile(
    path.join(reportsDir, "summary.json"),
    JSON.stringify(summary, null, 2)
  );
  await fs.writeFile(
    path.join(reportsDir, "per-recipe.json"),
    JSON.stringify(results, null, 2)
  );
  await fs.writeFile(path.join(reportsDir, "failures.md"), formatFailures(results));
  await checkRegression(results);

  if (summary.critical_failures > 0) process.exit(1);
}
```

## G.6 The structural checker

The structural checker handles the rule types defined in the rules format.

```ts
// eval/runners/structural-checker.ts
interface Rule {
  id: string;
  description: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  [key: string]: unknown;
}

export function checkStructure(output: unknown, rules: { rules: Rule[] }) {
  return rules.rules.map((rule) => runRule(output, rule));
}

function runRule(output: unknown, rule: Rule) {
  switch (rule.type) {
    case "no_match":
      return checkNoMatch(output, rule);
    case "tokens_resolved":
      return checkTokensResolved(output, rule);
    case "field_equals":
      return checkFieldEquals(output, rule);
    case "field_in_set":
      return checkFieldInSet(output, rule);
    case "temp_attribute":
      return checkTempAttribute(output, rule);
    case "technique_present":
      return checkTechniquePresent(output, rule);
    case "step_with_context":
      return checkStepWithContext(output, rule);
    case "temp_range_check":
      return checkTempRange(output, rule);
    case "similarity_check":
      return checkSimilarity(output, rule);
    default:
      return {
        rule_id: rule.id,
        passed: false,
        severity: rule.severity,
        details: `Unknown rule type: ${rule.type}`,
      };
  }
}
```

Core checks:

1. `no_match` collects all matching fields and fails if a regex matches any of them.
2. `tokens_resolved` verifies every token in each `narrative_template` has a matching key in the adjacent `temps` object, and that there are no unused temps.
3. `temp_attribute` and `temp_range_check` traverse all `temps` dictionaries and inspect matching `context` values.
4. `similarity_check` compares each `narrative_template` against original instructions using token-overlap/Jaccard similarity.

For production, use a real JSONPath library instead of hand-rolled `**.field` traversal.

## G.7 The eval set

Minimum viable corpus: 30 recipes, distributed across difficulty classes.

Simple single-technique:

1. Buttermilk pancakes.
2. Grilled cheese.
3. Fried eggs over easy.
4. Pan-seared salmon fillet.
5. Sauteed garlic in olive oil.

Multi-phase:

1. Pasta carbonara.
2. Beef stir-fry.
3. Mushroom risotto.
4. Tomato sauce from scratch.
5. French onion soup base.

Protein-heavy:

1. Reverse-seared ribeye.
2. Roast chicken thighs with stovetop start.
3. Pork tenderloin medallions.
4. Pan-fried tilapia.
5. Shrimp scampi.

High-risk:

1. Caramel for flan.
2. Deep-fried chicken thighs.
3. Hollandaise sauce.
4. Tempering chocolate.
5. Creme anglaise.

Vague instruction:

1. Scrambled eggs with only "cook until done."
2. Recipe with "medium heat" repeated throughout.
3. Recipe with no temperature mentions.
4. Recipe with conflicting cues.
5. Recipe written in metaphor.

Non-U.S. recipes:

1. BBC Good Food shepherd's pie.
2. Australian lamington base.
3. French confit, stovetop portion.
4. Japanese tonkatsu.
5. Italian risotto al nero.

Each gets an input JSON file and a rules JSON file. Thirty recipes is small enough to run in one batch and large enough to catch the common regressions.

## G.8 Running the eval

```bash
npm run eval -- --prompt-version=v3.2-decimal-precision
npm run eval -- --prompt-version=production --notify-slack
```

A prompt-change PR should include:

1. The prompt change itself.
2. The eval report showing pass rates before and after.
3. Any new test recipes added for the new behavior.

Prompt changes that drop critical pass rates below 100% do not ship.

## G.9 The human review loop

Layer 3 is partially automated via `temp_range_check`, but full coverage requires human review. The harness supports this with a `requires_review.json` file per report.

Selection criteria:

1. Any output with `confidence_level === "low"`.
2. Any output where allowed temperature ranges are especially wide.
3. A random 10% sample of all outputs.

Reviewer outcomes are `accept`, `accept_with_notes`, or `reject`. Rejections become new test rules. This is how the harness grows: every human-detected issue becomes an automated check.

## G.10 What the eval gives you

Immediate value:

1. Confidence to deploy prompt changes.
2. A data set for possible fine-tuning once you have 100+ verified recipes.
3. A communicable quality signal for partners, investors, and contributors.

What's still missing:

1. The eval set needs to grow with the product. Thirty recipes is the minimum for Stage 3; Stage 5 should be 100+.
2. Human review is real work. Plan for 2-3 hours per week of cooking-domain review and rule conversion.
3. The rendering layer needs design-partner review. The conversion preview can be correct in code and still feel wrong in use.

You now have the complete end-to-end system: a token schema the AI can reliably produce, prompt engineering and eval infrastructure to keep it producing, a rendering layer that consumes it cleanly, a database schema that captures structured feedback, and an admin workflow that turns feedback into recommendations.
