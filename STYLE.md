# ModSim Essentials Design and Interaction Specification

> Product renamed from ModSim101 to **ModSim Essentials** (20 Nov 2026). Visual QA evidence: [docs/release-evidence.md](./docs/release-evidence.md).

> Agent-ready visual contract · Version 1.0 · 20 November 2026  
> Companion: [PLAN.md](./PLAN.md). PLAN defines scientific and educational semantics, content IDs, data, exports and delivery. STYLE defines layout, components, interactions, charts, themes and accessible states. This specification is a target, not a description of an inspected implementation.

## 1 Source fidelity and product character

The visual source is the supplied `STYLE(10).md` for Monte Carlo Simulation Lab, itself derived from the BPMN Studio family. Preserve its exact base light/dark colours, compact shell, typography, restrained surfaces, component geometry and chart grammar. Adapt the interaction language to an introductory modelling application; do not copy Monte Carlo node types, its export-centre scope or its simulation-builder navigation.

**Character:** calm academic software, clear task progression, compact analytical views and explanations beside the task. More guidance than a specialist editor, with the same family identity. Avoid marketing-sized heroes, decorative gradients, glass effects, floating ornamental cards, cartoon mascots, confetti and pseudo-3D diagrams.

Priority order: scientifically correct meaning → accessible interaction → coherent learning workflow → source visual fidelity. Record necessary contrast or touch-target deviations rather than silently changing the whole palette.

Blue identifies actions, focus and selection. Orange identifies an active experiment or current step. Neutral surfaces carry explanations. Semantic colours indicate actual status, paired with text. A lower backlog is not automatically green if abandonment explains the reduction. A filled passport is not automatically validated.

## 2 Exact inherited theme tokens

Copy the following base tokens into a central stylesheet. They reproduce the supplied source theme; aliases for ModSim Essentials follow separately. Do not define private palettes in feature components. Source colours are not evidence that every foreground/background pairing passes contrast.

