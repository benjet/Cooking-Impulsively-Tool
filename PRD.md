# PRD: Cooking Impulsively MVP

## Product name

**Cooking Impulsively**

## Core feature name

**Cook This Impulsively**

## One-line concept

Users submit a recipe URL and receive an Impulse-friendly cooking card that translates vague stovetop instructions into temperature, power, timing, cue, and pan-specific guidance, then improves over time based on real user cooking feedback.

## Product thesis

Most recipes use vague stovetop language — "medium heat," "medium-high," "simmer," "until browned," "cook until fragrant." These terms are inconsistent because stove output, pan material, burner size, food volume, and user technique all affect results. Serious Eats has documented this directly: stovetop heat settings are not universal, and reliable cooking depends more on sensory cues like oil shimmer, sizzling, browning, scent, and liquid behavior than on a dial label.

Impulse changes the opportunity. The cooktop supports true temperature control: users can set an exact temperature and the stove automatically adjusts power to maintain it, while still surfacing familiar cues like low, medium, and high.

The MVP should not simply convert "medium-high" into a fixed number. It should analyze the **whole recipe** — ingredients, technique, cooking goal, intended outcome — and produce a safer, clearer Impulse-specific companion card.

---

# 1. Problem

Home cooks transitioning to Impulse face a translation problem.

Traditional recipes are written for inconsistent stovetops and use general language:

- "Heat over medium-high"
- "Reduce to low"
- "Cook until browned"
- "Simmer gently"
- "Do not burn the garlic"
- "Sear until deeply browned"

On Impulse, users reasonably ask:

- Should I use Temperature Control or Power Mode?
- What temperature should I set?
- Is the recipe trying to brown, soften, crisp, melt, reduce, or simmer?
- Should garlic and onions use the same temperature?
- Does stainless behave differently than cast iron?
- When should I ignore the original heat instruction and follow visual cues instead?

The tool solves this by producing an **Impulse-friendly instruction layer**, not by replacing the original recipe.

---

# 2. Target users

## Primary users

**Impulse owners and new users.** People who own the cooktop and want better results when following existing recipes.

**Impulse-curious buyers.** People deciding whether the cooktop will make cooking easier, more precise, or more enjoyable.

**Technically minded home cooks.** People who like precision cooking, induction, sous vide, outdoor cooking gear, pizza ovens, smokers, and other equipment-specific communities.

## Secondary users

**Recipe testers and community contributors.** Users willing to cook, rate, and refine suggested temperature guidance.

**Remodeling and kitchen planning users.** People researching Impulse as part of a kitchen build and wanting to understand what cooking on it actually feels like.

---

# 3. MVP goal

Build a lightweight web app that lets a user:

1. Paste a recipe URL.
2. Confirm or edit key recipe details.
3. Select pan type and experience level.
4. Receive an Impulse-friendly cooking card.
5. Cook the recipe.
6. Provide structured feedback.
7. Improve future recommendations based on aggregated feedback.

---

# 4. Non-goals for MVP

- Do **not** build a full social network.
- Do **not** attempt full automated recipe rewriting.
- Do **not** copy and republish the full original recipe.
- Do **not** guarantee food safety based on pan temperature alone.
- Do **not** claim affiliation with Impulse Labs unless permission exists.
- Do **not** attempt deep personalization or machine learning in v1. Start with structured feedback and rule-assisted recommendations.

---

# 5. Legal and attribution guardrails

The product behaves as a **companion layer** to existing recipes.

The U.S. Copyright Office holds that a basic list of ingredients or simple directions is not copyrightable, but creative descriptions, explanations, photos, and expressive writing may be protected.

Therefore, the MVP:

- Links prominently to the original recipe.
- Shows source name and recipe title.
- Avoids copying headnotes, personal stories, photography, or expressive recipe prose.
- Stores only functional extracted data needed for analysis.
- Generates original Impulse-specific notes.
- Labels output as "adaptation notes," not "the recipe."
- Provides an opt-out/contact path for publishers.

