# Cooking Impulsively

## MVP Implementation and Hosting Guide

This guide translates the product requirements into a practical build path for the existing repository.

## 1. Current repository baseline

The repository already contains:

- Next.js with the App Router and TypeScript
- Tailwind CSS
- Recipe extraction using structured recipe data and HTML parsing
- A three-stage recipe submission flow
- Anonymous shareable card pages
- Structured post-cook feedback
- A basic admin dashboard
- SQLite using Node's built-in `node:sqlite`
- A deterministic heuristic adaptation generator
- Product and engineering documentation

This is a useful prototype. The next step is not a rewrite. It is a staged migration from a local single-instance demo to a production-capable application.

## 2. Recommended production stack

| Need | Recommended tool | Purpose |
|---|---|---|
| Application | Next.js + TypeScript | Public pages, user flows, APIs, admin tools |
| Source control | GitHub | Branching, reviews, deployments |
| Frontend/application hosting | Vercel | Next.js hosting and preview deployments |
| Database/auth/storage | Supabase | PostgreSQL, user identity, photos, access rules |
| Background jobs | Trigger.dev | Extraction, AI processing, retries, link checks |
| Recipe analysis | OpenAI Responses API | Structured whole-recipe analysis |
| Product analytics | PostHog | Funnels, events, feature flags, experiments |
| Transactional email | Resend | Magic links, ready notices, feedback reminders |
| Error monitoring | Sentry | Production errors and tracing |
| Domain/DNS/bot protection | Cloudflare | DNS, domain, CDN, Turnstile |
| Temporary forms | Tally | Early beta, publisher requests, concierge feedback |

The repository can remain on Next.js. The major infrastructure changes are replacing SQLite for production, adding asynchronous work, and swapping the heuristic engine for a structured AI pipeline.

## 3. Why not keep SQLite in production

SQLite is appropriate for local development and a single-server prototype. It is a poor fit for a Vercel-hosted public application because:

- Serverless instances do not share one durable local filesystem
- Concurrent writes become difficult
- User authentication and row-level permissions are not built in
- Background workers need a shared source of truth
- Public adaptation pages and feedback will eventually require reliable backups and migrations

Keep SQLite as a local-development option temporarily, but use PostgreSQL before inviting a meaningful public beta.

## 4. Target architecture

```text
User submits recipe URL
        |
        v
Next.js validates URL and creates submission record
        |
        v
Trigger.dev extraction job
        |
        +--> Fetch page safely
        +--> Detect canonical URL
        +--> Parse Recipe JSON-LD
        +--> Normalize ingredients and steps
        |
        v
User confirms extracted recipe
        |
        v
Trigger.dev analysis job
        |
        +--> Device-neutral cooking plan
        +--> Device-specific adapter
        +--> Safety and confidence validation
        |
        v
Versioned adaptation stored in Supabase
        |
        v
Public card rendered by Next.js
        |
        v
Completed cook and structured feedback
        |
        +--> Personal journal update
        +--> Community evidence queue
```

## 5. Build sequence

### Phase A: Stabilize the existing prototype

Before adding infrastructure:

1. Add automated tests for recipe extraction.
2. Add tests for temperature conversion and rendering.
3. Add schema validation for all stored adaptation output.
4. Add source-link and canonical-URL tests.
5. Add an explicit adaptation version to stored cards.
6. Add a device-profile field, defaulting to Impulse.
7. Change feedback from generic card rating to completed-cook feedback tied to a version.

Deliverable: a reliable local application with explicit data contracts.

### Phase B: Introduce production database and auth

1. Create a Supabase project owned by the product owner.
2. Add Supabase client and server helpers.
3. Create PostgreSQL migrations.
4. Add anonymous authenticated sessions or friction-light sign-in.
5. Enable Row Level Security on user-owned records.
6. Migrate current tables to the production schema.
7. Keep service-role credentials server-side only.

Deliverable: persistent shared data suitable for preview and public environments.

