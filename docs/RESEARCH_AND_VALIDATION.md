# Cooking Impulsively

## User Research and Product Validation Notes

This document captures the user needs that informed the updated PRD. It is not a substitute for direct customer interviews or controlled usability testing.

## 1. Core validated problem

Precision cooktops provide more control than conventional recipes know how to use.

Traditional recipes commonly say:

- Low
- Medium
- Medium-high
- High
- Simmer
- Brown until done
- Cook until fragrant

Those instructions are shorthand for a desired physical result, not reliable temperature values. The result depends on the ingredient, pan, cooking fat, food quantity, moisture, and equipment response.

Impulse and Breville Control Freak users therefore face a translation problem:

> What does this recipe's intended result mean on my precision-controlled device?

## 2. Impulse community signals

Two July 2026 discussions in the Impulse Labs subreddit strongly support the concept.

### Discussion: how owners actually cook with temperature control

Source:

- https://www.reddit.com/r/ImpulseLabs/comments/1v98s1q/curious_how_impulse_folks_actually_cook_with/

Themes raised by users include:

- Difficulty translating the recurring phrase “medium-high”
- Switching inconsistently between familiar heat language and temperature mode
- Looking for Breville Control Freak guidance because it addresses a similar cooking model
- Wanting recommendations that change according to cooking fat
- Wanting instructions that explain what to watch for after a specific amount of time
- Keeping personal notes for recurring foods
- Wanting the system to remember a poor prior result and change the next recommendation

The key insight is that users are not asking only for numbers. They are asking for:

- Starting point
- Intent
- Sensory cue
- Adjustment rule
- Memory

### Discussion: desired presets

Source:

- https://www.reddit.com/r/ImpulseLabs/comments/1v9biw3/what_presets_do_you_want_on_the_impulse_cooktop/

Requested concepts include:

- Boil, then automatically reduce to simmer
- Rice
- Potstickers
- Popcorn
- Oil-specific temperature limits
- Eggs
- Pancakes
- Bacon
- Sweating vegetables
- Searing meat
- Yogurt
- Sauce holding

These requests indicate demand for reusable technique profiles and multi-phase sequences. However, a preset alone does not solve adaptation of a specific third-party recipe. This supports a product hierarchy:

1. Recipe adaptation
2. Personal cooking history
3. Reusable technique profile
4. Community-tested starting point
5. Preset candidate

## 3. What the research rules out

### A static conversion chart is insufficient

“Medium-high” does not map to one temperature because the intended outcome varies.

Examples:

- Browning onion
- Cooking pancakes
- Searing steak
- Heating a cream sauce
- Frying an egg

Each may use similar conventional burner language while requiring different temperature and energy-delivery strategies.

### Thumbs-up alone is insufficient

A simple rating does not explain:

- Whether the setting was too hot or too cool
- Which step failed
- What pan was used
- Whether the user changed the temperature
- Whether timing or browning was the real issue

Therefore, a thumbs-up can remain a friendly interface, but the stored feedback must be structured.

### A forum alone is insufficient

Discussion is useful, but the durable value lies in structured, searchable knowledge:

- Recipe-specific adaptation
- Device and cookware context
- Versioned recommendations
- Completed-cook evidence
- Personal settings
- Cross-recipe technique patterns

## 4. Breville Control Freak relevance

The Breville Control Freak is an actual precision induction product with similar user needs.

Its users must decide how to use:

- Surface-temperature control
- Heat intensity
- Probe control or monitoring
- Timers
- Custom presets

Control Freak users also seek repeatable settings for eggs, pancakes, sauces, frying, simmering, and other recurring techniques.

The product should therefore avoid making the core recipe analysis Impulse-only.

Recommended architecture:

1. Analyze the recipe into a device-neutral cooking plan.
2. Apply an Impulse adapter or a Control Freak adapter.
3. Store feedback by device and model.

This makes Impulse the initial community focus while preserving a credible path to adjacent precision-cooking users.

## 5. Strongest value proposition

The strongest user-facing promise is:

> Paste a recipe URL and receive a precision-cooktop companion card that explains the intended cooking result, gives a reliable starting setting, preserves sensory cues, and tells you how to adjust when the food behaves differently.

This is stronger than:

- “Convert medium heat to a temperature”
- “Find Impulse recipes”
- “Browse cooktop presets”

## 6. Product differentiation

A manufacturer can add native presets. The independent product should be defensible through:

- Adaptation of recipes from across the web
- Prominent backlinking and publisher attribution
- Device-neutral analysis
- Cross-device support
- Personal cook history
- Community-tested evidence
- Pan-, fat-, and quantity-aware guidance
- Adaptation versioning
- Searchable public companion cards

## 7. Research-informed MVP requirements

The research supports the following as required rather than optional:

- Whole-recipe analysis, including ingredients
- Intended-outcome detection
- Pan type
- Cooking fat
- Sensory cues
- Adjustment instructions
- Fahrenheit/Celsius switching
- Original-source backlinking
- “I cooked this” gating
- Adaptation versioning
- Step-level structured feedback
- Personal cooking memory
- Moderated community learning

## 8. Research questions still open

The beta should explicitly investigate:

1. Will users paste URLs before they own an Impulse cooktop, or primarily after purchase?
2. How much context will users tolerate entering before generation?
3. Is cooking fat important enough to require, or should it be inferred and confirmed?
4. Do users prefer a concise card or a detailed “nerd mode”?
5. How often do users return to the same adapted recipe?
6. What percentage actually submit post-cook feedback?
7. Which failures are most common: temperature, timing, loading, pan choice, or unclear cues?
8. Are public community notes trusted more when evidence counts are shown?
9. Will Control Freak users accept the “Cooking Impulsively” brand, or should cross-device pages use a broader descriptor?
10. How should publishers be invited into attribution and correction workflows?

## 9. Suggested beta interview prompts

After a completed cook, ask:

- What part of the card was most useful?
- Where did you ignore or change the guidance?
- What happened when you added the food to the pan?
- Was the temperature, timing, or sensory cue most helpful?
- Did the card make you more confident than the original recipe alone?
- What would make you use this again?

Avoid asking only whether the user “liked” the product. Focus on observed cooking behavior and outcomes.

## 10. Initial beta cohort

Recruit a small, high-engagement group rather than a broad audience.

Suggested mix:

- 10 to 15 Impulse owners
- 5 to 10 Control Freak owners
- A mix of beginner and experienced cooks
- Different common cookware types
- Users willing to cook at least two adaptations

The initial goal is not scale. It is to learn whether the recommendations survive contact with real pans, ingredients, and kitchens.
