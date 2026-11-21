import type { ConceptModel } from '../../domain/artefacts/types';
import type { ProjectTemplate } from './types';

/**
 * Project template: phishing that spreads along an organisation’s internal e-mail network. Agent-based model,
 * decision support, steps 1 to 6. All numbers are synthetic teaching values and are labelled as such.
 */

// ── Conceptual model (step 2): one picture of the agents, the loop and the three options ──
const concept: ConceptModel = {
  objectives: 'Compare how three options change the chance that phishing reaches any of the 30 privileged accounts within 72 hours of a campaign, and how many accounts it compromises on the way.',
  assumptions: 'Internal phishing goes only to the sender’s real contacts. Each employee decides on each e-mail independently. A report leads to a lock after a random delay. The network does not change within 72 hours.',
  simplifications: 'Messages are counted, never read. One campaign, hourly steps, three states per account. What the attacker does after a privileged compromise, and other ways in, are left out.',
  nodes: [
    { id: 'c-campaign', type: 'variable', label: 'External campaign: 150 e-mails', x: 24, y: 144, zone: 'inputs' },
    { id: 'c-network', type: 'variable', label: 'E-mail network: contacts per account', x: 24, y: 248, zone: 'inputs' },
    { id: 'c-option', type: 'lever', label: 'Option funded: 1, 2 or 3', x: 24, y: 424, zone: 'inputs' },
    { id: 'c-emails', type: 'entity', label: 'Phishing e-mails', x: 344, y: 144, zone: 'content' },
    { id: 'c-staff', type: 'actor', label: 'Employees (800 accounts)', x: 344, y: 248, zone: 'content' },
    { id: 'c-compromised', type: 'stock', label: 'Compromised accounts', x: 560, y: 248, zone: 'content' },
    { id: 'c-soc', type: 'resource', label: 'Security operations', x: 344, y: 416, zone: 'content' },
    { id: 'c-locked', type: 'stock', label: 'Locked accounts', x: 560, y: 416, zone: 'content' },
    { id: 'c-privileged', type: 'outcome', label: 'Privileged compromise within 72 h', x: 736, y: 144, zone: 'outputs' },
    { id: 'c-count', type: 'outcome', label: 'Accounts compromised by hour 72', x: 736, y: 416, zone: 'outputs' },
    { id: 'c-filter', type: 'external', label: 'E-mail filtering', x: 944, y: 144, zone: 'outside' },
    { id: 'c-after', type: 'external', label: 'Attacker actions after a privileged compromise', x: 944, y: 416, zone: 'outside' },
  ],
  edges: [
    { id: 'ce-deliver', from: 'c-campaign', to: 'c-emails', kind: 'flow', sign: '', label: 'delivers' },
    { id: 'ce-route', from: 'c-network', to: 'c-emails', kind: 'information', sign: '', label: 'gives recipients' },
    { id: 'ce-reach', from: 'c-emails', to: 'c-staff', kind: 'flow', sign: '', label: 'reach' },
    { id: 'ce-click', from: 'c-staff', to: 'c-compromised', kind: 'flow', sign: '', label: 'click' },
    { id: 'ce-loop', from: 'c-compromised', to: 'c-emails', kind: 'influence', sign: '+', label: 'send more phishing' },
    { id: 'ce-report', from: 'c-staff', to: 'c-soc', kind: 'information', sign: '', label: 'report' },
    { id: 'ce-lock', from: 'c-compromised', to: 'c-locked', kind: 'flow', sign: '', label: 'are locked' },
    { id: 'ce-soc', from: 'c-soc', to: 'c-locked', kind: 'decides', sign: '', label: 'locks' },
    { id: 'ce-opt-staff', from: 'c-option', to: 'c-staff', kind: 'decides', sign: '', label: '1, 2: lower clicks' },
    { id: 'ce-opt-signin', from: 'c-option', to: 'c-compromised', kind: 'influence', sign: '-', label: '2: blocks sign-in' },
    { id: 'ce-opt-soc', from: 'c-option', to: 'c-soc', kind: 'decides', sign: '', label: '3: locks sooner' },
    { id: 'ce-privileged', from: 'c-compromised', to: 'c-privileged', kind: 'information', sign: '', label: 'checked for privileged' },
    { id: 'ce-count', from: 'c-compromised', to: 'c-count', kind: 'information', sign: '', label: 'counted' },
    { id: 'ce-after', from: 'c-privileged', to: 'c-after', kind: 'influence', sign: '+', label: 'opens the way to' },
  ],
};


