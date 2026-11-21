# Release evidence — ModSim Essentials 3.0.0 (project compass)

Date: 21 November 2026. Branch: `compass-rebuild`.

This file records what was checked for the compass product described in [COMPASS-SPEC.md](COMPASS-SPEC.md), how it was checked, and what was not checked. An item is ticked only where the evidence is listed.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | Clean |
| `npm test` | 162 tests in 8 files, all passing |
| `npm run lint` | Clean |
| `npm run build` | Passes with no size warning |

Bundle after the rebuild (minified / gzipped):

| Chunk | Size | Loaded |
| --- | --- | --- |
| `index` | 493 kB / 156 kB | Always |
| `Tools` | 125 kB / 38 kB | On first visit to Tools |
| `DiagramView` | 71 kB / 20 kB | When a diagram card scrolls into view |
| `sandbox.worker` | 5 kB | When the sandbox runs replications |

The diagram layout engine (1.44 MB) is no longer shipped. Layouts are computed at build time by `npm run gen:layouts` and stored; `tests/layouts.test.ts` recomputes all 68 with the engine and fails if the stored file is out of date.

## What the tests cover

- [x] **Compass rules** (`tests/compass.test.ts`, 43 tests). Every warning rule fires and clears on the intended input; steps count as started only with real content; checkpoint readiness follows the steps a checkpoint covers; the worked example has zero open items; schema v1 files upgrade to v2; the importer rejects future schemas and drops unknown keys, unknown feedback sources and malformed dates.
- [x] **Exports** (`tests/exports.test.ts`, 29 tests). Markdown and HTML follow the seven steps with self-checks, open items and checkpoints; hostile text is escaped in every user-controlled place; the HTML report loads no external resource; stale and partial sandbox results are labelled; the ZIP round-trips; the author name is included only when asked.
- [x] **Sandbox engine** (`tests/sandbox.test.ts`, 28 tests). Fixtures, conservation over random trajectories, zero capacity, α = 0 reduction, seeded replay, paired arrivals, results independent of chunking, Student-t quantiles, type-7 quantiles and paired differences against reference values.
- [x] **Distributions** (`tests/distributions.test.ts`, 45 tests). 22 families (seeded draws, moments, invalid parameters); maximum-likelihood fits agree with SciPy on the stored datasets; the decision tree is closed; a discrete law transfers to sandbox demand with the trimmed tail reported, and continuous laws are refused.
- [x] **Method registry and rules** (`tests/domain.test.ts`, 7 tests). All-unsure answers give "more information needed"; latent constructs give both SEM variants with the measurement-model caveat; simple queues give queueing theory with discrete-event simulation as a complement.
- [x] **Persistence** (`tests/persistence.test.ts`, 3 tests). Save and read, revision conflict detection, last-known-good backup, recoverable delete, and the in-memory fallback used when IndexedDB is unavailable.
- [x] **Diagram layouts** (`tests/layouts.test.ts`, 4 tests). Stored layouts equal the engine's output; every width from 120 to 2600 px has a layout; from 280 px of card width no diagram needs sideways scrolling.
- [x] **Owner rules** (`tests/guard.test.ts`, 3 tests). No institution or author names, no Croatian, and no raster figures anywhere in `src/` or `index.html`.

## Browser checks

Scripted with Playwright (headless Chromium 1248) against the production server (`node server.mjs`) serving `dist/`.

- [x] **Tour of every screen.** Home, all seven steps and checkpoints of the worked example, the tools hub and all seven tools, Help. Light and dark, at 320, 390, 820, 1280 and 1440 px: no console errors, no page-level horizontal overflow.
- [x] **End-to-end journey.** New project → all seven steps, with the open-items count responding to each edit → method chooser → checkpoints (rubric, status and target date persist after reload) → ZIP and JSON export → re-import as a second project → a future-schema file is rejected with an explanation.
- [x] **Tools to project.** A sandbox run records its settings into step 6 and a model assumption into step 4; a Poisson law from the explorer becomes the sandbox demand and an input row; a fitted distribution becomes an input row; results from earlier settings are labelled as stale; a 100-replication run completes.
- [x] **States.** Two tabs editing the same project produce the conflict dialog, and "Keep both" yields two projects. The skip link is the first Tab stop and moves focus to main. With reduced motion there are no running animations. Each page has one `h1`. Old routes (`/start`, `/lectures/*`, `/labs/*`, `/sandbox`, `/methods`, `/legacy/*`) redirect to their new homes. Without IndexedDB the app says the project is not saved on this device.
- [x] **Exported report.** The worked example's HTML report was opened as a file in light (1100 px) and dark (390 px) and printed to PDF: no overflow and readable in both themes; the first pages of the PDF were inspected.

## Accessibility

- [x] **Automated WCAG 2.1 A/AA audit (axe-core 4)** over 28 screens, including every editable step with a project open and the sandbox before and after a run. Light at 1280 px and dark at 390 px.
  - First pass: no colour-contrast failures. Three structural findings: a tab list that contained a non-tab button, and two scrollable regions that could not be reached by keyboard.
  - All three were fixed; the second pass result is recorded under "Re-checks" below.
- [x] **Keyboard basics.** Skip link, dialogs trap focus and close with Escape, every slider has a labelled number field, every chart has "Show data table", every diagram has "As text".
- [ ] **Screen reader pass.** Not done.
- [ ] **Full manual keyboard-only pass of every screen.** Not done.
- [~] **Text scaling.** Browser zoom to 400% of a 1280 px window corresponds to the 320 px layout, which was checked. Text-only scaling (a larger default font size without zoom) was not checked.

## Deployment

- [x] **Railway runtime (`server.mjs`) tested locally:** `/healthz` returns 200, deep links return the app, missing assets return 404, and path-traversal requests get the app shell or a 404, never a file outside `dist/`.
- [ ] **Netlify:** `netlify.toml` follows Netlify's documented redirect rules but has not been run on Netlify.
- [ ] **Live deployment:** none was performed. The repository and hosting projects were deliberately not touched.

## Known limitations

- **Content needs an owner review.** The step guidance, good and weak examples, self-check questions, rubric wording, method notes and the worked example were written for this release. They are internally consistent and tested for structure, not reviewed by a subject teacher.
- **The method chooser is a rule table, not an expert.** It gives a shortlist with reasons and caveats and says so; it cannot judge a project.
- **Open items measure completeness and consistency, not quality.** The app never grades written reasoning. Quality belongs to the checkpoints and the reviewer.
- **Reviewer feedback is a typed label.** There are no accounts, so reviewer names and rubric levels are not authenticated.
- **The sandbox is one teaching model** (daily aggregate backlog). It does not estimate individual waiting times and says so wherever waiting time is chosen as an outcome.
- **Queueing Lab link:** no verified URL was available, so it shows "App link not configured".
- **Storage is one browser on one device.** Moving work means exporting and importing the project file.
- **Cancel timing in the sandbox** is covered by code review and manual use, not by an automated test.