Suggested disclaimer:

> Cooking Impulsively provides independent cooking adaptation notes for use alongside the original recipe. We do not replace the original recipe and are not affiliated with the recipe publisher or Impulse Labs.

---

# 6. Data sources and extraction approach

Many recipe websites use structured recipe data. Google's recipe structured-data documentation describes metadata such as cooking time, ingredients, nutrition, and instructions; Schema.org's Recipe type includes `recipeIngredient`, `recipeInstructions`, and `recipeYield`.

## MVP extraction priority

1. Extract Recipe schema if available.
2. Fall back to readable page extraction if schema is missing.
3. If extraction fails, ask the user to paste ingredients and instructions manually.
4. Always show a confirmation screen before generating adaptation notes.

---

# 7. Core user flow

## Flow A: First-time recipe adaptation

1. User lands on homepage.
2. User sees input: "Paste a recipe URL."
3. User pastes URL.
4. System extracts recipe title, source, yield, ingredients, and instructions.
5. User confirms or edits extracted content.
6. User answers quick cooking context:
   - Pan type
   - Pan size (optional)
   - Cooktop size/model (optional)
   - Experience level: beginner, comfortable, nerd mode
   - Preferred temperature unit (°F or °C)
   - Desired style: follow closely, optimize for precision, avoid burning, maximize browning
7. System analyzes recipe.
8. System outputs Impulse-friendly cooking card.
9. User saves card.
10. After cooking, user rates the result and provides structured feedback.

## Flow B: Returning user

1. User logs in or returns via saved session.
2. User sees previous adapted recipes.
3. User can duplicate, adjust pan type, or submit cooking feedback.
4. System updates aggregate learnings for future cards.

---

# 8. MVP screens

## Screen 1: Landing page

**Purpose:** Explain the value quickly.

**Headline:** Cook This Impulsively

**Subheadline:** Paste a recipe URL and get an Impulse-friendly cooking card with temperature, power, timing, and cue-based guidance.

**Primary input:** Recipe URL field

**CTA:** Generate cooking card

**Trust note:** Independent community tool. Not affiliated with Impulse Labs or recipe publishers.

---

## Screen 2: Recipe extraction confirmation

**Purpose:** Prevent bad extraction from poisoning the output.

**Fields displayed:**

- Recipe title
- Source site
- Original URL
- Yield
- Total time
- Ingredients
- Instructions
- Detected stovetop steps

**User actions:** Confirm · Edit · Paste manually · Cancel

**Acceptance criteria:**

- User must confirm before generation.
- If no instructions are detected, user must paste instructions manually.
- Original source remains visible.

---

## Screen 3: Cooking context

**Purpose:** Capture the variables that matter.

**Required fields:**

- **Pan type:** stainless steel, cast iron, carbon steel, nonstick, enameled cast iron, wok, other
- **Main cooking goal** (best guess by tool, user can override): sear, brown, sweat/soften, sauté, simmer, reduce, fry, melt, hold warm, mixed/unclear
- **Experience level:** beginner, comfortable, nerd mode
- **Temperature unit:** °F or °C (defaults to user profile setting or locale)

**Optional fields:**

- Pan size
- Ingredient substitutions
- Cooktop model
- Dietary or texture preferences
- "I burn things easily"
- "I want more browning"
- "I want less smoke"

---

## Screen 4: Impulse-friendly cooking card

**Purpose:** Give the user a practical companion card.

**Output sections:**

### A. Summary

- Dish name
- Source recipe link
- Overall difficulty
- Best Impulse mode strategy
- Confidence level
- Key risk points

Example:

> This recipe has three heat-sensitive phases: browning aromatics, simmering sauce, and finishing dairy. Use Temperature Control for the aromatic phase, Power Mode for the simmer, and lower controlled heat for the finish.

### B. Heat map

