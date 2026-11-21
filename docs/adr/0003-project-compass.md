# ADR 0003 — From learning platform to project compass

Status: accepted · 21 November 2026 · supersedes the scope decisions in ADR 0001 and ADR 0002

## Context

After two rounds of growth the app had 15 destinations: six "core experiences", lectures, lessons, examples, challenges, labs, a glossary and more. Much of it duplicated the course lectures or the specialist apps, and the volume was too large to maintain or review.

The owner judged that the durable value lies in two things: the **project passport as an assessable deliverable**, and a **small set of practical tools**.

## Decision

1. The product becomes a **project compass** with three areas: Home, Project (seven steps, checkpoints, export) and Tools.
2. **Removed:** lectures, lessons, examples, challenges, Model Detective, modelling lenses, the glossary page, the start exercise and course-progress tracking. The knowledge from the flawed-claim cases lives on as **compass warnings**, shown at the step where the mistake would be made.
3. **Guidance over grading.** Each step carries a why, a good and a weak example, deterministic warnings from a versioned rule table (`compass-rules-v2`), and self-check questions that are stored and exported but never auto-graded.
4. **A worked example** — a complete passport — replaces lesson content as the reference for what good looks like.
5. **Passport schema v2** adds `selfChecks` and per-checkpoint `rubric`. Version-1 files import with defaults. Sandbox data and all other fields are unchanged.
6. **Checkpoints are assessment-ready.** Each has a readiness list, a rubric and a status. Reviewer feedback remains a manual label.
7. **Five purposeful diagrams** replace 38 slide redraws. They use automatic layout (elkjs) and build-up animation. The layouts are computed at build time (`npm run gen:layouts`) and stored, so the layout engine is not shipped to the browser; a test fails when the stored layouts are out of date.
8. **The audience widens** from students to anyone defining a modelling project. Wording says "reviewer" where it previously said "teacher".

## Consequences

- PLAN.md v1 (six experiences, 12/12/12 content) no longer describes the product. `docs/COMPASS-SPEC.md` is the governing specification.
- The codebase and bundle shrink substantially, and the content that needs expert review reduces to the step guidance, the warning rules and the worked example.
- Old URLs redirect into the three areas. Saved projects are unaffected. The v1 `progress` store is left in the database but unused.
