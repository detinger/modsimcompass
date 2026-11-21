/**
 * Method candidates and specialist app registry (PLAN §8).
 *
 * Specialist URLs come from the owner's list of companion apps and returned HTTP 200
 * when checked on 20 Nov 2026. The Queueing Lab is listed without a URL, so it is
 * deliberately left unconfigured — never invent a link.
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
  sem: { id: 'sem', name: 'SEM Lab', url: 'https://sem-lab.netlify.app', urlSource: 'Checked 2026-11-20', handoff: 'download-passport' },
  montecarlo: { id: 'montecarlo', name: 'Monte Carlo Simulation Lab', url: 'https://montecarlosimlab.netlify.app/', urlSource: 'Checked 2026-11-20', handoff: 'download-passport' },
  markov: { id: 'markov', name: 'Markov Chains', url: 'https://markovchainsim.netlify.app/', urlSource: 'Checked 2026-11-20', handoff: 'download-passport' },
  petri: { id: 'petri', name: 'Petri Nets', url: 'https://petrinetsim.netlify.app', urlSource: 'Checked 2026-11-20', handoff: 'download-passport' },
  queueing: { id: 'queueing', name: 'Queueing Lab', url: null, urlSource: null, handoff: 'download-passport' },
  des: { id: 'des', name: 'DES Playground', url: 'https://desplayground.netlify.app', urlSource: 'Checked 2026-11-20', handoff: 'download-passport' },
  sd: { id: 'sd', name: 'System Dynamics Studio', url: 'https://sysdyn-studio.netlify.app', urlSource: 'Checked 2026-11-20', handoff: 'download-passport' },
  ca: { id: 'ca', name: 'Cellular Automata Lab', url: 'https://cellular-automata-lab.netlify.app', urlSource: 'Checked 2026-11-20', handoff: 'download-passport' },
  abm: { id: 'abm', name: 'ABM Learning Platform', url: 'https://abm-learning-platform.up.railway.app', urlSource: 'Checked 2026-11-20', handoff: 'download-passport' },
};

export interface MethodRecord {
  id: MethodId;
  name: string;
  family: MethodFamily;
  summary: string;
  /** What the method is for, in one sentence (Learn cards and the comparison table). */
  purpose: string;
  /** One typical question the method answers well. */
  exampleQuestion: string;
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
    purpose: 'Tests whether a hypothesised web of direct and indirect links between measured variables fits the data.',
    exampleQuestion: 'Does training raise satisfaction directly, or through better skills?',
    suitableQuestions: ['How strongly are observed variables associated, directly and indirectly?', 'Is a hypothesised pattern of relationships consistent with the data?'],
    representation: 'Observed variables connected by directed paths', time: 'Usually static (cross-sectional)', randomness: 'Statistical error terms', aggregation: 'Variables measured on individuals or units',
    assumptions: ['Correct model specification and direction of paths', 'No important omitted confounders for any causal reading', 'Adequate measurement of each observed variable'],
    dataNeeds: ['Observations on every variable in the model', 'Sample size'],
    omits: ['Latent constructs and measurement error', 'Process timing, queues and feedback over time'],
    failureConditions: ['Paths read as causal effects without an identification strategy', 'Key confounders unmeasured'],
    appId: 'sem',
  },
  {
    id: 'cb-sem', name: 'CB-SEM', family: 'relationships',
    summary: 'Covariance-based structural equation modelling of a measurement and structural model.',
    purpose: 'Tests a theory about hidden constructs, each measured by several indicators, against the observed covariances.',
    exampleQuestion: 'Does perceived usefulness explain the intention to use a new system?',
    suitableQuestions: ['Is a theory-specified measurement and structural model consistent with the observed covariance structure?'],
    representation: 'Latent constructs measured by indicators; structural paths between constructs', time: 'Usually static', randomness: 'Measurement and structural error', aggregation: 'Individuals or units in a sample',
    assumptions: ['Theory-driven specification', 'Model identification', 'Distributional assumptions of the chosen estimator'],
    dataNeeds: ['Indicators for each construct (several per construct)', 'Sample size adequate for the model and estimator'],
    omits: ['Dynamic process behaviour', 'Intervention effects unless causal assumptions are defended'],
    failureConditions: ['Poor measurement quality or identification', 'Fit statistics treated as proof of theory'],
    appId: 'sem',
  },
  {
    id: 'pls-sem', name: 'PLS-SEM', family: 'relationships',
    summary: 'Component-based estimation of relationships between constructs and indicators.',
    purpose: 'Estimates how composite constructs relate, and how well they predict an outcome in new data.',
    exampleQuestion: 'Which drivers best predict customer loyalty in next year’s survey?',
    suitableQuestions: ['How do composite constructs relate, and how well does the model predict out of sample?'],
    representation: 'Constructs as weighted composites of indicators; structural paths', time: 'Usually static', randomness: 'Estimation uncertainty (often via bootstrap)', aggregation: 'Individuals or units in a sample',
    assumptions: ['Composite or measurement model appropriate to the constructs', 'Purpose stated: explanation versus prediction'],
    dataNeeds: ['Indicators for each construct', 'Holdout data or cross-validation (for predictive claims)'],
    omits: ['Covariance-based tests of a common-factor model', 'Dynamic process behaviour'],
    failureConditions: ['Chosen only because of a “small sample” slogan', 'Predictive claims without out-of-sample evaluation'],
    appId: 'sem',
  },
  {
    id: 'petri-nets', name: 'Petri nets', family: 'processes',
    summary: 'Places, transitions and tokens for concurrency, synchronisation and blocking.',
    purpose: 'Shows whether a process with parallel steps and shared resources can block, and what must wait for what.',
    exampleQuestion: 'Can two orders that need the same approval and the same machine block each other?',
    suitableQuestions: ['Can the process deadlock?', 'Which steps can happen concurrently and which must synchronise?'],
    representation: 'Places, transitions, arcs and tokens', time: 'Logical (untimed) unless a timed extension is used', randomness: 'None in the basic form', aggregation: 'Tokens represent resources, cases or conditions',
    assumptions: ['Firing rules represent the real process logic', 'Token meaning is clearly defined'],
    dataNeeds: ['Process steps and their order', 'Approval and synchronisation rules', 'Resource limits'],
    omits: ['Timed performance such as waiting times (basic nets)', 'Behaviour of heterogeneous actors'],
    failureConditions: ['A generic flowchart labelled as a Petri net', 'Logical reachability confused with timed throughput'],
    appId: 'petri',
  },
  {
    id: 'monte-carlo', name: 'Monte Carlo simulation', family: 'uncertainty',
    summary: 'Propagates uncertain inputs through a calculation by repeated sampling.',
    purpose: 'Turns uncertain inputs into a distribution of outcomes, so you can state the chance of each result.',
    exampleQuestion: 'How likely is the project to overrun its budget?',
    suitableQuestions: ['How uncertain is this outcome given uncertain inputs?', 'What is the probability that cost exceeds a threshold?'],
    representation: 'Input distributions feeding a deterministic calculation', time: 'Often static; can wrap a dynamic model', randomness: 'Explicit input distributions', aggregation: 'Depends on the underlying calculation',
    assumptions: ['Input distributions and their dependence are justified', 'Enough replications for the precision needed'],
    dataNeeds: ['Range or distribution of each uncertain input', 'Dependence between inputs'],
    omits: ['Mechanisms not included in the underlying calculation'],
    failureConditions: ['Independent inputs assumed when they are correlated', 'Outcome spread confused with uncertainty about a mean'],
    appId: 'montecarlo',
  },
  {
    id: 'markov-chains', name: 'Markov chains', family: 'uncertainty',
    summary: 'Probabilistic movement between a finite set of states.',
    purpose: 'Tracks how cases move between a few states, step by step, and where they settle in the long run.',
    exampleQuestion: 'What share of subscribers will still be active after twelve months?',
    suitableQuestions: ['What share of cases will be in each state after k steps?', 'How long until absorption?'],
    representation: 'States and a transition probability matrix', time: 'Discrete steps (or continuous-time variant)', randomness: 'Transition probabilities', aggregation: 'Individuals or cohort shares',
    assumptions: ['Next state depends only on the current state (memoryless)', 'Transition probabilities stable over the horizon unless modelled otherwise'],
    dataNeeds: ['List of states', 'Transition probabilities or observed state sequences'],
    omits: ['History beyond the current state', 'Resource constraints and queues'],
    failureConditions: ['State definitions hide important memory', 'Rows not summing to one'],
    appId: 'markov',
  },
  {
    id: 'system-dynamics', name: 'System dynamics', family: 'processes',
    summary: 'Stocks, flows, delays and feedback loops at an aggregate level.',
    purpose: 'Explains how accumulation, delay and feedback shape the behaviour of a whole system over time.',
    exampleQuestion: 'Why does the backlog keep growing after hiring, and when will it level off?',
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
    purpose: 'Gives quick formulas for waiting and congestion in a simple, steady service system.',
    exampleQuestion: 'How long is the average wait with three servers at 85% utilisation?',
    suitableQuestions: ['What is the expected wait in a simple stationary service system?', 'Is the system stable at this utilisation?'],
    representation: 'Arrival process, service process, servers and discipline', time: 'Continuous time, steady state', randomness: 'Stochastic arrivals and service', aggregation: 'Long-run averages',
    assumptions: ['Stationarity and stability (utilisation below one)', 'Specific arrival/service distributions (e.g. Poisson/exponential)'],
    dataNeeds: ['Arrival rate', 'Service rate', 'Number of servers'],
    omits: ['Time-varying schedules, priorities and complex routing'],
    failureConditions: ['Applied to an unstable or strongly time-varying system', 'Distributional assumptions not checked'],
    appId: 'queueing',
  },
  {
    id: 'des', name: 'Discrete-event simulation', family: 'processes',
    summary: 'Entities, events and resources over simulated time.',
    purpose: 'Follows individual items through queues and resources to reveal waiting times and bottlenecks.',
    exampleQuestion: 'Which staffing schedule keeps nine in ten waits under ten minutes?',
    suitableQuestions: ['What waiting-time distribution will individuals experience under this schedule?', 'Which staffing rule meets a service level?'],
    representation: 'Entities flowing through activities that use resources; event list', time: 'Event-driven', randomness: 'Stochastic arrivals, service times and routing', aggregation: 'Individual entities',
    assumptions: ['Event logic and routing match the process', 'Input distributions justified', 'Warm-up and run length appropriate'],
    dataNeeds: ['Arrival pattern', 'Service-time distribution', 'Routing between steps', 'Resource schedules'],
    omits: ['Adaptive behaviour of individuals unless explicitly added'],
    failureConditions: ['Single run reported as a result', 'No verification of event logic'],
    appId: 'des',
  },
  {
    id: 'cellular-automata', name: 'Cellular automata', family: 'emergence',
    summary: 'Local update rules on a spatial grid.',
    purpose: 'Shows how simple rules between neighbouring cells create patterns that spread across space.',
    exampleQuestion: 'How fast does a fire spread through a forest of a given density?',
    suitableQuestions: ['How do local spatial rules produce global patterns?', 'How fast does something spread across space?'],
    representation: 'Grid of cells with states and a neighbourhood rule', time: 'Discrete steps', randomness: 'Deterministic or stochastic rules', aggregation: 'Spatial cells',
    assumptions: ['Neighbourhood and update scheme justified', 'Boundary condition chosen deliberately'],
    dataNeeds: ['Spatial layout (grid and neighbourhood)', 'Evidence for local rules'],
    omits: ['Non-spatial interactions and individual mobility'],
    failureConditions: ['Boundary choice drives the result unnoticed', 'Spatial question never stated'],
    appId: 'ca',
  },
  {
    id: 'abm', name: 'Agent-based modelling', family: 'emergence',
    summary: 'Heterogeneous agents following behavioural rules and interacting.',
    purpose: 'Shows how the choices and interactions of different individuals add up to system-wide outcomes.',
    exampleQuestion: 'How do individual route choices add up to a traffic jam?',
    suitableQuestions: ['How does heterogeneous, adaptive behaviour create system outcomes?', 'Who is affected differently by a policy?'],
    representation: 'Agents with attributes and rules in an environment', time: 'Discrete steps or events', randomness: 'Usually stochastic', aggregation: 'Individual agents',
    assumptions: ['Behavioural rules supported by evidence', 'Interaction structure justified', 'Calibration separated from validation'],
    dataNeeds: ['Agent attributes', 'Behaviour rules and the evidence for them', 'Interaction structure'],
    omits: ['Nothing by design — the risk is unjustified detail'],
    failureConditions: ['Hypothetical behaviour presented as fact', 'Emergent pattern over-interpreted from one run'],
    appId: 'abm',
  },
];

export const METHOD_BY_ID: Record<MethodId, MethodRecord> = Object.fromEntries(METHODS.map((m) => [m.id, m])) as Record<MethodId, MethodRecord>;

export function appForMethod(id: MethodId): SpecialistApp {
  return SPECIALIST_APPS[METHOD_BY_ID[id].appId];
}
