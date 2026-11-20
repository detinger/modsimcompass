import { RULE_VERSION, answersKey, emptyAnswers, evaluateRules, type MethodAnswers } from '../domain/methods/rules';
import { createProject, type ProjectDoc } from '../domain/passport/schema';
import { defaultConfig, ENGINE_VERSION } from '../domain/sandbox/engine';
import { runAll } from '../domain/sandbox/experiment';
import { RNG_VERSION } from '../domain/sandbox/rng';
import type { RunRecord, SandboxConfig } from '../domain/sandbox/types';

/**
 * The worked example (docs/COMPASS-SPEC.md §3): a complete passport for a university
 * student-support office with a growing backlog. Students compare their own work with it
 * step by step, so every field is written the way a good project would write it.
 *
 * All inputs are synthetic teaching values and are labelled as such. The numbers quoted
 * in the conclusion come from the sandbox run below (100 paired replications, seed
 * “compass-example”); tests/compass.test.ts recomputes them, so the text cannot drift
 * from the engine unnoticed.
 */
export const WORKED_EXAMPLE_ID = 'worked-example';
const NOW = '2026-11-21T00:00:00.000Z';
const SEED = 'compass-example';
const UNIT = 'request-equivalents';

function baselineConfig(): SandboxConfig {
  const c = defaultConfig();
  c.horizon = 30;
  c.initialBacklog = 0;
  c.demand.mode = 'random'; // default law: 8, 12 or 16 with probabilities 0.25, 0.5, 0.25
  c.capacity.mode = 'direct';
  c.capacity.direct = 10;
  c.replications = 100;
  c.seed = SEED;
  return c;
}

function alternativeConfig(): SandboxConfig {
  const c = baselineConfig();
  c.capacity.direct = 12;
  return c;
}

/** The run is deterministic, so it is computed once and cloned for every caller. */
let cachedRun: RunRecord | null = null;
function exampleRun(): RunRecord {
  cachedRun ??= runAll(baselineConfig(), alternativeConfig(), { id: 'run-example', projectId: WORKED_EXAMPLE_ID, modelRevision: 1, createdAt: NOW });
  return structuredClone(cachedRun);
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
    queues: 'simple',          // one backlog, one pool of advisors, no priorities
    spatial: 'no',
    heterogeneous: 'no',
    granularity: 'aggregate',  // totals, not individual requests
    evidence: 'time-series',   // daily counts
  };
}

