import type { ProjectTemplate } from './types';

/**
 * Template: why staff do (not) use a new collaboration and document platform, and which adoption lever matters most.
 * A structural equation model of survey constructs and logged use, estimated with PLS-SEM. All numbers are synthetic
 * teaching values: the survey is drawn by the template from planted paths, never answered by real people.
 */
export const platformAdoption: ProjectTemplate = {
  id: 'platform-adoption',
  title: 'Why staff use the platform',
  area: 'Information systems',
  pitch: 'Staff still e-mail files instead of using the new platform. Which lever raises use the most?',
  data: 'Staff survey and usage logs',
  shows: [
    'Constructs measured by survey items, use from the logs',
    'Hypotheses mapped to paths, tested by bootstrap',
    'Prediction checked on respondents kept aside',
  ],
  content: {
    // ── 1 Frame ────────────────────────────────────────────────────────────
    decision: {
      stakeholder: 'The head of IT of a regional public agency with about 1,200 staff, who decides together with HR where next year’s adoption budget goes. The budget is fixed and covers one large measure or two small ones, and the choice must be justified to the management board.',
      problem: 'Six months after launch, the new collaboration and document platform is little used: fewer than 40% of staff were active in the last month, and many teams still e-mail attachments, so versions diverge and files sit in personal mailboxes. Making the platform mandatory has been proposed; that is one possible response, not the problem itself.',
      levers: '1) Hands-on training in small groups, aimed at ease of use.\n2) Integration with the e-mail client and office tools people already use, aimed at usefulness.\n3) Visible encouragement by managers, who share and comment on documents in the platform, aimed at social influence.\n4) Better support and resources: a contact person per department and quick guides, aimed at facilitating conditions.',
      outcome: 'Actual use: active days per month per employee over months 8–10, from the platform logs, put in seven bands for the analysis. The budget follows the driver with the largest total effect on it.',
      question: 'Among the agency’s staff, six months after launch, which of four drivers (usefulness, ease of use, social influence, facilitating conditions) has the largest standardised total effect on logged use in months 8–10, with 95% bootstrap intervals, and how well do the drivers predict intention and use for 90 staff kept out of the estimation?',
      claimType: 'explanatory',
    },

    // ── 2 Concept and scope ────────────────────────────────────────────────
    scope: {
      boundary: 'Included: all staff with a platform account (about 1,200); their perceptions of the platform as measured by the survey; their intention to use it; their logged active days. Four drivers are linked to intention and use at one point in time. The four levers appear only as what each is meant to move; they are not measured.',
      exclusions: 'External partners: they use guest accounts and the budget does not reach them.\nOutages and platform speed: they hit everyone at once and IT monitors them; differences in access, such as field connections, are captured as facilitating conditions.\nCost of each lever: the model ranks drivers by effect, and IT and HR weigh costs afterwards.\nDepth of use: logs count active days, not what people do.',
      horizon: 'One survey wave in the first three weeks of month 7 after launch; logged use over the following three months (months 8–10). Logs of months 4–6 serve only the check of the causal ordering.',
      timeUnit: 'month',
      detail: 'Individual: one row per respondent with 17 item answers and the use band from the logs. Results are reported for the whole sample and for office and field staff, never for teams under 10 people.',
      constraints: 'Survey under about 10 minutes: 17 items on the 1–7 agreement scale, an attention item, a marker item and a work-setting question. Voluntary and anonymous; logs are linked only through a pseudonymous code held by the data-protection officer, and only for staff who consent. Results are needed before the budget round in month 11.',
    },

    // ── 3 Choose a method ──────────────────────────────────────────────────
    representation: {
      primaryMethod: 'pls-sem',
      justification: 'The question asks how strongly several perceived drivers, each measured by several items, explain intention and logged use, and how well they predict both for staff kept aside, so a model of constructs and paths fits. PLS-SEM estimates constructs as weighted composites, which suits an explanation that must also predict, lets facilitating conditions be formed from different kinds of support (formative), and takes the use band from the logs as a single indicator. It leaves out a global test of whether a common-factor theory fits the data, and any change over time.',
      alternativeMethod: 'cb-sem',
      alternativeJustification: 'CB-SEM treats each construct as a common factor and tests whether the whole model reproduces the observed covariances, with global fit indices. It is the better choice if the aim is to confirm that a technology-acceptance theory as a whole fits this agency, rather than to rank levers and predict use. It would need every construct reflective and an assumed error variance for the single log indicator.',
      notes: 'Arrows are hypothesised paths (H1–H6), not proven causes. Ease of use acts directly and through usefulness; facilitating conditions act on use, not on intention. Each lever is assumed to move its own driver; the levers themselves are not measured.',
    },

    // ── 4 Measured variables ───────────────────────────────────────────────
    // The six constructs are the rows of the survey (artefacts.survey). These two rows are measured variables outside
    // the constructs: a grouping variable and a control for one rival model.
    inputs: [
      { id: 'in-setting', name: 'Work setting', value: 'Office or field, one survey question; about 30% field staff expected', unit: 'category (office or field)', sourceType: 'observed',
        provenance: 'Self-reported in the planned staff survey. Not part of the synthetic teaching survey, so the group comparison cannot be tried on the template’s data.',
        uncertainty: 'Some staff split their week between office and field and must pick one. With about 60 field staff among the estimation cases, group differences are exploratory.',
        availability: 'obtainable', plan: 'Asked in the same survey wave: HR sends the survey to all 1,200 staff in the first three weeks of month 7, with two reminders, aiming for about 350 answers.' },
      { id: 'in-prior-use', name: 'Prior use, months 4–6', value: 'Logged active days per month, mean of months 4–6, in the same seven bands as actual use; a control in one rival model only', unit: 'band (1–7) of active days per month', sourceType: 'observed',
        provenance: 'Planned anonymised log export. Not part of the synthetic teaching survey, so the rival model cannot be tried on the template’s data.',
        uncertainty: 'Missing for respondents who do not consent to linking, as is actual use. Counts frequency, not depth of use.',
        availability: 'obtainable', plan: 'IT exports active days per person and department for months 4–10; the data-protection officer replaces staff numbers with the survey’s pseudonymous code, then deletes the key.' },
    ],

    assumptions: [
      { id: 'as-honest', statement: 'Survey answers reflect what staff actually think of the platform: they answer honestly and read the items as intended.',
        rationale: 'The survey is voluntary and anonymous, run by HR rather than by IT, and linked to logs only through a pseudonymous code.',
        consequenceIfWrong: 'If staff give the answers they think management wants, social influence and intention are inflated, and manager encouragement looks like a stronger lever than it is.',
        plannedCheck: 'An attention item; a pilot in which 10 staff think aloud while answering; compare stated intention with logged use in months 8–10.',
        evidenceKind: 'assumed', sourceNote: 'Not yet checked; the pilot is the planned source.' },
      { id: 'as-ordering', statement: 'Causal ordering: perceptions shape intention, and intention shapes later use, rather than use shaping perceptions.',
        rationale: 'Use is taken from the logs of the three months after the survey, so it follows the perceptions in time.',
        consequenceIfWrong: 'If people who already use the platform rate it easier because they use it, the ease-of-use path is overstated and training buys less use than the model suggests.',
        plannedCheck: 'A rival model adds prior use (months 4–6) as a control; if the ease-of-use path shrinks by more than half, it is read as an association, not an effect.',
        evidenceKind: 'assumed', sourceNote: 'The usual ordering in technology-acceptance models; plausible here, not shown for this platform.' },
      { id: 'as-method', statement: 'Common-method bias is not strong: asking for all perceptions and intention in one survey does not by itself create the correlations between them.',
        rationale: 'Items differ in wording and one is reversed; actual use comes from another source (logs), so paths into use are not inflated the same way.',
        consequenceIfWrong: 'Shared method variance inflates the paths into intention and its explained variance, so every driver looks stronger and the ranking is less certain.',
        plannedCheck: 'Full collinearity screen (all construct VIFs below 3.3) and a marker item unrelated to the platform (liking of the office building); paths are re-estimated with the marker partialled out.',
        evidenceKind: 'literature', sourceNote: 'A known risk of single-survey designs in survey research; the checks are standard practice, not results for this agency.' },
      { id: 'as-levers', statement: 'Each lever moves mainly its own driver: training raises ease of use, integration raises usefulness, manager encouragement raises social influence, more support raises facilitating conditions.',
        rationale: 'The levers were designed with one target each, and the model can rank drivers, not measures.',
        consequenceIfWrong: 'If integration also makes the platform easier, or training mainly shows people what it is good for, the ranking of drivers is not the ranking of levers and the budget may go to the wrong measure.',
        plannedCheck: 'Before full rollout, pilot the chosen lever in two departments and re-survey them after two months to see which drivers actually moved.',
        evidenceKind: 'assumed', sourceNote: 'Judgement of IT and HR when the levers were designed; in this teaching case no interview was held.' },
    ],

    // ── 5 Verification and validation ──────────────────────────────────────
    // A summary in words; the check plan (artefacts.checks) writes the same checks into the project, one line each.
    evaluation: {
      verification: '1) Screening: leave out answers completed in under a third of the median time, failing the attention item, or identical on every item including the reverse-worded one (straight-lining).\n2) Missing values: leave out respondents with any blank (listwise), about one in six, and compare them with the rest.\n3) Reflective constructs: loadings about 0.70 or more, composite reliability and coefficient alpha 0.70–0.95, average variance extracted 0.50 or more; the reverse-worded ease-of-use item is the first candidate to drop.\n4) Discriminant validity: heterotrait–monotrait ratio below 0.85 for every pair.\n5) Collinearity: indicators of facilitating conditions and the predictors of intention and use with VIF below 3; all construct VIFs below 3.3.\n6) The analysis script, run on the synthetic survey, converges and recovers the planted paths.',
      validation: '1) Out-of-sample prediction: 90 respondents set aside at random, before any estimation, are predicted by the model estimated on the other 200; its prediction errors (RMSE) for the intention items and the use band must beat the estimation-sample mean for every target and a linear benchmark for most.\n2) Agreement with the logs: departments rank the same by mean intention as by the logged use of all their staff.\n3) Non-response: respondents’ logged use is compared with that of all staff.\nThe data are synthetic: this is the plan, not completed evidence.',
      calibration: 'Nothing is tuned. Weights, loadings and paths are estimated on the 200 estimation cases only; the 90 kept-aside cases are opened once, after every measurement decision (such as dropping an item) is recorded. Sample size: a standardised path has a standard error of about 1/√n, so detecting a path of 0.20 at the 5% level with 80% power needs n ≈ ((1.96 + 0.84) / 0.20)² ≈ 196; with 90 kept aside the survey needs about 290 complete answers, so about 350 answers. A driver weaker than 0.20 would not justify a whole budget line.',
    },

    // ── 6 Outcomes and analysis plan ───────────────────────────────────────
    outcomes: [
      { id: 'out-total-effect', metric: 'Total effect of each driver on use',
        definition: 'Standardised total effect (direct plus indirect paths) of usefulness, ease of use, social influence and facilitating conditions on actual use (the band of logged active days), estimated on the 200 estimation cases.',
        unit: 'standardised effect', direction: 'higher',
        aggregation: 'Point estimate with a 95% percentile interval from 5,000 bootstrap resamples; the difference between the top two drivers is bootstrapped too.',
        criterion: 'The top driver’s lever is funded first if its interval excludes zero and so does the interval of its difference to the next driver; otherwise the importance–performance map decides between the two.' },
      { id: 'out-prediction', metric: 'Out-of-sample prediction error',
        definition: 'Root mean squared error of the predicted intention items and use band for the 90 kept-aside respondents, from the model estimated on the 200 others.',
        unit: 'scale points (1–7)', direction: 'lower',
        aggregation: 'One value per target indicator, each compared with the linear benchmark and the estimation-sample mean.',
        criterion: 'Adequate if lower than the mean for every target and lower than the linear benchmark for most; if not, the ranking is reported as explanation only.' },
      { id: 'out-variance', metric: 'Explained variance of intention and use',
        definition: 'R² of intention to use and of actual use in the estimation cases.',
        unit: 'share of variance (0–1)', direction: 'higher',
        aggregation: 'Point estimate with a 95% bootstrap interval.',
        criterion: 'Read as explanation, not validation. An R² for use below about 0.10 means the drivers explain little of actual use, and the budget case rests on weak ground.' },
    ],
    experiment: {
      baseline: 'H1: usefulness → intention to use (+).\nH2: ease of use → intention to use (+).\nH3: ease of use → usefulness (+).\nH4: social influence → intention to use (+).\nH5: facilitating conditions → actual use (+).\nH6: intention to use → actual use (+).',
      alternatives: '1) Rival model without social influence: if the prediction error for intention barely rises and f² < 0.02, manager encouragement is not worth funding.\n2) Rival model with prior use (months 4–6) as a control (checks the causal ordering).\n3) Groups: office versus field staff, from the work-setting question; path differences by permutation test after a measurement invariance check. Exploratory: only about 60 field staff are expected among the estimation cases.',
      comparison: 'Each path: 5,000 bootstrap resamples and a 95% percentile interval; a hypothesis is supported if the interval excludes zero with the expected sign. Mediation: the indirect effect of ease of use via usefulness, tested by its own interval and reported with the direct effect. Effect sizes: f² for each driver of intention. Levers: total effects on use plotted against mean driver scores (importance–performance map).',
      runSettings: 'Path weighting scheme; usefulness, ease of use, social influence and intention reflective (mode A); facilitating conditions formative (mode B); actual use a single indicator (the use band). Stop criterion 10⁻⁷, at most 300 iterations. Bootstrap 5,000 resamples, percentile intervals, seed 2611; the holdout split uses the same seed. Missing values: listwise, as in verification. Open-source statistics package, name and version recorded in the analysis script.',
    },
  },

  artefacts: {
    // ── 2 Conceptual model: levers → drivers → intention → use ──────────────
    concept: {
      title: 'Why staff use the platform: conceptual model',
      data: {
        objectives: 'Rank four drivers of platform use by their total effect on logged use in months 8–10, and see how well they predict intention and use for staff kept aside.',
        assumptions: 'Each driver and intention is measured by survey items; actual use comes from the logs of the three months after the survey, so it follows the perceptions in time. Each lever moves mainly its own driver.',
        simplifications: 'One survey wave, no change over time. Arrows H1–H6 are the hypotheses of step 6; a path not drawn is fixed at zero. The levers are not measured, so the model ranks drivers, not measures.',
        nodes: [
          { id: 'c-integration', type: 'lever', label: 'Integration with office tools', x: 24, y: 144, zone: 'inputs' },
          { id: 'c-training', type: 'lever', label: 'Hands-on training', x: 24, y: 248, zone: 'inputs' },
          { id: 'c-managers', type: 'lever', label: 'Managers share in the platform', x: 24, y: 344, zone: 'inputs' },
          { id: 'c-support', type: 'lever', label: 'Support contacts and guides', x: 24, y: 432, zone: 'inputs' },
          { id: 'c-ease', type: 'variable', label: 'Ease of use', x: 280, y: 248, zone: 'content' },
          { id: 'c-useful', type: 'variable', label: 'Usefulness', x: 280, y: 144, zone: 'content' },
          { id: 'c-social', type: 'variable', label: 'Social influence', x: 360, y: 344, zone: 'content' },
          { id: 'c-conditions', type: 'variable', label: 'Facilitating conditions', x: 360, y: 432, zone: 'content' },
          { id: 'c-intention', type: 'variable', label: 'Intention to use', x: 528, y: 192, zone: 'content' },
          { id: 'c-use', type: 'outcome', label: 'Actual use', x: 736, y: 336, zone: 'outputs' },
          { id: 'c-partners', type: 'external', label: 'External partners', x: 944, y: 60, zone: 'outside' },
          { id: 'c-outages', type: 'external', label: 'Outages and platform speed', x: 944, y: 136, zone: 'outside' },
        ],
        edges: [
          { id: 'ce-integration', from: 'c-integration', to: 'c-useful', kind: 'influence', sign: '+', label: 'aims at' },
          { id: 'ce-training', from: 'c-training', to: 'c-ease', kind: 'influence', sign: '+', label: 'aims at' },
          { id: 'ce-managers', from: 'c-managers', to: 'c-social', kind: 'influence', sign: '+', label: 'aims at' },
          { id: 'ce-support', from: 'c-support', to: 'c-conditions', kind: 'influence', sign: '+', label: 'aims at' },
          { id: 'ce-h1', from: 'c-useful', to: 'c-intention', kind: 'influence', sign: '+', label: 'H1' },
          { id: 'ce-h2', from: 'c-ease', to: 'c-intention', kind: 'influence', sign: '+', label: 'H2' },
          { id: 'ce-h3', from: 'c-ease', to: 'c-useful', kind: 'influence', sign: '+', label: 'H3' },
          { id: 'ce-h4', from: 'c-social', to: 'c-intention', kind: 'influence', sign: '+', label: 'H4' },
          { id: 'ce-h5', from: 'c-conditions', to: 'c-use', kind: 'influence', sign: '+', label: 'H5' },
          { id: 'ce-h6', from: 'c-intention', to: 'c-use', kind: 'influence', sign: '+', label: 'H6' },
        ],
      },
    },

    // ── 3 Method chooser: latent constructs, survey evidence, an explanatory claim ─
    method: {
      title: 'Why staff use the platform: method choice',
      answers: {
        claim: 'explain', time: 'static', latent: 'yes', observedRelations: 'no', concurrency: 'no', uncertainInputs: 'no',
        finiteStates: 'no', feedback: 'no', queues: 'none', spatial: 'no', heterogeneous: 'no', granularity: 'aggregate', evidence: 'survey',
      },
    },

    // ── 4 The survey: six constructs, one row each ─────────────────────────
    data: [],
    survey: {
      title: 'Why staff use the platform: staff survey',
      source: 'Synthetic teaching survey drawn by the template from planted paths, shaped like the planned staff survey and log export (350 respondents). Not responses from real people.',
      seed: 'staff-survey-27',
      cases: 350,
      constructs: [
        { name: 'Usefulness', mode: 'reflective', items: [
          { column: 'PU1', label: 'Using the platform saves me time when I share documents.', loading: 0.84 },
          { column: 'PU2', label: 'The platform helps my team work on one version of a document.', loading: 0.8 },
          { column: 'PU3', label: 'The platform makes it easier to coordinate work with other departments.', loading: 0.74 },
          { column: 'PU4', label: 'Overall, the platform is useful in my job.', loading: 0.85 },
        ] },
        { name: 'Ease of use', mode: 'reflective', items: [
          { column: 'EOU1', label: 'Learning to use the platform was easy for me.', loading: 0.8 },
          { column: 'EOU2', label: 'Finding the latest version of a file in the platform is easy.', loading: 0.78 },
          { column: 'EOU3', label: 'I can share a document in the platform without asking anyone for help.', loading: 0.76 },
          { column: 'EOU4', label: 'The platform is confusing to use. (reverse-worded)', reverse: true, loading: 0.5 },
        ] },
        { name: 'Social influence', mode: 'reflective', items: [
          { column: 'SI1', label: 'My manager expects me to use the platform.', loading: 0.74 },
          { column: 'SI2', label: 'The colleagues I work with most share their documents in the platform.', loading: 0.72 },
          { column: 'SI3', label: 'People whose opinion I value think I should use the platform.', loading: 0.68 },
        ] },
        { name: 'Facilitating conditions', mode: 'formative', items: [
          { column: 'FC1', label: 'My device and connection let me use the platform wherever I work.', loading: 0.66 },
          { column: 'FC2', label: 'I have been shown how to do my own tasks in the platform.', loading: 0.7 },
          { column: 'FC3', label: 'When I get stuck in the platform, I quickly get help.', loading: 0.68 },
        ] },
        { name: 'Intention to use', mode: 'reflective', items: [
          { column: 'BI1', label: 'I intend to share my team’s documents in the platform in the next three months.', loading: 0.86 },
          { column: 'BI2', label: 'For shared files I plan to use the platform rather than e-mail attachments.', loading: 0.84 },
          { column: 'BI3', label: 'I expect to use the platform in every working week.', loading: 0.8 },
        ] },
        { name: 'Actual use', mode: 'single', items: [
          { column: 'USE', label: 'Not asked: logged active days per month, mean of months 8–10, in seven bands (1 = none, 2 = 1–2, 3 = 3–5, 4 = 6–9, 5 = 10–13, 6 = 14–17, 7 = 18 or more).', loading: 0.9 },
        ] },
      ],
      paths: [
        { from: 'Usefulness', to: 'Intention to use', beta: 0.4 },
        { from: 'Ease of use', to: 'Intention to use', beta: 0.15 },
        { from: 'Ease of use', to: 'Usefulness', beta: 0.45 },
        { from: 'Social influence', to: 'Intention to use', beta: 0.2 },
        { from: 'Facilitating conditions', to: 'Actual use', beta: 0.2 },
        { from: 'Intention to use', to: 'Actual use', beta: 0.4 },
      ],
      exogenousCorrelation: 0.3,
      missingRate: 0.01,
      straightLiners: 4,
      missing: 'listwise',
      note: 'Drawn by the template, never answered by real people: 17 items on the 1–7 agreement scale and the use band, which comes from the logs and is not asked. The attention, marker and work-setting questions are not drawn.\nPlanted paths (H1–H6): usefulness → intention 0.40, ease of use → intention 0.15, ease of use → usefulness 0.45, social influence → intention 0.20, facilitating conditions → use 0.20, intention → use 0.40; the three exogenous drivers correlate 0.30. Run the analysis script on these data first and check that it recovers them.\nThe reverse-worded EOU4 is planted weak (loading 0.50): the reliability screen shows alpha of ease of use rising without it, a decision to record before the kept-aside cases are opened. Social influence has only three items and is the least reliable construct. Facilitating conditions is formative: its items cover devices, know-how and help, and no reliability check can show a resource the list misses. Real use bands would pile up at 1 (no active day); these are centred on the middle of the scale.\nMissing values: about 1 answer in 100 is blank, at random. Respondents with any blank are left out (listwise), so every case kept has all values, as the bootstrap and the holdout prediction need. This drops about one in six, leaving about 290 complete answers: 200 to estimate (enough to detect a path of 0.20 at the 5% level with 80% power) and 90 kept aside. Four respondents straight-line and are screened out.',
    },

    // ── 5 Check plan: screening and measurement, prediction on kept-aside staff, estimation kept separate ─
    checks: {
      title: 'Why staff use the platform: check plan',
      data: {
        method: 'pls-sem',
        checks: [
          { id: 'ck-verify-1', group: 'verification', status: 'planned', evidence: '',
            text: 'Screen the answers: leave out respondents who finished in under a third of the median time, failed the attention item, or gave the same answer to every item, the reverse-worded one included (straight-lining). Record how many, by work setting.' },
          { id: 'ck-verify-2', group: 'verification', status: 'planned', evidence: '',
            text: 'Count blanks per item and per respondent; leave out respondents with any blank (listwise), about one in six, and compare them with the rest on work setting and mean driver scores.' },
          { id: 'ck-verify-3', group: 'verification', status: 'planned', evidence: '',
            text: 'Check the reflective constructs: loadings about 0.70 or more, composite reliability and coefficient alpha 0.70 to 0.95, average variance extracted 0.50 or more. Drop an item only for a reason recorded beforehand; the reverse-worded EOU4 is the first candidate.' },
          { id: 'ck-verify-4', group: 'verification', status: 'planned', evidence: '',
            text: 'Check discriminant validity: heterotrait–monotrait ratio below 0.85 for every pair of reflective constructs.' },
          { id: 'ck-verify-5', group: 'verification', status: 'planned', evidence: '',
            text: 'Check collinearity: the three indicators of facilitating conditions and the predictors of intention and of use with VIF below 3, each formative weight with its bootstrap interval; all construct VIFs below 3.3 as a screen for common-method bias.' },
          { id: 'ck-verify-6', group: 'verification', status: 'planned', evidence: '',
            text: 'Run the analysis script on the synthetic survey before the real answers arrive: it converges well within 300 iterations and recovers the planted paths (survey note) to within about 0.10.' },
          { id: 'ck-validate-1', group: 'validation', status: 'planned', evidence: '',
            text: 'Predict the intention items and the use band of the 90 kept-aside respondents from the model estimated on the other 200. Compare RMSE with the estimation-sample mean and a linear benchmark of all driver items: lower than the mean for every target, lower than the benchmark for most.' },
          { id: 'ck-validate-2', group: 'validation', status: 'planned', evidence: '',
            text: 'Compare with the logs: departments with at least 10 respondents should rank the same by mean intention as by the mean logged active days of all their staff, respondents or not (rank correlation 0.5 or more).' },
          { id: 'ck-validate-3', group: 'validation', status: 'planned', evidence: '',
            text: 'Check non-response: compare the logged active days of respondents with those of all staff; if respondents are clearly more active, report the results as those of keener users.' },
          { id: 'ck-calibrate-1', group: 'calibration', status: 'planned', evidence: '',
            text: 'Draw the 90 kept-aside respondents at random before any estimation (by work setting, seed 2611). Estimate weights, loadings and paths on the other 200 only, and open the kept-aside cases once, after every measurement decision is recorded.' },
        ],
        validation: {
          measure: 'Prediction error (RMSE) of the intention items and the use band for the 90 kept-aside respondents, against the estimation-sample mean and a linear benchmark',
          tolerancePct: null, toleranceOn: 'pairs', observed: [], simulated: [],
        },
        calibration: {
          parameters: 'Indicator weights and loadings, path coefficients, R² of intention and use',
          tunedOn: '200 estimation respondents, drawn from about 290 complete answers',
          validatedOn: '90 kept-aside respondents, drawn at random before any estimation and opened once',
        },
      },
    },
  },
};