### Phase C: Move extraction and generation to background jobs

1. Add Trigger.dev.
2. Create `extract-recipe` job.
3. Create `generate-adaptation` job.
4. Add retry policies and timeouts.
5. Add job-status fields to the database.
6. Add user-facing processing states.
7. Add scheduled backlink checks later.

Deliverable: reliable processing that does not block browser requests.

### Phase D: Implement the structured AI pipeline

1. Replace the heuristic implementation behind the existing `generateAdaptation` interface.
2. Generate a device-neutral cooking plan first.
3. Translate through a device adapter.
4. Use strict structured output or JSON Schema.
5. Store prompt version, model snapshot, device-profile version, and adaptation version.
6. Validate temperature tokens and prohibit unstructured temperatures in prose.
7. Run safety rules before publication.
8. Retain the heuristic generator as a development fallback.

Deliverable: whole-recipe, versioned, device-specific guidance.

### Phase E: Native feedback and cooking journal

1. Add `cook_sessions` and `step_feedback` tables.
2. Require the user to mark the card as cooked.
3. Collect actual temperature, unit, pan, fat, timing, and adjustments.
4. Add personal journal pages.
5. Show previous settings when revisiting a recipe.
6. Keep community recommendations moderated.

Deliverable: the core learning loop.

### Phase F: Breville Control Freak support

1. Add device profiles for Home and Commercial models.
2. Add capability-aware output for surface temperature, intensity, probe control, and probe monitoring.
3. Add Control Freak-specific cooking context fields.
4. Keep feedback segmented by device and model.
5. Test the same recipes across both adapters.

Deliverable: an adjacent user base without duplicating the analysis engine.

## 6. Proposed production data model

### `profiles`

- `id`
- `display_name`
- `default_device_profile_id`
- `default_pan_type`
- `default_fat`
- `temperature_unit`
- `experience_level`
- timestamps

### `recipe_sources`

- `id`
- `submitted_url`
- `canonical_url`
- `source_domain`
- `title`
- `author`
- `publisher`
- `accessed_at`
- `extraction_method`
- `link_status`
- `last_link_check_at`

### `recipe_snapshots`

- `id`
- `recipe_source_id`
- `content_hash`
- `ingredients_json`
- `instructions_json`
- `yield_text`
- `prep_time`
- `cook_time`
- `user_confirmed`
- timestamps

### `device_profiles`

- `id`
- `manufacturer`
- `model`
- `profile_version`
- `capabilities_json`
- `min_temp_f`
- `max_temp_f`
- `temp_increment_f`
- `documentation_version`
- `last_verified_at`

### `adaptations`

- `id`
- `recipe_snapshot_id`
- `created_by`
- `adaptation_version`
- `device_profile_id`
- `device_profile_version`
- `pan_type`
- `pan_size`
- `cooking_fat`
- `experience_level`
- `desired_outcome`
- `analysis_json`
- `status`
- `public_slug`
- `model_name`
- `model_snapshot`
- `prompt_version`
- `confidence`
- timestamps

### `adaptation_steps`

- `id`
- `adaptation_id`
- `source_step_number`
- `technique`
- `ingredient_focus`
- `intended_outcome`
- `device_mode`
- `narrative_template`
- `temperatures_json`
- `power_or_intensity_json`
- `timing_json`
- `sensory_cues_json`
- `adjustment_guidance_json`
- `risk_notes_json`
- `confidence`

### `cook_sessions`

- `id`
- `user_id`
- `adaptation_id`
- `adaptation_version`
- `device_profile_id`
- `pan_type`
- `pan_size`
- `cooking_fat`
- `recipe_scale`
- `substitutions_json`
- `overall_result`
- `notes`
- `photo_path`
- `cooked_at`

### `step_feedback`

