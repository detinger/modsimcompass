# Build spec: Learn, Toolbox and Project

Governs the build described in [LEARN-TOOLBOX-PLAN.md](LEARN-TOOLBOX-PLAN.md). Read the plan first for the product intent; this file fixes the contracts between work packages. Where the two differ, this file wins.

Existing rules still apply: [COMPASS-SPEC.md](COMPASS-SPEC.md) for the seven steps, `STYLE.md` tokens, and the owner rules in section 9.

## 1. Sections and routes

Left menu, top to bottom. Sub-links are always visible on desktop.

| Section | Route | Page |
| --- | --- | --- |
| Home | `/` | Projects, start, import |
| Learn | `/learn` | Landing: three cards |
| | `/learn/process` | The simulation process |
| | `/learn/methods` | Methods at a glance |
| | `/learn/methods/:id` | One method (same page, card opened) |
| | `/learn/ideas` | Key ideas, demos, glossary |
| Toolbox | `/toolbox` | Hub: five tools and recent artefacts |
| | `/toolbox/concept[/:id]` | Conceptual model |
| | `/toolbox/method[/:id]` | Method chooser |
| | `/toolbox/data[/:id]` | Data and inputs |
| | `/toolbox/checks[/:id]` | Verification, validation, calibration |
| | `/toolbox/compare[/:id]` | Fair comparison |
| | `/toolbox/artefacts` | My artefacts |
| Project | `/project` | Projects: your projects, and the examples (the worked example and the templates in `src/content/templates/`) |
| | `/project/overview` | Overview of the open project on the compass |
| | `/project/:step` | Step (`frame`, `scope`, `method`, `inputs`, `evaluation`, `experiment`, `conclude`) |
| | `/project/checkpoints` | Checkpoints |
| | `/example[/:step]` | Worked example, read only |

`:id` is an artefact id. Redirects: `/tools` → `/toolbox`; `/tools/distributions*`, `/tools/choose`, `/tools/fitting` → `/toolbox/data`; `/tools/sampling`, `/tools/regression` → `/learn/ideas`; `/tools/sandbox` → `/toolbox/compare`; `/tools/apps` → `/learn/methods`. Earlier redirects keep working.

## 2. Artefacts

An artefact is what a tool produces. It lives on the device in its own store, independent of any project.

### 2.1 Types — `src/domain/artefacts/types.ts`

