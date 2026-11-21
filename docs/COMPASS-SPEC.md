# ModSimCompass — Project Compass specification

Version 2.0 · 21 November 2026 · supersedes the scope of PLAN.md v1. STYLE.md tokens and accessibility rules still apply.

## 1 Purpose

ModSimCompass is the **project checklist and compass** for a master's course in Modelling and Simulation. Students define their semester project as a **model passport**, step by step, and receive guidance and warnings along the way. The passport is ready to be **assessed at five checkpoints**. A small set of **tools** supports the project.

The app does not teach lectures, host lessons or quizzes, or duplicate the specialist apps.

## 2 Structure

| Area | Route | Contents |
| --- | --- | --- |
| **Home** | `/` | Your projects (title, step progress, checkpoint status) · new project · open the worked example |
| **Project compass** | `/project/:step` | 7 steps, checkpoints, export |
| **Tools** | `/tools/*` | Backlog sandbox · Distributions (explore, choose, fit) · Sampling · Regression · Specialist apps |
| Footer | `/help`, `/settings` | Help, settings |

Old routes redirect to `/`, `/project` or `/tools`.

## 3 The seven compass steps

| # | Step | Passport fields | Helpers |
| --- | --- | --- | --- |
| 1 | **Frame** | title, stakeholder, observed problem, decision levers, outcome of interest, precise question, claim type | — |
| 2 | **Concept and scope** | boundary, exclusions, horizon, time unit, level of detail, constraints, conceptual sketch | Conceptual-model diagram |
| 3 | **Choose a method** | primary method, alternative, both justifications, recorded rule version and answers | Method chooser (questionnaire → shortlist with reasons, caveats and what each method omits); method-family cards; specialist-app links |
| 4 | **Inputs and assumptions** | inputs (value, unit, source, provenance, uncertainty), assumptions (rationale, consequence, planned check, evidence) | Distribution tools, with Send to project |
| 5 | **Verification and validation plan** | verification checks, validation evidence plan, calibration (kept separate) | V&V diagram; backlog sandbox as a practice ground |
| 6 | **Outcomes and experiment** | outcome metrics (definition, unit, direction, aggregation, criterion), baseline, alternatives, comparison logic, run settings | Paired-comparison diagram; sandbox run settings |
| 7 | **Conclude and share** | results, recommendation, limitations, conditions that change the decision | Checkpoints, export |

Every step shows three supports:

1. **Why it matters:** one or two sentences, plus a good example and a weak example.
2. **Warnings:** computed from the passport by an authored rule table (§4).
3. **Self-check questions:** 2–3 per step, answered in the student's own words. They are stored in the passport and exported, and **never auto-graded**.

The **worked example** is a complete, good passport (the backlog of an IT helpdesk, modelled with system dynamics). Its reference copy at `/example` is read-only, so each step can show the example's answers for that step. On the Project page, among the examples, it starts an editable copy of the whole project (checkpoints back to draft); the reference page can also copy it as a practice project.

## 4 Warnings (compass rules)

A rule has an id, a step, a severity and a message (plus an optional fix link):

- **gap:** required information is missing;
- **check:** something is likely inconsistent or scientifically risky;
- **tip:** a wording or quality suggestion.

Rules are deterministic, versioned (`compass-rules-v2`) and explain themselves. They never label written reasoning correct or incorrect. Wording tips are labelled as suggestions.

Examples of check rules:

- the question has no measurable outcome;
- calibration is described but validation is empty;
- the method is stochastic but no replications or seed appear in the run settings;
- the question mentions waiting times but the primary method cannot estimate individual waiting times;
- an input has no unit or source;
- an assumption has no planned check;
- the sandbox results are stale;
- the recommendation has no conditions that would change it.

## 5 Checkpoints and assessment

| Checkpoint | Expected steps |
| --- | --- |
| Proposal | 1–2 |
| Design | 3–4 |
| Baseline | 5 |
| Evaluation | 6 |
| Final | 7 |

Each checkpoint shows:

- a **readiness list** of the gaps and checks that are still open for its steps;
- a **rubric** of 3–4 criteria, each with levels from Emerging to Strong. The rubric is recorded as self-assessment or teacher feedback; teacher feedback is a manual label with no authentication;
- **status** (Draft, Self-reviewed, Teacher-reviewed, Needs revision) and **notes**.

Completeness ("N of 7 steps started") stays separate from review status and from model validity.

Exports (Markdown, standalone HTML / print-to-PDF, JSON, CSV, ZIP with manifest) include the self-check answers, open warnings and rubric records, so a teacher can grade from the file alone.

## 6 Tools

- **Backlog sandbox:** daily aggregate recurrence, replications, paired comparison.
- **Distributions:** explore, choose, fit (maximum likelihood).
- **Sampling.**
- **Regression.**
- **Specialist apps:** links.

Distribution tools can add an input row to the active project. Discrete laws can become sandbox demand.

## 7 Data

- The passport schema moves to **version 2**: it adds `selfChecks` and per-checkpoint `rubric`. Version-1 files import with defaults.
- Local-first IndexedDB. Autosave, conflict detection, recoverable delete and import/export behave as before.
- Course-progress records from v1 are no longer used.

## 8 Visuals

There are about five purposeful diagrams, each readable at card size, using automatic layout (elkjs, run at build time and stored) and build-up animation:

- the compass journey on Home;
- conceptual-model components (step 2);
- method families (step 3);
- verification and validation (step 5);
- a paired comparison (step 6).

## 9 Not in scope

Lectures, lessons, examples, quizzes, case libraries, a glossary page, standalone modelling lenses, accounts and backends.

## Amendments after review (21 November 2026)

Two independent reviews of the built app (a code review and a first-time-user walkthrough as a student and as a working analyst) led to these changes. Where they differ from the text above, this section governs.

- **Naming.** The app says "project" throughout. The exported document is the "project report". "Model passport" survives only as an internal name in the code.
- **Rules are `compass-rules-v2`.** Added: a data status per input (have it, can get it, must assume) with a plan; a planning stage that makes step 7 due later instead of missing; suggestions for a question with no amount or period, a problem that opens like a solution, a one-word outcome and unlabelled arrows; checks for observed data whose source reads like a guess and for data to be obtained without a plan. Suggestions never affect checkpoint readiness.
- **The worked example is self-reviewed.** All five checkpoints carry ratings and notes by its own author, with four criteria at Developing and the reason given. No reviewer is named. A practice copy starts with empty checkpoints.
- **Sandbox results are opt-in for reports.** They are included by default only when the project's run settings name the sandbox; the export dialog has a switch. The project file always keeps them.
- **Specialist apps without a verified address are hidden**, not shown as "not configured".
- **Schema stays at version 2.** The new fields (`inputs[].availability`, `inputs[].plan`, `identity.stage`) are optional, so earlier files and stored projects remain valid.
- **Diagram layouts are computed at build time** and stored; the layout engine is not shipped.