```css
:root, :root[data-theme="light"] {
  color-scheme: light;
  --bg: #f4f6f9;
  --bg-elevated: #ffffff;
  --bg-subtle: #eef1f5;
  --bg-sunken: #e6eaf0;
  --bg-hover: #e9eef5;
  --border: #d6dce5;
  --border-strong: #b7c1cf;
  --text: #17202c;
  --text-muted: #4b5867;
  --text-subtle: #6b7787;
  --text-on-primary: #ffffff;
  --primary: #1f5f8b;
  --primary-hover: #184d72;
  --primary-soft: #e3eef7;
  --primary-strong: #123b59;
  --accent: #d9822b;
  --accent-soft: #fbeedd;
  --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.06);
  --shadow: 0 2px 8px rgba(16, 24, 40, 0.08), 0 1px 2px rgba(16, 24, 40, 0.06);
  --shadow-lg: 0 12px 32px rgba(16, 24, 40, 0.16);
  --focus-ring: 0 0 0 3px rgba(31, 95, 139, 0.35);
  --chart-1: #2a78d6;
  --chart-2: #eb6834;
  --chart-3: #1baf7a;
  --chart-grid: #e1e0d9;
  --chart-axis: #c3c2b7;
  --chart-muted: #898781;
  --chart-surface: #ffffff;
  --canvas-bg: #ffffff;
  --model-stroke: #22242a;
  --model-fill: #ffffff;
  --model-label: #22242a;
  --error: #c0392b;
  --error-soft: #fbe9e7;
  --warning: #b7791f;
  --warning-soft: #fdf3dc;
  --recommendation: #2b6cb0;
  --recommendation-soft: #e6f0fa;
  --info: #5a6779;
  --info-soft: #eef1f5;
  --success: #2f855a;
  --success-soft: #e3f4ea;
  --font-sans: 'Inter', 'IBM Plex Sans', system-ui, -apple-system,
    'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace,
    SFMono-Regular, Menlo, monospace;
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 14px;
  --status-good: #0ca30c;
  --status-warning: #fab219;
  --status-serious: #ec835a;
  --status-critical: #d03b3b;
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0f141b;
  --bg-elevated: #171e27;
  --bg-subtle: #1c2430;
  --bg-sunken: #121821;
  --bg-hover: #233042;
  --border: #2b3645;
  --border-strong: #3b4a5e;
  --text: #e6ebf1;
  --text-muted: #b2bdcb;
  --text-subtle: #8a97a8;
  --text-on-primary: #0b1520;
  --primary: #5aa7d8;
  --primary-hover: #7ab9e3;
  --primary-soft: #16314a;
  --primary-strong: #a8d3ef;
  --accent: #f0a457;
  --accent-soft: #3a2a17;
  --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.06);
  --shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
  --shadow-lg: 0 16px 40px rgba(0, 0, 0, 0.6);
  --focus-ring: 0 0 0 3px rgba(90, 167, 216, 0.45);
  --chart-1: #3987e5;
  --chart-2: #d95926;
  --chart-3: #199e70;
  --chart-grid: #2c2c2a;
  --chart-axis: #383835;
  --chart-muted: #898781;
  --chart-surface: #171e27;
  --canvas-bg: #141a22;
  --model-stroke: #d7dee8;
  --model-fill: #1b232d;
  --model-label: #e6ebf1;
  --error: #f2776a;
  --error-soft: #3b1d1a;
  --warning: #e8b45a;
  --warning-soft: #3a2d14;
  --recommendation: #79b2ec;
  --recommendation-soft: #172a40;
  --info: #a3afbf;
  --info-soft: #1f2833;
  --success: #6fcf97;
  --success-soft: #16301f;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #0f141b;
    --bg-elevated: #171e27;
    --bg-subtle: #1c2430;
    --bg-sunken: #121821;
    --bg-hover: #233042;
    --border: #2b3645;
    --border-strong: #3b4a5e;
    --text: #e6ebf1;
    --text-muted: #b2bdcb;
    --text-subtle: #8a97a8;
    --text-on-primary: #0b1520;
    --primary: #5aa7d8;
    --primary-hover: #7ab9e3;
    --primary-soft: #16314a;
    --primary-strong: #a8d3ef;
    --accent: #f0a457;
    --accent-soft: #3a2a17;
    --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.06);
    --shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
    --shadow-lg: 0 16px 40px rgba(0, 0, 0, 0.6);
    --focus-ring: 0 0 0 3px rgba(90, 167, 216, 0.45);
    --chart-1: #3987e5;
    --chart-2: #d95926;
    --chart-3: #199e70;
    --chart-grid: #2c2c2a;
    --chart-axis: #383835;
    --chart-muted: #898781;
    --chart-surface: #171e27;
    --canvas-bg: #141a22;
    --model-stroke: #d7dee8;
    --model-fill: #1b232d;
    --model-label: #e6ebf1;
    --error: #f2776a;
    --error-soft: #3b1d1a;
    --warning: #e8b45a;
    --warning-soft: #3a2d14;
    --recommendation: #79b2ec;
    --recommendation-soft: #172a40;
    --info: #a3afbf;
    --info-soft: #1f2833;
    --success: #6fcf97;
    --success-soft: #16301f;
  }
}
```

### 2.1 ModSim Essentials semantic aliases

```css
:root {
  --ms-selection: var(--primary);
  --ms-selection-soft: var(--primary-soft);
  --ms-focus: var(--primary);
  --ms-current-step: var(--accent);
  --ms-assumption: var(--warning);
  --ms-assumption-soft: var(--warning-soft);
  --ms-evidence: var(--recommendation);
  --ms-evidence-soft: var(--recommendation-soft);
  --ms-baseline: var(--chart-1);
  --ms-alternative: var(--chart-2);
  --ms-reference: var(--text-muted);
  --ms-relation: var(--border-strong);
  --ms-panel: var(--bg-elevated);
}
```

Assumptions are not intrinsically errors; the assumption colour is reserved for untested or consequential assumptions where emphasis is useful. Ordinary assumption rows may remain neutral. Evidence badges identify provenance, not truth. Do not use a green “Observed” badge to imply that observations are unbiased.