```ts
export const ARTEFACT_SCHEMA = 'modsimcompass/artefact'; // files named modsim-essentials/artefact still import
export const ARTEFACT_SCHEMA_VERSION = 1;
export type ArtefactKind = 'concept-model' | 'method-choice' | 'data-model' | 'check-plan' | 'comparison';

export interface ArtefactMeta {
  schema: typeof ARTEFACT_SCHEMA; schemaVersion: number;
  id: string; kind: ArtefactKind; title: string;
  createdAt: string; updatedAt: string;
  /** Increments on every saved change. */
  revision: number;
}

// ── Conceptual model ──
export type CMNodeType = 'actor' | 'entity' | 'resource' | 'activity' | 'stock' | 'variable' | 'lever' | 'outcome' | 'external' | 'note';
export type CMZone = 'inputs' | 'content' | 'outputs' | 'outside';
export interface CMNode { id: string; type: CMNodeType; label: string; x: number; y: number; zone: CMZone }
export type CMEdgeKind = 'flow' | 'influence' | 'information' | 'decides';
export interface CMEdge { id: string; from: string; to: string; kind: CMEdgeKind; sign: '' | '+' | '-'; label: string }
export interface ConceptModel { objectives: string; assumptions: string; simplifications: string; nodes: CMNode[]; edges: CMEdge[] }

// ── Method choice ──
export interface MethodChoice {
  answers: MethodAnswers; ruleVersion: string; shortlist: MethodId[];
  primary: MethodId | ''; alternative: MethodId | '';
  justification: string; alternativeJustification: string;
}

// ── Data model (one uncertain input) ──
export interface DataModel {
  name: string; unit: string;
  family: Kind; params: number[];
  /** How the model was arrived at. */
  origin: 'fitted' | 'described' | 'manual';
  provenance: string; uncertainty: string;
  availability: Availability; plan: string;
  summary: { n: number; mean: number; sd: number; min: number; max: number } | null;
  fit: { rank: number; candidates: { family: Kind; aic: number }[]; ksD: number | null } | null;
  generator: { seed: string; n: number };
  /** Raw data is stored only when the user asks for it. */
  keepData: boolean; data: number[];
}

// ── Check plan ──
export type CheckStatus = 'planned' | 'done' | 'passed' | 'failed';
export interface PlannedCheck { id: string; group: 'verification' | 'validation' | 'calibration'; text: string; status: CheckStatus; evidence: string }
export interface CheckPlan {
  method: MethodId | '';
  checks: PlannedCheck[];
  validation: { measure: string; tolerancePct: number | null; observed: number[]; simulated: number[] };
  calibration: { parameters: string; tunedOn: string; validatedOn: string };
}

// ── Comparison of two policies ──
export interface Comparison {
  outcome: string; unit: string; direction: 'lower' | 'higher';
  baselineLabel: string; alternativeLabel: string;
  /** One value per replication. Paired: row i of both lists used the same random inputs. */
  baseline: number[]; alternative: number[]; paired: boolean;
  minimumDifference: number | null; targetHalfWidth: number | null;
  origin: 'pasted' | 'imported' | 'example';
  note: string;
}

export interface ArtefactData {
  'concept-model': ConceptModel; 'method-choice': MethodChoice; 'data-model': DataModel; 'check-plan': CheckPlan; 'comparison': Comparison;
}
export type Artefact<K extends ArtefactKind = ArtefactKind> = { [P in K]: ArtefactMeta & { kind: P; data: ArtefactData[P] } }[K];
```

Limits enforced by every sanitizer: text ≤ 20,000 characters; lists ≤ 2,000 items (number lists ≤ 10,000); numbers finite; ids match `/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/`; enumerations validated; unknown keys dropped.

### 2.2 Kind definitions — `src/domain/artefacts/kinds.ts` and one file per kind

```ts
export interface KindDef<K extends ArtefactKind> {
  kind: K;
  label: string;        // "Conceptual model"
  toolPath: string;     // "/toolbox/concept"
  step: StepId;         // the project step it belongs to
  /** false: a project holds one of this kind; adding another replaces it. */
  many: boolean;
  empty(): ArtefactData[K];
  /** Clean copy with only known, well-typed fields, or null when the shape is wrong. */
  sanitize(raw: unknown, warn: (m: string) => void): ArtefactData[K] | null;
  /** True when there is nothing worth saving yet. */
  isEmpty(data: ArtefactData[K]): boolean;
  /** Two to five short plain-text lines for a card. */
  summary(data: ArtefactData[K]): string[];
  /** Report section in the Markdown subset of `src/exports/html.ts` (lists, tables, paragraphs; no headings). User text must go through the escaping helpers of `src/exports/markdown.ts`. */
  markdown(data: ArtefactData[K]): string[];
  /** Standalone SVG markup for cards and the report, or null. All text escaped; no scripts, no external references; colours via CSS variables with fallbacks. */
  figure(data: ArtefactData[K]): string | null;
  /** Writes the matching project fields (see 3.2). Mutates the draft. */
  applyToProject(doc: ProjectDoc, data: ArtefactData[K], inclusionId: string): void;
}
export const KINDS: { [K in ArtefactKind]: KindDef<K> };
```

