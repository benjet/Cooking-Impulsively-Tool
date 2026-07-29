# Cooking Impulsively

## Product Requirements Document v0.2

**Product stage:** MVP definition  
**Primary launch device:** Impulse Cooktop  
**Secondary supported device:** Breville Control Freak Home and Commercial  
**Core feature:** Cook This Impulsively

## 1. Executive summary

Cooking Impulsively is an independent web platform that helps users adapt existing recipes for precision temperature-controlled cooking.

A user submits the URL of a recipe published elsewhere. The system analyzes the recipe as a whole, including ingredients, sequence, cooking techniques, intended outcomes, timing, cooking fats, cookware assumptions, and sensory cues. It then produces a device-specific companion card with:

- Recommended temperature or power settings
- Temperature ranges where exact precision would be misleading
- Suggested device mode
- Preheat and ingredient-loading guidance
- Pan and cooking-fat considerations
- Timing guidance
- Visual, auditory, aroma, and texture cues
- Adjustment instructions
- Confidence levels
- Food-safety reminders
- Fahrenheit and Celsius display options

The public adaptation page must prominently link back to the original recipe and be positioned as a companion, not a replacement.

After cooking, users can submit structured feedback tied to the exact adaptation version they used. The platform learns first at the personal level, then at the community level after enough consistent evidence exists.

## 2. Product vision

### Vision statement

Create the most useful independent knowledge layer for cooking by temperature.

### Long-term user question

> How should I cook this specific recipe on my specific precision cooktop, using my cookware and ingredients, to achieve the result the recipe intended?

The product is not merely:

- A heat-conversion chart
- A recipe database
- A preset list
- A general cooking chatbot
- A replacement for the original recipe
- Official support for Impulse Labs or Breville

It is a recipe interpretation, adaptation, and learning platform.

## 3. Problem statement

Most stovetop recipes use imprecise language such as low, medium, medium-high, high, simmer, brown, cook until fragrant, and reduce the heat.

Those instructions depend on:

- Stove output
- Burner size
- Pan material and thickness
- Pan diameter
- Food quantity
- Starting ingredient temperature
- Moisture content
- Cooking fat
- Desired outcome
- User technique

Precision cooktops solve the hardware-control problem but expose a knowledge problem: what temperature, power, intensity, or probe strategy should the cook actually choose?

## 4. Evidence of need

Impulse community discussions show users already:

- Guess how to translate medium-high into temperature mode
- Search for Breville Control Freak recipes
- Keep personal temperature notes for eggs, pancakes, bacon, vegetables, and searing
- Ask for guidance that changes by cooking fat, pan, and intended result
- Want visual cues, timing, and adjustment guidance alongside a temperature
- Want the system to remember when a prior attempt was dry, burnt, pale, or otherwise unsuccessful
- Ask for automated cooking sequences such as boil-then-simmer, rice, potstickers, popcorn, yogurt, sauce holding, and oil-specific limits

The same needs exist among Breville Control Freak users, who must decide how to use surface temperature, heat intensity, probe control, timers, and presets when recipes were written for generic burners.

## 5. Product thesis

The correct adaptation cannot come from a simple mapping such as:

> Medium-high = 375°F

The system must reason across:

**Device + ingredient + technique + intended outcome + cookware + cooking fat + quantity + time + sensory cues**

For every cooking phase, it should decide whether the best guidance is:

- Exact temperature
- Temperature range
- Power level
- Heat intensity
- Probe target
- Timer or sequence
- Sensory cue
- A combination of these

## 6. Product principles

1. **Preserve the original recipe.** The adaptation is a companion layer.
2. **Explain the cooking goal.** A number without intent is not enough.
3. **Prefer useful ranges over false precision.**
4. **Keep sensory cues.** Temperature supplements sight, sound, smell, and texture.
5. **Learn only from completed cooks.**
6. **Separate personal learning from community learning.**
7. **Make uncertainty visible.**
8. **Remain device-aware without hard-coding the core analysis to one manufacturer.**

## 7. Target users

### Primary

- New Impulse owner
- Experienced home cook seeking repeatable results
- Precision-cooking enthusiast
- Breville Control Freak owner
- Recipe experimenter who records and compares attempts