| Recipe phase | Original cue | Impulse mode | Suggested target | What to watch for |
|---|---|---|---|---|
| Sauté onions | Medium-high | Temperature Control | 330°F to 350°F | Steady sizzle, golden edges |
| Add garlic | Same pan | Temperature Control | Drop to 285°F to 310°F | Fragrant, not browned |
| Simmer sauce | Low simmer | Power Mode or Temp Control | Gentle bubbling | Small bubbles, no scorching |

All temperatures render in the user's selected unit. Toggle is persistent on this screen.

### C. Step-by-step adaptation notes

For each relevant step:

- Original step reference
- Detected intent
- Suggested Impulse setting
- Timing adjustment
- Visual/auditory/smell cue
- Adjustment guidance
- Pan-specific note

Example:

> **Step 3: Cook onions over medium-high heat**
> **Intent:** Brown and soften
> **Impulse mode:** Temperature Control
> **Start at:** 335°F
> **Adjust:** Increase toward 350°F if onions release water and stay pale. Drop toward 315°F if edges darken before centers soften.
> **Cue:** Steady sizzling and light browning by minute 4 to 6.

### D. Confidence and caution

- **High confidence:** Pancakes, onions, grilled cheese, eggs, simple searing.
- **Medium confidence:** Sauces, reductions, stir-fry, mixed vegetables.
- **Low confidence:** Candy, deep frying, delicate emulsions, recipes with unclear steps.

### E. Food safety note

When meat, poultry, seafood, or eggs are involved, the app reminds users that pan temperature is not the same as internal food temperature. USDA safe minimum internal temperatures include 165°F for poultry, 160°F for ground meats, and 145°F with rest time for whole cuts of beef, pork, lamb, and veal. Food safety temperatures display in both units regardless of user preference, since underdone meat is a safety issue, not a stylistic one.

---

# 9. AI behavior requirements

## The AI analyzes

- Ingredient list
- Recipe title
- Cooking method
- Instruction sequence
- Heat words
- Sensory cues
- Timing cues
- Liquid volume
- Fat type
- Delicate ingredients
- Proteins requiring doneness checks
- Pan type
- User goal

## The AI infers

- Cooking phase
- Intended outcome
- Whether Temperature Control or Power Mode is more appropriate
- Whether the recipe's heat cue is about pan temperature, liquid behavior, or ingredient transformation
- Where burning, scorching, sticking, or under-browning is likely
- Where original instructions should be preserved

## The AI does not

- Pretend one universal temperature equals "medium-high"
- Remove sensory cues
- Replace internal food temperature guidance
- Present low-confidence suggestions as certain
- Copy the original recipe's expressive wording
- Hide uncertainty

---

# 10. Recommendation logic

## Core logic model

Each step is classified by:

**Ingredient type + technique + intended outcome + pan type + risk level**

Example:

- Ingredient: onions
- Technique: sauté/brown
- Outcome: golden edges, softened center
- Pan: stainless
- Risk: sticking or scorching
- Suggested mode: Temperature Control
- Suggested temp range: 330°F to 350°F
- Cue: steady sizzle, gradual browning

## Technique categories

Preheat · Sweat · Sauté · Brown · Sear · Simmer · Boil · Reduce · Fry · Melt · Toast · Finish · Hold warm

## Ingredient sensitivity categories

- **Aromatics:** onion, garlic, shallot, ginger
- **Proteins:** beef, chicken, pork, fish, tofu, eggs
- **Dairy:** butter, cream, cheese
- **Sugar:** caramelization/scorch risk
- **Starches:** pancakes, potatoes, rice, pasta
- **Vegetables:** watery vs. dense
- **Sauces:** tomato, cream, pan sauce, reduction

---

# 11. Temperature unit switching

## 11.1 Why this is a first-class MVP requirement

Cooking is global. Impulse's interface is not. The cooktop's published product language uses Fahrenheit with single-degree resolution across a 68°F to 482°F range, but the recipes users paste come from a mix of U.S., U.K., European, Australian, and Asian sources where Celsius is standard.