| Kind | File | `step` | `many` | Tool path |
| --- | --- | --- | --- | --- |
| `concept-model` | `conceptModel.ts` | `scope` | false | `/toolbox/concept` |
| `method-choice` | `methodChoice.ts` | `method` | false | `/toolbox/method` |
| `data-model` | `dataModel.ts` | `inputs` | true | `/toolbox/data` |
| `check-plan` | `checkPlan.ts` | `evaluation` | false | `/toolbox/checks` |
| `comparison` | `comparison.ts` | `experiment` | true | `/toolbox/compare` |

The foundation ships each file with a correct `empty`, `isEmpty`, a strict `sanitize`, a basic `summary`, `markdown`, `figure: () => null` and a working `applyToProject`. The package that owns the kind improves `summary`, `markdown` and `figure` and may tighten the rest. It must not change the types without telling the coordinator.

### 2.3 Artefact files — `src/domain/artefacts/file.ts`

- `artefactJson(a: Artefact): string` — the downloadable file (`<slug>.artefact.json`).
- `parseArtefactJson(text: string): { ok: true; artefact: Artefact; warnings: string[] } | { ok: false; error: string }` — size limit 5 MB, schema name and version checked, future versions rejected with an explanation, `KINDS[kind].sanitize` applied, new id assigned on import.
- `createArtefact(kind, opts?: { title?: string; now?: string }): Artefact`.

### 2.4 Storage — `src/persistence/db.ts`

Database version 2 adds an `artefacts` object store (key `id`). `Repo` gains `listArtefacts()`, `getArtefact(id)`, `saveArtefact(a)`, `deleteArtefact(id)`. The in-memory fallback implements the same. Opening a version 1 database upgrades it without touching projects.

### 2.5 React API — `src/app/artefacts.tsx`

```ts
useArtefacts(): {
  ready: boolean;
  list: Artefact[];                                   // newest first
  ofKind<K extends ArtefactKind>(kind: K): Artefact<K>[];
  get(id: string): Artefact | undefined;
  save(a: Artefact): Promise<void>;                   // bumps revision and updatedAt
  remove(id: string): Promise<void>;
  duplicate(id: string): Promise<Artefact | null>;
  importText(text: string): Promise<{ ok: true; artefact: Artefact; warnings: string[] } | { ok: false; error: string }>;
}

/** The editing session of one tool page. */
useArtefactEditor<K extends ArtefactKind>(kind: K, routeId: string | undefined): {
  artefact: Artefact<K>;                              // a blank draft until first change
  persisted: boolean;                                 // false while it is still the blank draft
  setData(fn: (draft: ArtefactData[K]) => void): void;// structuredClone + mutate; autosaves after 500 ms (2 s max wait)
  rename(title: string): void;
  startNew(): void;                                   // a fresh blank draft
  open(id: string): void;
  saveState: 'idle' | 'saving' | 'saved' | 'failed';
}
```

Opening a tool with no id shows the most recently edited artefact of that kind, or a blank draft. The first change saves it and replaces the address with `/toolbox/<tool>/<id>`. Unsaved edits are flushed on page hide and before navigation.

## 3. Artefacts in a project

### 3.1 Schema version 3 — `src/domain/passport/schema.ts`

```ts
export interface Inclusion<K extends ArtefactKind = ArtefactKind> {
  /** Id of this copy inside the project. */
  id: string;
  /** Id and revision of the Toolbox artefact it was copied from. */
  sourceId: string; sourceRevision: number;
  kind: K; title: string; addedAt: string;
  data: ArtefactData[K];
}
// ProjectDoc gains:
artefacts: Inclusion[];
// InputRow gains (optional): inclusion?: string   // id of the data-model copy that owns this row
```

`PASSPORT_SCHEMA_VERSION = 3`. Version 1 and 2 files and stored projects upgrade on load and on import:

- a project with sketch nodes gets a `concept-model` copy built from them;
- a project with a recorded method decision gets a `method-choice` copy;
- a project with a sandbox run gets a `comparison` copy built from the run's average end-of-day backlog per replication;
- `sandbox` becomes an optional legacy field that nothing reads.