### Secondary

- Prospective buyers
- Recipe testers
- Food writers
- Culinary educators
- Professional cooks doing small-batch development

## 8. MVP goals

The MVP must let a user:

1. Submit a public recipe URL or enter a recipe manually.
2. Confirm or correct extracted ingredients and instructions.
3. Select device, pan, cooking fat, unit, experience level, and desired result.
4. Receive a device-specific companion card.
5. Open the original recipe from that card.
6. Save or share the adaptation.
7. Mark the adaptation as cooked.
8. Submit overall and step-level feedback.
9. See their personal cooking history on return.
10. Contribute eligible evidence to moderated community learning.

## 9. Non-goals for MVP

- Direct cooktop control
- Native mobile applications
- Full social network or direct messaging
- Paid memberships
- Automatic model retraining from individual ratings
- Unmoderated public presets
- Broad support for every precision appliance
- Full recipe republication

## 10. Device strategy

### 10.1 Launch approach

Launch as **Impulse-first, precision-cooking aware**.

The core analysis must produce a device-neutral cooking plan. A separate adapter translates that plan into device-specific instructions.

### 10.2 Initial device profiles

#### Impulse Cooktop

Possible outputs:

- Temperature Control target or range
- Power Mode guidance
- Timer guidance
- Preheat guidance
- Zone-specific instructions
- Adjustment instructions

#### Breville Control Freak Home

Possible outputs:

- Surface-temperature target or range
- Heat-intensity recommendation
- Probe-control or probe-monitoring guidance
- Manual mode
- Ingredient/technique mode
- Custom-preset-ready sequence

#### Breville Control Freak Commercial

Maintain a separate device profile because controls and capabilities may differ.

### 10.3 Device capability schema

Each profile should store:

- Manufacturer and model
- Minimum and maximum selectable temperature
- Supported units and increments
- Temperature-control support
- Manual-power support
- Heat-intensity support
- Surface sensing
- Probe control and monitoring
- Timer and sequence support
- Number of cooking zones
- Device-specific terminology
- Documentation or firmware version
- Last verified date

## 11. Primary user flow

### Step 1: Submit recipe

- Paste a recipe URL
- Or enter a recipe manually

### Step 2: Extract

Attempt to retrieve:

- Title
- Author and publisher
- Canonical URL
- Yield
- Ingredients
- Instructions
- Timing
- Detected stovetop steps

Use Recipe JSON-LD first, then limited fallback extraction, then manual entry.

### Step 3: Confirm

The user must be able to:

- Correct ingredients
- Correct or add steps
- Confirm substitutions
- Identify failed extraction

### Step 4: Select context

Required:

- Device
- Pan material
- Temperature unit
- Experience level

Recommended:

- Pan diameter
- Cooking fat
- Recipe scaling
- Ingredient substitutions
- Desired result
- Smoke sensitivity
- Browning preference
- Doneness preference

### Step 5: Analyze

Analyze the recipe as one connected cooking process, not isolated sentences.

### Step 6: Generate

Create a device-specific companion card.

### Step 7: Cook

The user keeps the original recipe and adaptation open together.

### Step 8: Record outcome

The user selects **I cooked this** before feedback becomes eligible for learning.

### Step 9: Learn

Update personal history immediately and route community evidence through thresholds and moderation.

## 12. Recipe analysis requirements

The engine must evaluate:

- Ingredients and quantities
- Ingredient order and state
- Cooking-fat type
- Instruction sequence
- Heat terminology
- Timing and sensory cues
- Liquid volume and crowding
- Sugar, dairy, and acid content
- Protein thickness and safety needs
- Carryover cooking and resting

### Cooking-phase taxonomy

- Preheat
- Heat fat
- Sweat
- Sauté
- Brown
- Sear
- Toast
- Deglaze
- Simmer
- Boil
- Reduce
- Braise
- Fry
- Melt
- Emulsify
- Temper
- Poach
- Hold
- Finish
- Rest

### Intended-outcome taxonomy

- Translucent
- Softened
- Sweated without browning
- Lightly golden
- Deeply browned
- Crisp
- Seared
- Rendered
- Melted
- Emulsified
- Reduced
- Thickened
- Gently simmering
- Rapidly boiling
- Cooked through
- Held safely
- Warmed without splitting
- Toasted without scorching

