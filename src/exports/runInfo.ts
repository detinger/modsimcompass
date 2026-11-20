import { runHash } from '../domain/sandbox/experiment';
import type { RunRecord } from '../domain/sandbox/types';
import type { ProjectDoc } from '../domain/passport/schema';

/** A run is stale when the current scientific inputs no longer match its snapshot hash. */
export function runIsStale(doc: ProjectDoc): boolean {
  const run = doc.sandbox.lastRun;
  if (!run) return false;
  return run.modelHash !== runHash(doc.sandbox.baseline, doc.sandbox.alternative);
}

export function describeRunStatus(run: RunRecord): string {
  if (run.status === 'partial') return `${run.completedReplications} of ${run.requestedReplications} replications completed. Results are partial.`;
  if (run.status === 'failed') return `Run failed${run.error ? `: ${run.error}` : ''}.`;
  if (run.status === 'running') return `Running: ${run.completedReplications} of ${run.requestedReplications} replications.`;
  return `${run.completedReplications} replication${run.completedReplications === 1 ? '' : 's'} completed.`;
}

/** Unlocalised number for reports: rounded, dot decimal, “—” when undefined. */
export function fmt(n: number | null | undefined, dp = 2): string {
  return n === null || n === undefined || !Number.isFinite(n) ? '—' : (Math.round(n * 10 ** dp) / 10 ** dp).toString();
}