### 3.2 Adding, updating, removing — `src/domain/artefacts/include.ts`

```ts
includeArtefact(doc: ProjectDoc, a: Artefact, now: string): { inclusionId: string; replaced: Inclusion | null };
removeInclusion(doc: ProjectDoc, inclusionId: string): Inclusion | null;
inclusionState(inc: Inclusion, source: Artefact | undefined): 'current' | 'outdated' | 'source-missing';
inclusionsFor(doc: ProjectDoc, step: StepId): Inclusion[];
```

All mutate a draft and are called inside the store's `update`.

- **Same source again** (`sourceId` already included): the copy is refreshed in place. This is "Update from Toolbox".
- **`many: false`**: a new copy replaces the existing one of that kind.
- After storing the copy, `KINDS[kind].applyToProject` writes the project's own fields:

| Kind | Writes |
| --- | --- |
| `concept-model` | `representation.nodes`, `representation.relations` (types mapped to the three legacy types), `representation.notes` when empty |
| `method-choice` | `representation.primaryMethod`, `alternativeMethod`, `justification`, `alternativeJustification`, and `methods` |
| `data-model` | one input row with `inclusion` set to the copy's id: name, value (distribution description), unit, provenance, uncertainty, availability, plan; `sourceType` `observed` for fitted data, otherwise `assumed` |
| `check-plan` | `evaluation.verification`, `.validation`, `.calibration` as numbered lines generated from the checks |
| `comparison` | nothing; the copy itself is the record |

- **Removing** a `data-model` copy removes its input row. Other project fields are left as they are.

The project fields stay the source for the compass rules and remain editable. The copy is what cards and the report show.

## 4. Shared screen parts

### 4.1 Tool page frame — `src/features/toolbox/ToolPage.tsx`

```tsx
<ToolPage kind="concept-model" editor={editor} exports={[{ id: 'svg', label: 'Picture (SVG)', run: () => … }]} intro={<FigureCard id="concept-components" />}>
  {/* the tool */}
</ToolPage>
```

Renders, in this order, kept slim so the tool gets the height: one line with the tool name, one-line purpose and an **About this tool** button; the artefact bar on one line; the optional intro (open on the first visit, then behind the About button); the tool.

The artefact bar holds: editable title; save state; **New**; **Open** (this kind's artefacts); **Duplicate**; **Export** (the tool's own items, then "Artefact file"); and the primary action **Add to project**:

- no project open → "Add to a new project";
- not yet in the open project → "Add to *project name*";
- in the project and unchanged → "In *project name*" with a link to the step;
- in the project and changed since → "Update *project name*".

`downloadFile` in `src/ui/controls.tsx` is the only way to save a file.

### 4.2 Artefact card — `src/features/toolbox/ArtefactCard.tsx`

`<ArtefactCard kind title updatedAt summary figure actions />` is used by My artefacts, the Toolbox hub, and the project steps. `figure` is the SVG string from `KINDS[kind].figure`, rendered through `<SvgFigure svg={…} />`, which is the only place that injects markup.

### 4.3 Menu — `src/app/Shell.tsx`

Sections Home, Learn, Toolbox, Project with their sub-links from section 1; Help and Settings in the footer. The project switcher and save indicator stay in the top bar.

## 5. Tools

Requirements are in the plan, section 5. Additional contracts:

- **Every tool** uses `useArtefactEditor` and `ToolPage`, offers at least the exports the plan lists, has a text equivalent for every picture, and is fully usable by keyboard.
- **Conceptual model** uses `@xyflow/react`, imported only inside `src/features/toolbox/concept/`. The zones are the layout of the "Parts of a conceptual model" diagram; a node's `zone` follows where it is dropped. `figure()` draws the model without React Flow.
- **Method chooser** reuses `evaluateRules` and the method registry unchanged.
- **Data and inputs** reuses `src/domain/distributions/**`. CSV import: one file up to 5 MB, comma, semicolon or tab separated, header row detected, numeric columns offered; nothing leaves the browser.
- **Verification, validation, calibration** ships standard checks per method in `src/content/checks.ts`.
- **Fair comparison** uses `src/domain/sandbox/stats.ts` for intervals and `src/domain/sandbox/engine.ts` only for the example data. Unpaired data gets a two-sample (Welch) interval and says so.

