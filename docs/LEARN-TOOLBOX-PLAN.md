# Plan: Learn, Toolbox and Project

Status: revised 21 November 2026 after the owner's answers. Not started. Builds on the compass app on branch `compass-rebuild`.

## 1. The idea in three lines

- **Learn is lean.** A short, visual overview of the simulation process and of all methods.
- **The Toolbox is powerful.** Five full-page tools. Each produces an **artefact** that can be exported on its own and added to a project.
- **The Project builder is lean.** Seven steps of framing questions on the project compass, plus the artefacts you include from the Toolbox.

One rule keeps it coherent: every Learn page, tool and project step belongs to exactly one of the seven compass stops and links to the other two. Anything that maps to no stop is cut.

Desktop comes first. The app must not break on a phone, but no phone-specific work is planned.

## 2. Structure

Left menu, top to bottom. An open section shows its pages as links.

| Section | Pages |
| --- | --- |
| **Home** | Projects, start, import |
| **Learn** | The simulation process · Methods at a glance · Key ideas |
| **Toolbox** | Conceptual model · Method chooser · Data and inputs · Verification, validation, calibration · Fair comparison · My artefacts |
| **Project** | Compass overview · seven steps · checkpoints · report |

| Compass stop | Learn | Toolbox | Artefact | Project step |
| --- | --- | --- | --- | --- |
| 1 Frame | The simulation process | — | — | Frame |
| 2 Scope | Parts of a conceptual model | **Conceptual model** | Conceptual model | Scope and concept |
| 3 Method | Methods at a glance | **Method chooser** | Method choice | Choose a method |
| 4 Inputs | Describing uncertainty | **Data and inputs** | Data model (one per input) | Inputs and assumptions |
| 5 Check | Verification, validation, calibration | **Verification, validation, calibration** | Check plan | Verification and validation |
| 6 Experiment | A fair comparison | **Fair comparison** | Comparison | Outcomes and experiment |
| 7 Conclude | Closing the loop | — | — | Conclude and share |

## 3. Artefacts: how the Toolbox and the Project connect

This is the main design change from the first draft of this plan.

- **A tool always works, with or without a project.** What you make is saved on this device as an artefact in **My artefacts**, with a name and a date. Nothing is lost when you leave the page.
- **Export individually.** Every artefact has its own exports (listed per tool below) and its own file that can be imported again.
- **Add to project.** One button puts the artefact into the open project, at the step it belongs to. With no project open, the button offers to start one.
- **The project keeps a copy.** Adding stores a snapshot inside the project file, so the project report is complete on its own and a reviewer sees exactly what was included. The copy remembers where it came from; if the artefact is edited later, the project step offers "Update from Toolbox".
- **Project steps include artefacts.** A step shows the artefacts added to it as cards (picture or summary, date, remove, open in tool) under its framing questions. A step can also pick from My artefacts directly.
- **Imported data stays out of files.** A data model stores the fitted distribution, the summary statistics and where the data came from. The raw rows live in memory only, unless the user chooses "keep the data with this artefact".

## 4. Learn

About 20 to 30 minutes of reading in total, mostly pictures. No quizzes, no lessons, no author names.

1. **The simulation process.** The project compass diagram is the map. Each stop opens a short card: what you do there, what usually goes wrong, which tool and project step it leads to.
2. **Methods at a glance.** Entered through the four-families diagram. One card per method (11):
   - what it is for, in one sentence;
   - a small moving picture of how it works;
   - what it needs, what it leaves out, when it fails;
   - a link to its specialist app where one exists.
   A table puts all 11 side by side. The text comes from the method registry, so Learn and the chooser cannot disagree.
3. **Key ideas.** Parts of a conceptual model; describing uncertainty; verification, validation, calibration; a fair comparison. Each is its diagram, a few lines, and a button into its tool. The coin-flip and regression demos move here as illustrations of chance and noise. A short glossary closes the page.

Source material: lectures 01–04 in `TEMP/` as reference only; everything is written fresh in English.

## 5. Toolbox

### 5.1 Conceptual model

A canvas built with React Flow.

- **The frame is the diagram.** The background is the "Parts of a conceptual model" layout: objectives on top, inputs → content → outputs across the middle, assumptions and simplifications below.
- **Elements:** actor, entity, resource, activity, queue or stock, variable, lever, outcome, external influence, note.
- **Connections:** flow of things, influence (with + or −), information, "decides".
- **Boundary:** an in-scope frame; what lies outside is listed as excluded.
- **Starters** per method family: stock and flow, queue network, interacting agents, causal paths.
- **Working features:** palette, drag and connect, labels, auto-arrange, undo and redo, zoom to fit, keyboard operation, and a text list of the same model.
- **Exports:** picture (SVG and PNG), text description (Markdown), artefact file.
- **Into the project:** the picture and the lists of levers, outcomes and exclusions go to step 2.

### 5.2 Method chooser

- Entered through the four-families diagram: pick a family, or answer the questions.
- Shortlist with reasons, cautions and what each method leaves out.
- Side-by-side comparison of two or three methods.
- **Exports:** a one-page method decision (primary, alternative, reasons, what is left out) as Markdown and HTML; artefact file.
- **Into the project:** step 3.