If the app forces a single unit, three things break:

1. **Trust.** A Celsius-native cook reading "335°F" mentally converts every number, which slows cooking and introduces conversion errors at the exact moments precision matters.
2. **Feedback quality.** If users enter "170" without specifying a unit, the aggregated learning layer becomes meaningless. Was that 170°C or 170°F?
3. **Adoption.** Non-U.S. users won't return to a tool that feels foreign on every screen.

Unit switching is therefore a Stage 3 requirement, not a Stage 5 polish item.

## 11.2 Default behavior

- Default to Fahrenheit for U.S. users (detected via locale, IP, or browser settings).
- Default to Celsius for all other detected locales.
- Allow switching at any time without regenerating content.
- Save preference to user profile if authenticated; fall back to browser localStorage for unauthenticated users.
- In Nerd Mode, display both units simultaneously (e.g., `335°F / 168°C`).

## 11.3 Internal storage

Store all temperature values canonically in **Fahrenheit**. Impulse's published product language uses Fahrenheit throughout, so Fahrenheit is the device-native unit and keeps storage aligned with the hardware.

Convert to Celsius at the presentation layer only.

Conversion formulas (NIST):

- °C = (°F − 32) / 1.8
- °F = (°C × 1.8) + 32

## 11.4 Display rules

| Context | Rule | Example |
|---|---|---|
| Fahrenheit | Whole degrees | 335°F |
| Celsius | Round to nearest whole degree | 168°C |
| Ranges | Convert both endpoints | 330°F–350°F → 166°C–177°C |
| High-risk techniques (sugar, frying, chocolate, candy) | One decimal in Celsius when meaningful | 171.1°C |
| Food safety thresholds | Always show both units | 165°F (74°C) |

Avoid false precision (e.g., 176.7°C) in standard mode.

## 11.5 UI placement

A persistent toggle (`°F | °C`) appears on:

- User profile / settings
- Cooking context screen
- Generated cooking card
- Saved recipe card
- Post-cook feedback form
- Public adaptation library
- Admin dashboard

The toggle is visible without requiring a settings detour. Toggling never triggers an AI regeneration — only a re-render.

## 11.6 AI output behavior

The AI generates temperature recommendations in the user's selected unit at time of generation. If the user switches units after generation, the card recalculates and redisplays without a new AI call. All narrative text containing temperatures updates dynamically.

**Fahrenheit view:** Start at 335°F. Increase toward 350°F if onions release water and stay pale.

**Celsius view:** Start at 168°C. Increase toward 177°C if onions release water and stay pale.

This requires the AI to emit structured temperature tokens (not free-text "335°F" inside prose) so the frontend can swap units cleanly. Example schema:

```json
{
  "narrative_template": "Start at {{temp_1}}. Increase toward {{temp_2}} if onions release water and stay pale.",
  "temps": {
    "temp_1": { "f": 335 },
    "temp_2": { "f": 350 }
  }
}
```

## 11.7 Feedback form behavior

When users submit actual temperature used, the form captures:

```json
{
  "actual_temp_input": 170,
  "actual_temp_unit": "C",
  "actual_temp_f": 338,
  "actual_temp_c": 170
}
```

The input field auto-labels with the user's current unit but allows override per entry (some users may read their thermometer in the opposite unit).

## 11.8 Admin requirement

The admin dashboard displays feedback temperatures in both units alongside one canonical stored value (Fahrenheit). No manual conversion required. Aggregated learning tables also store canonical Fahrenheit values, so community notes can be displayed in either unit at the presentation layer.

## 11.9 Acceptance criteria