## 6. Learn

Requirements are in the plan, section 4. Method text comes from `src/domain/methods/registry.ts`; where the registry lacks a field (a one-sentence purpose, a typical example), add it to the registry rather than keeping a second copy. The coin-flip and regression demos move from `src/features/tools/` into Learn. No quizzes, scores or progress tracking.

## 7. Project builder

- `/project/overview` shows the compass overview of the open project (`/project` is the Project page: projects and examples): the seven stops with started state, open items and included artefacts, checkpoints as flags. It replaces opening on the last step.
- Steps 2, 3, 5 and 6 show an **artefact slot** first: the included copy as a card (summary, figure, date, state, "Open in Toolbox", "Update", "Remove"), or an invitation to make one, plus "Choose from My artefacts". The step's own fields sit under "Write it here instead" (open when no copy is included and the fields have content).
- Step 4 lists input rows; rows owned by a data model show its card. Manual rows and assumptions stay as they are.
- The embedded sketch editor, method chooser and tool links are removed from the steps.
- Compass rules become `compass-rules-v3`: sandbox rules removed; added checks for a failed check in an included check plan, a comparison with fewer than two replications per policy, and an outdated copy (suggestion).
- The report shows each included copy under its step: `markdown()` and `figure()`. The sandbox appendix and the sandbox CSV are removed.
- The worked example includes one copy of each kind.

## 8. Work packages and file ownership

A package edits only its own files. Shared files are changed by the coordinator; ask in the final report if a change is needed.

| Package | Owns | Dev port |
| --- | --- | --- |
| **0 Foundation** | `src/domain/artefacts/**` (first version), `src/app/artefacts.tsx`, `src/persistence/db.ts`, `src/features/toolbox/{ToolPage,ArtefactCard,SvgFigure,Toolbox,Artefacts}.tsx`, `src/styles/toolbox.css`, `src/app/{App,Shell}.tsx`, schema version 3 and importer, stubs for every page below | — |
| **A Learn** | `src/features/learn/**`, `src/content/learn/**`, `src/styles/learn.css`, `src/domain/methods/registry.ts` (additions only), `tests/learn.test.ts` | 4321 |
| **B Conceptual model** | `src/features/toolbox/concept/**`, `src/domain/artefacts/conceptModel.ts`, `tests/concept.test.ts` | 4322 |
| **C Data and inputs** | `src/features/toolbox/data/**`, `src/domain/artefacts/dataModel.ts`, `src/domain/distributions/**`, `tests/datamodel.test.ts`, `tests/distributions.test.ts` | 4323 |
| **D Method and comparison** | `src/features/toolbox/method/**`, `src/features/toolbox/compare/**`, `src/domain/artefacts/{methodChoice,comparison}.ts`, `tests/method-compare.test.ts` | 4324 |
| **E Checks** | `src/features/toolbox/checks/**`, `src/domain/artefacts/checkPlan.ts`, `src/content/checks.ts`, `tests/checks.test.ts` | 4325 |
| **F Project** | `src/features/compass/**`, `src/features/project/**`, `src/domain/passport/compass.ts`, `src/exports/**`, `src/content/workedExample.ts`, `src/ui/diagrams/CompassJourney.tsx`, `tests/{compass,exports,hardening}.test.ts` | 4326 |