export function workedExample(): ProjectDoc {
  const doc = createProject({
    title: 'Student support backlog (worked example)',
    id: WORKED_EXAMPLE_ID,
    now: NOW,
    origin: { kind: 'example', ref: WORKED_EXAMPLE_ID },
  });
  const p = doc.passport;

  // ── 1 Frame ──────────────────────────────────────────────────────────────
  p.decision = {
    stakeholder: 'The head of the student-support office at a university, who decides on staffing and opening hours within the office budget and has to justify any new post to the university management.',
    problem: 'Students complain that support is slow. Requests sent by e-mail, web form or at the desk often stay open for several days, and the number of open requests at closing time has grown during the teaching term. Management has proposed hiring; that is one possible response, not the problem itself.',
    levers: '1) Staffing: daily handling capacity, now 10 request-equivalents per day; one additional part-time advisor would raise it to about 12.\n2) Opening hours: longer desk hours on the busiest days.\n3) Triage: sort requests at intake so that simple ones are closed at once.\n4) Self-service: an FAQ and online forms that answer routine requests before they reach the office.',
    outcome: 'Average end-of-day backlog of open requests over 30 working days, in request-equivalents (one request-equivalent is the handling effort of one typical request).',
    question: 'Over 30 working days of the teaching term, how does the average end-of-day backlog (in request-equivalents) change if daily handling capacity rises from 10 to 12 request-equivalents per day, which is the most the current budget allows (one additional part-time advisor)?',
    claimType: 'decision-support',
  };

  // ── 2 Scope and concept ──────────────────────────────────────────────────
  p.scope = {
    boundary: 'Included: every request that reaches the central student-support office by e-mail, web form or walk-in, including the requests forwarded by the library desk; the advisors’ combined daily handling capacity; the backlog of open requests at the end of each day.',
    exclusions: 'IT helpdesk: it has its own staff, queue and budget, so its requests never use office capacity.\nEnrolment office: it handles enrolment and fee cases in a separate system; the few cases it passes on arrive as ordinary requests and are already counted.\nQuality and content of the answers, and the experience of individual students: the question is about the total backlog.',
    horizon: '30 working days (about six weeks of the teaching term)',
    timeUnit: 'day',
    detail: 'Aggregate. Daily totals in request-equivalents; no individual requests, students or advisors are represented.',
    constraints: 'Budget: at most one additional part-time advisor (about +2 request-equivalents per day). The ticket system cannot be changed during the term. Only aggregate daily counts are used; no personal data.',
  };
  p.representation.nodes = [
    { id: 'n-head', type: 'stakeholder', label: 'Head of support', x: 280, y: 40 },
    { id: 'n-students', type: 'entity', label: 'Students', x: 60, y: 110 },
    { id: 'n-library', type: 'entity', label: 'Library desk', x: 60, y: 210 },
    { id: 'n-arrivals', type: 'variable', label: 'Daily arrivals', x: 200, y: 160 },
    { id: 'n-backlog', type: 'variable', label: 'Open backlog', x: 340, y: 160 },
    { id: 'n-capacity', type: 'variable', label: 'Daily capacity', x: 480, y: 160 },
    { id: 'n-advisors', type: 'entity', label: 'Advisors', x: 480, y: 60 },
  ];
  p.representation.relations = [
    { id: 'r-students', from: 'n-students', to: 'n-arrivals', label: 'send requests', directed: true },
    { id: 'r-library', from: 'n-library', to: 'n-arrivals', label: 'forwards requests', directed: true },
    { id: 'r-inflow', from: 'n-arrivals', to: 'n-backlog', label: 'adds to', directed: true },
    { id: 'r-outflow', from: 'n-capacity', to: 'n-backlog', label: 'reduces', directed: true },
    { id: 'r-advisors', from: 'n-advisors', to: 'n-capacity', label: 'provide', directed: true },
    { id: 'r-staffing', from: 'n-head', to: 'n-advisors', label: 'decides staffing', directed: true },
    { id: 'r-report', from: 'n-backlog', to: 'n-head', label: 'is reported to', directed: true },
  ];
  p.representation.notes = 'One stock (open backlog) with one inflow (daily arrivals) and one outflow limited by daily capacity. The sketch names the elements; it is not the executable model.';

  // ── 3 Choose a method ────────────────────────────────────────────────────
  p.representation.primaryMethod = 'system-dynamics';
  p.representation.justification = 'The question is about an aggregate quantity that accumulates: the backlog rises with daily arrivals and falls with daily handling capacity. A stock-and-flow model with a daily time step represents exactly this balance, needs only daily totals (the evidence that is available) and keeps the units easy to check. Daily arrivals vary, so the inflow is drawn at random and the run is replicated. The method leaves out individual requests, their order and how long any single request stays open.';
  p.representation.alternativeMethod = 'des';
  p.representation.alternativeJustification = 'Discrete-event simulation would follow each request through intake and handling, so it could report individual waiting times, priorities and the effect of opening hours within a day. It needs time-stamped arrivals and handling times that are not available yet, and the stakeholder asks about the total backlog. It becomes the better choice if the question shifts to how long students wait.';
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
      provenance: 'Synthetic teaching data (ticket-system style): shaped like the daily request counts of the first 30 working days of a term, library-forwarded requests included. Not real records.',
      uncertainty: 'Daily range 8–16. The mean is the fragile part: one more request-equivalent per day adds about 30 to the baseline backlog by day 30.' },
    { id: 'in-capacity', name: 'Daily handling capacity (baseline)', value: '10', unit: `${UNIT}/day`, sourceType: 'synthetic',
      provenance: 'Synthetic teaching data (ticket-system style): typical number of requests closed per working day by the current team. Not real records.',
      uncertainty: 'About ±1 per day (absences, unusually long cases). Held constant in the model.' },
    { id: 'in-capacity-alt', name: 'Daily handling capacity with one more part-time advisor', value: '12', unit: `${UNIT}/day`, sourceType: 'assumed',
      provenance: 'Declared assumption in this synthetic teaching case: a trained part-time advisor closes about 2 request-equivalents per day.',
      uncertainty: 'Plausible range 11–13; lower during the first weeks of training. At 11 the backlog still grows by about 1 per day.' },
    { id: 'in-initial', name: 'Initial backlog', value: '0', unit: UNIT, sourceType: 'synthetic',
      provenance: 'Synthetic teaching data (ticket-system style): open requests on the first morning of the period, set to zero as after a cleared backlog. Not real records.',
      uncertainty: 'Plausible range 0–20. A higher start raises the backlog under both policies; it does not shrink the difference between them.' },
    { id: 'in-horizon', name: 'Horizon', value: '30', unit: 'working days', sourceType: 'assumed',
      provenance: 'Modelling choice for this synthetic teaching case: the period over which the stakeholder reviews the office.',
      uncertainty: 'A choice, not a measurement. With capacity below mean arrivals the backlog keeps growing, so a longer horizon gives a larger average.' },
  ];
  p.assumptions = [
    { id: 'as-lost', statement: 'Unused capacity is lost: handling time that is not needed on a quiet day cannot be saved for a later day.',
      rationale: 'Advisor hours cannot be stored, and requests can only be handled after they arrive.',
      consequenceIfWrong: 'If quiet days are used to prepare (templates, FAQ), later capacity is higher and the model overstates the backlog.',
      plannedCheck: 'Ask the advisors how slack time is used; compare the number of requests closed on days that follow a quiet day with other days.',
      evidenceKind: 'assumed', sourceNote: 'Standard simplification for a daily backlog balance; not yet checked with the office.' },
    { id: 'as-arrivals', statement: 'Daily arrivals are independent from day to day, follow the same distribution throughout the period and do not react to the backlog.',
      rationale: 'With no evidence yet of weekly patterns or of students sending the same request twice, this is the simplest description that matches the daily range.',
      consequenceIfWrong: 'If unanswered requests are sent again, or peaks cluster before deadlines, the backlog grows faster and varies more than the model shows, and capacity 12 may no longer stop the growth.',
      plannedCheck: 'Plot daily counts by weekday and against the previous day’s backlog; check the held-out period for deadline peaks and repeated requests.',
      evidenceKind: 'assumed', sourceNote: 'To be tested on the ticket-system export once real records are available.' },
    { id: 'as-capacity', statement: 'Handling capacity is constant at its nominal value: it does not fall when the backlog is high, and the new advisor delivers the full 2 request-equivalents per day from day 1.',
      rationale: 'Keeps the comparison to a single change and avoids a feedback rule for which there is no evidence.',
      consequenceIfWrong: 'If status enquiries and interruptions slow the team at high backlog, the baseline is worse than modelled. If training takes weeks, the first-period benefit of the new post is smaller.',
      plannedCheck: 'Compare requests closed per day on high-backlog and low-backlog days; ask the team lead how long a new advisor needs to reach full productivity.',
      evidenceKind: 'assumed', sourceNote: 'The team lead’s estimate is the planned source; no interview was held in this teaching case.' },
    { id: 'as-abandon', statement: 'No request leaves the backlog unanswered: students do not give up or take the request elsewhere.',
      rationale: 'Most requests concern matters only this office can settle, so students have no alternative channel.',
      consequenceIfWrong: 'If students give up, the measured backlog looks better than the service really is, and the benefit of extra capacity is understated.',
      plannedCheck: 'Count requests that were withdrawn or closed without an answer in the ticket system; above about 5% of arrivals, add abandonment to the model.',
      evidenceKind: 'assumed', sourceNote: 'No abandonment data in the synthetic case.' },
  ];

  // ── 5 Verification and validation ────────────────────────────────────────
  p.evaluation = {
    verification: '1) Conservation: on every day, start backlog + arrivals − served − end backlog = 0; the residual is checked in every replication.\n2) Units: flows in request-equivalents per day, the stock in request-equivalents, time step one day.\n3) Balanced case: constant arrivals of 10 per day and capacity 10 from an empty start must keep the backlog at 0.\n4) Drain case: start at 20, arrivals 5 per day, capacity 10 must reach 0 at the end of day 4 and stay there.\n5) Accumulation case: constant arrivals of 12 per day and capacity 10 must give a backlog of 2 × day.\n6) Repeatability: the same seed must give the same result.',
    validation: 'Hold out the following 30 working days of daily records (arrivals, requests closed, open requests at closing time); they are not used to set any input. Run the baseline with the recorded arrivals of that period and compare simulated with recorded end-of-day backlog: the trend must have the same direction and the 30-day mean must lie within 20% of the recorded mean, a tolerance agreed with the stakeholder beforehand.\nExpert review: walk the head of the office and two advisors through the daily table and ask where it contradicts their experience.\nIn this teaching case the data are synthetic, so this is the plan, not completed evidence.',
    calibration: 'Kept separate from validation. Two inputs are estimated from data: the arrival distribution and the baseline capacity, both from the first 30 working days only. The held-out period is never used for tuning. If the comparison fails, the structure is reviewed (assumptions 2 and 3) instead of adjusting capacity until the curves match.',
  };

  // ── 6 Outcomes and experiment ────────────────────────────────────────────
  p.outcomes = [
    { id: 'out-average', metric: 'Average end-of-day backlog', definition: 'Mean of the 30 end-of-day backlog values of one replication (open request-equivalents after the day’s handling).', unit: UNIT, direction: 'lower',
      aggregation: 'Mean over 100 replications with a 95% interval; the policy difference is taken within each pair of replications.',
      criterion: 'The alternative is worth funding if the 95% interval of the paired difference lies below zero and the reduction is at least 10 request-equivalents (one day of current capacity).' },
    { id: 'out-terminal', metric: 'Terminal backlog', definition: 'Open request-equivalents at the end of day 30.', unit: UNIT, direction: 'lower',
      aggregation: 'Mean and 5th–95th percentile over 100 replications.',
      criterion: 'Diagnostic: a terminal value well above the 30-day average shows that the backlog is still growing at the end of the period.' },
  ];
  p.experiment = {
    baseline: 'Capacity 10 request-equivalents per day; arrivals 8, 12 or 16 per day with probabilities 0.25, 0.5 and 0.25; initial backlog 0; no abandonment and no feedback; the office is open on each of the 30 days.',
    alternatives: 'Capacity 12 request-equivalents per day (one additional part-time advisor); everything else as in the baseline. Triage, self-service and opening hours are not simulated here; they are follow-up experiments.',
    comparison: 'Paired comparison: in each replication both policies face the same sequence of daily arrivals, so only capacity differs. The difference (alternative − baseline) is computed within each pair and summarised by its mean and an approximate 95% t interval.',
    runSettings: `Horizon 30 days, time step 1 day, 100 replications, seed “${SEED}”. Backlog sandbox, engine ${ENGINE_VERSION}, random-number generator ${RNG_VERSION}.`,
  };

  // ── 7 Conclude and share ─────────────────────────────────────────────────
  p.conclusion = {
    results: 'Over 100 paired replications of 30 days, the average end-of-day backlog was about 30 request-equivalents at capacity 10 (95% interval of the mean roughly 28 to 32) and about 6 at capacity 12 (roughly 5 to 7). The paired difference was about −24 request-equivalents (95% interval roughly −25 to −23), and the alternative was lower in all 100 pairs. At capacity 10 the backlog was still growing by about 2 per day and averaged about 59 on day 30; at capacity 12 it averaged about 10 on day 30. The backlog does not vanish at capacity 12, because capacity then only equals mean arrivals and nothing is left over to clear a run of busy days. The intervals reflect random arrivals only, not uncertainty in the inputs or assumptions.',
    recommendation: 'If arrivals stay near 12 request-equivalents per day and the part-time advisor does add about 2 per day, raising capacity to 12 is supported: within the budget it stops the steady growth of the backlog. It leaves no spare capacity, so it should be combined with a low-cost demand measure (triage or self-service) and reviewed after the first 30 working days against real counts.',
    limitations: 'The model reports the aggregate backlog only. It says nothing about individual waiting times, which is what students complain about: a smaller backlog suggests shorter waits but does not measure them. The inputs are synthetic teaching values, not office records. Capacity is constant, all requests count as equal effort, nobody abandons a request, and weekly or deadline patterns are ignored. Only the staffing lever was simulated. Validation against a held-out period is planned, not done.',
    changeConditions: 'Revisit the recommendation if: mean arrivals rise above about 12 per day (at 14 per day, capacity 12 gives the same growing backlog as today); the new advisor adds less than 2 request-equivalents per day; more than about 5% of requests are abandoned or sent again; the held-out comparison misses the agreed 20% tolerance; or the stakeholder needs individual waiting times, which requires a discrete-event model.',
  };

  // ── Self-check answers (never auto-graded) ───────────────────────────────
  p.selfChecks = {
    'frame-proposal': 'Observed concern: students report slow support and open requests pile up during term. “Hire more staff” is a proposed solution; it is one of four levers, not the problem.',
    'frame-decide': 'If capacity 12 clearly lowers the backlog, the head requests the part-time post. If it barely moves, the money goes to triage or self-service instead.',
    'scope-omitted': 'The enrolment office. If it passed on many cases during enrolment weeks, arrivals would be higher than modelled and capacity 12 would no longer stop the growth.',
    'scope-detail': 'Totals. The question asks about the average backlog, so daily aggregates are enough. Individuals would be needed only for waiting times or for fairness between students.',
    'method-omits': 'Individual requests, their order and their waiting times. A discrete-event model would show how long a request stays open and how priorities change that.',
    'method-claim': 'Support for a decision: a comparison of two capacity levels under stated assumptions, not a forecast of next term’s backlog.',
    'inputs-fragile': 'Mean daily arrivals. One request-equivalent more per day adds about 30 to the baseline backlog by day 30, roughly twice the spread between replications.',
    'inputs-assume': 'That the new advisor delivers the full 2 request-equivalents per day. At 11 instead of 12 the backlog keeps growing by about 1 per day and the case for the post is weaker.',
    'eval-simple': 'The balanced case: arrivals of 10 per day and capacity 10 from an empty start must give a backlog of 0 on every day. The drain case must reach 0 at the end of day 4.',
    'eval-heldout': 'The second 30 working days of records, which are not used to set arrivals or capacity, plus the advisors’ judgement of the daily table.',
    'exp-fair': 'Identical: the arrival sequences, initial backlog, horizon, seed and all rules. Different: only daily capacity, 10 versus 12.',
    'exp-noise': 'By the paired difference over 100 replications: its 95% interval is far from zero and the alternative is lower in every pair, so the effect is larger than the run-to-run variation.',
    'conclude-change': 'Real ticket counts with mean arrivals above 12 per day, a held-out period the model cannot reproduce, or evidence that students abandon requests or send them again.',
    'conclude-repro': 'Yes for the sandbox result: inputs, horizon, replications, seed and engine version are recorded. A real study would also need the data extract and the rule for converting requests into request-equivalents.',
  };

  // ── Sandbox: baseline 10 vs alternative 12, same arrival sequences ───────
  doc.sandbox = { baseline: baselineConfig(), alternative: alternativeConfig(), lastRun: exampleRun() };

  // Review checkpoints stay ‘draft’ with empty rubrics: the example is not pre-graded.
  return doc;
}
