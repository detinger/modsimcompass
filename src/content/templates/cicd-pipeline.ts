import type { ProjectTemplate } from './types';

/**
 * Template: lead time through a shared CI/CD pipeline at the late-morning peak. Discrete-event simulation, decision
 * support. All numbers are synthetic teaching values: the “records” behind the data models are drawn by the template.
 */
const T = 'Build pipeline lead time';
const SYNTHETIC = 'Synthetic teaching values drawn by this template, not real records:';

export const cicdPipeline: ProjectTemplate = {
  id: 'cicd-pipeline',
  title: T,
  area: 'DevOps',
  pitch: 'Merges wait too long to become deploy-ready at peak hours: more build agents or one more test environment?',
  data: 'Pipeline event logs',
  shows: [
    'Merges queueing for two shared resources',
    'Poisson arrivals, fitted stage times, flaky retries',
    'Paired runs with common random numbers',
  ],
  content: {
    // ── 1 Frame ────────────────────────────────────────────────────────────
    decision: {
      stakeholder: 'The platform team lead at a mid-sized software company (about 60 developers), who decides how the pipeline’s infrastructure budget is spent and must show the head of engineering that the money shortens developers’ waiting. This quarter the budget covers one capacity option, not both.',
      problem: 'Developers say merged changes take too long, and too unpredictably, to become deploy-ready: about 30 minutes for an early-morning merge, but often over 90 minutes for one made between 10:00 and 12:00, just before stand-ups and release cut-offs. The wait holds up hotfixes and releases. “Buy more build agents” is the usual demand; it is one lever, not the problem.',
      levers: '1) Build agents: now 4; the budget allows 2 more.\n2) Test environments: now 3; the budget allows 1 more (or splitting the integration suite to run in parallel).\n3) Priority lane: hotfix merges go to the front of every queue.\n4) Build caching: reuse dependencies and compiled modules to shorten builds.',
      outcome: '90th percentile of merge-to-deploy-ready lead time over the working hours of one week, in minutes (nine in ten merges are ready within this time).',
      question: 'Over one working week (Monday to Friday, merges from 08:00 to 18:00), which lowers the 90th percentile merge-to-deploy-ready lead time (in minutes) more: adding 2 build agents (4 → 6) or adding 1 test environment (3 → 4), the two options the budget allows at about the same monthly cost?',
      claimType: 'decision-support',
    },

    // ── 2 Concept and scope ────────────────────────────────────────────────
    scope: {
      boundary: 'Included: every merge to the main branch of all repositories built by the shared CI server, from the merge event to the deploy-ready artefact: the wait for and run of build plus unit tests on a build agent, the wait for and run of integration tests on a test environment, the reset of the environment after each run, automatic retries of flaky integration runs, and genuine failures that stop a merge.',
      exclusions: 'Code review and pre-merge checks: they happen before the merge and run on a separate agent pool with its own budget.\nDeployment to production: it starts after deploy-ready and follows the release schedule, not the pipeline.\nMerges outside 08:00–18:00 and at weekends (under 5%): they meet an empty pipeline and are not what developers complain about.',
      horizon: 'One working week: 5 days of merges from 08:00 to 18:00, each day run until the last merge leaves the pipeline',
      timeUnit: 'minute',
      detail: 'Individual merges (jobs) moving through two stages with limited resources; each arrival, start, end, retry and failure is an event. What is inside a job (code, test cases, causes of failure) is not represented: only durations and outcomes.',
      constraints: 'Budget: one of the two options this quarter, at about the same monthly cost. The stage order (build and unit tests, then integration tests) stays fixed. Only pipeline event logs are used: time stamps and outcomes, no source code and no developer names.',
    },

    // ── 3 Choose a method ──────────────────────────────────────────────────
    representation: {
      primaryMethod: 'des',
      alternativeMethod: 'queueing-theory',
      justification: 'The question is about the tail of individual lead times, and that tail is made at the late-morning peak, when jobs queue for two shared, limited resources. Discrete-event simulation follows each merge through both queues, with a peak and an off-peak arrival rate, stage times fitted from the logs, flaky retries, environment resets and genuine failures, and reports the whole lead-time distribution for each option. It leaves out what happens inside a job and any change in how developers behave when the pipeline is slow.',
      alternativeJustification: 'Steady-state queueing formulas give each stage’s average wait from average rates and utilisation. At average load (about 53% of build-agent time and 63% of test-environment time) they predict short waits and miss the peak, when the agents run at about 88% and the environments at about 105%: for two hours they cannot keep up. They also miss retries, the finite working day and the 90th percentile of the whole path. They are the better choice for a quick first screening of many capacity options, or if merges arrived at a steady rate all day.',
      notes: 'Each merge is a job that waits for a build agent, then for a test environment; its lead time is the sum of waits and work. A flaky integration run sends it back to the end of the same queue. After each run the environment is reset, which keeps it busy but adds nothing to the merge’s lead time. The sketch names the elements; it is not the executable model.',
    },

    // ── 4 Inputs and assumptions ───────────────────────────────────────────
    // The six uncertain inputs are data models (artefacts.data); these rows are the configuration and the options.
    inputs: [
      { id: 'in-config', name: 'Baseline pipeline configuration', value: '4 build agents and 3 test environments, available from 08:00 until the pipeline is empty; one first-come, first-served queue per stage; a flaky integration run is retried automatically at most twice, then counts as failed', unit: 'agents, environments', sourceType: 'synthetic',
        provenance: 'Synthetic teaching values for the pipeline configuration of a mid-sized software company. Not a real configuration.',
        uncertainty: 'Known exactly from the configuration. An agent or environment taken offline for maintenance is not represented.',
        availability: 'have' },
      { id: 'in-genuine', name: 'Genuine failures', value: '3 in 100 merges fail build or unit tests, and 2 in 100 of the rest fail integration tests; the merge leaves, not deploy-ready (its fix comes back as a new merge, already in the arrival counts)', unit: 'share of merges', sourceType: 'synthetic',
        provenance: 'Synthetic teaching values, shaped like the failure outcomes recorded per job. Not real records.',
        uncertainty: 'Shares of 0.02–0.05 per stage are plausible. They change the load by a few percent only, so they are kept as fixed shares rather than data models.',
        availability: 'obtainable', plan: 'Count failed jobs per stage in weeks 1–4 of the event-log export; at the integration stage, a failure is genuine only when the same commit also fails on retry.' },
      { id: 'in-options', name: 'Capacity options within budget', value: 'A: 6 build agents, 3 test environments. B: 4 build agents, 4 test environments', unit: 'agents, environments', sourceType: 'assumed',
        provenance: 'Declared assumption in this synthetic teaching case: both options cost about the same per month, and a new agent or environment is as fast as the existing ones from day 1.',
        uncertainty: 'A new test environment may be slower at first (cold caches, smaller test database); if its runs take 20% longer, option B gains less.',
        availability: 'assume', plan: 'Ask the platform team for a quote and setup time for each option, and time a trial run on a new environment before the Evaluation checkpoint.' },
    ],
    assumptions: [
      { id: 'as-arrivals', statement: 'Merges arrive at random (Poisson) at one rate from 10:00 to 12:00 and one rate in the other working hours, the same on every working day and independent of how congested the pipeline is.',
        rationale: 'A merge follows an approved review, which is one of many small independent decisions; the two rates capture the late-morning peak.',
        consequenceIfWrong: 'If developers hold back merges when the pipeline is slow, or batch them just before release cut-offs, the peak is flatter or sharper than modelled and the lead-time tail is misjudged for both options.',
        plannedCheck: 'In weeks 1–4, compare hourly counts across weekdays and hours: within each rate, the variance of the counts should be about equal to their mean, and no hour outside 10:00–12:00 should stand out. Look for clusters before release cut-offs.',
        evidenceKind: 'assumed', sourceNote: 'Usual description of independent arrivals; to be tested on the merge time stamps.' },
      { id: 'as-durations', statement: 'Stage times do not depend on how busy the pipeline is: a build takes as long with 6 agents running as with 1.',
        rationale: 'Each agent and environment has its own compute, and nothing yet points to a slowdown at the peak.',
        consequenceIfWrong: 'If the agents share a network link or artefact store that slows down under load, builds lengthen exactly at the peak and extra agents help less than modelled: option A is overstated.',
        plannedCheck: 'Plot build time against the number of busy agents at job start in weeks 1–4; a rising trend means stage time must depend on load.',
        evidenceKind: 'assumed', sourceNote: 'Not yet checked; the logs record busy agents per job, so the check is possible.' },
      { id: 'as-retries', statement: 'An integration run fails flakily with a fixed probability, independently of other runs, and a retried run re-joins the back of the same queue. Flaky failures at the build stage are rare and left out.',
        rationale: 'This is how the CI server is set to retry, and flaky tests are not tied to a particular merge.',
        consequenceIfWrong: 'If flaky failures rise when the environments are busy (time-outs under load), the peak is worse than modelled and an extra test environment helps more than modelled.',
        plannedCheck: 'Independent failures make the gaps between flaky failures geometric: the data model tests this. Also compare flaky rates in peak and off-peak hours in weeks 1–4; a clear difference means the probability must depend on load.',
        evidenceKind: 'assumed', sourceNote: 'The retry rule comes from the pipeline configuration; independence is a declared assumption.' },
      { id: 'as-discipline', statement: 'Each stage serves jobs first-come, first-served from one shared queue, and any free agent or environment can take any job.',
        rationale: 'There is no hotfix lane today, and the agents and environments are configured alike.',
        consequenceIfWrong: 'If some repositories need a particular environment, the pool behaves like several smaller pools that queue more, and the model looks better than reality for every option.',
        plannedCheck: 'Look for job-to-agent labels in the pipeline configuration; count in the logs how often a job waited while an environment stood free.',
        evidenceKind: 'assumed', sourceNote: 'The platform team’s description of the configuration is the planned source; no interview was held in this teaching case.' },
    ],

    // ── 6 Outcomes (defined before the experiment) ─────────────────────────
    outcomes: [
      { id: 'out-p90', metric: '90th percentile lead time', definition: 'Merge-to-deploy-ready time of every merge made Monday to Friday, 08:00–18:00, that ends deploy-ready; the 90th percentile of these (about 380) values in one simulated week.', unit: 'min', direction: 'lower',
        aggregation: 'Mean over replications with a 95% interval; the difference between options is taken within each replication.',
        criterion: 'Team target: at most 60 min. Recommend the option whose P90 is lower by at least 5 min, with the 95% interval of the paired difference excluding zero; if neither meets 60 min, report that this budget alone does not reach the target.' },
      { id: 'out-peak', metric: 'Peak-hour 90th percentile', definition: 'The same percentile, only for merges made between 10:00 and 12:00 (about 125 deploy-ready per week).', unit: 'min', direction: 'lower',
        aggregation: 'Mean and 5th–95th percentile over replications.',
        criterion: 'Diagnostic: shows whether an option helps where developers complain. An option that lowers the weekly P90 but not this one mainly helps off-peak hours.' },
      { id: 'out-queue', metric: 'Peak queue per stage', definition: 'Largest number of jobs waiting for a build agent, and for a test environment, on each day; averaged over the five days.', unit: 'jobs', direction: 'lower',
        aggregation: 'Mean over replications, reported per stage.',
        criterion: 'Diagnostic: shows whether an option removes waiting or only moves it from one stage to the other.' },
    ],

    // ── 5 Verification and validation (the check plan below writes the same, check by check) ──
    evaluation: {
      verification: '1) Units: all times in minutes; hourly rates converted to merges per minute in one place.\n2) Count merges: at the end of each day, merges arrived = deploy-ready + stopped by a genuine failure; none may remain in the pipeline.\n3) Known answer: one build agent, Poisson arrivals of 3 per hour, exponential build time with mean 12 min, no other stage and no failures must give a long-run mean wait near 18 min, utilisation 0.6 and on average 1.5 jobs in the system (0.05 per minute × 30 min, the flow balance).\n4) Extreme cases: with 50 agents and 50 environments, fixed times (build 16, tests 11, reset 2 min) and no failures, every lead time is exactly 27 min, because the reset adds nothing to a merge; with no arrivals, nothing happens.\n5) Trace one job: print every event of a merge with one flaky retry and check order and times by hand.\n6) The same seed (“cicd-week”) gives the same result.',
      validation: '1) Week 5 of the logs is held out: nothing is fitted or tuned on it. Run the baseline with its recorded merge times and compare daily P90 lead time with the recorded days: within 15% on average over the five days, and the integration queue longest in the same hours (10:00–12:00). Tolerances are agreed with the platform team lead beforehand.\n2) Two developers and the platform team lead review one simulated day’s trace for anything that contradicts their experience.\nWith synthetic data this is the plan, not completed evidence.',
      calibration: 'Kept separate from validation. Fitted or counted from weeks 1–4: both arrival rates, the build and integration-test time laws, the flaky-failure probability and the genuine-failure shares. Tuned on weeks 1–4 only: the unlogged environment reset time (start 2 min, plausible 1–4 min), until simulated and recorded mean waits for a test environment agree. If validation then fails, revisit the assumptions rather than the reset time.',
    },

    // ── 6 Experiment ───────────────────────────────────────────────────────
    experiment: {
      baseline: '4 build agents and 3 test environments; merges Monday to Friday 08:00–18:00 at the fitted rates (about 13.3 per hour from 10:00 to 12:00 and 6.7 per hour otherwise); fitted build and integration-test times; an environment reset after each run; flaky integration runs retried at most twice; genuine failures as in the inputs; first-come, first-served at both stages; no hotfix lane and no build caching.',
      alternatives: 'A) +2 build agents: 6 agents, 3 test environments.\nB) +1 test environment: 4 agents, 4 test environments.\nBoth cost about the same per month and the budget covers one; everything else as in the baseline. The hotfix lane and build caching are follow-up experiments: caching changes the build-time law and needs its own data.',
      comparison: 'Common random numbers: in each replication the baseline, A and B get the same merge times and, per merge, the same stage-time, reset and failure draws (one random stream for each), so only capacity differs. The weekly P90 lead time decides; the difference A − B is taken within each replication, with its mean and a 95% t interval. Precision target: half-width at most 2 min. Robustness: rerun with a peak rate of 10 and of 16 merges per hour, and a reset of 1 and of 4 min; report whether the ranking holds.',
      runSettings: 'One working week: five days of merges from 08:00 to 18:00, each day run until the last merge leaves. No warm-up: the real pipeline starts each day empty (a terminating simulation). 30 replications to start, more until the precision target is met; seed “cicd-week”; time unit minute. Record the engine version and random-number generator with the results.',
    },
  },

  artefacts: {
    // ── 2 Conceptual model ────────────────────────────────────────────────
    concept: {
      title: `${T}: conceptual model`,
      data: {
        objectives: 'Compare the 90th percentile merge-to-deploy-ready time over one working week for option A (6 build agents) and option B (4 test environments), and see where merges wait at the 10:00–12:00 peak.',
        assumptions: 'Merges arrive at random, about 13 per hour at the peak and 7 otherwise; stage times do not depend on load. Flaky runs fail independently and re-join the queue.',
        simplifications: 'Only durations and outcomes: no code or test cases. One first-come, first-served queue per stage, no hotfix lane or caching; genuine failures are fixed shares.',
        nodes: [
          { id: 'c-devs', type: 'actor', label: 'Developers', x: 24, y: 240, zone: 'inputs' },
          { id: 'c-option', type: 'lever', label: 'Capacity option', x: 24, y: 496, zone: 'inputs' },
          { id: 'c-jobs', type: 'entity', label: 'Merge jobs', x: 192, y: 136, zone: 'content' },
          { id: 'c-agents', type: 'resource', label: 'Build agents', x: 264, y: 408, zone: 'content' },
          { id: 'c-buildq', type: 'stock', label: 'Build queue', x: 432, y: 136, zone: 'content' },
          { id: 'c-build', type: 'activity', label: 'Build and unit tests', x: 264, y: 272, zone: 'content' },
          { id: 'c-testq', type: 'stock', label: 'Integration queue', x: 528, y: 272, zone: 'content' },
          { id: 'c-tests', type: 'activity', label: 'Integration tests', x: 536, y: 400, zone: 'content' },
          { id: 'c-envs', type: 'resource', label: 'Test environments', x: 352, y: 496, zone: 'content' },
          { id: 'c-diag', type: 'outcome', label: 'Peak-hour P90, queue peaks', x: 736, y: 176, zone: 'outputs' },
          { id: 'c-p90', type: 'outcome', label: 'P90 lead time', x: 736, y: 496, zone: 'outputs' },
          { id: 'c-deploy', type: 'external', label: 'Deployment to production', x: 944, y: 376, zone: 'outside' },
        ],
        edges: [
          { id: 'ce-merge', from: 'c-devs', to: 'c-jobs', kind: 'flow', sign: '', label: 'merge' },
          { id: 'ce-join', from: 'c-jobs', to: 'c-buildq', kind: 'flow', sign: '', label: 'join' },
          { id: 'ce-start-build', from: 'c-buildq', to: 'c-build', kind: 'flow', sign: '', label: 'take a free agent' },
          { id: 'ce-agents', from: 'c-agents', to: 'c-build', kind: 'influence', sign: '+', label: 'run' },
          { id: 'ce-pass', from: 'c-build', to: 'c-testq', kind: 'flow', sign: '', label: 'pass on' },
          { id: 'ce-start-test', from: 'c-testq', to: 'c-tests', kind: 'flow', sign: '', label: 'start' },
          { id: 'ce-retry', from: 'c-tests', to: 'c-testq', kind: 'flow', sign: '', label: 'retry' },
          { id: 'ce-envs', from: 'c-envs', to: 'c-tests', kind: 'influence', sign: '+', label: 'run tests, then reset' },
          { id: 'ce-a', from: 'c-option', to: 'c-agents', kind: 'decides', sign: '', label: 'sets A: 4 → 6' },
          { id: 'ce-b', from: 'c-option', to: 'c-envs', kind: 'decides', sign: '', label: 'sets B: 3 → 4' },
          { id: 'ce-time', from: 'c-tests', to: 'c-p90', kind: 'information', sign: '', label: 'times each merge' },
          { id: 'ce-peak-build', from: 'c-buildq', to: 'c-diag', kind: 'information', sign: '', label: 'measured at peak' },
          { id: 'ce-peak-test', from: 'c-testq', to: 'c-diag', kind: 'information', sign: '', label: 'measured at peak' },
          { id: 'ce-ready', from: 'c-tests', to: 'c-deploy', kind: 'flow', sign: '', label: 'hand over when ready' },
        ],
      },
    },

    // ── 3 Method choice ───────────────────────────────────────────────────
    method: {
      title: `${T}: method choice`,
      answers: {
        claim: 'compare', time: 'dynamic', latent: 'no', observedRelations: 'no', concurrency: 'no', uncertainInputs: 'yes',
        finiteStates: 'no', feedback: 'no', queues: 'detailed', spatial: 'no', heterogeneous: 'no', granularity: 'individual', evidence: 'event-log',
      },
    },

    // ── 4 Data: one data model per uncertain input ────────────────────────
    data: [
      {
        title: `${T}: merges per hour at the peak`,
        name: 'Merges per hour, 10:00–12:00', unit: 'merges/hour',
        source: 'synthetic', truth: { family: 'poisson', params: [13] }, seed: 'cicd-arrivals-peak', n: 40, decimals: 0,
        provenance: `${SYNTHETIC} 40 hourly merge counts (2 peak hours on each of 20 working days, weeks 1–4), shaped like the merge time stamps a CI server logs.`,
        uncertainty: 'Poisson fits best by AIC, with lognormal and gamma close behind on only 40 counts; the variance is about equal to the mean, as random arrivals give. Between weeks the peak rate may range from about 10 to 16, and at 13 the test environments are already overloaded: the most fragile input.',
        availability: 'obtainable',
        plan: 'The platform team exports merge time stamps for five working weeks from the CI server event log before the Design checkpoint; count merges per clock hour in weeks 1–4 (week 5 is held out).',
      },
      {
        title: `${T}: merges per hour off-peak`,
        name: 'Merges per hour, other working hours', unit: 'merges/hour',
        source: 'synthetic', truth: { family: 'poisson', params: [6.5] }, seed: 'cicd-arrivals-offpeak', n: 160, decimals: 0,
        provenance: `${SYNTHETIC} 160 hourly merge counts for 08:00–10:00 and 12:00–18:00 (8 hours on each of 20 working days, weeks 1–4), shaped like CI server merge time stamps.`,
        uncertainty: 'Poisson fits best by AIC (mean about 6.7, variance about equal to the mean). One rate for all eight hours assumes no second peak; the pipeline is about half loaded then, so a small one would matter little.',
        availability: 'obtainable',
        plan: 'From the same export: count merges per clock hour outside 10:00–12:00 in weeks 1–4, and compare the hours with each other before pooling them.',
      },
      {
        title: `${T}: build and unit-test time`,
        name: 'Build and unit-test time per merge', unit: 'min',
        source: 'synthetic', truth: { family: 'lognormal', params: [2.726, 0.3053] }, seed: 'cicd-build', n: 400, decimals: 1,
        provenance: `${SYNTHETIC} 400 build-job durations (start to end on a build agent, in minutes), shaped like a sample from the build logs of weeks 1–4.`,
        uncertainty: 'Lognormal fits best by AIC, gamma next (about 6 points behind). Mean about 16 min; about 1 build in 20 takes over 25 min. The long builds come from cold dependency caches, so build caching (lever 4) would change this whole law, not only its mean.',
        availability: 'obtainable',
        plan: 'Sample 400 build jobs from weeks 1–4 of the export and check the fit with a quantile plot.',
      },
      {
        title: `${T}: integration-test time`,
        name: 'Integration-test time per run', unit: 'min',
        source: 'synthetic', truth: { family: 'lognormal', params: [2.35, 0.31] }, seed: 'cicd-integration', n: 400, decimals: 1,
        provenance: `${SYNTHETIC} 400 integration-test runs (start to end of the tests, in minutes), shaped like the test-stage logs of weeks 1–4. The environment reset after each run is not in these logs.`,
        uncertainty: 'Gamma fits best by AIC; lognormal is close behind (about 1 point), so either would serve. Mean about 11 min. A retried run is assumed to take as long as a first run.',
        availability: 'obtainable',
        plan: 'Sample 400 runs from weeks 1–4 of the export; compare first runs with retries before pooling them.',
      },
      {
        title: `${T}: environment reset time`,
        name: 'Environment reset time per run', unit: 'min',
        source: 'described', family: 'triangular', params: [1, 2, 4], evidence: 'expert',
        provenance: 'Expert judgement in this synthetic teaching case, not measured: the platform team’s estimate of at least 1, most likely 2, at most 4 min. The reset is not in the logs.',
        uncertainty: 'The one unobserved input. It keeps an environment busy (about 2.3 of every 13 busy minutes) but adds nothing to a merge’s lead time. Tuned in calibration within 1–4 min.',
        availability: 'assume',
        plan: 'Tune on weeks 1–4 until simulated and recorded mean waits for a test environment agree; time a few resets by hand to confirm the range.',
      },
      {
        title: `${T}: flaky integration runs`,
        name: 'Integration runs between two flaky failures', unit: 'runs',
        source: 'synthetic', truth: { family: 'geometric', params: [0.1] }, seed: 'cicd-flaky-runs', n: 160, decimals: 0,
        provenance: `${SYNTHETIC} 160 gaps, each the number of clean integration runs between two flaky failures (failures that pass on automatic retry), shaped like the run outcomes of weeks 1–4.`,
        uncertainty: 'Geometric fits best by AIC, as independent failures with a fixed probability give; exponential is next. Its probability (about 0.10) is the chance that a run fails flakily, drawn per run. Weekly rates of 0.05–0.15 are plausible; each retry adds a full run and re-joins the queue, so flakiness stretches the tail more than the mean.',
        availability: 'obtainable',
        plan: 'Count clean runs between flaky failures in weeks 1–4; call a failure flaky when the same commit passes on retry.',
      },
    ],

    // ── 5 Check plan ──────────────────────────────────────────────────────
    checks: {
      title: `${T}: check plan`,
      data: {
        method: 'des',
        checks: [
          { id: 'ck-verify-1', group: 'verification', status: 'planned', evidence: '',
            text: 'Check units on every input and event time: all times in minutes, hourly rates converted to merges per minute in one place.' },
          { id: 'ck-verify-2', group: 'verification', status: 'planned', evidence: '',
            text: 'Count merges: at the end of each day, merges arrived equals deploy-ready plus stopped by a genuine failure, with none left in the pipeline.' },
          { id: 'ck-verify-3', group: 'verification', status: 'planned', evidence: '',
            text: 'Compare a single-server case with the queueing formula: one build agent, 3 merges per hour, exponential builds with mean 12 min and no other stage must give a mean wait near 18 min, utilisation 0.6 and 1.5 jobs in the system on average.' },
          { id: 'ck-verify-4', group: 'verification', status: 'planned', evidence: '',
            text: 'Push capacity to an extreme: with 50 agents and 50 environments, fixed times (build 16, tests 11, reset 2 min) and no failures, every lead time is exactly 27 min; with no arrivals, nothing happens.' },
          { id: 'ck-verify-5', group: 'verification', status: 'planned', evidence: '',
            text: 'Trace one merge with one flaky retry through the event list and check the order and times of its events by hand.' },
          { id: 'ck-verify-6', group: 'verification', status: 'planned', evidence: '',
            text: 'Repeat a run with seed “cicd-week” and confirm identical output.' },
          { id: 'ck-validate-1', group: 'validation', status: 'planned', evidence: '',
            text: 'Run the baseline with the recorded merge times of week 5 (held out) and compare daily P90 lead time with the recorded days; the integration queue must also be longest in the same hours (10:00–12:00).' },
          { id: 'ck-validate-2', group: 'validation', status: 'planned', evidence: '',
            text: 'Show one simulated day’s trace to two developers and the platform team lead, and note anything that contradicts their experience.' },
          { id: 'ck-calibrate-1', group: 'calibration', status: 'planned', evidence: '',
            text: 'Fit both arrival rates, both stage-time laws, the flaky-failure probability and the genuine-failure shares on weeks 1–4 only; set week 5 aside for validation.' },
          { id: 'ck-calibrate-2', group: 'calibration', status: 'planned', evidence: '',
            text: 'Tune only the environment reset time (start 2 min, plausible 1–4 min) until simulated and recorded mean waits for a test environment agree on weeks 1–4; if validation then fails, revisit the assumptions, not the reset.' },
        ],
        validation: { measure: 'Daily P90 lead time in week 5 (held out), Monday to Friday: recorded against simulated (mean over replications)', tolerancePct: 15, toleranceOn: 'pairs', observed: [], simulated: [] },
        calibration: {
          parameters: 'Environment reset time, the only tuned value (start 2 min, plausible 1–4 min); every other input is fitted or counted from the logs',
          tunedOn: 'Event logs of weeks 1–4: the mean wait for a test environment',
          validatedOn: 'Week 5 of the logs, never used for fitting or tuning',
        },
      },
    },
  },
};
