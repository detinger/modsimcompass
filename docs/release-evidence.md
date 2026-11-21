# Release evidence — ModSimCompass 3.0.0 (project compass)

Earlier names: ModSim101, ModSim Essentials.

Date: 21 November 2026. Branch: `compass-rebuild`.

This file records what was checked for the compass product described in [COMPASS-SPEC.md](COMPASS-SPEC.md), how it was checked, and what was not checked. An item is ticked only where the evidence is listed.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | Clean |
| `npm test` | 197 tests in 9 files, all passing |
| `npm run lint` | Clean |
| `npm run build` | Passes with no size warning |

Bundle (minified / gzipped):

| Chunk | Size | Loaded |
| --- | --- | --- |
| `index` | 482 kB / 152 kB | Always |
| `Tools` | 127 kB / 39 kB | On first visit to Tools |
| `DiagramView` | 71 kB / 20 kB | When a diagram card scrolls into view |
| `ExportDialog` | 31 kB / 12 kB | When Export is first opened (report writers) |
| `sandbox.worker` | 5 kB | When the sandbox runs replications |

The diagram layout engine (1.44 MB) is not shipped. Layouts are computed at build time by `npm run gen:layouts` and stored; `tests/layouts.test.ts` recomputes all 68 with the engine and fails if the stored file is out of date.

## What the tests cover

- [x] **Compass rules** (`tests/compass.test.ts`, 48 tests). Every warning rule fires and clears on the intended input, including the planning stage, the data-status rules and the suggestions for thin entries. Suggestions never affect checkpoint readiness. The worked example has zero open items and a complete self-review. Schema v1 files upgrade to v2; future schemas are rejected.
- [x] **Hardening** (`tests/hardening.test.ts`, 28 tests). Fourteen ways of tampering with saved sandbox results each cause the results to be dropped with a notice, after which every export still works and contains no markup. Inherited object keys are not accepted as method or step ids. Row ids are made unique. Calendar dates must exist. Unknown fields survive 30 export/import cycles without nesting. A malformed address matches no route.
- [x] **Exports** (`tests/exports.test.ts`, 29 tests). The report follows the seven steps with self-checks, open items and checkpoints; it opens with a cover and a contents list; hostile text is escaped in every user-controlled place; the HTML loads no external resource; stale and partial sandbox results are labelled; the ZIP round-trips; the author name is included only when asked.
- [x] **Sandbox engine** (`tests/sandbox.test.ts`, 28 tests). Fixtures, conservation over random trajectories, zero capacity, α = 0 reduction, seeded replay, paired arrivals, results independent of chunking, Student-t quantiles, type-7 quantiles and paired differences against reference values.
- [x] **Distributions** (`tests/distributions.test.ts`, 45 tests). 22 families; maximum-likelihood fits agree with SciPy on the stored datasets; the decision tree is closed; a discrete law transfers to sandbox demand with the trimmed tail reported; pasted data with decimal commas is read correctly or the split values are reported.
- [x] **Method registry and rules** (`tests/domain.test.ts`, 7 tests).
- [x] **Persistence** (`tests/persistence.test.ts`, 5 tests). Save and read, revision conflict detection, a recovery backup that is kept for ten minutes, a restore that never overwrites a live project, recoverable delete, and the in-memory fallback.
- [x] **Diagram layouts** (`tests/layouts.test.ts`, 4 tests). Stored layouts equal the engine's output; every width from 120 to 2600 px has a layout; from 280 px of card width no diagram needs sideways scrolling.
- [x] **Owner rules** (`tests/guard.test.ts`, 3 tests). No institution or author names, no Croatian, and no raster figures anywhere in `src/` or `index.html`.

## Browser checks

Scripted with Playwright (headless Chromium 1248) against the production server (`node server.mjs`) serving the final `dist/`.

- [x] **Tour of every screen.** Home, all seven steps and checkpoints of the worked example, the tools hub and all seven tools, Help. Light and dark at 320, 390, 820, 1280 and 1440 px, plus light at 640 px: no console errors and no page-level horizontal overflow in any of the eleven runs.
- [x] **End-to-end journey.** New project → all seven steps, with the open-items count responding to each edit → method chooser → checkpoints (rubric, status and target date persist after reload) → ZIP and JSON export → re-import as a second project → a future-schema file is rejected with an explanation.
- [x] **Tools to project**, at 1280 px light and 390 px dark. A sandbox run records its settings into step 6 and a model assumption into step 4; a Poisson law from the explorer becomes the sandbox demand and an input row; a fitted distribution becomes an input row; results from earlier settings are labelled as stale; a 100-replication run completes.
- [x] **Behaviours added after review** (20 checks, all passing):
  - the claim type explains itself and answers the chooser's first question;
  - marking a project as still planning turns three "missing" items in step 7 into one suggestion, and shows a chip in the header;
  - a practice sandbox run stays out of the report by default, and opting in adds it;
  - the report carries the stage and the reference line;
  - a tool opened from step 4 offers the way back, and a sent distribution arrives with its name and unit;
  - decimal commas are recognised, or the split value is reported;
  - an unknown step, an inherited key used as a step and a malformed address each show a page instead of a blank screen;
  - no unconfigured specialist app is listed;
  - an Undo offer disappears when the project is switched.
