/**
 * Method candidates and specialist app registry (PLAN §8).
 *
 * Specialist URLs come from the course owner's portfolio file
 * (TEMP/ModellingSimulationLab.tsx, 20 Nov 2026) and returned HTTP 200 when checked
 * on 20 Nov 2026. The Queueing Lab appears in the portfolio overview without a URL,
 * so it is deliberately left unconfigured — never invent a link.
 */

export type MethodId =
  | 'path-analysis' | 'cb-sem' | 'pls-sem' | 'petri-nets' | 'monte-carlo' | 'markov-chains'
  | 'system-dynamics' | 'queueing-theory' | 'des' | 'cellular-automata' | 'abm';

export type MethodFamily = 'relationships' | 'uncertainty' | 'processes' | 'emergence';

export const FAMILY_TONE: Record<MethodFamily, string> = { relationships: 'tone-blue', uncertainty: 'tone-teal', processes: 'tone-brown', emergence: 'tone-purple' };

export const FAMILIES: Record<MethodFamily, { label: string; question: string }> = {
  relationships: { label: 'Relationships', question: 'Why are variables related?' },
  uncertainty: { label: 'Uncertainty', question: 'What might happen?' },
  processes: { label: 'Processes & dynamics', question: 'How does a system evolve?' },
  emergence: { label: 'Emergence', question: 'How does complexity arise?' },
};

export interface SpecialistApp {
  id: string;
  name: string;
  /** Verified URL or null when not configured. */
  url: string | null;
  urlSource: string | null;
  handoff: 'download-passport';
}

export const SPECIALIST_APPS: Record<string, SpecialistApp> = {
  sem: { id: 'sem', name: 'SEM Lab', url: 'https://sem-lab.netlify.app', urlSource: 'Course portfolio, checked 2026-11-20', handoff: 'download-passport' },
  montecarlo: { id: 'montecarlo', name: 'Monte Carlo Simulation Lab', url: 'https://montecarlosimlab.netlify.app/', urlSource: 'Course portfolio, checked 2026-11-20', handoff: 'download-passport' },
  markov: { id: 'markov', name: 'Markov Chains', url: 'https://markovchainsim.netlify.app/', urlSource: 'Course portfolio, checked 2026-11-20', handoff: 'download-passport' },
  petri: { id: 'petri', name: 'Petri Nets', url: 'https://petrinetsim.netlify.app', urlSource: 'Course portfolio, checked 2026-11-20', handoff: 'download-passport' },
  queueing: { id: 'queueing', name: 'Queueing Lab', url: null, urlSource: null, handoff: 'download-passport' },
  des: { id: 'des', name: 'DES Playground', url: 'https://desplayground.netlify.app', urlSource: 'Course portfolio, checked 2026-11-20', handoff: 'download-passport' },
  sd: { id: 'sd', name: 'System Dynamics Studio', url: 'https://sysdyn-studio.netlify.app', urlSource: 'Course portfolio, checked 2026-11-20', handoff: 'download-passport' },
  ca: { id: 'ca', name: 'Cellular Automata Lab', url: 'https://cellular-automata-lab.netlify.app', urlSource: 'Course portfolio, checked 2026-11-20', handoff: 'download-passport' },
  abm: { id: 'abm', name: 'ABM Learning Platform', url: 'https://abm-learning-platform.up.railway.app', urlSource: 'Course portfolio, checked 2026-11-20', handoff: 'download-passport' },
};

export interface MethodRecord {
  id: MethodId;
  name: string;
  family: MethodFamily;
  summary: string;
  suitableQuestions: string[];
  representation: string;
  time: string;
  randomness: string;
  aggregation: string;
  assumptions: string[];
  dataNeeds: string[];
  omits: string[];
  failureConditions: string[];
  appId: string;
}