- `id`
- `cook_session_id`
- `adaptation_step_id`
- `outcome_tags_json`
- `recommended_temp_f`
- `actual_temp_value`
- `actual_temp_unit`
- `actual_temp_f_normalized`
- `actual_power_or_intensity`
- `actual_timing_seconds`
- `notes`

### `community_insights`

- `id`
- segmentation fields
- evidence counts
- proposed guidance
- confidence
- moderation status
- source adaptation versions
- timestamps

## 7. Recipe extraction implementation

### Extraction priority

1. Fetch public HTML.
2. Read canonical URL.
3. Find JSON-LD with `@type: Recipe`.
4. Normalize `recipeIngredient`.
5. Flatten `recipeInstructions`, including `HowToSection` and `HowToStep`.
6. Use limited microdata or readable-content fallback.
7. Ask for manual input when extraction is incomplete.
8. Require user confirmation.

### URL safety

The extraction service must:

- Accept only HTTP and HTTPS
- Reject localhost, private IP ranges, and metadata endpoints
- Validate every redirect destination
- Limit response size
- Apply short connection and total timeouts
- Reject binary or executable types
- Rate-limit anonymous submissions
- Deduplicate by canonical URL and snapshot hash

### Publisher respect

- Do not bypass paywalls or access controls
- Do not reuse publisher photography
- Do not publish unnecessary source text
- Maintain a correction and removal workflow
- Link to the original recipe prominently

## 8. AI pipeline design

### Layer 1: deterministic normalization

Application code handles:

- Temperature conversion
- Rounding to device increments
- Recipe-step numbering
- URL and attribution logic
- Device range validation
- Duplicate detection
- Adaptation versioning

### Layer 2: device-neutral analysis

The model should produce:

- Cooking phases
- Ingredient and technique focus
- Intended transformation
- Approximate surface, liquid, oil, or internal-temperature need
- Energy-delivery pattern
- Timing
- Sensory cues
- Risks and uncertainty

### Layer 3: device adapter

#### Impulse adapter

Translate into:

- Temperature Control
- Power Mode
- Timer guidance
- Zone-specific instructions
- Recovery and adjustment guidance

#### Control Freak adapter

Translate into:

- Surface temperature
- Heat intensity
- Probe control or monitoring
- Manual mode
- Preset-ready sequence

### Output discipline

Use structured output. Every temperature should be a typed value referenced from narrative templates, not an uncontrolled number embedded in prose.

This supports:

- Reliable Fahrenheit/Celsius switching
- Device-aware rounding
- Validation
- Community aggregation
- Future preset generation

## 9. Feedback implementation

### Early beta

Tally can be used temporarily for:

- Concierge feedback
- Publisher correction requests
- Beta applications

Pass hidden fields such as recipe ID, adaptation ID, adaptation version, and device profile.

### Product feedback

The actual cooking-feedback experience should become native as soon as the core workflow is stable.

Native feedback is needed for:

- Step-level interactions
- Accurate version attachment
- Temperature validation
- Immediate personal-history updates
- Better mobile experience
- Reliable permissions

## 10. Authentication approach

Avoid a registration wall before the user sees value.

Recommended flow:

1. Allow anonymous session creation.
2. Let the user submit and generate one adaptation.
3. Ask for account linking when saving history, adding a photo, or returning to personal settings.
4. Support passwordless email first.
5. Add social login only when demand justifies it.

## 11. Hosting setup

### Domain and DNS

Use Cloudflare for:

- Domain registration
- DNS
- DNSSEC
- CDN and basic security
- Turnstile bot protection

Suggested hostnames:

- `cookingimpulsively.com` for production
- `staging.cookingimpulsively.com` for private testing

### Application

Use Vercel for:

- Production deployment
- Preview deployment per pull request
- Environment variables
- Logs and rollbacks

### Database and storage

Use Supabase for:

- PostgreSQL
- Authentication
- User-uploaded photos
- Row Level Security
- Backups and migrations

### Background jobs

Use Trigger.dev for:

- Recipe extraction
- AI analysis
- Retryable processing
- Scheduled source-link checks
- Aggregation jobs

