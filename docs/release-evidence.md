# Release evidence — ModSim Essentials 2.0.0

Date: 20 November 2026. This file records the evidence behind each PLAN §15/§16 item. An item is ticked only where the evidence is listed. Open items are stated plainly.

**Automated:**
- `npm run typecheck`: clean.
- `npm test`: 110 tests in 6 files, all passing.
- `npm run lint`: clean (baseline: 4 errors, 1 warning).
- `npm run build`: passes.

**Browser:** scripted runs used Playwright with headless Chromium 1248 against the production server (`node server.mjs`) serving `dist/`. The scripts covered:
- a route crawl of all 62 routes;
- an end-to-end journey;
- a sweep of 10 screens × 5 widths × 2 themes;
- the state checks below.

## Scientific and content tests (PLAN §15)

- [x] **All §6 fixtures, conservation, zero-capacity handling and α = 0 reduction.** See `tests/sandbox.test.ts`. It covers accumulation (2, 4, 6, 8, 10; served 50), balanced, drain (15, 10, 5, 0, 0; served 45), closed (5, 9; served 0; utilisation null), abandonment (10 / 0.5 / 1.5), α = 0 identity across three fixtures, and conservation over 20 random fractional trajectories.
- [x] **Seeded replay, identical paired arrival arrays, results independent of animation and chunking.** Tests cover chunk independence (0–7 | 7–8 | 8–40 equals one run), paired arrivals for every replication, and seeded replay. Playback only moves a highlighted day.
- [x] **Partial-run counts and late-result rejection.** `useSandboxRun` checks the request ID on every worker message, and cancelling keeps the partial count. *Limitation:* covered by code review and manual cancel in the browser; there is no automated UI test for cancel timing.
- [x] **Mean, quantile and paired-difference calculations match references.** Student t quantiles match tables to 1e-6 for df 1, 2, 5, 9, 29 and 99. Sample SD matches R. Type-7 quantiles match R `quantile()`. The t-interval is checked against a hand calculation, and n = 1 gives "Interval unavailable: one replication."
- [x] **No waiting-time metric fabricated from backlog.** No code computes waiting time from backlog. Choosing waiting time as an outcome in the Sandbox or the Start Here brief shows the "does not estimate individual waiting times" explanation; the journey test asserts both.
- [x] **All 36 records exist, crosslinks are valid, activities are real.** See `tests/content.test.ts`. It checks the ids EX01–EX12, L01–L12 and C01–C12, that crosslinks resolve, that each lesson uses its example's widget, that the 12 widgets are distinct, minimum lesson structure, 3 hints per challenge, and glossary links.
- [x] **Markov probabilities stay nonnegative and sum to 1; invalid matrices are rejected.** See `tests/domain.test.ts`.
- [x] **Detective checks separate evidence quality from arithmetic and never grade free text by keywords.** Options carry the categories calculation, evidence, interpretation and defensible. Free text never reaches `domain/grading.ts`. Numeric answers use tolerances, never string equality.
- [x] **Method rules include alternatives and insufficient-information cases.** All-unsure answers give "more information needed". Latent constructs give both CB-SEM and PLS-SEM with the measurement-model caveat. Simple queues give queueing theory plus DES as a complementary candidate.
- [x] **Numeric fixture answers are verified against the engine.** Every `fixtureCheck` (more than 6) equals the computed metric. The C07 table has exactly one conservation violation, matching its answer. The C06 mean paired difference matches the table arithmetic.

## User journeys

- [x] **First problem → brief → sandbox → detective → shortlist → passport export.** Journey script: classification check, six-step brief, composed question, five-day setup, prediction, run (terminal backlog 10), stale label after an edit, stochastic paired run (100 replications), CSV, C04 numeric checks passed, reasoning and revision stored, method choice, ZIP and JSON downloads. Storage revisions were logged after every step.
- [x] **Project survives theme change, refresh and navigation.** Revisions persist across full reloads. Opening an example never overwrites the project; passport actions preview first and skip duplicates.
- [x] **JSON export/import preserves semantic fields, scenarios and results.** Unit test (passport, both configs, run summaries) and a browser import of the downloaded file.
- [x] **Recovery paths for save failure, corrupt import, future schema and cross-tab conflict.**
  - Without IndexedDB, the app shows "Not saved on this device" with a download link.
  - A corrupt file is rejected with "not valid JSON".
  - A future schema version is rejected with an explanation.
  - Two tabs editing at once: the tab that saved second got the conflict dialog, and "Keep both" produced two projects.
- [x] **Exported HTML works offline and labels current and older results.** It contains no external `src` or `href` (unit test). Stale runs are labelled "From earlier settings" (unit test).
- [ ] **Both deployments pass the same smoke suite and deep-link refresh.**
  - Railway's runtime (`server.mjs`) was tested locally: `/healthz` returns 200, deep links return 200 HTML, missing assets return 404, path traversal returns 404, and refresh works.
  - `netlify.toml` follows Netlify's documented redirect semantics but has **not been run on Netlify**.
  - **No live deployment was performed** (no access, and hosting projects were deliberately not touched).

## Visual and accessibility evidence