export const METHODS: MethodRecord[] = [
  {
    id: 'path-analysis', name: 'Path analysis', family: 'relationships',
    summary: 'Systems of regression equations among observed variables.',
    suitableQuestions: ['How strongly are observed variables associated, directly and indirectly?', 'Is a hypothesised pattern of relationships consistent with the data?'],
    representation: 'Observed variables connected by directed paths', time: 'Usually static (cross-sectional)', randomness: 'Statistical error terms', aggregation: 'Variables measured on individuals or units',
    assumptions: ['Correct model specification and direction of paths', 'No important omitted confounders for any causal reading', 'Adequate measurement of each observed variable'],
    dataNeeds: ['A sample of observations on every variable in the model'],
    omits: ['Latent constructs and measurement error', 'Process timing, queues and feedback over time'],
    failureConditions: ['Paths read as causal effects without an identification strategy', 'Key confounders unmeasured'],
    appId: 'sem',
  },
  {
    id: 'cb-sem', name: 'CB-SEM', family: 'relationships',
    summary: 'Covariance-based structural equation modelling of a measurement and structural model.',
    suitableQuestions: ['Is a theory-specified measurement and structural model consistent with the observed covariance structure?'],
    representation: 'Latent constructs measured by indicators; structural paths between constructs', time: 'Usually static', randomness: 'Measurement and structural error', aggregation: 'Individuals or units in a sample',
    assumptions: ['Theory-driven specification', 'Model identification', 'Distributional assumptions of the chosen estimator'],
    dataNeeds: ['Multiple indicators per construct', 'A sample adequate for the model complexity and estimator'],
    omits: ['Dynamic process behaviour', 'Intervention effects unless causal assumptions are defended'],
    failureConditions: ['Poor measurement quality or identification', 'Fit statistics treated as proof of theory'],
    appId: 'sem',
  },
  {
    id: 'pls-sem', name: 'PLS-SEM', family: 'relationships',
    summary: 'Component-based estimation of relationships between constructs and indicators.',
    suitableQuestions: ['How do composite constructs relate, and how well does the model predict out of sample?'],
    representation: 'Constructs as weighted composites of indicators; structural paths', time: 'Usually static', randomness: 'Estimation uncertainty (often via bootstrap)', aggregation: 'Individuals or units in a sample',
    assumptions: ['Composite or measurement model appropriate to the constructs', 'Purpose stated: explanation versus prediction'],
    dataNeeds: ['Indicators per construct', 'Holdout data or cross-validation for predictive claims'],
    omits: ['Covariance-based tests of a common-factor model', 'Dynamic process behaviour'],
    failureConditions: ['Chosen only because of a “small sample” slogan', 'Predictive claims without out-of-sample evaluation'],
    appId: 'sem',
  },
  {
    id: 'petri-nets', name: 'Petri nets', family: 'processes',
    summary: 'Places, transitions and tokens for concurrency, synchronisation and blocking.',
    suitableQuestions: ['Can the process deadlock?', 'Which steps can happen concurrently and which must synchronise?'],
    representation: 'Places, transitions, arcs and tokens', time: 'Logical (untimed) unless a timed extension is used', randomness: 'None in the basic form', aggregation: 'Tokens represent resources, cases or conditions',
    assumptions: ['Firing rules represent the real process logic', 'Token meaning is clearly defined'],
    dataNeeds: ['Process rules, approvals and resource constraints'],
    omits: ['Timed performance such as waiting times (basic nets)', 'Behaviour of heterogeneous actors'],
    failureConditions: ['A generic flowchart labelled as a Petri net', 'Logical reachability confused with timed throughput'],
    appId: 'petri',
  },
  {
    id: 'monte-carlo', name: 'Monte Carlo simulation', family: 'uncertainty',
    summary: 'Propagates uncertain inputs through a calculation by repeated sampling.',
    suitableQuestions: ['How uncertain is this outcome given uncertain inputs?', 'What is the probability that cost exceeds a threshold?'],
    representation: 'Input distributions feeding a deterministic calculation', time: 'Often static; can wrap a dynamic model', randomness: 'Explicit input distributions', aggregation: 'Depends on the underlying calculation',
    assumptions: ['Input distributions and their dependence are justified', 'Enough replications for the precision needed'],
    dataNeeds: ['Evidence for input ranges, distributions and correlations'],
    omits: ['Mechanisms not included in the underlying calculation'],
    failureConditions: ['Independent inputs assumed when they are correlated', 'Outcome spread confused with uncertainty about a mean'],
    appId: 'montecarlo',
  },
  {
    id: 'markov-chains', name: 'Markov chains', family: 'uncertainty',
    summary: 'Probabilistic movement between a finite set of states.',
    suitableQuestions: ['What share of cases will be in each state after k steps?', 'How long until absorption?'],
    representation: 'States and a transition probability matrix', time: 'Discrete steps (or continuous-time variant)', randomness: 'Transition probabilities', aggregation: 'Individuals or cohort shares',
    assumptions: ['Next state depends only on the current state (memoryless)', 'Transition probabilities stable over the horizon unless modelled otherwise'],
    dataNeeds: ['Observed state sequences or defensible transition estimates'],
    omits: ['History beyond the current state', 'Resource constraints and queues'],
    failureConditions: ['State definitions hide important memory', 'Rows not summing to one'],
    appId: 'markov',
  },
  {
    id: 'system-dynamics', name: 'System dynamics', family: 'processes',
    summary: 'Stocks, flows, delays and feedback loops at an aggregate level.',
    suitableQuestions: ['How do accumulation and feedback shape behaviour over time?', 'Which policy avoids overshoot or collapse?'],
    representation: 'Stocks, flows, auxiliaries and feedback loops', time: 'Continuous (numerically integrated) or small time steps', randomness: 'Usually deterministic; can add noise', aggregation: 'Aggregate quantities',
    assumptions: ['Aggregation is acceptable for the question', 'Feedback structure and delays are justified', 'Units are consistent'],
    dataNeeds: ['Time series for key stocks', 'Evidence for feedback mechanisms'],
    omits: ['Individual heterogeneity', 'Individual waiting times'],
    failureConditions: ['Feedback rules asserted without evidence', 'Unit inconsistencies'],
    appId: 'sd',
  },
  {
    id: 'queueing-theory', name: 'Queueing theory', family: 'processes',
    summary: 'Analytical formulas for waiting and congestion in stylised service systems.',
    suitableQuestions: ['What is the expected wait in a simple stationary service system?', 'Is the system stable at this utilisation?'],
    representation: 'Arrival process, service process, servers and discipline', time: 'Continuous time, steady state', randomness: 'Stochastic arrivals and service', aggregation: 'Long-run averages',
    assumptions: ['Stationarity and stability (utilisation below one)', 'Specific arrival/service distributions (e.g. Poisson/exponential)'],
    dataNeeds: ['Arrival rate, service rate and number of servers'],
    omits: ['Time-varying schedules, priorities and complex routing'],
    failureConditions: ['Applied to an unstable or strongly time-varying system', 'Distributional assumptions not checked'],
    appId: 'queueing',
  },
  {
    id: 'des', name: 'Discrete-event simulation', family: 'processes',
    summary: 'Entities, events and resources over simulated time.',
    suitableQuestions: ['What waiting-time distribution will individuals experience under this schedule?', 'Which staffing rule meets a service level?'],
    representation: 'Entities flowing through activities that use resources; event list', time: 'Event-driven', randomness: 'Stochastic arrivals, service times and routing', aggregation: 'Individual entities',
    assumptions: ['Event logic and routing match the process', 'Input distributions justified', 'Warm-up and run length appropriate'],
    dataNeeds: ['Arrival patterns, service-time distributions, routing and schedules'],
    omits: ['Adaptive behaviour of individuals unless explicitly added'],
    failureConditions: ['Single run reported as a result', 'No verification of event logic'],
    appId: 'des',
  },
  {
    id: 'cellular-automata', name: 'Cellular automata', family: 'emergence',
    summary: 'Local update rules on a spatial grid.',
    suitableQuestions: ['How do local spatial rules produce global patterns?', 'How fast does something spread across space?'],
    representation: 'Grid of cells with states and a neighbourhood rule', time: 'Discrete steps', randomness: 'Deterministic or stochastic rules', aggregation: 'Spatial cells',
    assumptions: ['Neighbourhood and update scheme justified', 'Boundary condition chosen deliberately'],
    dataNeeds: ['Spatial layout and evidence for local rules'],
    omits: ['Non-spatial interactions and individual mobility'],
    failureConditions: ['Boundary choice drives the result unnoticed', 'Spatial question never stated'],
    appId: 'ca',
  },
  {
    id: 'abm', name: 'Agent-based modelling', family: 'emergence',
    summary: 'Heterogeneous agents following behavioural rules and interacting.',
    suitableQuestions: ['How does heterogeneous, adaptive behaviour create system outcomes?', 'Who is affected differently by a policy?'],
    representation: 'Agents with attributes and rules in an environment', time: 'Discrete steps or events', randomness: 'Usually stochastic', aggregation: 'Individual agents',
    assumptions: ['Behavioural rules supported by evidence', 'Interaction structure justified', 'Calibration separated from validation'],
    dataNeeds: ['Behavioural evidence, agent attributes, interaction structure'],
    omits: ['Nothing by design — the risk is unjustified detail'],
    failureConditions: ['Hypothetical behaviour presented as fact', 'Emergent pattern over-interpreted from one run'],
    appId: 'abm',
  },
];

export const METHOD_BY_ID: Record<MethodId, MethodRecord> = Object.fromEntries(METHODS.map((m) => [m.id, m])) as Record<MethodId, MethodRecord>;

export function appForMethod(id: MethodId): SpecialistApp {
  return SPECIALIST_APPS[METHOD_BY_ID[id].appId];
}