- [ ] User can switch between °F and °C from any cooking card
- [ ] All temperatures, ranges, and inline narrative text update correctly on toggle
- [ ] Unit preference persists across sessions (profile or localStorage)
- [ ] Locale-based default works for U.S. and non-U.S. users
- [ ] Community feedback aggregates correctly regardless of entry unit
- [ ] Public cards can be shared with either unit displayed
- [ ] Nerd Mode shows both units simultaneously
- [ ] Food safety temperatures always show both units
- [ ] High-risk technique steps allow one decimal in Celsius when precision matters
- [ ] Toggling never triggers AI regeneration

---

# 12. Feedback loop

A thumbs-up is useful but insufficient. The MVP captures more structure without becoming annoying.

## Post-cook feedback prompt

**How did this adaptation work?**

- Worked well
- Too hot
- Too cool
- Timing was off
- Browned too fast
- Did not brown enough
- Simmer was too aggressive
- Sauce reduced too slowly
- Food stuck to pan
- Food scorched
- I changed the temp and it worked better

## Follow-up fields

- What pan did you use?
- Did you follow the suggested temp?
- What temp worked best? (with unit selector — see Section 11)
- Would you use this adaptation again?
- Optional notes
- Optional photo

## Learning rule for MVP

Do not auto-train blindly. Instead:

- Store feedback by recipe step, ingredient, technique, pan type, and temperature (canonical °F).
- Show aggregate community notes only after enough users have cooked the same or similar step.
- Require a minimum number of consistent reports before changing default recommendations.
- Flag conflicting feedback for admin review.

Example community note:

> 8 users cooked this onion step in stainless steel. Most preferred 325°F to 335°F (163°C to 168°C) instead of the original 350°F suggestion.

---

# 13. Data model

## User

- `user_id`
- `email` or auth provider
- `display_name`
- `created_at`
- `default_pan_type`
- `default_experience_level`
- `preferred_temp_unit` ("F" or "C")
- `locale`

## Recipe source

- `recipe_id`
- `source_url`
- `source_domain`
- `source_title`
- `author` (if available)
- `extracted_at`
- `extraction_method` (schema / manual / fallback)
- `copyright_status` (linked_only)
- `canonical_url`

## Recipe extraction

- `extraction_id`
- `recipe_id`
- `raw_ingredients_functional`
- `raw_instructions_functional`
- `yield`
- `prep_time`
- `cook_time`
- `detected_stovetop_steps`
- `extraction_confidence`

## Adaptation card

- `card_id`
- `recipe_id`
- `user_id`
- `pan_type`
- `pan_size`
- `experience_level`
- `temp_unit_at_generation` ("F" or "C")
- `generated_summary`
- `confidence_level`
- `created_at`

## Adaptation step

- `step_id`
- `card_id`
- `original_step_number`
- `detected_intent`
- `technique_category`
- `ingredient_focus`
- `impulse_mode`
- `suggested_temp_min_f` (canonical Fahrenheit)
- `suggested_temp_max_f` (canonical Fahrenheit)
- `suggested_power_level`
- `suggested_time`
- `sensory_cues`
- `adjustment_guidance`
- `narrative_template` (with `{{temp_n}}` placeholders for unit-agnostic rendering)
- `risk_notes`
- `confidence_level`

## User feedback

- `feedback_id`
- `user_id`
- `card_id`
- `step_id` (optional)
- `overall_rating`
- `feedback_tags`
- `actual_temp_input` (as entered)
- `actual_temp_unit` ("F" or "C")
- `actual_temp_f` (normalized)
- `actual_temp_c` (normalized)
- `actual_pan_type`
- `timing_feedback`
- `notes`
- `photo_url` (optional)
- `created_at`

## Aggregated learning

- `learning_id`
- `technique_category`
- `ingredient_focus`
- `pan_type`
- `suggested_temp_min_f` (canonical Fahrenheit)
- `suggested_temp_max_f` (canonical Fahrenheit)
- `confidence_score`
- `number_of_successes`
- `number_of_failures`
- `common_adjustment`
- `last_updated`

---

# 14. Community layer for MVP

Keep community lightweight at first.