Read-only for everyone except the coordinator: `src/app/**`, `src/ui/**` (except as listed), `src/styles/{tokens,app,playful}.css`, `src/domain/artefacts/{types,kinds,include,file}.ts`, `package.json`, the existing `src/features/tools/**` (copy what you need into your own folder; the coordinator deletes the old folder at the end).

Each package's page stylesheet is imported from its own entry component, not from `src/main.tsx`.

## 9. Rules for every package

- **Owner rules, enforced by `tests/guard.test.ts`:** no institution or author names anywhere; English only; no raster images. Pictures are genuine diagrams (SVG or HTML), animated where it helps. Few words on screen; playful and visually pleasing.
- **Wording:** "project" and "project report"; "artefact" for what a tool makes; reviewer-neutral (not "student", "teacher", "course", "graded").
- **Honesty of method:** no invented data presented as real; no p-values for fits; a paired interval only for paired data; the app never scores written reasoning.
- **Style:** existing tokens and `tone-*` classes; light and dark themes; no horizontal page scroll from 320 px (phones are not a priority, but nothing may break).
- **Accessibility:** every control has an accessible name; keyboard operable; visible focus; a text equivalent for every picture; `prefers-reduced-motion` respected.
- **Code:** TypeScript strict; no new dependencies without asking (the coordinator has added `@xyflow/react`); pure logic in `src/domain/**` with tests; lazy-load heavy screens.
- **Checks before reporting:** `npx tsc -p tsconfig.json` clean for your files, `npx vitest run` passing for your tests, `npm run lint` clean, and your screens looked at in a browser in light and dark at 1280 px. Other packages are changing the tree at the same time: fix only your own files and report anything else.
- **Do not commit, push, or start anything on port 4319.** Stop your dev server when done.

## 10. Foundation as built

The foundation is in place and tested. Where this section differs from the text above, this section is what the code does.

**Types and helpers**

- `Inclusion<K>` is a discriminated union: narrowing on `inc.kind` types `inc.data`.
- `ProjectDoc.sandbox` is retired: an optional legacy field that nothing creates or reads. The importer reads only `lastRun` from version 1–2 files (validated field by field); the upgrade turns it into a comparison copy and drops the field. Version 3 files ignore it. The legacy fixture is `legacyProject()` in `src/content/fixtures.ts`.
- `src/domain/artefacts/clean.ts` has the sanitizer helpers (`LIMITS`, `isObj`, `isId`, `isNum`, `own`, `text`, `oneOf`, `numOrNull`, `items`, `numbers`, `sameData`). Use them.
- `kinds.ts` also exports `KIND_ORDER`, `isArtefactKind(k)` and `kindDef(k)`.
- `file.ts` also exports `storable`, `defaultTitle`, `ARTEFACT_FILE_SUFFIX`.
- `include.ts` also exports `inclusionOf(doc, artefactId)` and `sanitizeInclusions`.
- Escaping helpers for Markdown are `mdText`, `mdCell`, `mdLine` in `src/exports/mdText.ts`. Kind files import from there, not from `markdown.ts`.

**Revisions**

- `createArtefact` returns `revision: 0`; stored artefacts have revision ≥ 1. The editor bumps `revision` and `updatedAt` on every change, at once.

**React API**

- `useArtefacts()` also has `put(a)`: stores exactly as given, no bump.
- `useArtefactEditor`: with no id in the address, the address is replaced by the most recent artefact's id. The first change saves immediately.
- `useAddToProject(): { state(a): 'no-project' | 'absent' | 'current' | 'outdated'; add(a): void }`.
- `navigate(to, { replace?, scroll? })`; `scroll: false` keeps the scroll position.
- Tool page components take `{ id?: string }`. `Learn` takes `{ page?: string; id?: string }`.

**Screen parts**