## 13. Adaptation card requirements

Each adaptation card is a shareable web page containing:

### Header

- Recipe title
- Original publisher and author when available
- Device, pan, and cooking fat
- Adaptation version
- Temperature-unit toggle
- Confidence summary
- Date generated

### Original-source link

Above the fold:

> Use this guide alongside the original recipe

Primary button:

> Open the original recipe

Use the canonical source URL whenever available.

### Whole-recipe summary

Explain the major temperature-sensitive phases and the overall device-mode strategy.

### Heat plan

For each phase, show:

- Intended result
- Device mode
- Starting setting
- Timing
- Sensory cue
- Adjustment path

### Step-level guidance

Each relevant step should include:

- Original step reference
- Intended outcome
- Device mode
- Starting temperature, power, or intensity
- Range when appropriate
- Preheat and loading instructions
- Timing
- Sensory cues
- Adjustment guidance
- Pan- and fat-specific notes
- Confidence level

### Food safety

Clearly distinguish:

- Pan-surface temperature
- Liquid temperature
- Oil temperature
- Internal food temperature

Pan temperature must never be presented as proof of safe doneness.

## 14. Fahrenheit and Celsius

### Requirement

Every card must switch instantly between °F and °C without regeneration.

### Persistence

- Save to user profile when authenticated
- Save to browser storage when anonymous
- Permit a shared-link unit parameter

### Storage

Store one canonical numeric value and the original entered unit. Convert and round at the presentation layer according to the selected device's available increments.

### Display

- Avoid unnecessary decimals
- Convert both ends of ranges
- Allow dual-unit display in advanced mode
- Preserve the user's entered unit in historical feedback

## 15. Source attribution and backlinking

Every public adaptation page must backlink to the original recipe whenever a source URL exists.

Display the link:

1. Above the fold
2. Near the beginning of the guidance
3. In the footer

Store:

- Submitted URL
- Canonical URL
- Source domain
- Recipe title
- Author and publisher
- Access date
- Extraction method
- Link status and last check

A public adaptation cannot publish without an original URL or a documented manual-source reason.

Do not copy unnecessary publisher content, including headnotes, personal stories, photographs, or expressive narrative instructions.

## 16. Feedback system

### Feedback trigger

Ask:

> Did you cook this adaptation?

Only completed cooks qualify as outcome evidence.

### Overall rating

- Worked well
- Partly worked
- Did not work

### Outcome tags

- Too hot
- Too cool
- Timing too long or short
- Browned too quickly
- Did not brown enough
- Stuck or scorched
- Dry or undercooked
- Simmer too aggressive or weak
- Sauce reduced too quickly or slowly
- Texture was wrong
- Worked without changes
- Worked after adjustment

### Actual-cook fields

- Device
- Pan material and size
- Cooking fat
- Recipe scaling
- Substitutions
- Recommended setting
- Actual starting and adjusted settings
- Temperature unit entered
- Power or intensity changes
- Probe use
- Actual timing
- Outcome
- Notes and optional photo

### Versioning

Every rating must attach to:

- Recipe source and snapshot
- Adaptation ID and version
- Device profile and version
- Step ID
- User context

## 17. Learning system

### MVP approach

Do not retrain automatically from raw feedback.

Use:

- Structured feedback
- Aggregated statistics
- Personal history
- Similar-technique retrieval
- Human-reviewed community findings
- Versioned rules

### Personal learning

Available after one completed cook. Personal suggestions do not change the global default.

### Community learning

Segment evidence by:

- Device
- Ingredient
- Technique
- Intended outcome
- Pan and size
- Cooking fat
- Quantity
- Temperature or power
- Timing

### Suggested thresholds

- Personal note: 1 completed cook
- Emerging community note: at least 5 cooks and 3 unique users with directional agreement
- Community-tested label: at least 10 cooks, at least 7 consistent positive outcomes, no unresolved safety issue, admin review
- Default recommendation change: sufficient consistent evidence and a new adaptation version

## 18. Personal cooking journal

Every completed cook should create a journal entry containing:

