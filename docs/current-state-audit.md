# Current-state audit — ModSim101 before the ModSim Essentials upgrade

Audit date: 20 November 2026. Audited commit: `c940e77` ("Initial commit"). This record satisfies PLAN §2 (P0).

## 1 Repository and tooling

| Item | Finding |
| --- | --- |
| Instructions | No CLAUDE.md or AGENTS.md. README described "ModSim101 📊". Its install steps referred to a `learning-tool/` folder that no longer exists after the second commit moved everything to the root. |
| Package | `learning-tool` (private, v0.0.0). React 19.2, Vite 7.3, Chart.js 4.5 + react-chartjs-2, framer-motion (unused), prism-react-renderer (unused). npm with `package-lock.json`. |
| Language | Plain JavaScript/JSX. No TypeScript, no tests. |
| Routing | None. Pages were switched with `useState('home')` in `App.jsx`, so no URL ever changed and there were **no bookmarks or deep links to preserve**. |
| Persistence | None. No `localStorage`, `sessionStorage` or IndexedDB usage anywhere, so **no saved projects or learning progress existed to migrate**. |
| Hosting config | None committed (no `netlify.toml`, no Railway config, no server). The built `dist/` folder was committed to git. |
| Fonts | `index.css` loaded Space Grotesk, Inter and JetBrains Mono from Google Fonts, a third-party request. |
| Theme | Dark only, with a private palette and glassmorphism (gradients, blur), unlike STYLE.md. |

## 2 Baseline checks (before any change)

| Check | Result |
| --- | --- |
| `npm run build` | Passed: 39 modules, JS 449.7 kB (143 kB gzip). |
| `npm run lint` | **Failed: 4 errors and 1 warning**. Unused `navigate` (Home.jsx), unused `c` (Lesson02.jsx:97), unused `e` (StatFit.jsx:161), setState in an effect (StatFit.jsx:167), and an exhaustive-deps warning (StatFit.jsx:167). These are pre-existing and were not introduced by this work. |
| Tests | None existed. |

## 3 Capability inventory

| Capability | Location (before) | Classification | Decision |
| --- | --- | --- | --- |
| Overview page with module cards | `src/pages/Home.jsx` | Superseded | Replaced by Start Here and the Learn catalogue. Its content now introduces the Legacy labs page. |
| Lesson 01: random letter sampling and biased coin flips, with R/Python code | `src/pages/Lesson01.jsx` | Verified (renders; uses `Math.random`) | **Preserved** as legacy lab `/legacy/sampling` |
| Lesson 02: distributions explorer (Normal, Beta, Log-normal, Exponential, Poisson, χ², Triangular), with code | `src/pages/Lesson02.jsx` | Verified | **Preserved** as `/legacy/distributions` |
| Lesson 03: linear model with noise, with code | `src/pages/Lesson03.jsx` | Verified | **Preserved** as `/legacy/linear-model` |
| Distribution fitting (MLE/MoM over 7 families, log-likelihood ranking) | `src/pages/StatFit.jsx` | Verified | **Preserved** as `/legacy/fitting` |
| Code panel with copy button | `src/components/CodePanel.jsx` | Verified | Preserved (moved to `src/legacy/`) |
| Sidebar navigation | `src/components/Sidebar.jsx` | Superseded | Replaced by the STYLE §4 shell |
| R / Python code exports | Inline snippets in the lessons | Verified (display only, no file export) | Preserved inside the legacy labs. Per PLAN §13 they are not extended to new content. |
| Exports, projects, progress | — | Missing | Implemented new (PLAN §9, §12, §13) |

Legacy labs are archived content. They are **not counted** in the 12 examples, 12 lessons and 12 challenges (PLAN §2, §10). They draw from unseeded `Math.random()`, which the legacy page states. The new domain code never calls `Math.random()`.

## 4 Route mapping

There were no URL routes, so no redirects are needed. The new routes are `/start`, `/lenses[/:id]`, `/sandbox`, `/detective[/:id]`, `/methods`, `/project[/:id]`, `/learn[/:id]`, `/examples[/:id]`, `/challenges[/:id]`, `/glossary`, `/projects`, `/settings`, `/help` and `/legacy[/:id]`. `/` redirects to `/start`, and unknown paths show a "Page not found" page.

## 5 Identifiers and storage keys

- The npm package name `learning-tool` is kept unchanged. The visible product name is now **ModSim Essentials**.
- No storage keys existed. The new keys keep the original project identifier as their prefix: IndexedDB database `modsim101`, `localStorage` keys `modsim101.prefs` and `modsim101.activeProject`, and the cross-tab channel `modsim101`. No migration was necessary, so none was written. The importer also accepts a future `modsim101/project` schema identifier, in case files were produced under the old name.
- The GitHub repository and hosting project names were **not** renamed.

## 6 Changes to tooling recorded

See [ADR 0001](adr/0001-architecture.md).

## 7 Update — legacy labs incorporated (20 November 2026)

At the owner's request, the archived legacy labs were rebuilt as first-class **Labs** (`/labs`). The legacy code and its dependencies (Chart.js, react-chartjs-2, and the unused framer-motion and prism-react-renderer) were removed. Old addresses redirect.

| Original lab | New lab | Changes |
| --- | --- | --- |
| Lesson 01 — sampling and coin flips (`/legacy/sampling`) | `/labs/sampling` | Seeded RNG instead of `Math.random()`; running-share convergence chart; R/Python code kept. |
| Lesson 02 — distributions explorer (`/legacy/distributions`) | `/labs/distributions` | 22 families (merged with the Monte Carlo Simulation Lab Distribution Studio); theoretical overlay, CDF view, pdf/cdf/quantile inspector; R/Python for every family. |
| Lesson 03 — linear model (`/legacy/linear-model`) | `/labs/linear-model` | Seeded; adds the slope standard error, 95% CI, R² and the sampling distribution of the slope over 300 repetitions. |
| Distribution fitting (`/legacy/fitting`) | `/labs/fitting` | **Corrected science.** The original labelled all fits "MLE" but used moment approximations for Weibull, Gamma, Logistic and Triangular. All fits are now maximum likelihood, verified against scipy.stats on both preserved datasets. Adds AIC/BIC, Akaike weights, the KS distance (no invalid p-value), a Q–Q plot, a mystery-data mode, and count families (Poisson, geometric). |
| — | `/labs/choose` | Decision tree ported from the Monte Carlo Simulation Lab Distribution Helper, rebuilt without React Flow (stepper plus an accessible tree canvas). |