Preserve the source fonts: Inter / IBM Plex Sans / system sans and JetBrains Mono / IBM Plex Mono / system monospace. Use locally available fallbacks or self-host permitted font files; core rendering must not depend on a third-party font request. Load only required weights. Resolve system/light/dark preference before first paint and update charts/diagrams together.

## 3 Typography and spacing

| Element | Size / weight | Use |
| --- | --- | --- |
| First-screen heading | 32px / 650 | Short task-oriented introduction only |
| Page h1 | 26px / 650 | Each of six main experiences |
| Section h2 | 20px / 650 | Workspace sections |
| Card h3 | 16px / 650 | Panels and activity cards |
| Subheading | 14px / 650 | Within a grouped task |
| Body | 14px / 400, line-height 1.5 | Default interface and explanations |
| Reading mode | 16px / 400, line-height 1.65 | Optional expanded lesson article, deliberate accessibility extension |
| Compact content / table | 13px | Dense evidence and settings |
| Field label | 12px / 600 | Always visible, not placeholder-only |
| Hint | 12px / 400 | Supporting explanation |
| Metadata / badge | 11px | Secondary information only |
| KPI | 22px / 700 | Tabular numbers with visible units |
| Dialog heading | 17px / 650 | Concise action title |

Headings use 1.25 line height, mild negative tracking and 0.5em bottom margin. Article measure is 76ch; introductory descriptions 72ch. Do not use uppercase for paragraphs. Monospace is for formulas, IDs, data and code, not all numerical explanations.

Spacing follows 2/4/6/8/10/12/14/16/18/20/24/28/32/40/48px. Keep 4px between label/control/hint; 12px between fields; 18px card padding; 16px grid gaps; 28px 32px 48px desktop page padding. Radii: controls 6px, cards 10px, dialogs 14px, badges pill. Borders are 1px. Use the smallest shadow for cards, medium for elevated transient UI, large for dialogs/menus. No hover scaling or card translation.

## 4 Shell and navigation

Expanded sidebar 232px; collapsed 64px. Brand and workspace toolbar 56px minimum, allowed to grow when controls wrap. Main region uses `min-width:0` and `min-height:0` so tables and charts do not enlarge the page.

Primary navigation in this order:

1. Start Here — introductory task.
2. Modelling Lenses — alternative representations.
3. Sandbox — inspect and experiment.
4. Model Detective — investigate claims.
5. Choose a Method — justify a shortlist.
6. My Project — build the passport.

Secondary group: Learn, Examples, Challenges, Glossary. Bottom utilities: Projects, Settings, Help. Model Detective and Challenges refer to the same case records; do not show duplicate progress totals. A small active-project label is visible in the toolbar, with saved state and a project switcher.

Use labelled Lucide outline icons or existing equivalent: 18px navigation, 16px controls, 13–14px inline. ModSim Essentials brand uses the family’s 30px primary square and 15px wordmark, with a simple 20px mark showing a frame and two alternative representations. Do not reuse the Monte Carlo dice/dart identity. Icons are not the sole labels on mobile.

Navigation selection: primary text, primary-soft fill, 6px radius, 8px 10px padding. Collapsed navigation has accessible names and focus-triggered tooltips. On narrow screens use a compact header plus labelled navigation drawer; this deliberately improves the source’s icon-only horizontal navigation for first-time learners. Drawer close restores focus.

## 5 Screen compositions

| Screen | Desktop composition | Narrow-screen composition |
| --- | --- | --- |
| Start Here | Scenario + brief step editor and preview | Scenario, current step, expandable preview |
| Lenses | Shared context header; lens selector; diagram and explanation | Labelled selector, diagram, reveals/omits, compare below |
| Sandbox | 380px controls + flexible scene/results | Controls, run toolbar, key result, chart, expandable table |
| Detective | Evidence primary column + 340px investigation panel | Evidence followed by investigation; claim remains easy to revisit |
| Method studio | Guided questions then comparison cards/table | Questions then vertically stacked candidates |
| My Project | Section index + form + optional preview | Section menu, form, preview toggle |
| Lesson | Contextual index + article up to 76ch | Index above readable article |