export const phishingSpread: ProjectTemplate = {
  id: 'phishing-spread',
  title: 'Phishing spread',
  area: 'Cybersecurity',
  pitch: 'One click, then internal phishing along the e-mail network. Which option best shields privileged accounts?',
  data: 'E-mail network, exercises, tickets',
  shows: [
    'Agents on a network with hubs and roles',
    'A yes/no outcome: any privileged account hit',
    'Three options compared on common random numbers',
  ],
  content: {
    // ── 1 Frame ──────────────────────────────────────────────────────────────
    decision: {
      stakeholder: 'The chief information security officer of an organisation with about 800 employees, who has one budget for new security measures next year, enough for one of three options, and must explain the choice to the management board.',
      problem: 'Phishing campaigns get past the e-mail filter several times a year. One click can hand an account to the attacker, who then sends convincing internal phishing to that person’s contacts and works towards administrator and finance accounts. Spread follows who e-mails whom, so a few well-connected people matter most. “Train everyone” is one possible response, not the problem itself.',
      levers: '1) Awareness training for all 800 employees: lowers the click probability a little for everyone and raises reporting.\n2) Targeted training plus phishing-resistant multi-factor authentication for 110 accounts: the 30 privileged accounts and the 80 most connected others (assistants, team leads).\n3) Faster detection and response: 24-hour on-call and an automatic lock after two reports, cutting the median time from report to lock from 6 hours to 1 hour, and the median time to detection when nobody reports from 36 hours to 12.\nEach option takes about the whole budget, so only one is funded.',
      outcome: 'Probability that at least one of the 30 privileged accounts is compromised within 72 hours of a campaign start (share of replications), and the number of accounts compromised by hour 72 (accounts). The first decides; the second breaks ties.',
      question: 'Over the 72 hours after a phishing campaign reaches 150 inboxes, by how many percentage points does the probability that at least one of the 30 privileged accounts is compromised fall, compared with today, under 1) training for all 800 employees, 2) targeted training plus phishing-resistant multi-factor authentication for 110 accounts, or 3) a median time from report to lock of 1 hour instead of 6, and how does each option change the number of accounts compromised by hour 72?',
      claimType: 'decision-support',
    },

    // ── 2 Concept and scope ──────────────────────────────────────────────────
    scope: {
      boundary: 'Included: the 800 employee accounts of the e-mail system, the internal network of who e-mails whom, one external campaign and the internal phishing it triggers, staff reports, and account locks by the security operations team. 30 accounts are privileged: 12 IT administrators and 18 finance staff who approve payments.',
      exclusions: 'Attacker actions after a privileged compromise (data theft, ransomware, fraudulent payments): the question stops at that event, which is the one to prevent.\nE-mail filtering: the same under every option, so it only sets how many campaign e-mails get through.\nOther ways in (password reuse, stolen session tokens, technical exploits): the same under every option.\nExternal partners and personal devices: outside the organisation’s accounts.',
      horizon: '72 hours from the moment the external campaign reaches the first inbox',
      timeUnit: 'hour',
      detail: 'Individual. Each account is an agent with a role, a department, its contacts and one state: susceptible, compromised or locked. Messages are counted, never read.',
      constraints: 'Budget: one of the three options next year, each of similar cost. Privacy: only anonymised, aggregated network data (pseudonymous ids, role, department, message counts per pair); no message content, subjects or names, and the extract needs the data protection officer’s approval. The model must fit on one page for the board.',
    },

    // ── 2 and 3 Sketch and method ────────────────────────────────────────────
    representation: {
      notes: 'The loop compromised accounts → phishing e-mails → employees → compromised accounts is the internal spread along the network. Reports lead security operations to lock accounts, which cuts the loop. The options act at different places: 1 on clicks and reports, 2 on clicks and sign-in for 110 accounts, 3 on locks and detection. The sketch names the elements; it is not the executable model.',
      primaryMethod: 'abm',
      justification: 'The question turns on who is connected to whom: spread follows the e-mail network, hubs (assistants, team leads, IT and finance staff) pass phishing on far more than others, and the three options act on different people. An agent-based model with one agent per account, its role, contacts and state represents exactly this, and “any privileged account hit” is an event about specific accounts. Clicks, reports and lock times are random, so runs are replicated. The method leaves out message content, what the attacker does after a privileged compromise, and any change in behaviour during the 72 hours.',
      alternativeMethod: 'system-dynamics',
      alternativeJustification: 'A stock-and-flow model with three stocks (susceptible, compromised, locked) and average click, report and lock rates would be simpler, faster to build and easy to show the board. It assumes everyone mixes evenly, so it loses the network, the hubs and the differences between roles, and cannot tell protecting 110 key accounts from training everyone. It is the better choice if only the faster-response option is on the table, or if no network data can be obtained.',
    },

    // ── 4 Inputs and assumptions ─────────────────────────────────────────────
    // Rows written by hand: structure and design settings. Every distribution is a data model (artefacts.data below).
    inputs: [
      { id: 'in-roles', name: 'Accounts, roles and role factors',
        value: '800 accounts in 12 departments; 30 privileged: 12 IT administrators and 18 finance approvers. Click probability = department click rate × role factor: assistants 1.5, team leads 0.9, finance approvers 1.1, IT administrators 0.4, everyone else 1. Report rate × 2.5 for IT administrators.',
        unit: 'accounts; multipliers', sourceType: 'synthetic',
        provenance: 'Synthetic teaching values, shaped like a directory extract (role and department per pseudonymous id) and the split by role of past simulated-phishing exercises. Not real records.',
        uncertainty: 'Head counts are exact. The role factors rest on few people per role (12 IT administrators): plausible ±50%.',
        availability: 'obtainable', plan: 'Role and department per pseudonymous id from the directory, and clicks by role from the last three exercises, without names; IT operations and the awareness lead, before the Design checkpoint.' },
      { id: 'in-campaign', name: 'Campaign and attacker’s targeting',
        value: '150 external phishing e-mails at hour 0 to employees drawn at random. Each internal phishing e-mail goes to one of the sender’s contacts; a privileged contact is 3 times as likely to be chosen.',
        unit: 'e-mails; relative weight', sourceType: 'expert',
        provenance: 'Design choice and expert judgement in this synthetic teaching case: a campaign as large as the larger ones that got past the filter, and how the security operations team describes attackers using a compromised mailbox. Not measured.',
        uncertainty: 'Campaign size plausible 50–400 e-mails, privileged weight 1–10. Stronger targeting raises the privileged risk under options 1 and 3.',
        availability: 'assume', plan: 'Fixed by design and varied in sensitivity runs (50 and 400 e-mails; weights 1 and 10). The security operations lead reviews the rule.' },
      { id: 'in-options', name: 'Settings of the three options',
        value: '1) All staff: click probability −20% (relative), report rate +0.05. 2) The 30 privileged and the 80 most connected other accounts: click probability −40%, and phishing-resistant sign-in, so a click compromises them only with the probability in “Compromise after a click on a protected account”. 3) Time from first report to lock: median 1 h, 90th percentile 4 h; detection when nobody reports: median 12 h.',
        unit: 'relative change; hours', sourceType: 'assumed',
        provenance: 'Declared assumptions in this synthetic teaching case, taken from what each option promises; not measured in this organisation.',
        uncertainty: 'Training effects fade: −20% may be −5% after six months. Option 3’s 4-hour tail assumes the on-call team answers at night and at weekends.',
        availability: 'assume', plan: 'After funding, re-measure clicks in the first exercise and lock times in the first month after the change.' },
    ],
    assumptions: [
      { id: 'as-network', statement: 'Internal phishing goes only to the compromised person’s real contacts, and the network does not change during the 72 hours.',
        rationale: 'Attackers write from the mailbox to recent correspondents because those messages look most convincing; 72 hours is too short for working relationships to change.',
        consequenceIfWrong: 'If attackers also mail the whole address book, spread no longer runs through the hubs and protecting 110 key accounts (option 2) helps less than the model shows.',
        plannedCheck: 'In the last three phishing incidents, count the share of internal phishing recipients who had written to the sender before; run a sensitivity with 30% of e-mails to random employees.',
        evidenceKind: 'assumed', sourceNote: 'The security operations team’s account of past incidents is the planned source; not checked in this teaching case.' },
      { id: 'as-independent', statement: 'Each person decides on each e-mail independently, with a click probability that depends only on department, role, option and whether the sender is a known contact, and does not change within the 72 hours.',
        rationale: 'The simplest rule that matches department-level exercise data; there is no evidence yet on how warnings change behaviour.',
        consequenceIfWrong: 'A company-wide warning after the first locks would cut clicks. Faster response sends that warning earlier, so the model then understates option 3.',
        plannedCheck: 'Compare click rates before and after a warning in past incident tickets; add a rule that halves click probability after the first lock and rerun.',
        evidenceKind: 'assumed', sourceNote: 'Standard simplification for a first agent model; not yet checked.' },
      { id: 'as-mfa', statement: 'Phishing-resistant multi-factor authentication stops about 95% of compromises after a click on a protected account; the rest come from fallback sign-in methods and exceptions.',
        rationale: 'The method ties sign-in to the real site, so a fake page cannot reuse it; fallback methods kept for lost devices remain open.',
        consequenceIfWrong: 'If many protected accounts keep a weak fallback, far more clicks still succeed and option 2 loses much of its advantage on the deciding outcome.',
        plannedCheck: 'Ask IT how many of the 110 accounts would keep a fallback method; run the residual at 0.01 and 0.3 and see whether the ranking of the options changes.',
        evidenceKind: 'expert', sourceNote: 'Judgement of the IT identity team in this teaching case; not measured.' },
      { id: 'as-route', statement: 'A privileged account is compromised only by phishing (from the campaign or from a compromised contact), not by password reuse, stolen session tokens or technical exploits.',
        rationale: 'The question is about phishing spread; other routes are the same under all three options.',
        consequenceIfWrong: 'Other routes raise the privileged risk under every option, and some bypass sign-in protection, so the model overstates the benefit of option 2.',
        plannedCheck: 'Review the last incident reports with the security operations team for other routes to privileged accounts; add a small hourly escalation probability as a sensitivity run.',
        evidenceKind: 'assumed', sourceNote: 'Scope choice of this teaching case; not yet discussed with the security operations team.' },
    ],

    // ── 6 Outcomes ───────────────────────────────────────────────────────────
    outcomes: [
      { id: 'out-privileged', metric: 'Privileged compromise within 72 h', definition: 'In one replication: 1 if at least one of the 30 privileged accounts is compromised within 72 hours of the campaign start, else 0.', unit: 'probability (share of replications)', direction: 'lower',
        aggregation: 'Share over 1,000 replications with a 95% interval; the difference from the baseline is taken within each pair of replications.',
        criterion: 'Decides: prefer the option with the lowest probability, provided the 95% interval of its paired difference lies below zero and the reduction is at least 5 percentage points.' },
      { id: 'out-compromised', metric: 'Accounts compromised by hour 72', definition: 'Number of accounts compromised at any time in the first 72 hours, locked ones included.', unit: 'accounts', direction: 'lower',
        aggregation: 'Mean and 90th percentile over 1,000 replications; paired differences from the baseline.',
        criterion: 'Breaks ties: if two options are within 2 percentage points on the deciding outcome, prefer the one with fewer compromised accounts.' },
      { id: 'out-unlocked', metric: 'Still unlocked at hour 72', definition: 'Compromised accounts not yet locked at hour 72.', unit: 'accounts', direction: 'lower',
        aggregation: 'Mean over 1,000 replications.',
        criterion: 'Diagnostic: a value well above zero means the spread is still running at the horizon, so 72 hours understates the damage.' },
    ],

    // ── 5 Verification and validation ────────────────────────────────────────
    // The check plan (artefacts.checks) writes these three fields when the project is made; this is the same plan in words.
    evaluation: {
      verification: '1) Extreme cases: with a click rate of 0 no account is ever compromised; with no contacts only campaign recipients can be.\n2) Known answer: one compromised account sends one e-mail to each of its 10 contacts at click probability 0.2: the mean over 10,000 runs is 2.0 new compromises (±0.03).\n3) Bookkeeping: every hour each agent is in exactly one state and the three counts add up to 800.\n4) Follow one infection chain hour by hour and check each step against the rules.\n5) Identical agents mixing evenly match the three-stock alternative within 10%.\n6) The same seed gives the same run.',
      validation: 'Not used for tuning: the next simulated-phishing exercise, which includes an internal-looking message, and the last three phishing incidents. Compare the mean click share on the internal-looking message, simulated against recorded, with a tolerance of 25% fixed beforehand; compare several incident patterns at once; walk the security operations team through a traced chain. With synthetic data this is the plan, not completed evidence.',
      calibration: 'Kept separate from validation. Set on the last three simulated-phishing exercises: department click and report rates and the role factors; on last year’s tickets: the time from report to lock. The internal click factor, the attacker’s behaviour and the option effects cannot be tuned from these data; they stay declared and are varied in sensitivity runs.',
    },

    // ── 6 Experiment ─────────────────────────────────────────────────────────
    experiment: {
      baseline: 'Today: department click and report rates and role factors as in the inputs, standard sign-in for everyone, time from first report to lock as fitted to the tickets (median about 6 h, 90th percentile about 30 h), detection when nobody reports after a median 36 h. One external campaign of 150 e-mails at hour 0 to employees drawn at random; each compromised account starts sending 1–4 h after compromise, 2 internal e-mails per hour on average, privileged contacts weighted 3; an internal e-mail from a known contact doubles the click probability.',
      alternatives: '1) Training for all: click probability −20% (relative) and report rate +0.05 for every employee.\n2) Targeted training plus phishing-resistant sign-in for the 30 privileged and the 80 most connected other accounts: their click probability −40%, and a click compromises them with probability 0.05.\n3) Faster response: time from first report to lock median 1 h, 90th percentile 4 h; detection when nobody reports after a median 12 h.\nEverything else as in the baseline.',
      comparison: 'Common random numbers: each replication draws one synthetic network, one click and report rate per department and one set of 150 campaign recipients; all four policies share them and the random-number streams for clicks, reports, sending and locks. The probability of a privileged compromise decides; accounts compromised by hour 72 break ties. Paired differences from the baseline with 95% intervals; add replications until the deciding half-width is at most 3 percentage points. Sensitivity: move one declared value at a time to the ends of its range (internal click factor, compromise after a protected click, sending rate, targeting weight, campaign size) and record whether the ranking changes.',
      runSettings: '800 agents; horizon 72 hours; time step 1 hour (each hour: send, click, report, lock, in that order); 1,000 replications per policy, more if the precision target is not met; seed “phishing-72h”. Declared values at their most likely value in the main runs. Record the model version, network generator version and random-number generator version with every result.',
    },
  },

  artefacts: {
    concept: { title: 'Phishing spread: conceptual model', data: concept },

    method: {
      title: 'Phishing spread: method choice',
      answers: {
        claim: 'compare', time: 'dynamic',
        latent: 'no', observedRelations: 'no', concurrency: 'no',
        uncertainInputs: 'yes', finiteStates: 'yes', feedback: 'yes', queues: 'none',
        // The network is who e-mails whom, not physical location.
        spatial: 'no', heterogeneous: 'yes', granularity: 'individual', evidence: 'event-log',
      },
    },

    data: [
      { title: 'Phishing spread: contacts per account', name: 'Contacts per account', unit: 'contacts (at least 4 messages a month)',
        source: 'synthetic', truth: { family: 'lognormal', params: [2.197, 0.94] }, seed: 'phish-degree-7', n: 500, decimals: 0,
        provenance: 'Synthetic teaching values drawn by this template (500 values, seed “phish-degree-7”), not real records. They stand in for an anonymised, aggregated extract of the e-mail logs: pseudonymous ids, role, department and message counts per pair; no message content, subjects or names. The real extract covers all 800 accounts.',
        uncertainty: 'Drawn from a lognormal law, which the fit recovers: median 9, mean about 14, a few hubs above 100. The hubs shape the result: if the top 5% of accounts held 40% of links instead of about 25%, targeted protection would gain. The 4-message threshold is a choice; rerun with 2 and 8.',
        availability: 'obtainable', plan: 'Aggregated extract from the e-mail logs after the data protection officer’s approval; IT operations, before the Design checkpoint. The network generator gives the highest counts mostly to assistants, team leads, IT and finance staff, as the message counts by role pair show.' },
      { title: 'Phishing spread: click rate by department', name: 'Click rate per department and exercise', unit: 'share of recipients who entered credentials',
        source: 'synthetic', truth: { family: 'beta', params: [4, 46] }, seed: 'phish-click-6', n: 36, decimals: 3,
        provenance: 'Synthetic teaching values drawn by this template (36 values: 12 departments × 3 simulated-phishing exercises; seed “phish-click-6”), not real records. In the real study: recipients and credential entries per department, aggregated without names.',
        uncertainty: 'Drawn from a beta law with mean 0.08. Beta is not among the fitted candidates, so gamma is kept; lognormal fits almost as well. Each replication draws every department’s rate from this law. A real attack may draw more clicks than an exercise people half expect.',
        availability: 'obtainable', plan: 'Recipients and credential entries per department from the last three exercises; the awareness lead, before the Design checkpoint.' },
      { title: 'Phishing spread: report rate by department', name: 'Report rate per department and exercise', unit: 'share of recipients who reported without clicking',
        source: 'synthetic', truth: { family: 'beta', params: [6, 27] }, seed: 'phish-report-5', n: 36, decimals: 3,
        provenance: 'Synthetic teaching values drawn by this template (36 values: 12 departments × 3 simulated-phishing exercises; seed “phish-report-5”), not real records. In the real study: report-button counts per department, aggregated without names.',
        uncertainty: 'Drawn from a beta law with mean 0.18. Beta is not among the fitted candidates, so gamma is kept; lognormal fits almost as well. In a real attack people may report less than in an exercise (plausible mean 0.08–0.25); fewer reports mean later locks under every option.',
        availability: 'obtainable', plan: 'Report counts per department from the same three exercises; the awareness lead, before the Design checkpoint.' },
      { title: 'Phishing spread: time from report to lock', name: 'Time from first report to lock', unit: 'hours',
        source: 'synthetic', truth: { family: 'lognormal', params: [1.792, 1.256] }, seed: 'phish-lock-3', n: 120, decimals: 1,
        provenance: 'Synthetic teaching values drawn by this template (120 values, seed “phish-lock-3”), not real records. They stand in for report and lock timestamps from last year’s phishing tickets, without names or message content; the long tail stands for nights and weekends.',
        uncertainty: 'Drawn from a lognormal law, which the fit recovers: median about 6 h, 90th percentile about 30 h. The tail matters most: a 90th percentile of 48 h instead of 30 h lets a few accounts send for two days.',
        availability: 'obtainable', plan: 'Report and lock timestamps from last year’s phishing tickets; the security operations lead, before the Design checkpoint.' },
      { title: 'Phishing spread: detection without a report', name: 'Time to detection when nobody reports', unit: 'hours after compromise',
        source: 'described', family: 'lognormal', params: [3.584, 0.6], evidence: 'expert',
        provenance: 'Described, not fitted: the security operations team’s judgement of how long sign-in monitoring takes to flag a compromised account nobody has reported, in this synthetic teaching case. Median 36 h, 90th percentile about 78 h.',
        uncertainty: 'A guess: the median could be anywhere from 12 to 72 h. It matters most for accounts that only mail people who rarely report.',
        availability: 'obtainable', plan: 'Alert times of sign-in monitoring for compromised accounts in last year’s tickets; the security operations lead, before the Design checkpoint.' },
      { title: 'Phishing spread: attacker’s sending rate', name: 'Internal phishing e-mails per compromised account', unit: 'e-mails per hour',
        source: 'described', family: 'poisson', params: [2], evidence: 'expert',
        provenance: 'Described, not measured: how the security operations team describes attackers using a compromised mailbox, in this synthetic teaching case. Each hour a sending account sends a Poisson number of e-mails with mean 2.',
        uncertainty: 'Plausible mean 1–10 per hour. A faster attacker weakens option 3; run means 1 and 10 as sensitivity.',
        availability: 'assume', plan: 'Cannot be measured in advance. Varied in sensitivity runs; the security operations lead reviews the rule.' },
      { title: 'Phishing spread: delay before sending', name: 'Delay from compromise to first internal e-mail', unit: 'hours',
        source: 'described', family: 'uniform', params: [1, 4], evidence: 'expert',
        provenance: 'Described, not measured: expert judgement in this synthetic teaching case. The attacker first reads the mailbox, then sends; any delay from 1 to 4 hours is equally likely.',
        uncertainty: 'If attackers send at once, option 3 loses part of its head start; run a delay of 0 to 1 hour as sensitivity.',
        availability: 'obtainable', plan: 'The gap between the first malicious sign-in and the first internal phishing in past incident tickets; the security operations lead.' },
      { title: 'Phishing spread: internal e-mail click factor', name: 'Click factor for e-mail from a known contact', unit: 'multiplier on the click probability',
        source: 'described', family: 'triangular', params: [1.5, 2, 3], evidence: 'expert',
        provenance: 'Described, not measured: expert judgement in this synthetic teaching case. Most likely 2, between 1.5 and 3.',
        uncertainty: 'The weakest number, and the one that drives internal spread. Main runs use 2, sensitivity runs 1.5 and 3. Past exercises had no internal-looking message, so it cannot be tuned on them.',
        availability: 'obtainable', plan: 'The next simulated-phishing exercise includes an internal-looking message; its click share tests this factor (validation, not tuning). The awareness lead.' },
      { title: 'Phishing spread: compromise despite protected sign-in', name: 'Compromise after a click on a protected account', unit: 'probability per click',
        source: 'described', family: 'triangular', params: [0.01, 0.05, 0.3], evidence: 'expert',
        provenance: 'Described, not measured: judgement of the IT identity team in this synthetic teaching case. Phishing-resistant sign-in stops most compromises; fallback sign-in methods leave a small chance. Most likely 0.05, between 0.01 and 0.3.',
        uncertainty: 'Depends on how many protected accounts keep a weak fallback; near 0.3, option 2 loses much of its advantage. Main runs use 0.05, sensitivity runs 0.01 and 0.3.',
        availability: 'obtainable', plan: 'Ask IT how many of the 110 accounts would keep a fallback sign-in method, before the Design checkpoint.' },
    ],

    checks: {
      title: 'Phishing spread: check plan',
      data: {
        method: 'abm',
        checks: [
          { id: 'ck-verify-1', group: 'verification', status: 'planned', evidence: '',
            text: 'Extreme cases: with a click rate of 0 no account is ever compromised; with no contacts at all only the 150 campaign recipients can be.' },
          { id: 'ck-verify-2', group: 'verification', status: 'planned', evidence: '',
            text: 'Known answer: one compromised account sends one e-mail to each of its 10 contacts at click probability 0.2, with no reports and no onward sending; the mean over 10,000 runs is 2.0 new compromises (±0.03).' },
          { id: 'ck-verify-3', group: 'verification', status: 'planned', evidence: '',
            text: 'Bookkeeping: every hour each agent is in exactly one state (susceptible, compromised or locked), the three counts add up to 800, and no locked account returns.' },
          { id: 'ck-verify-4', group: 'verification', status: 'planned', evidence: '',
            text: 'Follow one infection chain hour by hour (sender, recipient, click, report, lock) and compare each decision with the agent rules.' },
          { id: 'ck-verify-5', group: 'verification', status: 'planned', evidence: '',
            text: 'Identical agents: give every account the same role and rates and send e-mails to random employees; the mean number compromised each hour must match the three-stock alternative model within 10%.' },
          { id: 'ck-verify-6', group: 'verification', status: 'planned', evidence: '',
            text: 'Repeatability: two runs with seed “phishing-72h” agree in every replication, and several other seeds give results within each other’s intervals.' },
          { id: 'ck-validate-1', group: 'validation', status: 'planned', evidence: '',
            text: 'Simulate the next simulated-phishing exercise, which includes an internal-looking message, and compare simulated with recorded click and report shares on that message.' },
          { id: 'ck-validate-2', group: 'validation', status: 'planned', evidence: '',
            text: 'Compare several patterns at once with the last three phishing incidents: accounts compromised, share of internal recipients who clicked, and share of internal phishing sent to past correspondents.' },
          { id: 'ck-validate-3', group: 'validation', status: 'planned', evidence: '',
            text: 'Expert review: walk the security operations team through a traced infection chain and ask where the agent rules contradict their experience.' },
          { id: 'ck-calibrate-1', group: 'calibration', status: 'planned', evidence: '',
            text: 'Set the department click and report rates and the role factors on the last three exercises, and the lock-time law on last year’s tickets; keep the next exercise and the incidents aside for validation.' },
        ],
        validation: { measure: 'Mean click share on the internal-looking message of the next exercise over the 12 departments, simulated against recorded', tolerancePct: 25, toleranceOn: 'means', observed: [], simulated: [] },
        calibration: {
          parameters: 'Department click and report rates; role factors; time from report to lock. Declared, not tuned: internal click factor, attacker’s sending and targeting, option effects',
          tunedOn: 'The last three simulated-phishing exercises and last year’s phishing tickets',
          validatedOn: 'The next simulated-phishing exercise and the last three phishing incidents, never used for tuning',
        },
      },
    },
  },
};