### Monitoring

- Sentry for errors and traces
- PostHog for behavior analytics and feature flags
- Vercel and Trigger.dev logs for operational troubleshooting

## 12. Environment strategy

Maintain separate environments:

### Local

- Local SQLite or local Supabase
- Stub or test AI provider
- Test recipe fixtures

### Staging

- Separate Supabase project or isolated schema
- Vercel preview/staging deployment
- Real background jobs with strict quotas
- Non-public cards by default

### Production

- Production Supabase
- Production AI and Trigger.dev keys
- Public card pages
- Monitoring and abuse controls enabled

Never reuse production credentials locally.

## 13. Suggested environment variables

```bash
# Application
NEXT_PUBLIC_APP_URL=
ADMIN_PASSWORD=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
OPENAI_API_KEY=
OPENAI_MODEL=
ADAPTATION_PROMPT_VERSION=

# Background jobs
TRIGGER_SECRET_KEY=

# Email
RESEND_API_KEY=
EMAIL_FROM=

# Analytics and monitoring
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
SENTRY_DSN=

# Bot protection
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

## 14. Analytics events

Track at minimum:

- `recipe_url_submitted`
- `recipe_extraction_succeeded`
- `recipe_extraction_failed`
- `recipe_extraction_confirmed`
- `adaptation_generation_started`
- `adaptation_generated`
- `original_recipe_opened`
- `temperature_unit_changed`
- `adaptation_saved`
- `adaptation_shared`
- `cook_marked_started`
- `cook_completed`
- `feedback_submitted`
- `second_recipe_adapted`

Do not treat page views alone as evidence of cooking value.

## 15. Quality and evaluation

Create a golden evaluation set of at least 30 recipes covering:

- Eggs and pancakes
- Bacon
- Onions and garlic
- Chicken, steak, fish, and tofu
- Pan sauces
- Tomato and cream sauces
- Stir-fry
- Rice and potstickers
- Shallow frying
- Butter and chocolate
- Simmering and reductions

For each recipe, document expected phases, intended outcomes, appropriate device modes, reasonable ranges, sensory cues, safety needs, and common failure modes.

Run the evaluation set whenever:

- The prompt changes
- The model changes
- A device profile changes
- Temperature rendering changes
- Community rules change

## 16. Initial CI recommendations

Add GitHub Actions for:

1. Install dependencies
2. Type checking
3. Unit tests
4. Production build
5. Extraction fixture tests
6. Temperature-token validation

Recommended commands:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Add `typecheck` and `test` scripts before enabling required checks.

## 17. Cost posture

Use free or entry tiers during concierge validation. Move to paid production tiers before accepting meaningful public user data.

Typical base services for a public beta will include:

- Vercel
- Supabase
- Trigger.dev
- AI API usage
- Domain registration

Analytics, email, error monitoring, and early forms can usually remain within free allowances initially. Verify current pricing before purchasing because service plans change.

## 18. What to postpone

Do not build these before the core loop is validated:

- Native mobile applications
- Direct cooktop control
- Full forum software
- Automatic community retraining
- Paid memberships
- Affiliate marketplace
- Complex reputation points
- Direct messaging
- Support for many device families
- Unmoderated presets

The MVP loop is:

> Submit recipe → confirm content → generate adaptation → cook → report outcome → improve next attempt

## 19. Immediate repository tasks

Recommended next pull requests:

1. Add adaptation and device-profile version fields.
2. Add typed temperature tokens and rendering utilities.
3. Add a persistent °F/°C toggle to the card page.
4. Add completed-cook sessions and step-level feedback.
5. Add canonical URL storage and backlink-status fields.
6. Add extraction fixtures and tests.
7. Add a Supabase migration plan behind a database interface.
8. Add Trigger.dev extraction job.
9. Replace heuristic generation with structured AI output behind the existing interface.
10. Add Impulse and Breville device adapters.
