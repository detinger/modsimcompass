import { sameData } from '../../../domain/artefacts/clean';
import { comparison } from '../../../domain/artefacts/comparison';
import type { Comparison } from '../../../domain/artefacts/types';
import { lawFor } from '../../../domain/distributions/laws';
import { lawToDemand } from '../../../domain/distributions/transfer';
import { arrivalsForReplication, defaultConfig, ENGINE_VERSION, simulateTrace } from '../../../domain/sandbox/engine';
import { RNG_VERSION } from '../../../domain/sandbox/rng';
import type { SandboxConfig } from '../../../domain/sandbox/types';

/**
 * The example of Fair comparison (docs/LEARN-TOOLBOX-PLAN.md §5.5): a small daily backlog, two capacities, run with and
 * without shared random inputs. Produced by the backlog engine, which is used for nothing else in this tool.
 * Seeded, so everyone sees the same numbers. Example data: never the results of anyone's project.
 */
export const EXAMPLE = {
  days: 30,
  replications: 20,
  meanArrivals: 12,
  baselineCapacity: 11,
  alternativeCapacity: 12,
  seed: 'fair-comparison-example',
} as const;

function config(capacity: number, seed: string): SandboxConfig {
  const c = defaultConfig();
  const demand = lawToDemand(lawFor('poisson', [EXAMPLE.meanArrivals]));
  if (!demand.ok) throw new Error(demand.reason);
  c.horizon = EXAMPLE.days;
  c.initialBacklog = 0;
  c.demand = { ...c.demand, mode: 'random', values: demand.values, probs: demand.probs };
  c.capacity = { ...c.capacity, mode: 'direct', direct: capacity };
  c.replications = EXAMPLE.replications;
  c.seed = seed;
  return c;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Average end-of-day backlog per replication for both capacities. `shared`: in replication i both face the same
 * daily arrivals. Not shared: the alternative draws its arrivals from a separate stream.
 */
export function exampleRuns(shared: boolean): { baseline: number[]; alternative: number[] } {
  const b = config(EXAMPLE.baselineCapacity, EXAMPLE.seed);
  const a = config(EXAMPLE.alternativeCapacity, shared ? EXAMPLE.seed : `${EXAMPLE.seed}/separate`);
  const baseline: number[] = [], alternative: number[] = [];
  for (let r = 0; r < EXAMPLE.replications; r++) {
    const arrB = arrivalsForReplication(b, r);
    const arrA = shared ? arrB : arrivalsForReplication(a, r);
    baseline.push(round2(simulateTrace(b, arrB, r).metrics.averageEndBacklog));
    alternative.push(round2(simulateTrace(a, arrA, r).metrics.averageEndBacklog));
  }
  return { baseline, alternative };
}

export const EXAMPLE_NOTE = (shared: boolean) =>
  `Example data, not results of a project: a small daily backlog model (engine ${ENGINE_VERSION}, generator ${RNG_VERSION}, seed “${EXAMPLE.seed}”). `
  + `Arrivals vary around ${EXAMPLE.meanArrivals} a day; ${EXAMPLE.days} days, ${EXAMPLE.replications} replications. `
  + (shared ? 'In each replication both capacities face the same daily arrivals.' : 'Each capacity faces its own random arrivals.');

/** The example as a comparison artefact's data. Labelled as an example everywhere it appears. */
export function exampleComparison(shared: boolean): Comparison {
  const runs = exampleRuns(shared);
  return {
    ...comparison.empty(),
    outcome: 'Average end-of-day backlog', unit: 'requests', direction: 'lower',
    baselineLabel: `Capacity ${EXAMPLE.baselineCapacity}`, alternativeLabel: `Capacity ${EXAMPLE.alternativeCapacity}`,
    baseline: runs.baseline, alternative: runs.alternative, paired: shared,
    minimumDifference: 8, targetHalfWidth: 1,
    origin: 'example', note: EXAMPLE_NOTE(shared),
  };
}

/**
 * Typed numbers for one policy. Edited numbers are the user's own: an edited example stops being an example, so it is
 * never reported as one; its note about the example model goes, and it is not paired until the user says so.
 * Imported numbers that are edited become entered by hand. Mutates the draft.
 */
export function typeValues(c: Comparison, which: 'baseline' | 'alternative', values: number[]): void {
  if (sameData(c[which], values)) return;
  c[which] = values;
  if (c.origin === 'example') {
    if (c.note === EXAMPLE_NOTE(true) || c.note === EXAMPLE_NOTE(false)) c.note = '';
    c.origin = 'pasted';
    c.paired = false;
  } else if (c.origin === 'imported') c.origin = 'pasted';
}
