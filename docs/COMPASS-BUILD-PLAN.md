# Build plan — Project Compass rebuild

21 November 2026 · implements [COMPASS-SPEC.md](COMPASS-SPEC.md)

## Foundation (done first, by the coordinator)

- Passport schema v2 (`selfChecks`, checkpoint `rubric`) with v1 import.
- `src/domain/passport/compass.ts`: 7 steps, guidance, self-checks, warning rules, checkpoint rubrics.
- Dropped areas removed: lectures, lessons, examples, challenges, detective, lenses, glossary, start page, course progress.
- New shell: sidebar **Home · Project · Tools** plus a Help/Settings footer; route table and redirects.
- Stubs for the three pages and five diagram ids, so the tree always compiles.

## Parallel work packages

Each package owns its files. Shared files are read-only for everyone else.

| WP | Deliverable | Owns | Contract it must honour |
| --- | --- | --- | --- |
| **A — Compass UI** | Stepper; 7 step screens (fields + why/good/weak + warnings + self-checks + worked-example peek); method chooser embedded in step 3; checkpoints screen (readiness, rubric, status); export entry; read-only example mode | `src/features/compass/**`, `src/features/project/**`, `src/features/methods/**`, `src/styles/compass.css` | `export default function Compass({ step, example })` |
| **B — Worked example, exports, tests** | A complete, exemplary passport; exports that include self-checks, open warnings, rubric records and step progress; test suites for compass rules, the worked example, importer v2 and exports | `src/content/workedExample.ts`, `src/exports/**`, `tests/compass.test.ts`, `tests/exports.test.ts` | `export function workedExample(): ProjectDoc`, with zero gaps or checks |
| **C — Home and Tools** | Home (projects, new, import, worked example, three doors); Tools hub; common tool frame; sandbox and the five labs re-housed under `/tools/*`; specialist apps page; Help and Settings rewritten | `src/features/home/**`, `src/features/tools/**`, `src/features/labs/**`, `src/features/sandbox/**`, `src/features/projects/**`, `src/features/help/**`, `src/features/settings/**`, `src/styles/tools.css` | `export default function Home()`, `export default function Tools({ toolId, sub })` |
| **D — Diagrams** | Five purposeful diagrams with automatic layout (elkjs), build-up walkthroughs and readable text | `src/ui/diagrams/**`, `src/content/diagrams/**`, `src/ui/playful.tsx`, `src/styles/diagrams.css` | `<FigureCard id>` for the ids `compass-journey`, `concept-components`, `method-families`, `vv-cycle`, `paired-comparison` |

Coordinator-owned (read-only for agents): `src/app/**`, `src/domain/**`, `src/persistence/**`, `src/ui/controls.tsx`, `src/ui/charts.tsx`, `src/styles/{tokens,app,playful}.css`, `src/main.tsx`, `package.json`, docs.

## Rules for every package

- English only. No author names, no institution, no Croatian. A guard test enforces this.
- Visual, uncluttered, playful: few words, large clear controls, colour with meaning, motion that stops under reduced-motion.
- Colours only from tokens. Works in light and dark and from 320 px to 1440 px. Keyboard-operable.
- Completeness, review status and model validity stay separate. Written answers are never auto-graded.
- Verify with `npx tsc -p tsconfig.json`, own files only.

## Integration (coordinator, after the packages land)

1. Typecheck, unit tests, lint, build.
2. Browser suites:
   - route crawl and redirects;
   - full journey: new project → 7 steps → checkpoints → export → re-import;
   - tools → send to project;
   - conflict, no-storage and reduced-motion states;
   - 320–1440 px in both themes.
3. Screenshot review of every screen and diagram.
4. Docs: README, release evidence, instructor guide, ADR.
