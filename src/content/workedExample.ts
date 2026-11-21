import type { CheckPlan, Comparison, ConceptModel, DataModel, MethodChoice } from '../domain/artefacts/types';
import { RULE_VERSION, answersKey, emptyAnswers, evaluateRules, type MethodAnswers } from '../domain/methods/rules';
import { createProject, newId, type CheckpointId, type Inclusion, type ProjectDoc } from '../domain/passport/schema';
import { defaultConfig, ENGINE_VERSION } from '../domain/sandbox/engine';
import { runAll } from '../domain/sandbox/experiment';
import { RNG_VERSION } from '../domain/sandbox/rng';
import type { SandboxConfig } from '../domain/sandbox/types';

/**
 * The worked example (docs/COMPASS-SPEC.md §3, docs/TOOLBOX-SPEC.md §7): a complete project for the IT helpdesk of a
 * mid-sized company, whose backlog of open tickets keeps growing. Readers compare their own work with it step by step,
 * or start their own editable copy from it, so every field is written the way a good project would write it, and it
 * includes one artefact of each kind.
 *
 * All inputs are synthetic teaching values and are labelled as such. The numbers quoted in the conclusion come
 * from the comparison below: the daily backlog model, 100 paired replications, seed “compass-example”.
 * tests/compass.test.ts recomputes them, so the text cannot drift from the engine unnoticed.
 */
export const WORKED_EXAMPLE_ID = 'worked-example';
const NOW = '2026-11-21T00:00:00.000Z';
const SEED = 'compass-example';
const UNIT = 'ticket-equivalents';
/** The example's name; the read-only reference adds “(worked example)”. */
export const EXAMPLE_TITLE = 'IT helpdesk backlog';

/**
 * The copies of the example. Their ids are fixed, and their sources are not artefacts of any Toolbox:
 * on a reader's device every copy reads “Original no longer in the Toolbox”.
 */
export const EXAMPLE_COPIES = {
  'concept-model': { id: 'inc-example-concept', sourceId: 'example-concept-model', title: 'IT helpdesk backlog: conceptual model' },
  'method-choice': { id: 'inc-example-method', sourceId: 'example-method-choice', title: 'Method choice for the backlog question' },
  'data-model': { id: 'inc-example-arrivals', sourceId: 'example-data-arrivals', title: 'Daily arrivals' },
  'check-plan': { id: 'inc-example-checks', sourceId: 'example-check-plan', title: 'Checks for the backlog model' },
  'comparison': { id: 'inc-example-comparison', sourceId: 'example-comparison', title: 'Capacity 10 versus 12' },
} as const;

/** The two policies of the example as settings of the daily backlog model: capacity 10 and capacity 12, same arrivals. */
export function exampleConfigs(): { baseline: SandboxConfig; alternative: SandboxConfig } {
  const baseline = defaultConfig();
  baseline.horizon = 30;
  baseline.initialBacklog = 0;
  baseline.demand.mode = 'random'; // default law: 8, 12 or 16 with probabilities 0.25, 0.5, 0.25
  baseline.capacity.mode = 'direct';
  baseline.capacity.direct = 10;
  baseline.replications = 100;
  baseline.seed = SEED;
  const alternative = structuredClone(baseline);
  alternative.capacity.direct = 12;
  return { baseline, alternative };
}

/** Average end-of-day backlog per replication, for both policies. Deterministic, so it is computed once. */
let cachedOutcomes: { baseline: number[]; alternative: number[] } | null = null;
function exampleOutcomes(): { baseline: number[]; alternative: number[] } {
  if (!cachedOutcomes) {
    const { baseline, alternative } = exampleConfigs();
    const run = runAll(baseline, alternative, { id: 'run-example', projectId: WORKED_EXAMPLE_ID, modelRevision: 1, createdAt: NOW });
    cachedOutcomes = { baseline: run.baseline.summaries.map((s) => s.averageEndBacklog), alternative: (run.alternative?.summaries ?? []).map((s) => s.averageEndBacklog) };
  }
  return { baseline: [...cachedOutcomes.baseline], alternative: [...cachedOutcomes.alternative] };
}

