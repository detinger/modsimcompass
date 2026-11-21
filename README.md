# ModSim Essentials

**A project compass for modelling and simulation.** ModSim Essentials helps students and professionals define a modelling project properly: frame the question, set the scope, choose a method, document data and assumptions, plan verification and validation, design a fair experiment, and state a conditional recommendation.

The result is one living project record that can be reviewed at five checkpoints and exported as a **project report** for assessment or sign-off.

Everything runs in the browser. There are no accounts, no backend and no analytics.

## Three areas

| Area | What it does |
| --- | --- |
| **Home** (`/`) | Your projects, a new project, import, and the worked example. |
| **Project** (`/project/:step`) | The compass: seven guided steps, checkpoints and export. |
| **Tools** (`/tools/*`) | Small practical tools that feed the project. |

### The seven steps

1. **Frame** — stakeholder, observed problem, levers, measurable outcome, precise question.
2. **Scope and concept** — boundary, exclusions, horizon, level of detail, conceptual sketch.
3. **Choose a method** — an explainable shortlist with reasons, caveats and what each method omits; a primary method and a justified alternative.
4. **Inputs and assumptions** — values, units, sources, uncertainty and a data status for each input (have it, can get it, must assume); assumptions with consequences and planned checks.
5. **Verification and validation** — checks that the model is built right and is the right model, with calibration kept separate.
6. **Outcomes and experiment** — computable metrics, baseline, alternatives, a fair comparison and reproducible run settings.
7. **Conclude and share** — results, a conditional recommendation, limitations, and what would change the decision.

Every step shows:

- **why it matters**, with a good and a weak example;
- **open items**, computed from the project by a versioned rule table (missing information, things to check, suggestions);
- **self-check questions**, answered in your own words and never scored;
- a peek at the **worked example** (a complete, self-reviewed project for a student-support backlog study).

### Checkpoints

Proposal, Design, Baseline, Evaluation and Final. Each shows a readiness list, a rubric and a review status.

Completeness ("N of 7 steps started") is kept separate from review status and from model validity. Reviewer feedback is a manual label; the app has no logins.

A project can be marked as **still planning**. Step 7 is then due later instead of missing, so a project definition can be complete before any model is run.

### Tools

- **Backlog sandbox:** a transparent daily model with replications and paired policy comparison. Every number can be reconstructed from its daily table.
- **Distributions:** explore 22 families, choose one from a decision tree, or fit one to data (maximum likelihood, AIC/BIC, Q–Q plot).
- **Sampling** and **Regression:** see how chance and noise behave.
- **Specialist apps:** links to method-specific apps. Handoff is manual: export the project first.

Distributions can be sent to the project's inputs. A count distribution can drive the sandbox. A tool opened from a step offers the way back to that step.

### Exports

A project report as standalone HTML (print to PDF from the browser) or Markdown, the project file as JSON (re-importable), CSV of sandbox results, and a ZIP with a manifest. Reports include self-check answers, open items, data readiness and rubric records, so a reviewer can work from the file alone. Sandbox results are included only when the project says it used the sandbox.

## Getting started

Requires Node ≥ 20.19 (`.nvmrc`: 22).

```bash
npm install
npm run dev          # http://localhost:5173
npm run check        # typecheck + tests + production build
npm run lint
npm run gen:layouts  # recompute the stored diagram layouts after changing a diagram graph
npm start            # serve dist/ with the production server (after npm run build)
```

## Project layout

```
src/
  app/          shell, router, store (autosave, conflict handling)
  domain/       pure logic
    passport/   schema v2, compass (steps, warnings, rubrics), importer
    methods/    method registry and explainable rule table
    sandbox/    recurrence, seeded RNG, statistics, experiments
    distributions/  laws, decision tree, fitting, experiments, code snippets
  content/      worked example, diagram specs, sandbox presets
  features/     home, compass, tools (sandbox, distributions, …), help, settings
  exports/      Markdown, HTML, CSV, JSON bundle, ZIP
  persistence/  IndexedDB repository, preferences
  ui/           controls, charts, diagrams
  workers/      replication worker
tests/          Vitest suites
docs/           spec, build plan, decisions, evidence, guide
```

Specification: [docs/COMPASS-SPEC.md](docs/COMPASS-SPEC.md). Visual tokens and accessibility rules: [STYLE.md](STYLE.md).

## Data and privacy

- Projects are stored in this browser's IndexedDB (database `modsim101`). Preferences are in `localStorage`.
- Autosave shows saved, saving or save-failed status. Each save keeps the previous revision, and deleted projects can be restored.
- If two tabs edit the same project, the app asks whether to keep both versions.
- Work does not move between browsers or devices. Export a project file and import it on the other side.

## Deployment

The app builds to static files in `dist/`.

- **Netlify:** `netlify.toml` (build, SPA fallback, real 404s for missing assets).
- **Railway:** `railway.json` builds and starts `node server.mjs`, a dependency-free static server with SPA fallback, `/healthz` and graceful shutdown.

## Status

See [docs/release-evidence.md](docs/release-evidence.md) for what was verified and for known limitations.
