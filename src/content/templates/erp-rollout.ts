import type { DataSpec, ProjectTemplate } from './types';

/**
 * Template: a regional distribution company replaces its old ordering and stock system with a new ERP system and must
 * commit to a go-live date before the peak season. Monte Carlo over a work-package network with three-point estimates
 * and one risk event; a synthetic history of past overruns checks the estimates. All numbers are synthetic teaching values.
 */

const T = 'ERP go-live risk';
const ESTIMATE_PLAN = 'The project manager collects written three-point estimates from each lead in separate sessions, before the Design checkpoint.';

/** A work package's duration as its lead's three-point estimate (minimum, most likely, maximum). */
const leadEstimate = (title: string, name: string, lead: string, params: [number, number, number], uncertainty: string, plan = ESTIMATE_PLAN): DataSpec => ({
  title: `${T}: ${title}`, name, unit: 'working days', source: 'described', family: 'triangular', params, evidence: 'expert',
  provenance: `Expert values in this teaching case, not real records: the ${lead}’s three-point estimate (optimistic, most likely, pessimistic).`,
  uncertainty, availability: 'obtainable', plan,
});

export const erpRollout: ProjectTemplate = {
  id: 'erp-rollout',
  title: 'ERP go-live risk',
  area: 'IT project management',
  pitch: 'Can the new ERP system go live before the peak season, and which fix raises the odds more?',
  data: 'Three-point estimates, past overruns',
  shows: [
    'Turning three-point estimates into a probability',
    'Why the most-likely plan finishes too early',
    'Fair option comparison with common random numbers',
  ],
  content: {
    // ── 1 Frame ────────────────────────────────────────────────────────────
    decision: {
      stakeholder: 'The ERP steering committee of a regional distribution company: the IT director decides, together with the CFO, who holds the remaining contingency budget. They must commit to a go-live date before the peak season, and the budget pays for one extra measure, not two.',
      problem: 'The old ordering and stock system must be replaced before the peak season, when order volume roughly doubles. The plan built from the team leads’ most-likely estimates finishes on working day 111, but it ignores the spread of each estimate and the chance of a failed migration rehearsal, so nobody knows how likely the planned day 120 is. Moving the date is one possible response, not the problem itself.',
      levers: '1) Go-live date: commit to working day 120, choose a later date up to day 130, or move go-live after the peak season.\n2) Early migration: start the data-migration build at the configuration design freeze (day 20) instead of when configuration ends.\n3) Second test team: a contracted team works alongside the current 4 testers in both test cycles.\n4) Scope: move secondary functions to a second release.',
      outcome: 'Probability that cut-over is complete, so the new ERP system is ready for go-live, by the end of working day 120 after kick-off. Also the P80 completion day: the working day by which cut-over is complete in 80% of iterations.',
      question: 'With the current plan, what is the probability that cut-over is complete by working day 120 after kick-off, and which of two options of about equal cost raises it more: 1) starting the data-migration build at the design freeze on configuration day 20, or 2) adding a second test team to both test cycles? The P80 completion day is reported for each plan.',
      claimType: 'decision-support',
    },

    // ── 2 Concept and scope ────────────────────────────────────────────────
    scope: {
      boundary: 'Included: the eight work packages from kick-off to cut-over (configuration, warehouse-system integration, data-migration build, migration rehearsal, test cycles 1 and 2, user training, cut-over), their finish-to-start links, their durations as three-point estimates, the risk of a failed rehearsal with its rework, and the effects of the two options.',
      exclusions: 'Peak season and the stabilisation before it: they come after the date the model computes and do not change it.\nWarehouse system supplier: a late interface release is not modelled as its own event; it sits inside the pessimistic integration estimate.\nCost: both options fit the contingency budget and cost about the same, so cost is a constraint, not an outcome.\nPeople, holidays and calendar dates: durations are in working days that already allow for each team’s availability.',
      horizon: 'One project from kick-off (day 0) to completed cut-over: planned go-live on working day 120; day 130 is the latest date that still leaves 20 working days of stabilisation before the peak season starts around day 150.',
      timeUnit: 'day',
      detail: 'Work-package level: eight packages with three-point durations and finish-to-start links; no tasks inside packages and no individual people. One iteration is one possible run of the whole project.',
      constraints: 'The contingency budget covers one option, not both. Go-live must leave at least 20 working days of stabilisation before the peak season, so day 130 is the latest acceptable date. Estimates come from the team leads; past projects give only planned and actual durations per work package.',
    },

    // ── 3 Representation and method ────────────────────────────────────────
    representation: {
      primaryMethod: 'monte-carlo',
      justification: 'The question asks for a probability, and the uncertainty sits in the inputs: every duration is a range, and the rehearsal may fail. Monte Carlo sampling draws them all, computes the finish day through the dependency network and repeats this 10,000 times; the share of iterations that finish by day 120 is the answer. It also shows merge bias: where paths join, the later one decides, which a critical-path calculation with most-likely values misses. Petri nets, also on the shortlist, would show the same merges but answer whether the plan can block, not how likely day 120 is. Left out: feedback inside the project, such as delays that change staffing, productivity or rework.',
      alternativeMethod: 'system-dynamics',
      alternativeJustification: 'System dynamics would represent the project as stocks of work to do, work done and undiscovered rework, with feedback from schedule pressure to overtime, fatigue, errors and more rework. It is the better choice if the committee asks why late projects slip further, or whether a test team added late helps or hurts once training and supervision are counted. It needs evidence on productivity and error rates over time that the team leads do not have.',
      notes: 'Durations and the risk event are drawn at random; the network adds them along every path, and the later path into each merge decides. Four activities group the eight work packages. The sketch names the elements; it is not the executable model.',
    },

    // ── 4 Inputs ───────────────────────────────────────────────────────────
    // The twelve input laws and the history of past overruns are data models (artefacts.data): each writes its own row.
    inputs: [
      { id: 'in-network', name: 'Work-package network',
        value: 'Configuration starts at kick-off; integration and the migration build start when configuration ends; the rehearsal starts when the build and configuration are both finished; test cycle 1 starts when integration and a passed rehearsal are both done; cycle 2 and training start after cycle 1; cut-over starts when cycle 2 and training are both finished.',
        unit: 'finish-to-start links, no lags', sourceType: 'expert',
        provenance: 'The project plan agreed with the team leads in this teaching case; not a real plan.',
        uncertainty: 'Fixed in the model (see the fixed-logic assumption). Two merges decide the finish: test cycle 1 waits for integration and the migration path, cut-over waits for cycle 2 and training.',
        availability: 'have' },
      { id: 'in-options', name: 'Option settings',
        value: 'Option 1, early migration: the build starts on configuration day 20 (design freeze), adds the re-mapping effort, and the rehearsal fails with probability 0.35 instead of 0.30. Option 2, second test team: both test cycles take the test-time fraction of their drawn duration.',
        unit: 'working day; probability', sourceType: 'assumed',
        provenance: 'Declared assumptions in this teaching case: early mapping meets a less stable configuration, so the rehearsal fails more often. Neither option has been tried here.',
        uncertainty: 'A freeze that slips to day 30 removes most of option 1’s gain. The 0.35 is a judgement; anything from 0.30 to 0.45 is plausible.',
        availability: 'assume', plan: 'Ask the configuration lead how firm a day-20 freeze is, and run option 1 with failure probability 0.45 as a sensitivity case.' },
      { id: 'in-target', name: 'Go-live target and latest date',
        value: 'Target: cut-over complete by the end of working day 120 after kick-off. Latest acceptable: day 130, which leaves 20 working days of stabilisation before the peak season starts around day 150.',
        unit: 'working days after kick-off', sourceType: 'assumed',
        provenance: 'Design value set by the steering committee in this teaching case.',
        uncertainty: 'Fixed for the analysis. The start of the peak season (around day 150) is the sales team’s estimate and could move by a week.',
        availability: 'have' },
    ],

    // ── 4 Assumptions ──────────────────────────────────────────────────────
    assumptions: [
      { id: 'as-independent', statement: 'Work-package durations are independent: a slow configuration does not make migration or testing slower as well.',
        rationale: 'Each package has its own team and lead, and there is no evidence yet on how overruns spread between packages.',
        consequenceIfWrong: 'Common causes (unclear requirements, poor master data, the same key users) make packages overrun together. The spread is then too narrow and the probability of day 120 is overstated for every plan.',
        plannedCheck: 'Sensitivity case, an upper bound on shared overruns: in each iteration one factor, drawn from the overrun-ratio law of past work packages and divided by its mean, multiplies every duration. Report how far P80 and the option ranking move.',
        evidenceKind: 'assumed', sourceNote: 'Usual simplification in schedule risk analysis; not yet checked against past projects.' },
      { id: 'as-unbiased', statement: 'The three-point estimates are not biased by optimism: actual durations fall inside each optimistic–pessimistic range and follow the stated laws.',
        rationale: 'Each lead estimated separately and in writing, before seeing the planned date, which limits anchoring on day 120.',
        consequenceIfWrong: 'Ranges that are too low or too narrow make every plan look safer, and the committee may commit to a date it then misses.',
        plannedCheck: 'Optimism check against 48 past work packages: if their mean ratio of actual to most-likely duration lies more than 5% above the 1.10 the laws imply, or more than 1 in 5 exceeds 1.5, raise all pessimistic values by one declared factor before any comparison.',
        evidenceKind: 'expert', sourceNote: 'Rests on the team leads’ judgement; the overrun history (synthetic here) is the planned evidence.' },
      { id: 'as-fixed-logic', statement: 'The dependency network is fixed: a package starts only when all its predecessors are finished, and nobody re-plans or overlaps work when delays appear.',
        rationale: 'The question is about the current plan and two defined options, not about how managers improvise.',
        consequenceIfWrong: 'In practice late work is often overlapped, so the model may be pessimistic about recovery while ignoring the extra errors that hurried work brings.',
        plannedCheck: 'Walk through every link with the team leads and mark those that could be overlapped; test the most likely one as a separate option.',
        evidenceKind: 'assumed', sourceNote: 'Modelling choice for this teaching case.' },
      { id: 'as-one-risk', statement: 'The failed rehearsal is the only risk event modelled; other risks, such as a late warehouse-system release or absent key users, are covered by the pessimistic estimates.',
        rationale: 'The leads rated the rehearsal as the most likely and most costly risk; the others were judged small or already inside the ranges.',
        consequenceIfWrong: 'A second discrete risk would stretch the late tail and understate P80; if it hits integration, option 1 gains even less.',
        plannedCheck: 'Hold a short risk workshop with the leads; add any event rated above 0.10 probability and 5 days impact as its own yes/no input.',
        evidenceKind: 'expert', sourceNote: 'Team leads’ risk ranking in this synthetic case; no risk register was available.' },
    ],

    // ── 6 Outcomes ─────────────────────────────────────────────────────────
    outcomes: [
      { id: 'out-ready', metric: 'Probability of readiness by day 120',
        definition: 'Share of iterations in which cut-over is complete by the end of working day 120 after kick-off.',
        unit: 'probability (0–1)', direction: 'higher',
        aggregation: 'Share over 10,000 iterations with a 95% interval; options compared by the paired difference on the same draws.',
        criterion: 'The committee commits to day 120 only if the chosen plan reaches at least 0.80. The option with the higher probability is funded if it leads by at least 3 percentage points.' },
      { id: 'out-p80', metric: 'P80 completion day',
        definition: 'The 80th percentile of the completion day: the working day by which cut-over is complete in 80% of iterations.',
        unit: 'working days after kick-off', direction: 'lower',
        aggregation: '80th percentile over 10,000 iterations, for each plan on the same draws.',
        criterion: 'If day 120 misses 0.80, the committee may commit to the P80 day instead, but only up to day 130; beyond that, go-live moves after the peak season.' },
    ],

    // ── 5 Verification and validation ──────────────────────────────────────
    // The check plan (artefacts.checks) writes these three fields when the project is made; this is the same plan in words.
    evaluation: {
      verification: '1) Fixed inputs: most-likely values and no failed rehearsal give day 111 via configuration, migration build, rehearsal, both test cycles and cut-over; option 1 gives day 106 (integration now critical), option 2 day 104.5. All optimistic gives day 83, all pessimistic with a failed rehearsal day 196, and every baseline iteration lies in between.\n2) Input samples: over 10,000 draws each duration’s mean lies within 0.5% of (optimistic + most likely + pessimistic) ÷ 3, e.g. 43.3 days for configuration; the failure share is 0.30 ± 0.01; no two durations correlate beyond ±0.04.\n3) Merge case: two parallel tasks, each uniform on 10–20 days, are both finished by day 15 in 25% of iterations, and the mean merge day is 16.7, not 15.\n4) Fair comparison: with the option effects switched off (build after configuration, no re-mapping, failure probability 0.30, test-time fraction 1), both options give the baseline completion day in every iteration.\n5) Settling: doubling to 20,000 iterations, or a second seed, moves the probability of readiness by day 120 by less than 1 percentage point.',
      validation: '1) Optimism check: the mean ratio of actual to most-likely duration in 48 past work packages against the 1.10 the eight work-package laws imply, within ±5%; and no more than 1 in 5 past ratios above 1.5, the pessimistic limit of most packages.\n2) Back-test on two finished projects kept out of that history: rebuilt from their planned durations, with ranges at the same ratios to most likely as today’s laws, each actual completion day falls between the simulated 10th and 90th percentiles.\n3) Logic review: the team leads walk through the network link by link and through 20 sampled iterations, and say where a path, merge or rework step is wrong.\nIn this teaching case the history is synthetic, so this is the plan, not completed evidence.',
      calibration: '1) Parameter sources: each input’s data model names its source (a lead’s estimate, past records or a declared assumption), and the option effects stay marked as assumptions.\n2) Declared correction only: if the optimism check fails, one common factor raises the eight pessimistic values for all plans alike, before any comparison. Nothing is tuned to reach day 120 or to favour an option.\nThe correction would be set on the six projects of the overrun history and validated on the two projects kept aside.',
    },

    // ── 6 Experiment ───────────────────────────────────────────────────────
    experiment: {
      baseline: 'Current plan: configuration from kick-off; integration and migration build after configuration; the rehearsal fails with probability 0.30; one test team; training after cycle 1; cut-over after cycle 2 and training. Target: cut-over complete by working day 120.',
      alternatives: '1) Early migration: the build starts at the design freeze on configuration day 20, with re-mapping effort triangular (3, 5, 8) days and failure probability 0.35.\n2) Second test team: both test cycles take a fraction triangular (0.65, 0.70, 0.80) of their duration.\nEverything else as in the baseline. Both together exceed the budget and are not simulated.\nSensitivity cases, not options: failure probability 0.20 and 0.50 for all plans, 0.45 for option 1, test-time fraction 0.90, and a shared overrun factor for all plans.',
      comparison: 'Common random numbers: in each iteration every duration, the rehearsal draw (one uniform number compared with 0.30 or 0.35) and the option effects are drawn once and shared by all three plans, so only the option differs. The probability of readiness by day 120 decides, as a paired difference with a 95% interval; P80 is reported alongside. At 10,000 iterations the interval is about ±1 percentage point, so differences under 3 points count as a tie, settled by P80.',
      runSettings: '10,000 iterations per plan, seed “erp-golive”, the twelve input laws of step 4 (the overrun history only in the shared-factor case), time unit one working day, durations kept continuous. Record the simulation tool’s version with the results; a rerun with doubled iterations or a second seed must agree within 1 percentage point.',
    },
  },

  artefacts: {
    // ── Step 2: conceptual model ─────────────────────────────────────────────
    concept: {
      title: `${T}: conceptual model`,
      data: {
        objectives: 'Estimate the probability that cut-over is complete by working day 120, and the P80 completion day, for the current plan and for two options of about equal cost.',
        assumptions: 'Durations are independent draws from the leads’ estimates. A package starts when all its predecessors finish; nobody re-plans. One risk event: a failed rehearsal.',
        simplifications: 'Eight work packages, drawn as four activities; no tasks, people, holidays or costs. Other risks sit inside the pessimistic estimates.',
        nodes: [
          { id: 'c-team', type: 'lever', label: 'Second test team', x: 20, y: 506, zone: 'inputs' },
          { id: 'c-early', type: 'lever', label: 'Early migration start', x: 20, y: 278, zone: 'inputs' },
          { id: 'c-config', type: 'activity', label: 'Configure ERP', x: 208, y: 144, zone: 'content' },
          { id: 'c-fail', type: 'variable', label: 'Failed rehearsal', x: 200, y: 430, zone: 'content' },
          { id: 'c-integration', type: 'activity', label: 'Integrate warehouse system', x: 560, y: 144, zone: 'content' },
          { id: 'c-migration', type: 'activity', label: 'Build and rehearse migration', x: 380, y: 278, zone: 'content' },
          { id: 'c-tests', type: 'activity', label: 'Test, train and cut over', x: 560, y: 506, zone: 'content' },
          { id: 'c-merge', type: 'note', label: 'At merges the later path decides', x: 740, y: 506, zone: 'outputs' },
          { id: 'c-ready', type: 'outcome', label: 'P(ready by day 120)', x: 740, y: 126, zone: 'outputs' },
          { id: 'c-p80', type: 'outcome', label: 'P80 completion day', x: 744, y: 376, zone: 'outputs' },
          { id: 'c-supplier', type: 'external', label: 'Warehouse system supplier', x: 944, y: 60, zone: 'outside' },
          { id: 'c-peak', type: 'external', label: 'Peak season', x: 944, y: 136, zone: 'outside' },
        ],
        edges: [
          { id: 'ce-config-int', from: 'c-config', to: 'c-integration', kind: 'flow', sign: '', label: 'precedes' },
          { id: 'ce-config-mig', from: 'c-config', to: 'c-migration', kind: 'flow', sign: '', label: 'precedes' },
          { id: 'ce-int-tests', from: 'c-integration', to: 'c-tests', kind: 'flow', sign: '', label: 'merges into' },
          { id: 'ce-mig-tests', from: 'c-migration', to: 'c-tests', kind: 'flow', sign: '', label: 'merges into' },
          { id: 'ce-fail', from: 'c-fail', to: 'c-migration', kind: 'influence', sign: '+', label: 'adds rework' },
          { id: 'ce-early', from: 'c-early', to: 'c-migration', kind: 'decides', sign: '', label: 'starts it on day 20' },
          { id: 'ce-early-fail', from: 'c-early', to: 'c-fail', kind: 'influence', sign: '+', label: 'raises to 0.35' },
          { id: 'ce-team', from: 'c-team', to: 'c-tests', kind: 'influence', sign: '-', label: 'shortens' },
          { id: 'ce-ready', from: 'c-tests', to: 'c-ready', kind: 'information', sign: '', label: 'measured as' },
          { id: 'ce-p80', from: 'c-tests', to: 'c-p80', kind: 'information', sign: '', label: 'measured as' },
        ],
      },
    },

    // ── Step 3: method chooser ───────────────────────────────────────────────
    method: {
      title: `${T}: method choice`,
      answers: {
        claim: 'compare',           // two options are compared for a decision
        time: 'static',             // one outcome per run: the completion day of a one-off project
        latent: 'no',
        observedRelations: 'no',
        concurrency: 'yes',         // parallel packages merge: a package waits for all its predecessors
        uncertainInputs: 'yes',     // every duration is a range, and the rehearsal may fail
        finiteStates: 'no',
        feedback: 'no',             // scoped out: delays do not change staffing or rework (fixed-logic assumption)
        queues: 'none',
        spatial: 'no',
        heterogeneous: 'no',
        granularity: 'aggregate',   // whole work packages and one project finish day
        evidence: 'expert',         // the leads’ three-point estimates
      },
    },

    // ── Step 4: one data model per uncertain input ───────────────────────────
    data: [
      leadEstimate('configuration', 'Configuration', 'configuration lead', [30, 40, 60],
        'Right-skewed: the mean, 43.3 days, lies above the most-likely 40. On the most-likely critical path, and integration and the migration build both wait for it.'),
      leadEstimate('integration', 'Warehouse-system integration', 'integration lead', [25, 35, 55],
        'Mean 38.3 days. It has 5 days of slack in the most-likely plan, so it becomes critical whenever the migration path runs fast, and with option 1.'),
      leadEstimate('migration build', 'Data-migration build', 'migration lead', [20, 30, 45],
        'Data quality in the old system is unknown until the first extracts, hence the 25-day range for about 12,000 items, 3,500 customers, open orders and stock balances. On the most-likely critical path, with zero slack.',
        'The migration lead re-estimates after a first extract of item and customer master data in week 2.'),
      leadEstimate('rehearsal', 'Migration rehearsal', 'migration lead', [8, 10, 15],
        'One full trial load; mean 11 days. A failed rehearsal adds rework before test cycle 1 can start (separate inputs).'),
      {
        title: `${T}: rehearsal failure`, name: 'Failed first rehearsal (risk event)', unit: '1 = fails, 0 = passes', source: 'described', family: 'bernoulli', params: [0.3], evidence: 'expert',
        provenance: 'Expert value in this teaching case, not real records: the migration lead’s judgement, set as if the first rehearsal had failed in 2 of the 6 past projects behind the overrun history.',
        uncertainty: 'Plausible from 0.2 to 0.5. Each extra 0.10 adds about 1.7 days to the mean finish (0.10 × 16.7 days of mean rework), but mostly it stretches the late tail and moves P80. Option 1 raises it to 0.35.',
        availability: 'obtainable', plan: 'The project office counts failed first rehearsals in the closure reports of past migration projects, before the Design checkpoint.',
      },
      leadEstimate('rework', 'Rework after a failed rehearsal', 'migration lead', [10, 15, 25],
        'Drawn only when the rehearsal fails: fixing the mapping and repeating the rehearsal, mean 16.7 days. The long right tail is what moves P80.'),
      leadEstimate('test cycle 1', 'Test cycle 1 (integration test)', 'test lead', [12, 15, 25],
        'Estimated for one team of 4 testers; defect counts drive the pessimistic value. Mean 17.3 days, on every path to cut-over. Option 2 multiplies it by the test-time fraction.',
        'The test lead checks the estimate against the defect logs of the last two internal releases.'),
      leadEstimate('test cycle 2', 'Test cycle 2 (acceptance test)', 'test lead', [10, 12, 20],
        'Mean 14 days, on every path to cut-over. Together the two cycles average 31.3 days against 27 most likely. Option 2 multiplies it by the test-time fraction.',
        'The test lead checks the estimate against the defect logs of the last two internal releases.'),
      leadEstimate('user training', 'User training', 'training lead', [8, 10, 14],
        'Training of 120 users, parallel to test cycle 2, with 2 days of slack. With a second test team, cycle 2 (about 8.4 days) is shorter than training, so training then decides when cut-over starts.'),
      leadEstimate('cut-over', 'Cut-over', 'IT operations lead', [3, 4, 6],
        'Narrow range, mean 4.3 days; the last package on every path.'),
      {
        title: `${T}: re-mapping effort`, name: 'Re-mapping effort (option 1)', unit: 'working days', source: 'described', family: 'triangular', params: [3, 5, 8],
        provenance: 'Declared assumption in this teaching case, not real records: mapping built before configuration ends is partly redone when configuration changes after the freeze.',
        uncertainty: 'Mean 5.3 days, added to the migration build only under option 1. If the freeze slips or changes are large, the effort and option 1’s gain both move.',
        availability: 'assume', plan: 'Ask the configuration lead how much changed after the design freeze in the last internal projects.',
      },
      {
        title: `${T}: test-time fraction`, name: 'Test-time fraction (option 2)', unit: 'fraction of one-team duration', source: 'described', family: 'triangular', params: [0.65, 0.7, 0.8],
        provenance: 'Declared assumption in this teaching case, not real records: a second team does not halve test time, because fixes still go through the same developers.',
        uncertainty: 'The most fragile input: the real fraction could lie anywhere from 0.6 to 0.9, and at 0.9 option 2 gains little. Run at 0.90 as a sensitivity case.',
        availability: 'assume', plan: 'Ask the test lead how much of each past test cycle was spent waiting for fixes.',
      },
      {
        title: `${T}: past overrun ratios`, name: 'Overrun ratio of past work packages', unit: 'actual ÷ most-likely duration', source: 'synthetic',
        truth: { family: 'lognormal', params: [0.1, 0.2] }, seed: 'erp-overrun-43', n: 48, decimals: 2,
        provenance: 'Synthetic teaching values drawn by the template, not real records: 48 work packages from six finished internal projects, each actual duration divided by its planned duration, the most-likely estimate made at the time. Used to check the estimates, not drawn in the baseline.',
        uncertainty: 'Right-skewed: 18 of 48 packages finished at or under their most-likely estimate, while 5 took more than 1.5 times as long, one 1.9 times. The lognormal law has the lowest AIC, with gamma close behind: 48 values cannot tell them apart. Six past projects, with other teams and scope, are a thin reference for this rollout.',
        availability: 'obtainable', plan: 'The project office takes planned and actual durations per work package from the closure reports of past internal projects, before the Design checkpoint, and keeps two projects aside for the back-test.',
      },
    ],

    // ── Step 5: check plan ───────────────────────────────────────────────────
    checks: {
      title: `${T}: check plan`,
      data: {
        method: 'monte-carlo',
        checks: [
          { id: 'ck-verify-1', group: 'verification', status: 'planned', evidence: '',
            text: 'Fixed inputs: most-likely values and no failed rehearsal give day 111 via configuration, migration build, rehearsal, both test cycles and cut-over; option 1 gives day 106 (integration now critical), option 2 day 104.5. All optimistic gives day 83, all pessimistic with a failed rehearsal day 196, and every baseline iteration lies in between.' },
          { id: 'ck-verify-2', group: 'verification', status: 'planned', evidence: '',
            text: 'Input samples: over 10,000 draws each duration’s mean lies within 0.5% of (optimistic + most likely + pessimistic) ÷ 3, e.g. 43.3 days for configuration; the failure share is 0.30 ± 0.01; no two durations correlate beyond ±0.04.' },
          { id: 'ck-verify-3', group: 'verification', status: 'planned', evidence: '',
            text: 'Merge case: two parallel tasks, each uniform on 10–20 days, are both finished by day 15 in 25% of iterations, and the mean merge day is 16.7, not 15.' },
          { id: 'ck-verify-4', group: 'verification', status: 'planned', evidence: '',
            text: 'Fair comparison: with the option effects switched off (build after configuration, no re-mapping, failure probability 0.30, test-time fraction 1), both options give the baseline completion day in every iteration.' },
          { id: 'ck-verify-5', group: 'verification', status: 'planned', evidence: '',
            text: 'Settling: doubling to 20,000 iterations, or a second seed, moves the probability of readiness by day 120 by less than 1 percentage point.' },
          { id: 'ck-validate-1', group: 'validation', status: 'planned', evidence: '',
            text: 'Optimism check: compare the mean ratio of actual to most-likely duration in 48 past work packages with the 1.10 the eight work-package laws imply, and count past ratios above 1.5, the pessimistic limit of most packages: more than 1 in 5 means the ranges are too narrow.' },
          { id: 'ck-validate-2', group: 'validation', status: 'planned', evidence: '',
            text: 'Back-test on two finished projects kept out of that history: rebuild each network from its planned durations, with ranges at the same ratios to most likely as today’s laws, and check that the actual completion day falls between the simulated 10th and 90th percentiles.' },
          { id: 'ck-validate-3', group: 'validation', status: 'planned', evidence: '',
            text: 'Logic review: walk the team leads through the network link by link and through 20 sampled iterations, and note every path, merge or rework step they say is wrong.' },
          { id: 'ck-calibrate-1', group: 'calibration', status: 'planned', evidence: '',
            text: 'Parameter sources: each input’s data model names its source (a lead’s estimate, past records or a declared assumption), and the option effects stay marked as assumptions.' },
          { id: 'ck-calibrate-2', group: 'calibration', status: 'planned', evidence: '',
            text: 'Declared correction only: if the optimism check fails, one common factor raises the eight pessimistic values for all plans alike, before any comparison. Nothing is tuned to reach day 120 or to favour an option.' },
        ],
        validation: {
          measure: 'Mean ratio of actual to most-likely duration: 48 past work packages (observed) against draws from the eight work-package laws, each divided by its most-likely value (simulated)',
          tolerancePct: 5, toleranceOn: 'means', observed: [], simulated: [],
        },
        calibration: {
          parameters: 'One common factor on the eight pessimistic values, applied only if the optimism check fails; nothing else is tuned',
          tunedOn: 'Ratios of actual to most-likely duration of 48 work packages from six finished internal projects (synthetic in this teaching case)',
          validatedOn: 'Two further finished projects kept out of the ratio history (back-test), and the team leads’ review of the network',
        },
      },
    },
  },
};