Use a 1080px max-width for ordinary content; analytical workspaces can fill available width. Conceptual-map inspector is 420px, reducing to 340px. Reference index is 280px. Avoid permanently displaying three dense columns unless the viewport genuinely supports them.

## 6 Start Here and the brief editor

The first screen shows a small eyebrow “Modelling and Simulation”, a heading such as “Turn a problem into a model”, two sentences of context and one primary button: **Investigate your first problem**. Existing users instead see **Continue your project**, with the introductory exercise available below. No fabricated project counts or empty KPI tiles.

The scenario is a bordered reading panel. Highlight complaint, proposed action and possible outcome through user selection and labelled feedback, not colour-coded answers revealed in advance. For keyboard users provide a list of selectable phrases.

The brief editor uses a six-step indicator with text labels: Stakeholder, Decision, Outcome, Boundary, Horizon, Constraints. Current step has a text status and primary underline or outline. Steps remain revisitable; completing a field changes completeness only. The stepper wraps or becomes a compact “Step 2 of 6 — Decision” on mobile.

Each step contains prompt → short explanation → field → example → optional reflection. Example text is not submitted automatically. A live brief preview distinguishes learner entries from unfilled placeholders. Primary **Save and continue**, secondary **Back**, optional **Skip for now**. Autosave operates independently; failed autosave must not erase the field.

## 7 Modelling Lenses visual grammar

Keep shared scenario and current question above the lens selector. Lens cards use a compact visual preview, name and one-sentence purpose; avoid a wall of generic icons. Opening a lens shows a diagram, visible provenance label, a small interaction, and two adjacent sections: **Reveals** and **Leaves out**.

| Lens | Required visual treatment | Meaning guardrail |
| --- | --- | --- |
| Relationships | Rectangles for observed variables, distinct latent-construct notation, labelled arrows | Arrow meaning visible; “Illustrative relationship model”; no fabricated coefficients |
| Process / Petri net | Clearly separate process steps from Petri places/transitions/tokens | Do not draw generic boxes and call them a Petri net |
| State transitions | Directed graph with labelled probabilities plus matrix | Show whether labels are assumptions or observations |
| Uncertainty | Discrete probability bars and sampled outcome display | Separate input probabilities from observed frequencies |
| Stock and flow | Stock box and flow conventions, units and daily step | Feedback view explicitly separate from stock-flow accounting |
| Events / resources | Time axis, arrivals, service intervals and resource row | “Illustrative trace” when authored, not a general simulation |
| Cellular space | Legible grid, neighbourhood key and boundary label | Spatial extension is a different question |
| Agents | Distinct rule/attribute cards and inspectable interactions | Variation has behavioural meaning, not decorative randomness |

“Compare lenses” selects at most two. Align Question, Representation, Time, Detail, Data, Reveals and Leaves out. Diagrams remain labelled and retain their own question. A lens switch does not pretend to convert the model automatically. Include **Add insight to project** with a preview of the note to be added and an undo action.

## 8 Sandbox workspace and interaction

### 8.1 Hierarchy

Header: question, model title and compact “Daily aggregate model” badge. Below: settings and central stock/flow scene; run toolbar; result KPIs; backlog chart; daily arithmetic table; assumptions and interpretation. Do not require opening a theory page to understand an input.

Default controls show arrivals/day, capacity/day, initial backlog, horizon and Run. Advanced sections reveal random demand, schedule, abandonment, feedback and cost. Group by purpose. Explain inactive controls and preserve their drafts, while making clear they do not affect the current mode.

Every slider has a numeric field, unit, allowed range and keyboard access. Do not coerce incomplete text such as `-` or blank into zero. Use **Apply changes** where editing would invalidate active results; label the previous result “From earlier settings”. Avoid expensive recomputation during typing.

### 8.2 Run and playback

Toolbar: Run model, Cancel while running, Replay, Step and Reset view where meaningful. Label **Playback speed** explicitly. Pausing the scene does not imply pausing computation. Reset view resets zoom/playback, not parameters or saved work. Reset example requires a separate action with a clear scope.

Progress reports completed trajectories, not animation frames. Reduced-motion mode shows the same accounting and results without token movement. Aggregate request-equivalents are drawn as quantities/flows, not literal avatars. Fractional abandonment cannot be depicted as half a student.

