# ADR 0002 — Labs, lectures and the playful visual layer

Status: accepted · 20 November 2026

## Context

The owner asked for four things: incorporate the legacy labs, bring in the Monte Carlo Simulation Lab's distribution material (with distribution fitting as a priority), use lectures 01–04 from the course, and make the app "much more visually appealing … not cluttered by words … as playful as possible".

## Decisions

1. **Labs replace the archived legacy labs.**
   - Domain logic lives in `src/domain/distributions/`: laws, tree, preview, fitting, experiments, code, transfer.
   - It is pure and unit-tested, including fits against scipy.stats reference values and the ported Monte Carlo Simulation Lab law and tree tests.
2. **jStat** (`jstat@1.9.6`, the version the Monte Carlo Simulation Lab uses) supplies the special functions behind 22 distribution families, so both apps share semantics. **Chart.js is removed**; all charts are the app's own token-themed SVG.
3. **Seeded sampling everywhere.** The previews use the app's `sfc32-cyrb128-v1` RNG and inverse-CDF sampling with u at cell centres, so draws are never exactly 0 or 1.
4. **Maximum-likelihood fitting.**
   - Closed forms where they exist; Newton iteration (Gamma) or bisection (Weibull) on the shape; Nelder–Mead for logistic and triangular.
   - Ranked by AIC and shown as Akaike weights, explicitly relative to these candidates only.
   - The KS p-value is deliberately omitted, because parameters are estimated.
5. **Transfer of distributions.**
   - A discrete law can become Sandbox demand. Tails under 1e-4 are trimmed and the rest renormalised; the dropped mass is displayed. The engine's cap on discrete values was raised from 20 to 60.
   - Any law can become a passport input row. It is marked "parameter uncertainty not quantified" and needs a name, unit and source.
6. **Lectures as story slides.** The typed `LectureRecord` uses visual blocks: diagram, idea, quote, flip cards, steps, comparison table, sorting game and try link, with enforced word limits.
6a. **Live diagrams instead of pictures** (owner direction). All 38 course figures are data-defined diagrams:
    - React Flow (`@xyflow/react@13.0.2`, as in the Monte Carlo Simulation Lab) for graphs, with custom shaped nodes, animated edges and walkthrough steps.
    - SVG for curves, Venn diagrams, scales and icon grids.
    - The diagram code and specs are lazy-loaded in their own chunk.
6b. **English only, no authors.** A guard test (`tests/content.test.ts`) scans all app source for author or institution names, Croatian characters or words, and raster figure references.
7. **The playful layer** (`src/styles/playful.css`) is an owner-directed deviation from STYLE.md's calmer brief:
   - **Family accents:** four family colours from the course family guide, defined centrally for both themes.
   - **Motion:** tiles lift slightly on hover, and the journey bubbles bob gently.
   - **Decoration:** some emoji in playful contexts (sorting games, try cards, the lowest-AIC marker).
   - **Kept unchanged:** the STYLE §2 tokens and accessibility rules. Motion stops under `prefers-reduced-motion`, everything is keyboard-operable, and charts still have data tables.
8. **Copy was shortened** across the hub pages. Long explanations moved into "Read more", "How it works" and "How to read this" disclosures.
9. **Labs are lazy-loaded.** The main bundle stays about 0.9 MB minified (about 270 kB gzip), mostly authored teaching text.