- [x] **Six core views, learning templates and project editor in light and dark themes.** Screenshots were taken in both colour schemes, and every token comes from STYLE §2.
- [x] **Keyboard, focus, labels, and chart/table parity.**
  - The skip link is the first Tab stop and moves focus to main.
  - Dialogs trap focus, close with Escape and return focus to their trigger.
  - Every slider has a labelled numeric field, and every chart has a "Show data table".
  - *Limitation:* there was no full manual keyboard-only pass of every page, and no screen-reader test.
- [~] **320 / 390 / 820 / 1100 / 1440 px, 200% text and 400% zoom.**
  - Widths 320–1440 (plus 1100) across 10 screens: no page-level horizontal overflow and no page errors in either theme.
  - 400% zoom of a 1280 px window corresponds to the 320 px case.
  - *Not done:* 200% browser text-size scaling.
- [x] **Reduced motion.** With `prefers-reduced-motion`, sandbox autoplay is removed, Step stays available and CSS transitions are neutralised.
- [x] **Empty, error, stale, partial, unsupported and save-failed states.** Seen in the journey and state scripts. The partial state comes from Cancel and was checked manually.
- [~] **Actual contrast checked** (WCAG relative-luminance ratios of token pairs):
  - **Light theme:** text/bg 15.2; muted/elevated 7.3; primary/elevated 6.8; on-primary/primary 6.8; error/elevated 5.4; success/elevated 4.5; subtle/bg **4.2**; warning/elevated **3.6**.
  - **Dark theme:** every listed pair is at least 5.1.
  - **Mitigation:** small helper text uses `--text-muted`, and warning status pairs a tinted panel with body text. Warning colour is never used for small text.
  - `--text-subtle` remains for non-essential metadata such as nav counts. **This is a recorded deviation; no accessibility certification is claimed.**

## Phases (PLAN §16)

| Phase | Status |
| --- | --- |
| P0 Audit and contracts | Done. See `docs/current-state-audit.md`, `docs/adr/0001-architecture.md` and the typed contracts in `src/domain/**`. |
| P1 First complete journey | Done. Evidence: the journey above. |
| P2 Foundations workspaces | Done: eight lenses (two computed, six labelled illustrative traces); stochastic, paired, abandonment, feedback, cost and statistics; 11-method registry with configured and absent links; all 11 passport sections; conceptual sketch with table parity; revisions, conflict recovery and trash; HTML, CSV and ZIP exports. |
| P3 Full teaching release | Done in content terms: 12 examples, 12 lessons and 12 challenges; 72-term glossary; rubrics, progressive hints and versioned progress; checkpoints; `docs/instructor-guide.md`. Open: dual-host smoke tests on live deployments; 200% text scaling; screen-reader pass. |

## Update: labs, lectures and visual layer (20 November 2026)

- [x] **MLE fits match scipy.stats** on both preserved datasets: Normal, Lognormal, Exponential, Gamma, Weibull and Logistic. Parameters agree to 2–6 decimals and log-likelihoods to 1e-3. Triangular and logistic are also checked as local optima. A fit to 5,000 Gamma(3, 2) draws recovers a shape between 2.8 and 3.2. See `tests/distributions.test.ts`.
- [x] **22 distribution families** pass the ported Monte Carlo Simulation Lab checks: reproducible seeded draws, bin probabilities in [0, 1], sample mean within 5 SE of the model mean (median for Cauchy), and invalid parameters rejected. R and Python snippets exist for every family.
- [x] **The decision tree is sound:** every answer leads to a question or a supported family, every node is reachable, and every leaf family renders.
- [x] **Distribution → Sandbox demand:** Poisson(12) becomes 26 values with 0.014% of the tail trimmed and renormalised. Continuous and negative-support laws are rejected. In the browser, the Sandbox then ran 100 replications.
- [x] **Fitted distribution → passport:** it appears as an input row (browser test).
- [x] **Lectures:** 4 lectures; every referenced diagram exists and is internally consistent (edge endpoints and walkthrough ids), sorting-game buckets are valid, try-links point at real routes, quotes carry no citations, and quiz answers resolve (`tests/content.test.ts`). The flip cards and the sorting game were exercised in the browser.
- [x] **Owner rules enforced by a test:** no author or institution names, no Croatian, and no raster figures anywhere in the app source.
- [x] **Routes:** 79 crawled, including `/lectures/*` and `/labs/*`, with zero page errors. `/legacy/*` redirects to `/labs/*`.
- [x] **Layout:** no page-level overflow for the hub, lecture and lab pages at 320, 390, 820 and 1440 px in both themes. The full first-problem journey and the recovery-state scripts still pass.

## Known limitations

- **Not deployed:** no live Netlify or Railway deployment was performed or verified.
- **Main bundle:** about 0.89 MB minified (about 268 kB gzip), mostly authored teaching text. The labs are lazy-loaded. It works, but Vite warns.
- **Lecture text and diagrams:** an English condensation and redrawing of the course slides. The owner should review them before teaching.
- **Owner-directed style deviation:** the playful layer departs from STYLE.md's calmer brief; see ADR 0002.
- **PNG/SVG figure export (SHOULD):** not implemented. Charts can be captured with browser screenshots, and the data is in the CSV.
- **Python/Colab notebook export (LATER):** not implemented.
- **Queueing Lab:** no verified URL was available, so it shows "App link not configured".
- **Teacher review:** it is a manual label without authentication, by design.
