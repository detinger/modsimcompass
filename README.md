# ModSimCompass

**Your guide through a modelling and simulation project.** ModSimCompass leads you from the first question to a recommendation you can defend. Learn the phases of a simulation study and the methods to choose from, from discrete-event simulation and system dynamics to agent-based models, Monte Carlo and structural equation modelling. Then build each piece with a focused tool and keep it all in one project that shows where you are and what comes next.

Everything runs in the browser. There are no accounts, no backend and no analytics.

## Three sections

| Section | What it does |
| --- | --- |
| **Learn** | A short, visual tour: the simulation process on the compass, eleven methods with a moving picture each, four key ideas, and a glossary. |
| **Toolbox** | Five tools. Each makes an **artefact** that is saved on this device, can be exported on its own, and can be added to a project. |
| **Project** | Seven steps on the project compass, five checkpoints, and a project report. Included artefacts stay live. |

### The compass

Seven stops, shown as a circle with a compass needle (or as a line, if you prefer):

1. **Frame**: who decides what, and how you will know it worked.
2. **Concept and scope**: what is inside the model, and what is left out on purpose.
3. **Choose a method**: a primary method and a justified alternative.
4. **Inputs and assumptions**: where every number comes from.
5. **Verification and validation**: is the model built right, and is it the right model.
6. **Outcomes and experiment**: a fair comparison, a scenario analysis or an analysis plan, depending on the method.
7. **Conclude and share**: a conditional recommendation and its limits.

The steps adapt to the chosen method. A PLS-SEM project collects measured constructs, checks its measurement and structural model and plans an analysis; a discrete-event simulation fits input distributions, separates tuning from validation and compares policies over paired replications; a queueing model solves scenarios by formula. What a project actually includes takes precedence over the method's default.

### The Toolbox

| Tool | Artefact | Highlights |
| --- | --- | --- |
| **Conceptual model** | Conceptual model | A canvas on the "parts of a conceptual model" frame: inputs, content, outputs, assumptions and what is left out. Ten element types, four kinds of link, starters (including technology acceptance), constructs from measurement data, undo, auto-arrange, keyboard use and a list view. Exports SVG, PNG and Markdown. |
| **Method chooser** | Method choice | Pick a family or answer questions; a shortlist with reasons, cautions and what each method leaves out; up to three methods side by side. |
| **Data and inputs** | Data model, or measurement data | Distributions: import a CSV or paste numbers, ranked fits (AIC, no p-values), Q–Q plot, seeded synthetic data, R and Python code, several columns at once. Measurement data: survey items grouped into constructs, Likert-aware summaries, a reliability screen and a sample-size note. Raw rows are kept only if you ask. |
| **Verify and validate** | Check plan | Standard checks per method, a validation calculator with a tolerance set beforehand, and a calibration or estimation record. Checks can be marked not applicable, with a reason. |
| **Fair comparison** | Comparison | Paste or import results from any simulator: paired or Welch intervals (unpaired unless you confirm shared random inputs), a dot plot, and the replications a target precision needs. A seeded example shows why pairing matters. |

### Live projects

Adding an artefact to a project puts a copy in the project file, so the report is complete on its own. The copy follows its original: edit it in the Toolbox (every card has **Edit** and a way back to its step) and the project updates. Text you write by hand in a step is never overwritten by a refresh. A checkpoint that was reviewed shows **Changed since review** when an included artefact changes or is removed afterwards.

### Exports

A project report as standalone HTML (print to PDF from the browser) or Markdown, the project file as JSON (re-importable), and a ZIP bundle with a manifest. Each artefact also exports on its own (pictures, CSV, Markdown, HTML, code) and as an artefact file that can be imported again. Files written under the app's earlier names still import.

## Getting started

Requires Node 20.19 or newer (`.nvmrc`: 22).

```bash
npm install
npm run dev     # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run check` | Typecheck, tests and production build |
| `npm test` | Vitest suites |
| `npm run lint` | ESLint (TypeScript, React hooks) |
| `npm run build` | Production build into `dist/` |
| `npm start` | Serve `dist/` with the production server (after a build) |
| `npm run gen:layouts` | Recompute stored diagram layouts after changing a diagram graph |

## Project layout

```
src/
  app/            shell, router, project store (autosave, conflicts, tabs), artefact store and live sync
  domain/         pure logic, all tested
    artefacts/    the six artefact kinds, files, inclusion in projects
    passport/     project schema, compass (steps, open items, checkpoints), importer, upgrades
    methods/      method registry, rule table, method profiles
    distributions/ laws, fitting, sampling, CSV
    measurement/  reliability and item statistics
    sandbox/      daily backlog model (example data) and interval statistics
  content/        worked example, standard checks, Learn text, diagram specs
  features/       home, learn, toolbox (one folder per tool), compass and project steps
  exports/        Markdown, HTML, JSON, ZIP
  persistence/    IndexedDB repository, preferences
  ui/             controls, charts, diagrams (the compass circle and line)
tests/            Vitest suites
docs/             plan, specifications, decisions, evidence
```

Product intent: [docs/LEARN-TOOLBOX-PLAN.md](docs/LEARN-TOOLBOX-PLAN.md). Contracts: [docs/TOOLBOX-SPEC.md](docs/TOOLBOX-SPEC.md) and [docs/COMPASS-SPEC.md](docs/COMPASS-SPEC.md). Visual tokens and accessibility: [STYLE.md](STYLE.md).

## Data and privacy

- Projects and artefacts are stored in this browser's local database (IndexedDB). Nothing is uploaded.
- Autosave shows its status. Each save keeps the previous revision, and deleted projects can be restored.
- If two tabs edit the same project, the app asks which version to keep. Only the tab showing a project writes synced artefacts into it.
- Work does not move between browsers or devices by itself: export a project file and import it on the other side.

## Deployment

The app builds to static files in `dist/`. Both hosts run `npm run build`.

**Netlify.** `netlify.toml` sets the build command, publishes `dist/`, uses Node 22, serves the app for deep links, returns a real 404 for missing assets and caches hashed assets for a year. Connect the repository in Netlify, or run `npx netlify deploy --prod --dir dist` after a build.

**Railway.** `railway.json` builds with Nixpacks (`npm ci && npm run build`) and starts `node server.mjs`, a dependency-free static server that binds `0.0.0.0:$PORT`, serves the app for deep links, returns 404 for missing assets, answers `GET /healthz`, and shuts down gracefully. Connect the repository in Railway; no environment variables are needed.