- Recipe and source
- Adaptation version
- Date cooked
- Device, pan, and fat
- Substitutions
- Recommended and actual settings
- Adjustments
- Result
- Notes and optional photo
- Preferred settings for next time

When the user returns, show previous settings, prior result, current recommendation, and why anything changed.

## 19. Public adaptation library

Browse by:

- Ingredient
- Technique
- Device
- Pan type
- Cooking fat
- Source
- Most cooked
- Highest success rate
- Recently adapted
- Community-tested
- Beginner-friendly

Public indicators may include completed-cook count, positive outcome rate, common pan and fat, confidence, last update, and device compatibility.

## 20. Preset relationship

Distinguish:

- **Recipe adaptation:** guidance for one source recipe
- **Technique profile:** reusable guidance for a defined cooking task
- **Preset candidate:** a repeatable sequence supported by enough evidence

The MVP may generate preset-ready specifications but must not claim direct installation or device control without official support.

## 21. AI output requirements

The system should produce structured objects for:

- Recipe analysis
- Device-neutral plan
- Device-specific plan
- Adaptation steps
- Safety notes
- Confidence

Temperatures should be stored as typed values or tokens rather than embedded only in prose so unit switching and later analysis remain reliable.

## 22. Administrative requirements

Admins must be able to:

- Review failed extractions
- Correct attribution and canonical URLs
- Monitor broken backlinks
- Review low-confidence or safety-sensitive cards
- Compare adaptation versions
- Filter feedback by recipe step, device, pan, fat, and setting
- Approve or reject community notes
- Handle publisher requests
- Update device profiles
- Review prompt and model versions

## 23. Metrics

### Acquisition and activation

- URLs submitted
- Extraction success rate
- Confirmation completion rate
- Cards generated, saved, and shared
- Original-recipe click-through rate

### Cooking value

- I-cooked-this rate
- Feedback completion
- Worked-well rate
- Repeat cooking and recipe revisits
- Second-recipe adaptation rate

### Learning quality

- Recipes with 5 or more cooks
- Recipes with 10 or more cooks
- Community-tested adaptations
- Validated technique profiles
- Recommendations improved by evidence

## 24. Delivery stages

### Stage 0: Concierge validation

Landing page, URL submission, manual or semi-manual adaptation, backlink, and basic feedback.

### Stage 1: Impulse automated MVP

Automated extraction, confirmation, Impulse profile, whole-recipe analysis, unit toggle, versioned card, structured feedback, and admin dashboard.

### Stage 2: Breville Control Freak support

Surface temperature, heat intensity, probe use, and preset-ready sequences for Home and Commercial profiles.

### Stage 3: Personal cooking memory

Journal, previous-cook summaries, personal settings, and attempt comparisons.

### Stage 4: Community learning

Evidence counts, community-tested labels, technique profiles, conflict detection, and moderation.

### Stage 5: Presets and integrations

Validated preset specifications and official integrations only where technically and contractually supported.

## 25. MVP acceptance criteria

The automated MVP is complete when:

1. A user can submit a public recipe URL or enter a recipe manually.
2. The user can confirm or correct extracted content.
3. The user selects an Impulse profile, cookware, fat, and unit.
4. The engine analyzes the complete recipe.
5. The card identifies phases and intended outcomes.
6. The card provides mode, temperature or power, timing, sensory cues, adjustments, and confidence.
7. The user can switch between °F and °C.
8. The page visibly backlinks to the original recipe.
9. The page does not unnecessarily reproduce publisher content.
10. The user can mark the adaptation as cooked and submit step-level feedback.
11. Feedback attaches to the correct adaptation version.
12. Personal history is available on return.
13. Community feedback does not automatically change defaults.
14. Food-safety reminders appear where required.
15. The platform clearly states that it is independent.

## 26. Key risks

- Poor recipe extraction
- False precision
- Conflicting results across pans, fats, and quantities
- Feedback submitted without cooking
- Publisher concerns
- Similar native features from manufacturers
- Firmware or product changes
- Unsafe cooking advice

Mitigate through confirmation, ranges and confidence labels, segmented evidence, completed-cook gating, backlinking, device-neutral architecture, versioned device profiles, and safety review.
