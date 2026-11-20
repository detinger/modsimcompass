import { arrivalsForReplication, comparisonKind, configHash, ENGINE_VERSION, generateArrivals, simulateTrace } from './engine';
import { replicationStream, RNG_VERSION } from './rng';
import type { DailyTrace, ReplicationSummary, RunRecord, SandboxConfig } from './types';

/**
 * Batch execution of replications, pure and chunkable. Results depend only on
 * (config, replication index), never on chunk size, worker scheduling or playback speed.
 *
 * Pairing: when baseline and alternative share the same demand process, each
 * replication generates ONE arrival array that both policies consume
 * (“Same arrival traces in each policy pair”). When demand differs, each policy
 * draws from the same per-replication stream (common random numbers) but the
 * comparison is labelled a scenario comparison because inputs differ.
 */

export interface BatchChunk {
  from: number;
  to: number; // exclusive
  baseline: ReplicationSummary[];
  alternative: ReplicationSummary[] | null;
  baselineTrace: DailyTrace | null; // replication 0 only
  alternativeTrace: DailyTrace | null;
  arrivalPreview: number[][]; // replications < PREVIEW_REPS
}

export const PREVIEW_REPS = 5;

export function replicationCount(c: SandboxConfig): number {
  return c.demand.mode === 'random' ? c.replications : 1;
}

export function runChunk(base: SandboxConfig, alt: SandboxConfig | null, from: number, to: number): BatchChunk {
  const paired = alt ? comparisonKind(base, alt) === 'paired-policy' : false;
  const out: BatchChunk = { from, to, baseline: [], alternative: alt ? [] : null, baselineTrace: null, alternativeTrace: null, arrivalPreview: [] };
  for (let r = from; r < to; r++) {
    const arrivals = arrivalsForReplication(base, r);
    const tb = simulateTrace(base, arrivals, r);
    out.baseline.push({ replication: r, ...tb.metrics });
    if (r === 0) out.baselineTrace = tb;
    if (r < PREVIEW_REPS) out.arrivalPreview.push(arrivals);
    if (alt) {
      const altArrivals = paired
        ? arrivals
        : generateArrivals(alt, alt.demand.mode === 'random' ? replicationStream(base.seed, r) : null);
      const ta = simulateTrace(alt, altArrivals, r);
      out.alternative!.push({ replication: r, ...ta.metrics });
      if (r === 0) out.alternativeTrace = ta;
    }
  }
  return out;
}

export function newRunRecord(opts: {
  id: string; projectId: string; modelRevision: number; createdAt: string;
  base: SandboxConfig; alt: SandboxConfig | null;
}): RunRecord {
  const { base, alt } = opts;
  const altCfg = alt ? { ...alt, seed: base.seed, replications: base.replications } : null;
  return {
    id: opts.id,
    projectId: opts.projectId,
    modelRevision: opts.modelRevision,
    modelHash: runHash(base, altCfg),
    engineVersion: ENGINE_VERSION,
    rngVersion: RNG_VERSION,
    seed: base.seed,
    requestedReplications: requiredReplications(base, altCfg),
    completedReplications: 0,
    status: 'running',
    createdAt: opts.createdAt,
    baselineSnapshot: structuredClone(base),
    alternativeSnapshot: altCfg ? structuredClone(altCfg) : null,
    comparisonKind: altCfg ? comparisonKind(base, altCfg) : 'none',
    baseline: { label: 'Baseline', configHash: configHash(base), summaries: [], retainedTrace: null },
    alternative: altCfg ? { label: 'Alternative', configHash: configHash(altCfg), summaries: [], retainedTrace: null } : null,
    arrivalPreview: [],
  };
}

/** Hash identifying the scientific inputs of a whole run (baseline + optional alternative). */
export function runHash(base: SandboxConfig, alt: SandboxConfig | null): string {
  return alt ? `${configHash(base)}-${configHash({ ...alt, seed: base.seed, replications: base.replications })}` : configHash(base);
}

/** Number of replications a run of base/alt requires. Stochastic if either side is stochastic. */
export function requiredReplications(base: SandboxConfig, alt: SandboxConfig | null): number {
  const stochastic = base.demand.mode === 'random' || (alt?.demand.mode === 'random');
  return stochastic ? base.replications : 1;
}

export function applyChunk(run: RunRecord, chunk: BatchChunk): RunRecord {
  const next: RunRecord = { ...run };
  next.baseline = { ...run.baseline, summaries: [...run.baseline.summaries, ...chunk.baseline] };
  if (chunk.baselineTrace) next.baseline.retainedTrace = chunk.baselineTrace;
  if (run.alternative && chunk.alternative) {
    next.alternative = { ...run.alternative, summaries: [...run.alternative.summaries, ...chunk.alternative] };
    if (chunk.alternativeTrace) next.alternative.retainedTrace = chunk.alternativeTrace;
  }
  next.arrivalPreview = [...run.arrivalPreview, ...chunk.arrivalPreview].slice(0, PREVIEW_REPS);
  next.completedReplications = next.baseline.summaries.length;
  return next;
}

/** Synchronous full run (tests, small deterministic runs). */
export function runAll(base: SandboxConfig, alt: SandboxConfig | null, meta: { id: string; projectId: string; modelRevision: number; createdAt: string }): RunRecord {
  const altCfg = alt ? { ...alt, seed: base.seed, replications: base.replications } : null;
  let run = newRunRecord({ ...meta, base, alt: altCfg });
  const n = requiredReplications(base, altCfg);
  run.requestedReplications = n;
  run = applyChunk(run, runChunk(base, altCfg, 0, n));
  run.status = 'complete';
  return run;
}
