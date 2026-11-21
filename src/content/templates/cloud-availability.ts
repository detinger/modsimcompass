import type { ProjectTemplate } from './types';

/**
 * Cloud operations, discrete-time chain: four service states, an hourly transition matrix estimated from pooled logs of
 * six alike services, two affordable improvements read as changed probabilities and compared at steady state. The
 * duration records show which states look memoryless and which do not. All numbers are synthetic teaching values.
 */
export const cloudAvailability: ProjectTemplate = {
  id: 'cloud-availability',
  title: 'Service availability',
  area: 'Cloud operations',
  pitch: 'An order service keeps going down: buy a standby replica or a 24/7 on-call rota?',
  data: 'Incident and monitoring logs',
  shows: [
    'Four service states with hourly transitions',
    'Outage lengths that are not memoryless',
    'Each option as changed probabilities, a fragile ranking',
  ],
  content: {
    // ── 1 Frame ────────────────────────────────────────────────────────────
    decision: {
      stakeholder: 'The site-reliability lead of an online retailer’s order platform, who must meet the 99.9% monthly availability target agreed with the business and has a fixed budget for next quarter that pays for one reliability improvement, not both.',
      problem: 'The order API missed its 99.9% target in 4 of the last 12 months, and while it is down no customer can place an order. Outages start when a lost node escalates or when a fault hits the whole service, and night-time outages wait for someone to notice. Engineers each argue for their own fix; the problem is the downtime, not the lack of a particular fix.',
      levers: '1) Standby replica with automatic failover: takes over a lost node’s load, lowering Degraded → Down (now 0.02 per hour).\n2) 24/7 on-call rota with runbooks: shortens repair, raising Down → Healthy (now 0.5 per hour) and Degraded → Healthy (now 0.25 per hour).\n3) Release practice: fewer faulty deployments that take the service straight from Healthy to Down.\n4) Maintenance practice: fewer or shorter planned windows.',
      outcome: 'Long-run availability: the share of hours the order API is not Down, in percent, against the 99.9% monthly target (at most 43.8 minutes Down in a 730-hour month); also reported as expected downtime in minutes per month.',
      question: 'At steady state, read as a typical 730-hour month, which option gives the order API the higher availability (%) and the lower expected downtime (minutes per month): a standby replica that lowers Degraded → Down from 0.02 to 0.005 per hour, or a 24/7 on-call rota that raises Down → Healthy from 0.5 to 0.8 and Degraded → Healthy from 0.25 to 0.35 per hour? Does either meet the 99.9% target?',
      claimType: 'decision-support',
    },

    // ── 2 Concept and scope ────────────────────────────────────────────────
    scope: {
      boundary: 'Included: the order API as one service, running on a two-node cluster at the cloud provider, in four states: Healthy; Degraded (one node lost or slow, orders still accepted); Down (orders fail); Planned maintenance (rolling work, orders still accepted, so it counts as available). Also included: the hour-to-hour moves between these states, as the monitoring system records them, and the on-call rota that answers its alerts.',
      exclusions: 'Payment, stock and storefront services: they have their own targets and teams; their faults count only when the order API itself fails.\nShared-cause failures as a cause of their own: a faulty release or a regional fault that stops both nodes at once shows only as Healthy → Down; the model does not track causes.\nCost of downtime and lost orders: either option fits the fixed budget, so the choice turns on availability.\nIndividual nodes, requests and response times: the question is about the state of the whole service.',
      horizon: 'Long run (steady state), read as a typical 730-hour month; the chosen option runs from next quarter for about a year.',
      timeUnit: 'hour',
      detail: 'Aggregate service state, one label per hour: the monitoring system’s minute checks are reduced to the state the service spent most of the hour in. No nodes, requests or individual engineers are represented. One matrix for the order API, estimated from it and 5 services built the same way.',
      constraints: 'Next quarter’s budget pays for one improvement only. The order API alone had too few outages to estimate from, so 24 months of logs from 6 services built the same way (two nodes, same monitoring, same office-hours support) are pooled: months 1–18 for estimation, months 19–24 kept for validation. Service-state data only; no customer or order records.',
    },

    // ── 3 Representation and method ────────────────────────────────────────
    representation: {
      primaryMethod: 'markov-chains',
      alternativeMethod: 'des',
      justification: 'The question is where the service spends its time in the long run, and the logs describe exactly that: four named states and the moves between them, hour by hour. A discrete-time chain with an hourly 4 × 4 transition matrix gives long-run availability directly from its stationary distribution, and each option changes one or two named probabilities, so the comparison is transparent. Long-run shares depend on the mean time spent in each state, not on the shape of those times, so the answer holds even where stays are not memoryless. The method leaves out history: how long an outage has already lasted, the hour of day and which node failed do not change the next step.',
      alternativeJustification: 'Discrete-event simulation would follow each node failure, failover and repair as a timed event, so outage lengths could keep their lognormal shape, failover could take minutes or fail, maintenance could sit on its fixed monthly slot, and both nodes could fail from one cause. It needs time distributions per node and per cause, and 48 pooled outages are too few to split that way. It becomes the better choice if the shape of outage lengths, not only their mean, drives the answer (for example month-to-month risk of missing the target), or if failures cluster.',
      notes: 'Four states and their main moves. Maintenance → Down (2 of 108 windows) is in the 4 × 4 matrix but not drawn. The replica acts on one move (Degraded → Down), the on-call rota on two (Down → Healthy and Degraded → Healthy). Availability and downtime are read from the long-run share of Down, mean time to recovery from Down → Healthy.',
    },

    // ── 4 Parameters ───────────────────────────────────────────────────────
    // The three duration records and the three option values are data models (artefacts below); only the counted
    // probabilities and the maintenance calendar are written here.
    inputs: [
      { id: 'in-base', name: 'Base transition probabilities, unplanned moves', value: 'Healthy → Degraded 0.004, Healthy → Down 0.0003; Degraded → Healthy 0.25, Degraded → Down 0.02; Down → Healthy 0.5 (what is left of each row stays put)', unit: 'per hour', sourceType: 'synthetic',
        provenance: 'Read from the three synthetic duration records of this step (months 1–18, 6 services pooled, 78,840 service-hours): each leaving chance is 1 ÷ mean length, split by counted destination. Synthetic teaching values, not real records.',
        uncertainty: 'Firm where many moves count: Healthy → Degraded (310 moves, 95% interval about 0.0036–0.0045) and Degraded → Healthy (287). Healthy → Down and Degraded → Down rest on 23 moves each (about 0.0002–0.00045 and 0.013–0.030); Down → Healthy on 48 outages (about 0.35–0.8).',
        availability: 'obtainable', plan: 'Recount from the real export with the same rule before the Design checkpoint; the SRE lead’s team confirms each escalation in the incident notes.' },
      { id: 'in-maint', name: 'Planned maintenance', value: 'Healthy → Maintenance 0.0014; Maintenance → Healthy 0.5; Maintenance → Down 0.01 (Maintenance → Maintenance 0.49)', unit: 'per hour', sourceType: 'synthetic',
        provenance: 'Synthetic teaching values shaped like a change calendar: 108 windows in months 1–18 for the 6 services (one per service a month), about 2 hours each; 2 of them ended in an outage. Not real records.',
        uncertainty: 'Windows are scheduled, so their rate and length are firm. The failure chance rests on 2 events (plausible 0.001–0.03 per hour); neither option changes it, so it shifts both scenarios alike.',
        availability: 'obtainable', plan: 'Change calendar from the platform team for the same 18 months; match each window with the incident log.' },
    ],
    assumptions: [
      { id: 'as-memoryless', statement: 'The next hour’s state depends only on the current state: how long the service has already been Degraded or Down does not change its chance of recovering in the next hour.',
        rationale: 'This is what lets four states and one matrix describe the service. Long-run shares depend only on the mean time in each state, so the base availability holds even if the lengths are not memoryless.',
        consequenceIfWrong: 'If hard faults wait hours for an expert while easy ones clear fast, outage lengths have a long tail: the mean still gives the right base availability, but the on-call option, which mainly cuts that tail, may be misjudged.',
        plannedCheck: 'Fit the outage, Degraded and Healthy-run lengths and compare the exponential (the continuous form of the chain’s geometric stay) with other shapes; then compare the share of episodes ending in the next hour after 0, 1, 2 and 3 hours. A roughly constant share supports the assumption.',
        evidenceKind: 'assumed', sourceNote: 'The defining assumption of the method. The synthetic records support it for Degraded episodes and Healthy runs, not for outages; real logs must be checked the same way.' },
      { id: 'as-pooled', statement: 'The order API moves between states like the 5 other services built the same way, so one matrix estimated from all 6 describes it.',
        rationale: 'Same two-node design, monitoring and office-hours support; the order API alone had about 8 outages in the 18 estimation months, too few to estimate from.',
        consequenceIfWrong: 'If the order API, which carries the most traffic, degrades or fails more often than the others, pooled probabilities understate its downtime and both options look better than they are.',
        plannedCheck: 'Estimate the order API’s own rows from its months 1–18 and check that each lies inside the pooled row’s 95% interval; where one does not, use the order API’s own value and repeat the comparison.',
        evidenceKind: 'assumed', sourceNote: 'Modelling choice for this synthetic teaching case, forced by the small number of outages of one service.' },
      { id: 'as-homogeneous', statement: 'Transition probabilities are the same in every hour: day and night, weekday and weekend, and in every month of the year.',
        rationale: 'One matrix keeps the model small and lets all 78,840 estimation service-hours feed each probability.',
        consequenceIfWrong: 'Repair is slower at night today, so one averaged Down → Healthy hides the very difference the on-call rota is meant to remove. Sales peaks may raise Healthy → Degraded just when downtime costs most.',
        plannedCheck: 'Estimate Down → Healthy and Degraded → Healthy separately for office hours and out of hours; if they differ by more than a factor of 2, use one matrix per period.',
        evidenceKind: 'assumed', sourceNote: 'Simplification for the first model; the split by hour of day is planned on the estimation months.' },
      { id: 'as-independent', statement: 'Failures are independent: the standby replica does not fail at the same time and for the same reason as the node it replaces, and one incident does not set off the next.',
        rationale: 'The replica runs in a separate zone of the cloud provider, so a single host or zone fault should not reach both.',
        consequenceIfWrong: 'Shared causes (a faulty deployment, a configuration change, a regional fault) hit both nodes, so failover stops fewer escalations and 0.005 per hour is too optimistic.',
        plannedCheck: 'Classify each outage in the logs by cause; if more than about a third would also have reached the replica, set the failover value to 0.012, the top of its range, and repeat the comparison.',
        evidenceKind: 'expert', sourceNote: 'Platform team’s judgement on zone separation; not checked against real records in this synthetic case.' },
      { id: 'as-hourly', statement: 'One-hour steps are fine enough: the chain moves once an hour, and each hour gets the state the service spent most of its minutes in.',
        rationale: 'The logs are kept hourly and the target is monthly; a finer step would add matrix entries without adding evidence.',
        consequenceIfWrong: 'Outages of 30 minutes or less (18 of the 48 outage records) vanish from hourly labels and longer ones are rounded, so counts from labels can be off by tens of minutes a month, close to the 43.8-minute budget itself. Outage lengths are therefore taken from the incident log’s minutes.',
        plannedCheck: 'For the 18 estimation months, compare downtime minutes from the minute checks with Down hours × 60; if they differ by more than 20%, move to a 15-minute step.',
        evidenceKind: 'assumed', sourceNote: 'Modelling choice for this synthetic teaching case.' },
    ],

    // ── 6 Outcomes ─────────────────────────────────────────────────────────
    outcomes: [
      { id: 'out-availability', metric: 'Long-run availability', definition: 'Share of hours not in Down under the stationary distribution: 1 minus the long-run share of Down.', unit: '%', direction: 'higher',
        aggregation: 'Steady state of the hourly chain; one value per scenario, plus its range when each uncertain probability is set to the ends of its range.',
        criterion: 'Meets the target at 99.9% or more. The option with higher availability is preferred if it stays ahead across the plausible ranges.' },
      { id: 'out-downtime', metric: 'Expected downtime per month', definition: 'Long-run share of Down × 730 hours × 60 minutes.', unit: 'minutes per month', direction: 'lower',
        aggregation: 'Steady state: the mean of a typical month, not a worst month.',
        criterion: 'At most 43.8 minutes. A gap under about 5 minutes between the options counts as a tie, given the wide expert ranges behind both option values.' },
      { id: 'out-mttr', metric: 'Mean time to recovery', definition: 'Expected length of a Down episode: 1 ÷ (Down → Healthy).', unit: 'hours', direction: 'lower',
        aggregation: 'Computed from the transition probability; one value per scenario.',
        criterion: 'Diagnostic: shows whether an option wins through fewer outages or through shorter ones.' },
    ],

    // ── 5 Verification and validation ──────────────────────────────────────
    evaluation: {
      verification: '1) Every row of the four transition matrices (base, failover, on-call, both) sums to 1 within 1e-9, and every entry lies between 0 and 1.\n2) Two hours forward from all-Healthy, by hand and in code: Degraded 0.0069 and Down 0.00054.\n3) Long-run shares from 10,000 hourly steps agree with the solved stationary distribution to 6 decimals; they settle only if no state traps the chain.\n4) Known answer: a two-state chain with Up → Down 0.001 and Down → Up 0.5 per hour gives availability 0.5 ÷ 0.501 = 99.80%.\n5) Units: every entry is a chance per one-hour step; downtime = share of Down × 730 × 60 minutes; mean time to recovery = 1 ÷ (Down → Healthy) hours.',
      validation: '1) Held-out prediction: from the matrix estimated on months 1–18, predict months 19–24 of the 6 services and compare with the logs. Degraded episodes (about 103 expected) must fall within ±20%, agreed with the SRE lead beforehand; outages (about 16) and downtime (about 1,930 minutes) are too few for a tight test and are reported beside it.\n2) Memory: in the outage and Degraded records, compare the share ending in the next hour after 0, 1, 2 and 3 hours; a falling share means the state hides memory.\n3) Expert review: walk the SRE lead and two on-call engineers through the states and the base matrix, and note anything that contradicts what they see. The data are synthetic, so this is the plan, not completed evidence.',
      calibration: 'Nothing is tuned. Each base probability is estimated on months 1–18 as moves out of a state divided by the hours spent in it, with the number of moves behind it recorded (fewest: 23 escalations, 23 direct outages, 2 failed windows). Months 19–24 set no probability and are used only for the held-out prediction. The option values are expert ranges, varied in step 6, never fitted.',
    },

    // ── 6 Scenario analysis ────────────────────────────────────────────────
    experiment: {
      baseline: 'Today’s set-up, office-hours support and no replica. Per hour: Healthy → Degraded 0.004, Healthy → Down 0.0003, Healthy → Maintenance 0.0014; Degraded → Healthy 0.25, Degraded → Down 0.02; Down → Healthy 0.5; Maintenance → Healthy 0.5, Maintenance → Down 0.01.',
      alternatives: '1) Failover: Degraded → Down 0.005 per hour, the most likely value of its range; everything else as in the base.\n2) On-call: Down → Healthy 0.8 and Degraded → Healthy 0.35 per hour, the most likely values of their ranges; everything else as in the base.\n3) Both: the two changes together, as a reference for a later budget, not an option this quarter.',
      comparison: 'Availability (%), expected downtime (minutes per month) and mean time to recovery at steady state for each scenario, and the gap between failover and on-call. Sensitivity: each uncertain probability is set to the ends of its range, one at a time (the triangular ranges of step 4 for the option values, the 95% intervals for the base values), to see whether the ranking of the two options changes and which probability flips it.',
      runSettings: 'Each scenario’s stationary distribution is solved as a linear system (stationary vector times matrix equals itself, entries summing to 1) and confirmed by 10,000 hourly steps from all-Healthy. Time step one hour; a month is 730 hours. No randomness in the model, so no replications or seed. The solver and its software version are recorded with the results.',
    },
  },

  artefacts: {
    // ── 2 Conceptual model ─────────────────────────────────────────────────
    concept: {
      title: 'Service availability: conceptual model',
      data: {
        objectives: 'Compare the order API’s long-run availability and monthly downtime under a standby replica and under 24/7 on-call cover, against the 99.9% target.',
        assumptions: 'The next hour’s state depends only on the current state, in every hour alike. The replica fails independently of the node it replaces.',
        simplifications: 'Four states for the whole service, one label per hour: no nodes, requests or causes. One matrix estimated from 6 services built the same way.',
        nodes: [
          { id: 'c-replica', type: 'lever', label: 'Standby replica', x: 24, y: 224, zone: 'inputs' },
          { id: 'c-cover', type: 'lever', label: '24/7 on-call cover', x: 24, y: 344, zone: 'inputs' },
          { id: 'c-healthy', type: 'stock', label: 'Healthy', x: 296, y: 128, zone: 'content' },
          { id: 'c-maint', type: 'stock', label: 'Planned maintenance', x: 192, y: 256, zone: 'content' },
          { id: 'c-degraded', type: 'stock', label: 'Degraded', x: 568, y: 136, zone: 'content' },
          { id: 'c-rota', type: 'resource', label: 'On-call rota', x: 200, y: 438, zone: 'content' },
          { id: 'c-down', type: 'stock', label: 'Down', x: 440, y: 320, zone: 'content' },
          { id: 'c-monitor', type: 'entity', label: 'Monitoring system', x: 440, y: 432, zone: 'content' },
          { id: 'c-availability', type: 'outcome', label: 'Availability (%)', x: 744, y: 144, zone: 'outputs' },
          { id: 'c-downtime', type: 'outcome', label: 'Downtime (minutes per month)', x: 744, y: 280, zone: 'outputs' },
          { id: 'c-mttr', type: 'outcome', label: 'Mean time to recovery (hours)', x: 744, y: 408, zone: 'outputs' },
          { id: 'c-shared', type: 'external', label: 'Shared-cause failures', x: 944, y: 60, zone: 'outside' },
        ],
        edges: [
          { id: 'ce-degrade', from: 'c-healthy', to: 'c-degraded', kind: 'flow', sign: '', label: 'node lost or slow' },
          { id: 'ce-recover', from: 'c-degraded', to: 'c-healthy', kind: 'flow', sign: '', label: 'recovers' },
          { id: 'ce-escalate', from: 'c-degraded', to: 'c-down', kind: 'flow', sign: '', label: 'escalates' },
          { id: 'ce-fail', from: 'c-healthy', to: 'c-down', kind: 'flow', sign: '', label: 'fails outright' },
          { id: 'ce-repair', from: 'c-down', to: 'c-healthy', kind: 'flow', sign: '', label: 'repaired' },
          { id: 'ce-maint', from: 'c-healthy', to: 'c-maint', kind: 'flow', sign: '', label: 'planned work' },
          { id: 'ce-maint-done', from: 'c-maint', to: 'c-healthy', kind: 'flow', sign: '', label: 'work done' },
          { id: 'ce-replica', from: 'c-replica', to: 'c-down', kind: 'influence', sign: '-', label: 'stops escalations' },
          { id: 'ce-cover', from: 'c-cover', to: 'c-rota', kind: 'decides', sign: '', label: 'extends to all hours' },
          { id: 'ce-rota-down', from: 'c-rota', to: 'c-down', kind: 'influence', sign: '-', label: 'repairs sooner' },
          { id: 'ce-rota-degraded', from: 'c-rota', to: 'c-degraded', kind: 'influence', sign: '-', label: 'fixes sooner' },
          { id: 'ce-detect', from: 'c-down', to: 'c-monitor', kind: 'information', sign: '', label: 'detected by' },
          { id: 'ce-alert', from: 'c-monitor', to: 'c-rota', kind: 'information', sign: '', label: 'alerts' },
          { id: 'ce-availability', from: 'c-down', to: 'c-availability', kind: 'information', sign: '', label: '1 − share of hours' },
          { id: 'ce-downtime', from: 'c-down', to: 'c-downtime', kind: 'information', sign: '', label: 'share × 730 h × 60' },
          { id: 'ce-mttr', from: 'c-down', to: 'c-mttr', kind: 'information', sign: '', label: 'mean length' },
        ],
      },
    },

    // ── 3 Method choice ────────────────────────────────────────────────────
    method: {
      title: 'Service availability: method choice',
      answers: {
        claim: 'compare', time: 'dynamic', latent: 'no', observedRelations: 'no', concurrency: 'no', uncertainInputs: 'no',
        finiteStates: 'yes', feedback: 'no', queues: 'none', spatial: 'no', heterogeneous: 'no', granularity: 'aggregate', evidence: 'event-log',
      },
    },

    // ── 4 Parameters: three duration records and three option values ──────
    data: [
      {
        title: 'Service availability: outage length', name: 'Outage length (time in Down)', unit: 'hours',
        source: 'synthetic', truth: { family: 'lognormal', params: [0.193, 1] }, seed: 'cloud-outage-68', n: 48, decimals: 2,
        provenance: 'Synthetic teaching values drawn by the template (seed cloud-outage-68), not real records. They stand for the 48 outages of months 1–18 of the 6 pooled services, timed from the incident log’s start and end minute. Down → Healthy = 1 ÷ mean length: 48 outages in 94 Down hours give 0.51 per hour, used as 0.5.',
        uncertainty: 'Lognormal fits best by a wide margin; the exponential, the memoryless shape the chain assumes, is 14 AIC points behind. The longer an outage lasts, the less likely it ends in the next hour: 27 of 48 ended in the first hour, but only 3 of the 13 still open after two hours ended in the third. Long-run shares depend only on the mean (1.96 hours, 95% interval about 1.2–2.8), so the base value holds; the on-call rota mainly shortens the long tail, so judge its effect there.',
        availability: 'obtainable', plan: 'Export the start and end minute of every outage in months 1–18 from the incident log, and check each against the monitoring system’s minute checks before the Design checkpoint.',
      },
      {
        title: 'Service availability: Degraded episode length', name: 'Degraded episode length', unit: 'hours',
        source: 'synthetic', truth: { family: 'exponential', params: [0.27] }, seed: 'cloud-degraded-62', n: 310, decimals: 2,
        provenance: 'Synthetic teaching values drawn by the template (seed cloud-degraded-62), not real records. They stand for the 310 Degraded episodes of months 1–18 of the 6 pooled services. Leaving Degraded = 1 ÷ mean length = 0.27 per hour, split by counted endings: 287 recovered (Degraded → Healthy 0.25) and 23 escalated (Degraded → Down 0.02).',
        uncertainty: 'Exponential fits best; gamma and Weibull, which contain it, gain nothing (about 2 AIC points behind, the price of an extra parameter). A fifth to a quarter of the episodes still open end in each hour, whatever their age, so the memoryless assumption holds here. Escalation rests on 23 events (95% interval about 0.013–0.030), and it is the very probability the replica acts on.',
        availability: 'obtainable', plan: 'Same export from the monitoring system; check each escalation in the incident notes to confirm the service really went from Degraded to Down.',
      },
      {
        title: 'Service availability: Healthy run between incidents', name: 'Healthy run between incidents', unit: 'hours',
        source: 'synthetic', truth: { family: 'exponential', params: [0.0043] }, seed: 'cloud-healthy-8', n: 333, decimals: 1,
        provenance: 'Synthetic teaching values drawn by the template (seed cloud-healthy-8), not real records. They stand for the Healthy hours before each of the 333 unplanned incidents of months 1–18 of the 6 pooled services, maintenance hours not counted. Leaving Healthy unplanned = 1 ÷ mean = 0.0043 per hour, split by counted destination: 310 to Degraded (0.004) and 23 straight to Down (0.0003).',
        uncertainty: 'Exponential fits best; gamma and Weibull add nothing, so incidents arrive at a steady rate with no sign that one sets off the next. Healthy → Degraded is firm (95% interval about 0.0036–0.0045). Healthy → Down rests on 23 moves (about 0.0002–0.00045); at its top, base downtime rises by about a quarter.',
        availability: 'obtainable', plan: 'Hourly state labels and incident starts for months 1–18 from the monitoring system; the SRE lead’s team counts the moves before the Design checkpoint.',
      },
      {
        title: 'Service availability: failover effect', name: 'Degraded → Down with a standby replica', unit: 'per hour',
        source: 'described', family: 'triangular', params: [0.002, 0.005, 0.012], evidence: 'expert',
        provenance: 'Expert judgement in this synthetic teaching case, not records: the platform team expects automatic failover to stop about 3 in 4 escalations, because the replica takes over the lost node’s load. Most likely 0.005 per hour, a quarter of today’s 0.02.',
        uncertainty: 'Plausible 0.002–0.012: failover stops 40–90% of escalations. Shared causes that reach both nodes push it towards the top of the range.',
        availability: 'assume', plan: 'No replica exists yet. The platform team runs 20 failover drills in the test environment before the decision meeting and counts how many finish without an outage.',
      },
      {
        title: 'Service availability: on-call repair', name: 'Down → Healthy with 24/7 on-call', unit: 'per hour',
        source: 'described', family: 'triangular', params: [0.6, 0.8, 0.9], evidence: 'expert',
        provenance: 'Expert judgement in this synthetic teaching case, not records: with someone on call at all hours, every outage gets today’s office-hours response. Most likely 0.8 per hour (mean outage 1.25 hours, from 2).',
        uncertainty: 'Plausible 0.6–0.9. Runbooks take time to mature, so the first quarter may sit at the low end. Outage lengths are not memoryless, so test this value on the long out-of-hours outages the rota mainly shortens.',
        availability: 'assume', plan: 'Estimate Down → Healthy from the office-hours outages of months 1–18 as a proxy; ask the on-call engineers how much runbooks would shorten out-of-hours repair.',
      },
      {
        title: 'Service availability: on-call recovery from Degraded', name: 'Degraded → Healthy with 24/7 on-call', unit: 'per hour',
        source: 'described', family: 'triangular', params: [0.3, 0.35, 0.4], evidence: 'expert',
        provenance: 'Expert judgement in this synthetic teaching case, not records: an engineer on call fixes a lost or slow node sooner at night and at weekends. Most likely 0.35 per hour (mean Degraded episode about 2.7 hours, from 3.7).',
        uncertainty: 'Plausible 0.30–0.40. It matters less than the repair value: it shortens Degraded episodes, and only through them the escalations to Down.',
        availability: 'assume', plan: 'Estimate Degraded → Healthy from the office-hours episodes of months 1–18 as a proxy.',
      },
    ],

    // ── 5 Check plan ───────────────────────────────────────────────────────
    checks: {
      title: 'Service availability: check plan',
      data: {
        method: 'markov-chains',
        checks: [
          { id: 'std-mk-rows', group: 'verification', status: 'planned', evidence: '',
            text: 'Check every row of the four transition matrices (base, failover, on-call, both) sums to 1 within 1e-9, with every entry between 0 and 1.' },
          { id: 'std-mk-two-steps', group: 'verification', status: 'planned', evidence: '',
            text: 'Multiply the state shares forward two hours from all-Healthy, by hand and in code, and compare: Degraded 0.0069 and Down 0.00054.' },
          { id: 'std-mk-long-run', group: 'verification', status: 'planned', evidence: '',
            text: 'Compare long-run shares from 10,000 hourly steps with the solved stationary distribution: they must agree to 6 decimals, which they do only if no state traps the chain.' },
          { id: 'std-g-known-answer', group: 'verification', status: 'planned', evidence: '',
            text: 'Run a two-state case with a known answer: Up → Down 0.001 and Down → Up 0.5 per hour must give availability 0.5 ÷ 0.501 = 99.80%.' },
          { id: 'std-g-units', group: 'verification', status: 'planned', evidence: '',
            text: 'Check units: every entry is a chance per one-hour step; downtime = share of Down × 730 × 60 minutes; mean time to recovery = 1 ÷ (Down → Healthy) hours.' },
          { id: 'std-g-held-out', group: 'validation', status: 'planned', evidence: '',
            text: 'Predict months 19–24 of the 6 services from the matrix estimated on months 1–18 and compare with the logs: Degraded episodes (about 103) within the tolerance; outages (about 16) and downtime (about 1,930 minutes) reported beside it.' },
          { id: 'std-mk-memory', group: 'validation', status: 'planned', evidence: '',
            text: 'Check from the outage and Degraded records whether time already spent changes the chance of leaving: compare the share ending in the next hour after 0, 1, 2 and 3 hours.' },
          { id: 'std-g-expert', group: 'validation', status: 'planned', evidence: '',
            text: 'Walk the SRE lead and two on-call engineers through the four states and the base matrix, and note any move or value that contradicts what they see.' },
          { id: 'std-mk-counts', group: 'calibration', status: 'planned', evidence: '',
            text: 'Estimate each base probability on months 1–18 as moves out of a state ÷ hours spent in it, and record how many moves each rests on (fewest: 23 escalations, 23 direct outages, 2 failed windows).' },
          { id: 'std-e-data-aside', group: 'calibration', status: 'planned', evidence: '',
            text: 'Keep months 19–24 aside: they set no probability and serve only the held-out prediction. The option values are expert ranges, never fitted.' },
        ],
        validation: { measure: 'Degraded episodes in months 19–24, 6 services together: logged count against the base chain’s prediction', tolerancePct: 20, toleranceOn: 'means', observed: [], simulated: [] },
        calibration: {
          parameters: 'The 8 base transition probabilities: leaving Healthy, Degraded, Down and Planned maintenance',
          tunedOn: 'Monitoring and incident logs of months 1–18, 6 services pooled (78,840 service-hours)',
          validatedOn: 'Months 19–24 of the same 6 services (26,280 service-hours), used only for the held-out prediction',
        },
      },
    },
  },
};