function methodAnswers(): MethodAnswers {
  return {
    ...emptyAnswers(),
    claim: 'compare',          // two capacity levels are compared for a decision
    time: 'dynamic',           // the backlog is followed day by day
    latent: 'no',
    observedRelations: 'no',
    concurrency: 'no',
    uncertainInputs: 'yes',    // daily arrivals vary
    finiteStates: 'no',
    feedback: 'yes',           // accumulation is the core of the question
    queues: 'simple',          // one backlog, one pool of technicians, no priorities
    spatial: 'no',
    heterogeneous: 'no',
    granularity: 'aggregate',  // totals, not individual tickets
    evidence: 'time-series',   // daily counts
  };
}

export function workedExample(): ProjectDoc {
  const doc = createProject({
    title: `${EXAMPLE_TITLE} (worked example)`,
    id: WORKED_EXAMPLE_ID,
    now: NOW,
    origin: { kind: 'example', ref: WORKED_EXAMPLE_ID },
  });
  const p = doc.passport;

  // ── 1 Frame ──────────────────────────────────────────────────────────────
  p.decision = {
    stakeholder: 'The IT service desk manager of a mid-sized company (about 600 staff), who decides on staffing and service hours within the IT budget and has to justify any new post to the head of IT.',
    problem: 'Staff complain that IT support is slow. Tickets raised in the self-service portal, by e-mail or by phone often stay open for several days, and the number of open tickets at closing time has grown since a laptop refresh and a new expenses app started rolling out this quarter. The head of IT has proposed hiring; that is one possible response, not the problem itself.',
    levers: '1) Staffing: daily handling capacity, now 10 ticket-equivalents per day; one additional part-time technician would raise it to about 12.\n2) Service hours: longer desk hours on the busiest days.\n3) Triage: sort tickets at intake so that simple ones (password resets, access requests) are closed at once.\n4) Self-service: a password-reset portal and a knowledge base that answer routine tickets before they reach the desk.',
    outcome: 'Average end-of-day backlog of open tickets over 30 working days, in ticket-equivalents (one ticket-equivalent is the handling effort of one typical ticket).',
    question: 'Over 30 working days of the rollout quarter, how does the average end-of-day backlog (in ticket-equivalents) change if daily handling capacity rises from 10 to 12 ticket-equivalents per day, which is the most the current budget allows (one additional part-time technician)?',
    claimType: 'decision-support',
  };

  // ── 2 Concept and scope ──────────────────────────────────────────────────
  p.scope = {
    boundary: 'Included: every ticket that reaches the IT helpdesk queue through the self-service portal, e-mail or phone, including tickets opened automatically by the monitoring system; the technicians’ combined daily handling capacity; the backlog of open tickets at the end of each day.',
    exclusions: 'Network operations: the network and infrastructure team has its own staff, on-call rota and budget, so its incidents never use helpdesk capacity.\nHardware purchasing: orders are handled by procurement in a separate system; the few cases it passes on arrive as ordinary tickets and are already counted.\nQuality of the fixes and the experience of individual employees: the question is about the total backlog.',
    horizon: '30 working days (about six weeks of the rollout quarter)',
    timeUnit: 'day',
    detail: 'Aggregate. Daily totals in ticket-equivalents; no individual tickets, employees or technicians are represented.',
    constraints: 'Budget: at most one additional part-time technician (about +2 ticket-equivalents per day). The ticketing system cannot be changed during the rollout. Only aggregate daily counts are used; no personal data.',
  };
  p.representation.nodes = [
    { id: 'n-head', type: 'stakeholder', label: 'Service desk manager', x: 280, y: 40 },
    { id: 'n-staff', type: 'entity', label: 'Employees', x: 60, y: 110 },
    { id: 'n-monitoring', type: 'entity', label: 'Monitoring', x: 60, y: 210 },
    { id: 'n-arrivals', type: 'variable', label: 'Daily arrivals', x: 200, y: 160 },
    { id: 'n-backlog', type: 'variable', label: 'Open backlog', x: 340, y: 160 },
    { id: 'n-capacity', type: 'variable', label: 'Daily capacity', x: 480, y: 160 },
    { id: 'n-techs', type: 'entity', label: 'Technicians', x: 480, y: 60 },
  ];
  p.representation.relations = [
    { id: 'r-staff', from: 'n-staff', to: 'n-arrivals', label: 'raise tickets', directed: true },
    { id: 'r-monitoring', from: 'n-monitoring', to: 'n-arrivals', label: 'opens tickets', directed: true },
    { id: 'r-inflow', from: 'n-arrivals', to: 'n-backlog', label: 'adds to', directed: true },
    { id: 'r-outflow', from: 'n-capacity', to: 'n-backlog', label: 'reduces', directed: true },
    { id: 'r-techs', from: 'n-techs', to: 'n-capacity', label: 'provide', directed: true },
    { id: 'r-staffing', from: 'n-head', to: 'n-techs', label: 'decides staffing', directed: true },
    { id: 'r-report', from: 'n-backlog', to: 'n-head', label: 'is reported to', directed: true },
  ];
  p.representation.notes = 'One stock (open backlog) with one inflow (daily arrivals) and one outflow limited by daily capacity. The sketch names the elements; it is not the executable model.';

  // ── 3 Choose a method ────────────────────────────────────────────────────
  p.representation.primaryMethod = 'system-dynamics';
  p.representation.justification = 'The question is about an aggregate quantity that accumulates: the backlog rises with daily arrivals and falls with daily handling capacity. A stock-and-flow model with a daily time step represents exactly this balance, needs only daily totals (the evidence that is available) and keeps the units easy to check. Daily arrivals vary, so the inflow is drawn at random and the run is replicated. The method leaves out individual tickets, their order and how long any single ticket stays open.';
  p.representation.alternativeMethod = 'des';
  p.representation.alternativeJustification = 'Discrete-event simulation would follow each ticket through intake and handling, so it could report individual waiting times, priorities and the effect of service hours within a day. It needs time-stamped arrivals and handling times that are not available yet, and the stakeholder asks about the total backlog. It becomes the better choice if the question shifts to how long employees wait.';
  const answers = methodAnswers();
  doc.methods = {
    ruleVersion: RULE_VERSION,
    answers,
    answersKey: answersKey(answers),
    shortlist: evaluateRules(answers).candidates.map((c) => c.method),
    decidedAt: NOW,
  };

  // ── 4 Inputs and assumptions ─────────────────────────────────────────────
  p.inputs = [
    { id: 'in-arrivals', name: 'Daily arrivals', value: '8, 12 or 16 with probabilities 0.25, 0.5 and 0.25 (mean 12)', unit: `${UNIT}/day`, sourceType: 'synthetic',
      provenance: 'Synthetic teaching data (ticketing-system style): shaped like the daily ticket counts of the first 30 working days of a quarter, monitoring tickets included. Not real records.',
      uncertainty: 'Daily range 8–16. The mean is the fragile part: one more ticket-equivalent per day adds about 30 to the baseline backlog by day 30.',
      availability: 'obtainable', plan: 'Ticketing-system export of daily ticket counts for the first 30 working days; the service desk team lead, before the Design checkpoint.',
      inclusion: EXAMPLE_COPIES['data-model'].id },
    { id: 'in-capacity', name: 'Daily handling capacity (baseline)', value: '10', unit: `${UNIT}/day`, sourceType: 'synthetic',
      provenance: 'Synthetic teaching data (ticketing-system style): typical number of tickets closed per working day by the current team. Not real records.',
      uncertainty: 'About ±1 per day (absences, unusually long tickets). Held constant in the model.',
      availability: 'obtainable', plan: 'Tickets closed per working day from the same ticketing-system export.' },
    { id: 'in-capacity-alt', name: 'Daily handling capacity with one more part-time technician', value: '12', unit: `${UNIT}/day`, sourceType: 'assumed',
      provenance: 'Declared assumption in this synthetic teaching case: a trained part-time technician closes about 2 ticket-equivalents per day.',
      uncertainty: 'Plausible range 11–13; lower during the first weeks of training. At 11 the backlog still grows by about 1 per day.',
      availability: 'assume', plan: 'No such post exists yet. Ask the team lead for the output of the last part-time technician in the first and third month.' },
    { id: 'in-initial', name: 'Initial backlog', value: '0', unit: UNIT, sourceType: 'synthetic',
      provenance: 'Synthetic teaching data (ticketing-system style): open tickets on the first morning of the period, set to zero as after a cleared backlog. Not real records.',
      uncertainty: 'Plausible range 0–20. A higher start raises the backlog under both policies; it does not shrink the difference between them.',
      availability: 'obtainable', plan: 'Open tickets on the first morning of the period, from the ticketing system.' },
    { id: 'in-horizon', name: 'Horizon', value: '30', unit: 'working days', sourceType: 'assumed',
      provenance: 'Modelling choice for this synthetic teaching case: the period over which the stakeholder reviews the helpdesk.',
      uncertainty: 'A choice, not a measurement. With capacity below mean arrivals the backlog keeps growing, so a longer horizon gives a larger average.',
      availability: 'have' },
  ];
  p.assumptions = [
    { id: 'as-lost', statement: 'Unused capacity is lost: handling time that is not needed on a quiet day cannot be saved for a later day.',
      rationale: 'Technician hours cannot be stored, and tickets can only be handled after they arrive.',
      consequenceIfWrong: 'If quiet days are used to prepare (scripts, knowledge-base articles), later capacity is higher and the model overstates the backlog.',
      plannedCheck: 'Ask the technicians how slack time is used; compare the number of tickets closed on days that follow a quiet day with other days.',
      evidenceKind: 'assumed', sourceNote: 'Standard simplification for a daily backlog balance; not yet checked with the helpdesk.' },
    { id: 'as-arrivals', statement: 'Daily arrivals are independent from day to day, follow the same distribution throughout the period and do not react to the backlog.',
      rationale: 'With no evidence yet of weekly patterns or of employees raising the same ticket twice, this is the simplest description that matches the daily range.',
      consequenceIfWrong: 'If unanswered tickets are raised again, or peaks cluster around rollout waves, the backlog grows faster and varies more than the model shows, and capacity 12 may no longer stop the growth.',
      plannedCheck: 'Plot daily counts by weekday and against the previous day’s backlog; check the held-out period for rollout peaks and repeated tickets.',
      evidenceKind: 'assumed', sourceNote: 'To be tested on the ticketing-system export once real records are available.' },
    { id: 'as-capacity', statement: 'Handling capacity is constant at its nominal value: it does not fall when the backlog is high, and the new technician delivers the full 2 ticket-equivalents per day from day 1.',
      rationale: 'Keeps the comparison to a single change and avoids a feedback rule for which there is no evidence.',
      consequenceIfWrong: 'If status enquiries and interruptions slow the team at high backlog, the baseline is worse than modelled. If onboarding takes weeks, the first-period benefit of the new post is smaller.',
      plannedCheck: 'Compare tickets closed per day on high-backlog and low-backlog days; ask the team lead how long a new technician needs to reach full productivity.',
      evidenceKind: 'assumed', sourceNote: 'The team lead’s estimate is the planned source; no interview was held in this teaching case.' },
    { id: 'as-abandon', statement: 'No ticket leaves the backlog unanswered: employees do not give up or fix the problem some other way.',
      rationale: 'Most tickets concern equipment, accounts and access that only the helpdesk can change, so employees have no alternative channel.',
      consequenceIfWrong: 'If employees give up or find workarounds, the measured backlog looks better than the service really is, and the benefit of extra capacity is understated.',
      plannedCheck: 'Count tickets that were withdrawn or closed without a fix in the ticketing system; above about 5% of arrivals, add abandonment to the model.',
      evidenceKind: 'assumed', sourceNote: 'No abandonment data in the synthetic case.' },
  ];

  // ── 5 Verification and validation ────────────────────────────────────────
  p.evaluation = {
    verification: '1) Conservation: on every day, start backlog + arrivals − served − end backlog = 0; the residual is checked in every replication.\n2) Units: flows in ticket-equivalents per day, the stock in ticket-equivalents, time step one day.\n3) Balanced case: constant arrivals of 10 per day and capacity 10 from an empty start must keep the backlog at 0.\n4) Drain case: start at 20, arrivals 5 per day, capacity 10 must reach 0 at the end of day 4 and stay there.\n5) Accumulation case: constant arrivals of 12 per day and capacity 10 must give a backlog of 2 × day.\n6) Repeatability: the same seed must give the same result.',
    validation: 'Hold out the following 30 working days of daily records (arrivals, tickets closed, open tickets at closing time); they are not used to set any input. Run the baseline with the recorded arrivals of that period and compare simulated with recorded end-of-day backlog: the trend must have the same direction and the 30-day mean must lie within 20% of the recorded mean, a tolerance agreed with the stakeholder beforehand.\nExpert review: walk the service desk manager and two technicians through the daily table and ask where it contradicts their experience.\nIn this teaching case the data are synthetic, so this is the plan, not completed evidence.',
    calibration: 'Kept separate from validation. Two inputs are estimated from data: the arrival distribution and the baseline capacity, both from the first 30 working days only. The held-out period is never used for tuning. If the comparison fails, the structure is reviewed (assumptions 2 and 3) instead of adjusting capacity until the curves match.',
  };

  // ── 6 Outcomes and experiment ────────────────────────────────────────────
  p.outcomes = [
    { id: 'out-average', metric: 'Average end-of-day backlog', definition: 'Mean of the 30 end-of-day backlog values of one replication (open ticket-equivalents after the day’s handling).', unit: UNIT, direction: 'lower',
      aggregation: 'Mean over 100 replications with a 95% interval; the policy difference is taken within each pair of replications.',
      criterion: 'The alternative is worth funding if the 95% interval of the paired difference lies below zero and the reduction is at least 10 ticket-equivalents (one day of current capacity).' },
    { id: 'out-terminal', metric: 'Terminal backlog', definition: 'Open ticket-equivalents at the end of day 30.', unit: UNIT, direction: 'lower',
      aggregation: 'Mean and 5th–95th percentile over 100 replications.',
      criterion: 'Diagnostic: a terminal value well above the 30-day average shows that the backlog is still growing at the end of the period.' },
  ];
  p.experiment = {
    baseline: 'Capacity 10 ticket-equivalents per day; arrivals 8, 12 or 16 per day with probabilities 0.25, 0.5 and 0.25; initial backlog 0; no abandonment and no feedback; the helpdesk is open on each of the 30 days.',
    alternatives: 'Capacity 12 ticket-equivalents per day (one additional part-time technician); everything else as in the baseline. Triage, self-service and service hours are not simulated here; they are follow-up experiments.',
    comparison: 'Paired comparison: in each replication both policies face the same sequence of daily arrivals, so only capacity differs. The difference (alternative − baseline) is computed within each pair and summarised by its mean and an approximate 95% t interval.',
    runSettings: `Horizon 30 days, time step 1 day, 100 replications, seed “${SEED}”. Daily backlog model, engine ${ENGINE_VERSION}, random-number generator ${RNG_VERSION}.`,
  };

  // ── 7 Conclude and share ─────────────────────────────────────────────────
  p.conclusion = {
    results: 'Over 100 paired replications of 30 days, the average end-of-day backlog was about 30 ticket-equivalents at capacity 10 (95% interval of the mean roughly 28 to 32) and about 6 at capacity 12 (roughly 5 to 7). The paired difference was about −24 ticket-equivalents (95% interval roughly −25 to −23), and the alternative was lower in all 100 pairs. At capacity 10 the backlog was still growing by about 2 per day and averaged about 59 on day 30; at capacity 12 it averaged about 10 on day 30. The backlog does not vanish at capacity 12, because capacity then only equals mean arrivals and nothing is left over to clear a run of busy days. The intervals reflect random arrivals only, not uncertainty in the inputs or assumptions.',
    recommendation: 'If arrivals stay near 12 ticket-equivalents per day and the part-time technician does add about 2 per day, raising capacity to 12 is supported: within the budget it stops the steady growth of the backlog. It leaves no spare capacity, so it should be combined with a low-cost demand measure (triage or self-service) and reviewed after the first 30 working days against real counts.',
    limitations: 'The model reports the aggregate backlog only. It says nothing about individual waiting times, which is what employees complain about: a smaller backlog suggests shorter waits but does not measure them. The inputs are synthetic teaching values, not helpdesk records. Capacity is constant, all tickets count as equal effort, nobody abandons a ticket, and weekly or rollout patterns are ignored. Only the staffing lever was simulated. Validation against a held-out period is planned, not done.',
    changeConditions: 'Revisit the recommendation if: mean arrivals rise above about 12 per day (at 14 per day, capacity 12 gives the same growing backlog as today); the new technician adds less than 2 ticket-equivalents per day; more than about 5% of tickets are abandoned or raised again; the held-out comparison misses the agreed 20% tolerance; or the stakeholder needs individual waiting times, which requires a discrete-event model.',
  };

  // ── Self-check answers (never auto-graded) ───────────────────────────────
  p.selfChecks = {
    'frame-proposal': 'Observed concern: employees report slow IT support and open tickets pile up during the rollout. “Hire more staff” is a proposed solution; it is one of four levers, not the problem.',
    'frame-decide': 'If capacity 12 clearly lowers the backlog, the manager requests the part-time post. If it barely moves, the money goes to triage or self-service instead.',
    'scope-omitted': 'Hardware purchasing. If it passed on many cases during the laptop refresh, arrivals would be higher than modelled and capacity 12 would no longer stop the growth.',
    'scope-detail': 'Totals. The question asks about the average backlog, so daily aggregates are enough. Individuals would be needed only for waiting times or for fairness between departments.',
    'method-omits': 'Individual tickets, their order and their waiting times. A discrete-event model would show how long a ticket stays open and how priorities change that.',
    'method-claim': 'Support for a decision: a comparison of two capacity levels under stated assumptions, not a forecast of next quarter’s backlog.',
    'inputs-fragile': 'Mean daily arrivals. One ticket-equivalent more per day adds about 30 to the baseline backlog by day 30, roughly twice the spread between replications.',
    'inputs-assume': 'That the new technician delivers the full 2 ticket-equivalents per day. At 11 instead of 12 the backlog keeps growing by about 1 per day and the case for the post is weaker.',
    'eval-simple': 'The balanced case: arrivals of 10 per day and capacity 10 from an empty start must give a backlog of 0 on every day. The drain case must reach 0 at the end of day 4.',
    'eval-heldout': 'The second 30 working days of records, which are not used to set arrivals or capacity, plus the technicians’ judgement of the daily table.',
    'exp-fair': 'Identical: the arrival sequences, initial backlog, horizon, seed and all rules. Different: only daily capacity, 10 versus 12.',
    'exp-noise': 'By the paired difference over 100 replications: its 95% interval is far from zero and the alternative is lower in every pair, so the effect is larger than the run-to-run variation.',
    'conclude-change': 'Real ticket counts with mean arrivals above 12 per day, a held-out period the model cannot reproduce, or evidence that employees abandon tickets or raise them again.',
    'conclude-repro': 'Yes for the simulated result: inputs, horizon, replications, seed and engine version are recorded. A real study would also need the data extract and the rule for converting tickets into ticket-equivalents.',
  };

  // ── Artefacts: one copy of each kind, as the Toolbox would have added them ─
  const arrivals = p.inputs[0];
  const concept: ConceptModel = {
    objectives: 'Show how the average end-of-day backlog over 30 working days changes when daily handling capacity rises from 10 to 12 ticket-equivalents per day.',
    assumptions: 'Unused capacity is lost. Daily arrivals are independent from day to day and do not react to the backlog. Capacity is constant at its nominal value. No ticket leaves the backlog unanswered.',
    simplifications: 'Daily totals only: no individual tickets, employees or technicians. Every ticket counts as the same effort. No weekly or rollout pattern. Only the staffing lever is represented.',
    nodes: [
      { id: 'c-staff', type: 'actor', label: 'Employees and monitoring', x: 32, y: 136, zone: 'inputs' },
      { id: 'c-arrivals', type: 'variable', label: 'Daily arrivals', x: 32, y: 224, zone: 'inputs' },
      { id: 'c-capacity', type: 'lever', label: 'Daily handling capacity (10 or 12)', x: 32, y: 328, zone: 'inputs' },
      { id: 'c-techs', type: 'resource', label: 'Technicians', x: 32, y: 438, zone: 'inputs' },
      { id: 'c-backlog', type: 'stock', label: 'Open backlog', x: 416, y: 224, zone: 'content' },
      { id: 'c-handling', type: 'activity', label: 'Tickets handled per day', x: 416, y: 328, zone: 'content' },
      { id: 'c-average', type: 'outcome', label: 'Average end-of-day backlog', x: 736, y: 184, zone: 'outputs' },
      { id: 'c-terminal', type: 'outcome', label: 'Backlog on day 30', x: 736, y: 296, zone: 'outputs' },
      { id: 'c-note', type: 'note', label: 'Individual waiting times are not represented: the model follows totals.', x: 736, y: 432, zone: 'outputs' },
      // What the scope leaves out stands outside the boundary.
      { id: 'c-network', type: 'external', label: 'Network operations', x: 944, y: 136, zone: 'outside' },
      { id: 'c-purchasing', type: 'external', label: 'Hardware purchasing', x: 944, y: 212, zone: 'outside' },
    ],
    edges: [
      { id: 'ce-send', from: 'c-staff', to: 'c-arrivals', kind: 'flow', sign: '', label: 'raise tickets' },
      { id: 'ce-in', from: 'c-arrivals', to: 'c-backlog', kind: 'flow', sign: '', label: 'adds to' },
      { id: 'ce-out', from: 'c-backlog', to: 'c-handling', kind: 'flow', sign: '', label: 'is cleared by' },
      { id: 'ce-limit', from: 'c-capacity', to: 'c-handling', kind: 'influence', sign: '+', label: 'limits' },
      { id: 'ce-staff', from: 'c-techs', to: 'c-capacity', kind: 'influence', sign: '+', label: 'provide' },
      { id: 'ce-average', from: 'c-backlog', to: 'c-average', kind: 'information', sign: '', label: 'measured as' },
      { id: 'ce-terminal', from: 'c-backlog', to: 'c-terminal', kind: 'information', sign: '', label: 'measured as' },
    ],
  };
  const choice: MethodChoice = {
    answers: { ...answers }, ruleVersion: RULE_VERSION, shortlist: [...doc.methods.shortlist],
    primary: 'system-dynamics', alternative: 'des',
    justification: p.representation.justification, alternativeJustification: p.representation.alternativeJustification,
  };
  const arrivalModel: DataModel = {
    name: arrivals.name, unit: arrivals.unit,
    // Four equally weighted values give 8, 12 or 16 with probabilities 0.25, 0.5 and 0.25: the law of the input row, exactly.
    family: 'empirical', params: [8, 12, 12, 16], origin: 'described',
    provenance: `${arrivals.provenance} Written as four equally weighted values, 8, 12, 12 and 16: a quiet day (8), a typical day (12, twice as likely) and a busy day (16). These are not observations.`,
    uncertainty: arrivals.uncertainty, availability: 'obtainable', plan: arrivals.plan ?? '',
    summary: null, fit: null, generator: { seed: SEED, n: 30 }, keepData: false, data: [],
  };
  const verification: [string, string][] = [
    ['Conservation: on every day, start backlog + arrivals − served − end backlog = 0.', 'The largest residual is below 0.000000001 in all 100 replications of both policies.'],
    ['Units: flows in ticket-equivalents per day, the stock in ticket-equivalents, time step one day.', 'Read through every equation of the daily balance.'],
    ['Balanced case: constant arrivals of 10 per day and capacity 10 from an empty start keep the backlog at 0.', 'Backlog 0 on each of the 30 days.'],
    ['Drain case: start at 20, arrivals 5 per day, capacity 10 reaches 0 at the end of day 4 and stays there.', 'Backlog 15, 10, 5, 0, then 0 to day 30.'],
    ['Accumulation case: constant arrivals of 12 per day and capacity 10 give a backlog of 2 × day.', 'Backlog 2 on day 1 and 60 on day 30.'],
    ['Repeatability: the same seed gives the same result.', 'Two runs with seed “compass-example” agree in every replication.'],
  ];
  const plan: CheckPlan = {
    method: 'system-dynamics',
    checks: [
      ...verification.map(([text, evidence], i) => ({ id: `ck-verify-${i + 1}`, group: 'verification' as const, text, status: 'passed' as const, evidence })),
      { id: 'ck-validate-1', group: 'validation', status: 'planned', evidence: '',
        text: 'Run the baseline with the recorded arrivals of the held-out 30 working days and compare simulated with recorded end-of-day backlog: same direction of trend, 30-day mean within the tolerance.' },
      { id: 'ck-validate-2', group: 'validation', status: 'planned', evidence: '',
        text: 'Expert review: walk the service desk manager and two technicians through the daily table and ask where it contradicts their experience.' },
      { id: 'ck-calibrate-1', group: 'calibration', status: 'planned', evidence: '',
        text: 'Estimate the arrival distribution and the baseline capacity from the first 30 working days only. If validation fails, review the structure before changing a number.' },
    ],
    validation: { measure: 'Mean end-of-day backlog over the held-out 30 working days, simulated against recorded', tolerancePct: 20, toleranceOn: 'means', observed: [], simulated: [] },
    calibration: {
      parameters: 'Arrival distribution; baseline daily handling capacity',
      tunedOn: 'Ticketing-system records of the first 30 working days',
      validatedOn: 'The following 30 working days, which are never used for tuning',
    },
  };
  const outcomes = exampleOutcomes();
  const comparison: Comparison = {
    outcome: 'Average end-of-day backlog', unit: UNIT, direction: 'lower',
    baselineLabel: 'Capacity 10', alternativeLabel: 'Capacity 12',
    baseline: outcomes.baseline, alternative: outcomes.alternative, paired: true,
    minimumDifference: 10, targetHalfWidth: null, origin: 'imported',
    note: `Daily backlog model, engine ${ENGINE_VERSION}, random-number generator ${RNG_VERSION}, seed “${SEED}”: 30 days, 100 replications. In each replication both policies face the same sequence of daily arrivals. Synthetic teaching inputs, not helpdesk records.`,
  };
  const copy = <K extends keyof typeof EXAMPLE_COPIES>(kind: K, data: Extract<Inclusion, { kind: K }>['data']): Inclusion =>
    ({ ...EXAMPLE_COPIES[kind], sourceRevision: 1, kind, addedAt: NOW, data }) as Inclusion;
  doc.artefacts = [
    copy('concept-model', concept), copy('method-choice', choice), copy('data-model', arrivalModel), copy('check-plan', plan), copy('comparison', comparison),
  ];

  // ── Checkpoints: an honest self-review. No reviewer is named; the ratings show how to argue a level, not a mark.
  const self = (rubric: Record<string, number>, notes: string) => ({ status: 'self-reviewed' as const, feedbackSource: 'self' as const, reviewer: '', due: '', rubric, notes });
  p.review = {
    proposal: self({ question: 3, problem: 3, boundary: 2 },
      'Question: names the lever (capacity 10 → 12), the outcome with its unit, the 30-day horizon and the budget limit.\nProblem versus proposal: “hire more staff” is listed as one of four levers, not as the problem.\nBoundary is rated Developing: hardware purchasing is excluded with a reason, but how many cases it passes on has not been counted yet.'),
    design: self({ method: 3, inputs: 2, assumptions: 3 },
      'Method: the fit to an aggregate, accumulating quantity is argued, and what is left out (individual waits) is stated together with the alternative that would show it.\nInputs are rated Developing: every value has a unit and a stated uncertainty, but all of them are synthetic. No source has been checked against real records.\nAssumptions: each one has a consequence and a check that ticketing-system counts can answer.'),
    baseline: self({ verification: 3, validation: 2, separation: 3 },
      'Verification: six concrete checks, including three cases with known answers.\nValidation is rated Developing: the held-out period and the 20% tolerance are fixed in advance, but this is a plan. No comparison has been made, so it cannot be Strong.\nCalibration: the two estimated inputs and the data used for them are named, and the held-out period is kept apart.'),
    evaluation: self({ outcomes: 3, fairness: 3, reproducible: 3 },
      'Outcomes: both metrics have a computable definition, unit, direction and aggregation, and the funding criterion is fixed before the run.\nFair comparison: only capacity changes, and both policies face the same 100 arrival sequences.\nReproducibility: horizon, replications, seed, engine and generator versions are recorded.'),
    final: self({ results: 3, conditional: 3, limits: 2 },
      'Results: effect size with an interval, and a statement of what the interval does not cover.\nRecommendation: tied to two conditions and to five events that would change it.\nLimitations are rated Developing: the gap between backlog and individual waiting time is named, but how much it weakens the case for the post is not argued.'),
  };
  return doc;
}

/**
 * The reader's own, editable copy of the example: all seven steps and every artefact, a new id, and every checkpoint
 * back to draft, because the review is the reader's to do. The read-only example at `/example` stays as it is, so the
 * step guidance can still compare with it.
 */
export function workedExampleCopy(opts: { title?: string; now?: string } = {}): ProjectDoc {
  const t = opts.now ?? new Date().toISOString();
  const doc = workedExample();
  const copy: ProjectDoc = { ...doc, id: newId('prj'), createdAt: t, updatedAt: t, projectRevision: 1, origin: { kind: 'copy', ref: doc.id } };
  copy.passport.identity.title = opts.title ?? EXAMPLE_TITLE;
  for (const k of Object.keys(copy.passport.review) as CheckpointId[]) copy.passport.review[k] = { status: 'draft', notes: '', reviewer: '', feedbackSource: '', rubric: {}, due: '' };
  return copy;
}
