import type { Law } from './laws';

/**
 * Convert a discrete law into the sandbox's finite demand list (values + probabilities).
 * Support is trimmed where each tail holds < 1e-4 probability, then renormalised. The
 * dropped mass is reported so the learner can see the approximation; nothing is silent.
 */
export const MAX_DEMAND_VALUES = 60;
export type DemandTransfer =
  | { ok: true; values: number[]; probs: number[]; droppedMass: number; mean: number }
  | { ok: false; reason: string };

export function lawToDemand(law: Law): DemandTransfer {
  if (!law.discrete) return { ok: false, reason: 'Only discrete (count) distributions can become daily arrivals in the sandbox.' };
  const lo = Math.floor(law.inv(1e-4)), hi = Math.ceil(law.inv(1 - 1e-4));
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { ok: false, reason: 'The distribution’s range could not be determined.' };
  if (lo < 0) return { ok: false, reason: 'Daily arrivals cannot be negative; this distribution allows negative values.' };
  const values: number[] = [];
  for (let k = lo; k <= hi; k++) if (law.pdf(k) > 0) values.push(k);
  if (values.length > MAX_DEMAND_VALUES) return { ok: false, reason: `This distribution spreads over ${values.length} values; the sandbox accepts at most ${MAX_DEMAND_VALUES}.` };
  const raw = values.map((k) => law.pdf(k));
  const kept = raw.reduce((a, b) => a + b, 0);
  const probs = raw.map((p) => p / kept);
  return { ok: true, values, probs, droppedMass: Math.max(0, 1 - kept), mean: values.reduce((s, v, i) => s + v * probs[i], 0) };
}