### 8.3 Comparison

Baseline and alternative use consistent primary chart categories, labelled solid/dashed styles and matched axes. The alternative panel shows a concise changed-input list. Under each result show model revision, seed, replication count and status through a compact details disclosure.

When arrivals are paired, display **Same arrival traces in each policy pair** and allow inspection. When demand assumptions change, display **Scenario comparison: inputs differ**. Do not show a green winner badge by default. Ask which outcome matters and show cost, served, abandoned and remaining backlog together.

### 8.4 Results table and charts

Daily table columns: day, starting backlog, arrivals, effective capacity, served, abandoned, ending backlog, optional cost. Formula reveal shows the exact recurrence for the selected row. Conservation check displays the residual and tolerance without crowding every row.

| Question | Chart | Required annotation |
| --- | --- | --- |
| How does backlog evolve? | Step/line series with daily sample convention | Day, request-equivalents, initial/ending point convention |
| Where did demand go? | Accounting table or labelled stacked totals | Served, abandoned, remaining, initial backlog and arrivals reconciled |
| How variable is terminal backlog? | Histogram or ordered discrete bars | Replications, bin definition, units, sample versus full data |
| How do policies differ? | Paired-difference plot and numerical table | Alternative minus baseline and preferred direction if specified |
| What does the interval mean? | Separate mean-CI and outcome-percentile panels | Explicit interval type and assumptions |
| Which assumption changes the decision? | Small scenario comparison or sensitivity line | Varied parameter, fixed inputs and no causal inference claim |

Chart containers have title, question, units, legend, source status and accessible table. Use 11px axis text, 2px lines, restrained grid, no chart junk or 3D. Zero-baseline bars; disclose nonzero line-chart ranges. No smoothed interpolation inventing observations. Undefined utilisation reads **Not defined — no available capacity**, not `0%` or an unexplained dash.

## 9 Model Detective experience

Lead with a specific claim in quotation marks, not a red “wrong” banner. Present evidence as an inspectable chart, settings sheet, trace or report excerpt. Let the learner decide what to inspect.

Investigation panel stages: **Your initial view → Check the evidence → Explain the issue → Revise the claim**. Use a compact step list, not a mandatory modal sequence. Record the initial answer without locking future exploration.

Actionable feedback includes issue, why it matters and a next check. Three hints progressively reveal where to look, the governing concept and a worked explanation. Showing a hint must not wipe work. Correct structured checks receive modest confirmation; reflections display **Submitted for reflection** or **Teacher reviewed**, never “Correct” from field completion.

At the end show the original claim and the learner’s revision side by side, with the relevant rubric. A sample revision is clearly labelled and appears only after an attempt or explicit reveal. Multiple defensible claims can be accepted. Avoid grading the strength of prose by length.

## 10 Method-selection studio

Use a short questionnaire with explanations and “Not sure yet”. Group inputs into Question, System, Evidence and Constraints. The user can inspect candidates before finishing; show which advice is provisional.

Candidate cards contain method name, why it may fit, important assumptions, what it omits, missing information and related specialist app. Selection has a blue outline; it is not a success state. Avoid percentage match scores, trophies or green “best method” ribbons.

Compare at most three candidates in a table on desktop and stacked cards on mobile. Primary action **Use as primary method**, secondary **Keep as alternative**. Selecting either opens a justification field and stores rule version plus questionnaire answers.

Outgoing app links use the explicit label **Open [app name]** and an external-link icon. With no configured URL show **App link not configured** and preserve all educational content. A separate **Download passport** action explains that transfer is manual. Never imply the other app has received a project without a verified integration.

## 11 My Project and the model passport

The editor uses a left section index with compact completeness indicators, editable forms and a preview toggle. Do not present “87% complete” as “87% valid”. Use **8 of 11 sections started** or another precisely defined count. Review statuses are separate: Draft, Self-reviewed, Teacher-reviewed, Needs revision.

Assumption rows show statement, provenance, rationale, consequence and planned check. Longer detail expands in place. Input rows show name/value/unit/source. Unspecified source remains visible and editable. The assumptions register should feel like a practical thinking tool, not a bureaucratic form.

