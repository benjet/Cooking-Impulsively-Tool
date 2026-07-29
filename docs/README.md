# Cooking Impulsively Documentation

This directory contains the current product and implementation documentation for the Cooking Impulsively MVP.

## Current documents

### [Build Plan](./BUILD_PLAN.md)

The execution layer and the only status-tracking document. Sequences the work into engineering phases A–F, records locked decisions, and resolves the contradictions between the specification documents:

- Honest current-state baseline of the codebase
- AI provider decision (agnostic interface, decided by eval)
- Database decision (Supabase PostgreSQL)
- Schema reconciliation between `IMPLEMENTATION_GUIDE.md` §6 and `ENGINEERING.md` §E
- Phase-to-PRD-stage mapping and per-phase definitions of done

### [Product Requirements Document v0.2](./PRD_V2.md)

The consolidated product definition, including:

- Impulse-first and cross-device strategy
- Breville Control Freak support
- Whole-recipe analysis
- Device-neutral cooking plans and device adapters
- Fahrenheit/Celsius switching
- Original-recipe backlinking
- Completed-cook feedback
- Personal cooking history
- Moderated community learning
- Delivery stages and acceptance criteria

### [MVP Implementation and Hosting Guide](./IMPLEMENTATION_GUIDE.md)

A practical path from the current Next.js/SQLite prototype to a production-capable application, including:

- Recommended tools and hosting
- Supabase migration
- Trigger.dev background jobs
- Structured AI output
- Feedback and journal schema
- Environment strategy
- Testing and CI
- Immediate repository tasks

### [User Research and Product Validation](./RESEARCH_AND_VALIDATION.md)

The user-needs evidence behind the updated requirements, including:

- Impulse community discussions
- Preset and cooking-journal demand
- Why a static conversion chart is insufficient
- Breville Control Freak adjacency
- Open beta research questions

## Existing root documents

The repository also contains:

- `PRD.md`: original Impulse-focused PRD
- `ENGINEERING.md`: detailed temperature-token and admin-learning schema
- `PLAN.md`: original application build plan

The files in this directory do not remove those documents. They consolidate the newer product direction and provide a staged implementation path that accounts for the current prototype.

## Recommended reading order

1. `docs/RESEARCH_AND_VALIDATION.md`
2. `docs/PRD_V2.md`
3. `docs/IMPLEMENTATION_GUIDE.md`
4. `docs/BUILD_PLAN.md`
5. `ENGINEERING.md`
6. `PLAN.md`

`PLAN.md` and the Stage 0–6 roadmap in `PRD.md` describe the original Impulse-only MVP and are superseded by `docs/BUILD_PLAN.md`. They are kept for history.