### 5.3 Data and inputs

Explore, Choose, Fit and Sampling merged into one path:

1. **Bring data or describe it.** Import a CSV and pick a column, paste numbers, or answer the shape questions when there is no data.
2. **Discover.** Summary, histogram, ranked fits, Q–Q plot.
3. **Settle the model.** Take a fitted distribution or set one by hand.
4. **Generate.** Draw seeded synthetic data from the model.
5. **Name it.** Name, unit, data status, source.

- **Exports:** generated data (CSV), fit report (Markdown and HTML), R and Python code, artefact file.
- **Into the project:** one input row per data model in step 4.

### 5.4 Verification, validation, calibration

Entered through the three-check diagram.

- **Check plan builder.** Standard checks for the chosen method (units, conservation, known simple cases, extreme values, repeatability, walk-through with an expert) or your own, each with a status: planned, done, passed, failed.
- **Validation calculator.** Paste observed and simulated values; get the error, whether it is within the tolerance set beforehand, and a plot.
- **Calibration record.** Which parameters were tuned, on which data, and a check that validation uses other data.
- **Exports:** check plan (Markdown and CSV), validation plot (SVG), artefact file.
- **Into the project:** step 5.

### 5.5 Fair comparison

Entered through the "A fair comparison" diagram.

- **Your own results.** Paste or import the replication outcomes of two policies from any simulator. Get the paired differences, the interval, the dot plot from the diagram, the number of replications a target precision needs, and a check against the decision criterion.
- **Try it with example data.** One click loads a small seeded example (two capacities of a daily backlog), with and without shared random inputs, to show why pairing matters.
- **Exports:** comparison summary (Markdown and HTML), plot (SVG), differences (CSV), artefact file.
- **Into the project:** steps 6 and 7.

**The backlog sandbox is removed as a tool.** Its controls (schedules, abandonment, feedback, cost) taught one specific model and were the part a reviewer found misleading for unrelated projects. Its engine stays only to produce the example data above.

## 6. Project builder

- **Opens on the compass.** The project compass diagram is the overview: seven stops with what is started, open items, and included artefacts; checkpoints as flags.
- **Lean steps.** Each step is its framing questions, its included artefacts, the open items and the self-check. The editors that are embedded today (sketch table, chooser, input rows from tools) move to the Toolbox.
- **Open items understand artefacts.** For example: no conceptual model included in step 2; a data model with no source; a check plan with a failed check; a comparison with fewer than the planned replications.
- **Report.** Includes each artefact as it was added: the conceptual model as a picture, the method decision, the data models, the check plan, the comparison results.

## 7. Technical notes

- **Routes:** `/learn/*`, `/toolbox/*`, `/project/*`. Current `/tools/*` addresses redirect.
- **Storage:** a new `artefacts` store on the device (database version 2, with upgrade). Artefact files are versioned and validated on import like project files.
- **Project file schema version 3:** adds included artefacts per step. Version 2 projects upgrade automatically: the existing sketch becomes a conceptual model artefact, the method choice a method artefact, sandbox results a comparison artefact.
- **React Flow** (`@xyflow/react`) is loaded only on the conceptual model page.
- **Removed:** the sandbox screens and their report appendix; the separate Explore, Choose, Fit and Sampling pages.
- **Gates:** tests, typecheck, lint, screen tour, automated accessibility audit, two independent reviews. The standing rules (no institution or author names, English only, no raster figures) stay enforced by test.

## 8. Order of work

| Phase | Work |
| --- | --- |
| 1 Slice | Menu and routes; artefact store with export, import and add to project; **Conceptual model** tool end to end; Project overview on the compass with one artefact-aware step (step 2) |
| 2 Review | The owner looks at the slice. Adjust before building the rest. |
| 3 Parallel | Learn; Method chooser; Data and inputs; Verification tool; Fair comparison |
| 4 Project | Remaining steps made lean and artefact-aware; report; upgrade of version 2 projects |
| 5 Finish | Integration, browser checks, accessibility audit, independent reviews, documentation |

The slice comes first on purpose. The last two directions were each changed after a complete build; a slice shows the artefact idea and the canvas, the two riskiest parts, before the other four tools are built on them.

## 9. Decisions taken

| Question | Decision |
| --- | --- |
| Tools with no project open | They work; artefacts are saved on the device and can be added to a project |
| Imported data | Raw data in memory only; the model and its source are stored; optional "keep the data" |
| Backlog sandbox | Removed as a tool; engine kept for example data in Fair comparison |
| Coin-flip and regression demos | Moved into Learn |
| Depth of Learn | Lean: one card per method |
| Phones | Not a priority; must not break |
| Adding to a project | The project keeps a copy, with "Update from Toolbox" |

## 10. Risks

- **Scope.** This roughly doubles the app. The compass rule in section 1 is the guard.
- **Content.** Learn text, method pictures and the standard check lists are new writing and need the owner's review, as the current step guidance still does.
- **Two copies of an artefact.** The Toolbox copy and the project copy can differ. The project shows the date of its copy and offers the update; it never changes silently.
- **Existing projects.** Sandbox results in current projects become comparison artefacts on upgrade; the sandbox settings themselves are dropped.