Conceptual map uses neutral nodes with text types: entity, variable, stakeholder. Relations have explicit labels and optional arrow direction. No causal meaning unless the learner names it, and even then the app does not certify it. Use a 16px grid only when helpful, 1.5–2px strokes, minimum legible labels and primary selection. Table/list editor provides equivalent add, rename, connect, disconnect and delete actions. Keyboard commands do not fire while typing.

Checkpoint view contains Proposal, Design, Baseline, Evaluation and Final. Each checkpoint shows expected evidence and user-entered notes. Teacher review is manually attributed; a checkbox does not authenticate an instructor. No mandatory login is introduced.

Export preview shows exactly what will be included, including incomplete sections, stale results and optional author information. Primary **Download**, not “Publish”. Downloading is not a cloud save. Print layout uses white backgrounds, readable black text, repeated table headers where supported and no editor controls.

## 12 Learning components and catalogue

Use a single versioned content renderer for EX01–EX12, L01–L12 and C01–C12. Display accurate totals; pilot releases explicitly show the available subset. Cards have a 140px preview where useful, title, question, activity type, approximate duration and actual progress status. Templates and archived examples do not inflate totals.

Lesson layout: concept → interaction → worked example → misconception → reflection → check. The article is readable without running an animation. Contextual glossary definitions open in a popover/drawer and return focus; there is also a searchable glossary page. Term links must not hijack selection or keyboard shortcuts.

Challenge layout: task, fixture, editable response, **Check my reasoning**, diagnostic feedback, hints, rubric and reset. If only a numerical answer is assessed, use **Check calculation** instead. Keep a persistent link to the relevant example and method explanation.

“Add to my project” always previews the destination section and avoids duplicate insertion. Repeated use should offer update/append rather than blindly duplicating notes.

## 13 Shared components

| Component | Geometry | Behaviour |
| --- | --- | --- |
| Standard button/input | 34px visual height, 6px radius | 44px usable target on touch where necessary |
| Small button | 28px height, 13px text | Secondary desktop controls only |
| Primary action | Primary fill and text-on-primary | One dominant action per task group |
| Card | 18px padding, 10px radius, 1px border | No movement on hover |
| Table | 13px body, 12px headers, 7px 10px cells | Numeric columns right aligned, units explicit |
| KPI | 12px label, 22px value, 11px detail | Undefined/stale states readable |
| Badge | 20px height, 11px label | Secondary status only, never sole evidence |
| Callout | 10px 12px padding, 18px icon | Consequence and next step included |
| Dialog | Width min(960px,100%), 14px radius | Named, focus trapped, Escape, focus restored |
| Toast | 260–420px on desktop, contained on mobile | Nonessential confirmation, not sole error channel |
| Progress | 8px track | Actual completed count and text alternative |

Disabled controls explain why when it is not obvious. Error summaries link to affected fields. Destructive actions use explicit names and confirmation or undo; avoid ambiguous Reset all. Menus use documented layer ordering: diagram controls 15, overlays 20, menus 30, dialogs 50, toasts 60, skip link 100.

## 14 Responsive and accessibility contract

| Width | Behaviour |
| --- | --- |
| Above 1100px | Full analytical layouts; inspector up to 420px |
| 1100px and below | Inspector 340px; settings/results stack where needed |
| 960px and below | Intro splits collapse |
| 900px and below | Reference index above article; utility grids stack |
| 820px and below | Labelled navigation drawer, 18px 16px 40px insets, inspector below diagram |
| 390/320px and 400% zoom | Single reading order, wrapping controls, contained table/diagram scrolling |

No page-level horizontal overflow. A wide evidence table can scroll inside a labelled focusable region. Diagram has zoom/fit and an equivalent text/table representation. Touch targets must not overlap invisibly; increase spacing or geometry instead. A visible 34px control can have a 44px target only where adjacent controls remain distinct.

Use semantic landmarks, skip link, one main h1, associated labels and programmatic field errors. Tabs implement arrow/Home/End navigation where appropriate. Focus order follows reading order; closing a dialog returns focus to its trigger. Live regions announce run completion, save failure and check outcome, not every simulated step. All text and controls support text zoom.