## MVP community elements

- Public library of adapted recipes
- Browse by: ingredient, technique, pan type, confidence level, most cooked, most successful
- User comments on adaptation cards
- "I cooked this" feedback
- Community notes surfaced only after enough feedback

## Avoid in MVP

- Direct messaging
- Private groups
- Full forum
- Complex reputation system
- Paid memberships
- Influencer features

---

# 15. Admin dashboard

Admin can:

- View submitted recipe URLs
- View failed extractions
- Review generated cards
- See low-confidence adaptations
- See flagged copyright/source concerns
- Moderate comments
- Merge duplicate recipes
- Review feedback clusters (with both °F and °C display)
- Approve "community-tested" notes
- Add or edit baseline technique guidance

---

# 16. Safety and quality requirements

## Safety

- Always include food safety reminders for meat, poultry, seafood, and eggs.
- Never present pan temperature as proof of food doneness.
- Encourage use of a food thermometer where relevant.
- Warn when deep frying, candy, pressure, or high-smoke techniques are involved.
- Display safe internal food temperatures in both °F and °C regardless of user preference.
- Include "use your senses" cues because recipe heat settings are inherently variable.

## Quality

Every generated card must include:

- Original source link
- Cooking mode recommendation
- Temperature or power guidance (in user's selected unit, with toggle)
- Sensory cues
- Adjustment instructions
- Confidence level
- Feedback prompt

## Trust

- Label the tool as independent.
- Explain when the tool is guessing.
- Avoid overpromising precision.
- Keep the original recipe creator visible.

---

# 17. Success metrics

## MVP activation

- % of users who paste a URL
- % of recipe URLs successfully extracted
- % of users who generate a card
- % of users who save or share a card

## Cooking value

- % of generated cards receiving feedback
- % of users rating "worked well"
- % of users who cook a second adapted recipe
- Number of recipes with at least 3 successful user reports

## Learning quality

- Number of temperature adjustments submitted
- Number of repeatable technique/pan/ingredient patterns found
- Reduction in "too hot" or "too cool" reports over time

## Community quality

- Number of public adaptation cards
- Comments per adapted recipe
- Repeat contributors
- Most adapted recipe sources/domains
- Search traffic to adaptation pages

## Unit-switching health (new)

- % of users who switch units at least once
- Geographic distribution of unit preferences
- % of feedback entries with explicit unit declared
- Conversion error rate (flagged outliers in aggregated learning)

---

# 18. MVP stages

## Stage 0: Product shell and positioning

**Goal:** Create the brand container and landing experience.

**Build:** Landing page · recipe URL input · basic explanation · independent community disclaimer · email capture · waitlist/beta access · terms/privacy placeholder.

**Acceptance criteria:**

- User understands the value in under 10 seconds.
- User can submit email and recipe URL.
- Site clearly says it is independent and not official Impulse Labs support.

---

## Stage 1: Manual-assisted recipe adaptation prototype

**Goal:** Validate usefulness before building full automation.

**Build:** Recipe URL submission · manual or semi-automated extraction · admin can generate/edit adaptation card · user receives card · user can rate outcome.

This can be powered manually behind the scenes.

**Acceptance criteria:**

- 25 to 50 recipes adapted.
- At least 10 users cook from cards and provide feedback.
- Clear evidence that users understand and value the output.

This is the fastest way to test the idea before investing in full URL parsing and automation.

---

## Stage 2: Automated recipe extraction

**Goal:** Let users paste a URL and get a draft extraction.

**Build:** Recipe schema parser · fallback extraction · manual paste fallback · user confirmation screen · extracted stovetop step detection.

**Acceptance criteria:**

- Extracts structured recipe data when available.
- Identifies likely stovetop steps.
- Requires user confirmation before generation.
- Fails gracefully when recipe extraction does not work.

---

## Stage 3: AI-generated Impulse cooking card with unit switching

**Goal:** Generate the first complete automated adaptation with full unit support.

**Build:** Recipe analysis pipeline · technique classification · ingredient sensitivity detection · mode recommendation (Temperature Control vs Power Mode) · suggested temperature/power range · step-specific cue guidance · confidence scoring · food safety notes · **unit-aware rendering with `°F | °C` toggle on all temperature surfaces**.

**Acceptance criteria:**

- Every generated card includes source link, mode, temp/power guidance, cues, confidence, and feedback prompt.
- Tool avoids full recipe republication.
- Tool does not claim certainty where confidence is low.
- All temperatures render correctly in both units; toggle does not trigger regeneration.

---

## Stage 4: Structured feedback and learning layer

**Goal:** Start building the community intelligence loop.

**Build:** "I cooked this" feedback · step-level feedback · structured tags · actual temp used (with unit selector) · pan type confirmation · aggregated learning table · admin review of emerging patterns.

**Acceptance criteria:**

- Feedback is tied to recipe step, ingredient, technique, and pan type.
- All temperature feedback normalized to canonical °F regardless of entry unit.
- System can surface basic community notes after repeated feedback.
- Admin can approve or suppress learned recommendations.

---

## Stage 5: Public adaptation library

**Goal:** Make the product useful even when users do not submit a URL.

**Build:** Browse adapted recipes · search by ingredient, technique, source, pan type, or unit preference · "Community-tested" label · popular recipes · recently adapted · high-confidence adaptations.

**Acceptance criteria:**

- Public pages are indexable.
- Every public page credits and links to the source recipe.
- Adaptation cards remain clearly separate from original recipes.
- Public cards respect the visitor's unit preference.

---

## Stage 6: Community features

**Goal:** Let users contribute knowledge without turning the product into chaos.

**Build:** Comments · contributor profiles · "Cooked by X users" indicators · report issue button · suggested correction workflow · optional photo upload.

**Acceptance criteria:**

- Comments can be moderated.
- Corrections do not automatically override recommendations.
- High-quality user feedback can be promoted into community notes.

---

# 19. Suggested MVP build scope

If I were forcing discipline, I would build only this first:

## True MVP

- Landing page
- Recipe URL input
- Recipe extraction confirmation
- Pan type selection
- Temperature unit toggle (`°F | °C`)
- AI-generated adaptation card
- Source attribution
- Save/share card
- Post-cook feedback (with unit-aware temperature capture)
- Admin dashboard

## Skip

- Full community
- Paid accounts
- Mobile app
- Discord/forum integration
- Complex personalization
- Automatic ML retraining

---

# 20. Example generated card

## Cook This Impulsively: Example Output

**Recipe:** Linked original recipe
**Source:** Original publisher
**Pan:** Stainless steel skillet
**Confidence:** Medium-high
**Best mode strategy:** Temperature Control for aromatics and browning; Power Mode for active simmering.
**Units:** °F | °C (toggle persistent)

### Key adaptation

This recipe uses "medium-high" in two different ways. For the onions, the goal is browning and softening. For the sauce, the goal is evaporation and gentle reduction. These should not use the same setting.

### Fahrenheit view

| Phase | Original instruction | Impulse recommendation | Cue |
|---|---|---|---|
| Preheat pan | Heat oil over medium-high | Temperature Control, 335°F | Oil moves easily and shimmers |
| Brown onions | Cook until golden | 335°F to 350°F | Steady sizzle, golden edges |
| Add garlic | Cook until fragrant | Drop to 285°F to 305°F | Fragrant within 30 to 60 seconds |
| Simmer sauce | Reduce heat and simmer | Power Mode or 205°F to 215°F liquid behavior | Small steady bubbles |
| Finish | Stir in dairy/herbs | Low heat or residual heat | No bubbling or splitting |

### Celsius view

| Phase | Original instruction | Impulse recommendation | Cue |
|---|---|---|---|
| Preheat pan | Heat oil over medium-high | Temperature Control, 168°C | Oil moves easily and shimmers |
| Brown onions | Cook until golden | 168°C to 177°C | Steady sizzle, golden edges |
| Add garlic | Cook until fragrant | Drop to 141°C to 152°C | Fragrant within 30 to 60 seconds |
| Simmer sauce | Reduce heat and simmer | Power Mode or 96°C to 102°C liquid behavior | Small steady bubbles |
| Finish | Stir in dairy/herbs | Low heat or residual heat | No bubbling or splitting |

### Adjustment guidance

- If onions release water and stay pale, increase by 10°F to 15°F (5°C to 8°C).
- If garlic browns immediately, remove pan from heat and restart lower.
- If sauce spits or thickens too fast, reduce heat and stir more often.

### Food safety

Internal temperatures (USDA): poultry 165°F / 74°C · ground meats 160°F / 71°C · whole cuts of beef, pork, lamb 145°F / 63°C with rest.

---

# 21. Builder prompt

> Build a web app called Cooking Impulsively. The core MVP feature is "Cook This Impulsively." Users paste a recipe URL and receive an Impulse cooktop-friendly cooking card. The app extracts recipe title, source, ingredients, yield, and instructions when structured recipe data is available. If extraction fails, users can paste ingredients and instructions manually. Before generation, users confirm extracted content and select pan type, experience level, cooking goal, and preferred temperature unit (°F or °C, defaulting by locale).
>
> The generated card does not republish the full recipe. It links to the original source and provides only adaptation notes. The card analyzes the whole recipe — ingredients, technique, intended outcome, heat words, timing, and sensory cues. It recommends Impulse mode, suggested temperature or power range, timing adjustments, visual/auditory/smell cues, pan-specific cautions, confidence level, and food safety reminders.
>
> All temperatures are stored canonically in Fahrenheit and rendered in the user's selected unit via a persistent `°F | °C` toggle present on every screen with temperature data. Toggling units never triggers AI regeneration — only a re-render. The AI emits structured temperature tokens (not free-text temps embedded in prose) so the frontend can swap units cleanly. Food safety temperatures always display in both units. Nerd Mode shows both units simultaneously.
>
> Add a feedback loop after cooking. Users can rate whether the adaptation worked, select structured tags (too hot, too cool, timing off, browned too fast, did not brown enough, stuck to pan, scorched, worked well), and optionally enter the actual temperature used with explicit unit selection. Feedback stores both the original entry (value + unit) and normalized °F and °C values. Aggregate feedback by recipe step, ingredient, technique, pan type, and temperature. Do not automatically change recommendations from one review. Require admin review before promoting community-tested notes.
>
> Build the first version with landing page, recipe URL input, extraction confirmation screen, cooking context screen, generated adaptation card, save/share function, post-cook feedback form, and admin dashboard. Include clear disclaimers that the product is independent, not affiliated with Impulse Labs, and should be used alongside the original recipe.

---

**My strongest recommendation:** build Stage 1 manually or semi-manually first. If 20 real Impulse users — ideally mixed U.S. and non-U.S. — cook from these cards and come back saying "yes, this made the recipe easier," then you have something worth building properly. Test the unit toggle with non-U.S. users early; it's a small feature with outsized impact on whether the product feels native.

---

## What changed from the original draft

Three structural things worth flagging:

1. **Unit switching moved into Stage 3, not Stage 5.** Treating it as polish makes the feedback data unusable for the first 100+ cooks. Building it correctly the first time is cheaper than retrofitting.
2. **Canonical storage in Fahrenheit, structured temperature tokens in AI output.** This is the load-bearing engineering decision. If the AI emits "335°F" inside a sentence, you can't cleanly swap to Celsius without re-prompting. Tokens (`{{temp_1}}`) solve this.
3. **Food safety temps always show both units.** Underdone chicken is a safety issue, not a UX preference. Pulling that out of the toggle protects the user.