- [x] **States.** Two tabs editing the same project produce the conflict dialog, and "Keep both" yields two projects. The skip link is the first Tab stop and moves focus to main. With reduced motion there are no running animations. Each page has one `h1`. Old routes redirect to their new homes. Without IndexedDB the app says the project is not saved on this device.
- [x] **Exported report.** The worked example's HTML report was opened as a file in light (1100 px) and dark (390 px) and printed to PDF: no overflow and readable in both themes; the first pages of the PDF were inspected.

## Independent reviews

Two reviews were run by separate agents that did not see the author's own conclusions.

- **Code review** (read-only). 15 confirmed findings and 5 plausible ones. The findings in the store, the importer and the exports were fixed and are covered by tests; the screen-level fixes were checked in the browser runs above. See commit `8812d6a`.
- **First-time-user walkthrough** (a student at 1280 px light and a working analyst at 390 px dark, plus the worked example). 12 defects, 11 friction points, 10 visual points and 6 value gaps. See commit `d6e06c3` for what was acted on.

Review findings **not** acted on, by choice:

- Tab controls (fit data source, sandbox policy, code samples) work with Tab and Enter but have no arrow-key navigation.
- A sandbox run in progress is discarded without notice if the user navigates away.
- Trashing or replacing a project in one tab is not announced to other tabs. A restore can no longer overwrite newer work, which was the harmful case.
- Fields from Frame (outcome, levers) are not offered again in step 6; they are retyped.
- The self-check question about the claim type in step 3 repeats a choice made in step 1.
- Internal identifiers remain visible in the sandbox (engine, generator, input hash, residual tolerance), where they serve reproducibility.
- A second, professional worked example (for instance a discrete-event warehouse study) was not written.
- A one-page brief with the sketch drawn into the report was not built; the report has a cover and contents, and lists the sketch as tables.
- Pasted data in the fitting tool is not kept across a reload.
- The distribution explorer still opens on its family picker, and the chooser's result card links to the explorer instead of sending to the project directly.
- Adding an input does not move focus to its Name field.
- The Home walkthrough counts eight stages (seven steps and the loop back), and the regression formula wraps on narrow cards.
- The exported project file keeps internal values such as `teacher-reviewed`; every screen and report shows "Reviewed".
- Two legacy fields of the first-session flow (`start.classification`, `start.firstSessionDone`) are dropped on import. Nothing reads them.

## Accessibility

- [x] **Automated WCAG 2.1 A/AA audit (axe-core)** over 28 screens, including every editable step with a project open and the sandbox before and after a run.
  - First pass: no colour-contrast failures; three structural findings (a tab list containing a non-tab button, two scrollable regions unreachable by keyboard).
  - After the fixes, on the final build: **0 violations** at 1280 px light and at 390 px dark.
- [x] **Keyboard basics.** Skip link; dialogs trap focus and close with Escape (the conflict dialog requires a choice); every slider has a labelled number field; every chart has "Show data table"; every diagram has "As text".
- [x] **Touch targets.** On touch screens, small buttons, fold-out summaries, back links and chooser steps are at least 38–40 px tall.
- [ ] **Screen reader pass.** Not done.
- [ ] **Full manual keyboard-only pass of every screen.** Not done.
- [~] **Text scaling.** Browser zoom to 400% of a 1280 px window corresponds to the 320 px layout, and 200% to the 640 px layout; both were checked. Text-only scaling (a larger default font size without zoom) was not checked.

## Deployment

- [x] **Railway runtime (`server.mjs`) tested locally:** `/healthz` returns 200, deep links return the app, missing assets return 404, a malformed address returns the app shell, and path-traversal requests get the app shell or a 404, never a file outside `dist/`.
- [ ] **Netlify:** `netlify.toml` follows Netlify's documented redirect rules but has not been run on Netlify.
- [ ] **Live deployment:** none was performed. The repository and hosting projects were deliberately not touched.

## Known limitations

- **Content needs an owner review.** The step guidance, good and weak examples, self-check questions, rubric wording, method notes, claim-type explanations and the worked example (including its self-review) were written for this release. They are internally consistent and tested for structure, not reviewed by a subject teacher.
- **Every good and weak example uses the student-support office.** Professionals get neutral wording in the interface, but not yet an example from their own setting.
- **The method chooser is a rule table, not an expert.** It gives a shortlist with reasons and caveats and says so; it cannot judge a project.
- **Open items measure completeness and consistency, not quality.** The new suggestions use simple text patterns (for example, a problem that begins "We should"). They are labelled as suggestions, can be wrong, and never block a checkpoint. The app never scores written reasoning.
- **Reviewer feedback is a typed label.** There are no accounts, so reviewer names and rubric levels are not authenticated.
- **The sandbox is one teaching model** (daily aggregate backlog). It does not estimate individual waiting times and says so.
- **Queueing theory has no app of its own.** It links to the DES Playground, which covers both methods.
- **Storage is one browser on one device.** Moving work means exporting and importing the project file.
- **Cancel timing in the sandbox** is covered by code review and manual use, not by an automated test.
- **The React layer has no component tests.** Screens are covered by the scripted browser runs above, which live outside the repository.
