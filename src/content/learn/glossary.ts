/**
 * A short glossary in plain language. Alphabetical; one or two lines each.
 * `to` is an optional page in the app where the term is put to work.
 */
export interface GlossaryTerm { term: string; text: string; to?: string }

export const GLOSSARY: GlossaryTerm[] = [
  { term: 'Agent', text: 'An individual in a model with its own attributes and rules of behaviour.', to: '/learn/methods/abm' },
  { term: 'Artefact', text: 'What a Toolbox tool produces, such as a conceptual model or a check plan. It can be exported or added to a project.', to: '/toolbox/artefacts' },
  { term: 'Assumption', text: 'Something taken as true because it cannot be checked right now. Write it down with a way to test it.' },
  { term: 'Baseline', text: 'The current situation, modelled first. Every alternative is compared against it.' },
  { term: 'Boundary', text: 'The line between what the model includes and what it leaves out.', to: '/toolbox/concept' },
  { term: 'Calibration', text: 'Tuning values until the model output matches data. It is not validation.', to: '/toolbox/checks' },
  { term: 'Conceptual model', text: 'The model on paper: objectives, inputs, content, outputs, assumptions and simplifications.', to: '/toolbox/concept' },
  { term: 'Confidence interval', text: 'A range that would capture the true value in most repetitions of the experiment. More replications make it narrower.' },
  { term: 'Deterministic model', text: 'A model with no randomness inside: the same inputs always give the same result.' },
  { term: 'Distribution', text: 'How likely each value of an uncertain quantity is.', to: '/toolbox/data' },
  { term: 'Emergence', text: 'A pattern in the whole system that no single part was told to produce.' },
  { term: 'Entity', text: 'An item that moves through a process: a customer, an order, a patient.', to: '/learn/methods/des' },
  { term: 'Event', text: 'An instant when the state changes, such as an arrival or the end of a service.', to: '/learn/methods/des' },
  { term: 'Feedback loop', text: 'A chain of cause and effect that returns to where it started. It either reinforces a change or balances it.', to: '/learn/methods/system-dynamics' },
  { term: 'Lever', text: 'An input the decision-maker can actually change.' },
  { term: 'Model', text: 'A simplified representation of a system, built to answer a question.' },
  { term: 'Outcome', text: 'The measured result used to judge an option.' },
  { term: 'Paired comparison', text: 'Comparing two options on the same random inputs, so that luck cancels out.', to: '/toolbox/compare' },
  { term: 'Parameter', text: 'A fixed number in the model, such as a rate or a capacity.' },
  { term: 'Random seed', text: 'A starting value that makes a random sequence repeatable.' },
  { term: 'Replication', text: 'One complete run with its own random numbers. Several are needed to see the spread.' },
  { term: 'Resource', text: 'Something with limited capacity that entities need: staff, machines, rooms.' },
  { term: 'Sensitivity analysis', text: 'Changing inputs, one at a time or several together, to see how much the result moves.' },
  { term: 'Simplification', text: 'A deliberate shortcut that keeps the model small enough to understand.' },
  { term: 'Simulation', text: 'Running a model to see how it behaves: over time, or many times over with random inputs.' },
  { term: 'State', text: 'Everything needed to describe the system at one moment.', to: '/learn/methods/markov-chains' },
  { term: 'Steady state', text: 'The long-run behaviour, after the effects of the starting conditions have faded.' },
  { term: 'Stochastic model', text: 'A model with randomness inside: runs with different random numbers give different results. The same seed repeats a run.' },
  { term: 'Stock and flow', text: 'A stock accumulates. Flows fill it and drain it.', to: '/learn/methods/system-dynamics' },
  { term: 'Validation', text: 'Is it the right model? The model is compared with the real system, for the stated purpose.', to: '/toolbox/checks' },
  { term: 'Verification', text: 'Is it built right? The program is compared with the conceptual model.', to: '/toolbox/checks' },
  { term: 'Warm-up period', text: 'The start of a run, discarded because the model has not yet reached typical conditions.' },
];

/** The address-safe id of a term, for links such as `/learn/glossary#term-random-seed`. */
export const termId = (term: string): string => `term-${term.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
/** The glossary entry of a term. */
export const glossaryHref = (term: string): string => `/learn/glossary#${termId(term)}`;