- `ToolPage<K>({ kind, editor, exports?, intro?, children })` with `ToolExport = { id; label; run }`. It exports `downloadArtefact(a)`. Add to project is disabled while `KINDS[kind].isEmpty(data)`.
- `ArtefactCard` also takes `to`, `status`, `dateLabel` and `headingLevel`.
- `SvgFigure({ svg, label?, className? })` and `isSafeSvg(svg)`. A figure must start with `<svg` and end with `</svg>`. It is refused if it contains scripts, `foreignObject`, embedded content, event attributes, `javascript:`, `@import`, any `url(` that is not `#…`, or any `href` that does not start with `#`.
- `TOOL_META[kind] = { name, short, tagline, icon, tone }` in `src/features/toolbox/toolMeta.ts`.
- `MenuButton` in `src/features/toolbox/Menu.tsx` is the keyboard-operable menu.

**Data rules worth knowing**

- A data model's `data` is emptied whenever `keepData` is false: in `sanitize`, in files, in storage and in project copies. Raw rows that are not kept live in component state only.
- `dataModel.ts` exports `lawFields`, `describeModel`, `paramsFit`, `withoutUnkeptData`. The `categorical` and `empirical` families take 1 to 256 parameters.
- A comparison's `paired` is forced to false when the two lists differ in length.
- `checkPlan.ts` exports `checkLines(d, group)`. A group with no lines leaves the project's own text untouched.
- Upgraded projects get copies with fixed ids `inc-from-sketch`, `inc-from-method`, `inc-from-sandbox`; their state is `source-missing`.

**Routes**

- `src/app/redirects.ts` holds `redirectFor(path)`.
- Sidebar labels come from `TOOL_META.short`; step labels are Frame, Scope, Method, Inputs, Check, Experiment, Conclude.
- `src/features/tools/` and `src/features/methods/` are deleted; their content lives in Learn and the Toolbox.

**Shared screen parts added during the build**

- `FigureCard` takes an optional `stage` node that replaces the plain diagram (Learn uses it to pass props to the compass).
- `CompassJourney` takes `project` (overview mode), or `onSelect(step)` and `selected` (selection mode); with neither it behaves as a plain diagram.
- `tone-green` lives in `playful.css` with the other tones.

**Live projects** (owner decision, 21 November 2026; replaces "Update from Toolbox" and "never changes silently")

- The project file still stores a full copy of each included artefact, so exports and reports stand on their own. The copy is kept current: `ArtefactsProvider` (`src/app/artefacts.tsx`) refreshes every copy in the open project whose original on this device has a higher revision, when an artefact is saved, when the list reloads after another tab saved, and when a project is opened. The refresh is an ordinary `update` of the project: saved with it and seen by other tabs. A copy whose original is not on this device (an upgraded project, one from another device) stays as it is; the worked example is read-only and never refreshes.
- **Adding** an artefact (or replacing a copy with a different artefact) is a deliberate choice: the copy writes every field its kind writes, overwriting what was there. Any hand-written text it replaces is named in the undo toast ("Replaced your text in: …"), so it is never silent.
- **Live refresh** keeps the author's later edits (`include.ts`): each field the old copy wrote that still holds exactly what it wrote is taken back to empty (`unwrite`); the new copy then writes only into empty fields (`write`). Text edited by hand after inclusion is never overwritten by a refresh. Rows owned by a kind (`ownsRows`: data models, measurement data) belong to it and always follow it. Removing a check plan takes back its untouched lines; removing any other kind leaves the step's fields as they are.
- A step's card has a primary **Edit**: `/toolbox/<tool>/<id>?from=<step>`, and `ToolPage` shows "Back to <step>". With the original missing, Edit first copies it into My artefacts and relinks the inclusion, which is live from then on. There is no Update button; `ToolPage` shows "In <project>" once added. The card's date is the last refresh ("Updated").
- `Checkpoint.reviewedAt` (optional ISO time) is set when a review status is chosen and removed for draft. `changedSinceReview(doc, id)` lists the copies of the checkpoint's steps refreshed after it; the checkpoints view and the report show "Changed since review", and "Reviewed again" sets the time anew.