Test ordinary text contrast, large text and control boundaries against the chosen accessibility target. Several inherited subtle/semantic colours may require using body text on a tinted panel instead of coloured small text. Keep token changes central, documented and tested in both themes. Pair categories with line styles and labels; never rely on blue/orange discrimination alone.

```css
:where(button, a, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--ms-focus);
  outline-offset: 2px;
  box-shadow: var(--focus-ring);
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

JavaScript playback honours the same preference and offers a still view. Ordinary transitions stay around 120–180ms, with no mandatory animation delaying input. Do not introduce timers or speed requirements into reasoning exercises.

## 15 State matrix and microcopy

| State | Visible treatment | Example copy |
| --- | --- | --- |
| New project | Neutral, one next step | “Start with a question you want the model to answer.” |
| Incomplete passport | Neutral completeness marker | “The system boundary has not been specified yet.” |
| Unsupported outcome | Information with route forward | “This daily model does not estimate individual waiting times. Explore DES for that question.” |
| Invalid input | Error beside field | “Capacity must be a finite, nonnegative value.” |
| Untested assumption | Warning label with consequence | “This feedback rule is hypothetical. Test how your conclusion changes without it.” |
| Authored trace | Neutral provenance badge | “Illustrative trace — step through the supplied example.” |
| Stale numerical result | Labelled muted result | “These results use earlier settings. Run again to update them.” |
| Partial run | Completed count, no false success | “37 of 100 replications completed. Results are partial.” |
| Undefined statistic | Text explanation | “Utilisation is not defined when capacity is zero.” |
| Reflection submitted | Neutral confirmation | “Reflection saved. Compare it with the rubric.” |
| Structured check passed | Restrained success | “The accounting balances for every day.” |
| Method shortlist | Reasons and caveats | “DES may fit because resources and event timing matter.” |
| Save failed | Persistent warning and export | “Your latest changes could not be saved on this device. Download a project file to keep them.” |
| Cross-tab conflict | Choice with preview | “Another tab saved a newer revision. Keep both versions or review the changes.” |
| Export ready | Precise confirmation | “Project file generated. Use your browser download to save it.” |
| App link absent | Disabled link with explanation | “The specialist app link has not been configured.” |

Avoid “model proven correct”, “best method guaranteed”, “causality established”, “100% mastery”, “saved to Drive” or “uploaded to the specialist app” without the relevant evidence/integration. Say whether the displayed number is assumed, observed, calculated or simulated. Keep these distinctions near the result, not buried in a disclaimer page.

## 16 Visual QA and delivery

Capture light/dark screens for Start Here, each lens, deterministic and stochastic Sandbox, paired comparison, Detective before/after feedback, method shortlist, passport editor, lesson, challenge and export preview. Include representative empty, invalid, partial, stale, missing-link and save-failed states.

- [ ] Exact inherited base tokens centralised; no feature-level hard-coded palettes.
- [ ] 232/64px shell, 56px toolbar, 420/340px inspector, typography and control geometry preserved with documented accessible adaptations.
- [ ] No misleading wait-time metrics, causal arrows or unlabelled authored results.
- [ ] Each lens uses appropriate notation and reveals/omits text.
- [ ] Charts retain units, provenance, replication count, legend and accessible tables.
- [ ] Reflection completion never masquerades as automatic correctness.
- [ ] Method advice shows reasons, caveats and alternatives; missing URLs are honest.
- [ ] Passport completeness, model evidence and review status are distinct.
- [ ] All 12 examples/lessons/challenges have consistent layout and meaningful interactions.
- [ ] Keyboard, reduced motion, theme switching, mobile and zoom reviewed.
- [ ] Print/export reports are readable and reflect the actual snapshot.
- [ ] Local, Netlify and Railway UI behaviours agree.

Implementation order: base tokens and controls → first problem and passport form → backlog sandbox and table → lenses/detective/method studio → full teaching content → responsive/error/export polish. Coordinate with PLAN whenever a design choice changes the scientific or educational meaning.
