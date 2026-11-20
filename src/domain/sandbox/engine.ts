import type { DailyRow, DailyTrace, FieldError, SandboxConfig, TraceMetrics } from './types';
import { replicationStream, type Uniform } from './rng';

/**
 * Daily aggregate backlog recurrence (PLAN §6.2). Pure; no UI, no Math.random.
 *
 *   available[t] = B[t] + A[t]
 *   served[t]    = min(available[t], effectiveCapacity[t])
 *   remaining[t] = available[t] − served[t]
 *   abandoned[t] = abandonmentFraction · remaining[t]
 *   B[t+1]       = remaining[t] − abandoned[t]
 *
 * effectiveCapacity[t] = C[t]                       (base)
 *                      = C[t] / (1 + α · B[t])      (optional hypothetical feedback rule)
 */
export const ENGINE_VERSION = 'backlog-daily-v1';
export const CONSERVATION_TOLERANCE = 1e-9;
export const PROBABILITY_TOLERANCE = 1e-6;
export const MAX_HORIZON = 365;
export const MAX_REPLICATIONS = 10000;
export const MAX_DISCRETE_VALUES = 60;

export function defaultConfig(): SandboxConfig {
  return {
    horizon: 30,
    initialBacklog: 0,
    demand: { mode: 'constant', constant: 12, values: [8, 12, 16], probs: [0.25, 0.5, 0.25], list: [] },
    capacity: { mode: 'direct', direct: 10, staff: 2, productivity: 5, list: [] },
    schedule: {
      enabled: false,
      openDays: [true, true, true, true, true, false, false],
      paidDays: [true, true, true, true, true, false, false],
    },
    abandonment: { enabled: false, fraction: 0.1 },
    feedback: { enabled: false, alpha: 0.01 },
    cost: { enabled: false, costPerStaffDay: 120, holdingRate: 0, currency: 'EUR' },
    replications: 100,
    seed: 'modsim-1',
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function validateConfig(c: SandboxConfig): FieldError[] {
  const errs: FieldError[] = [];
  const nonneg = (path: string, v: unknown, label: string) => {
    if (!isNum(v) || v < 0) errs.push({ path, message: `${label} must be a finite, nonnegative value.` });
  };
  if (!Number.isInteger(c.horizon) || c.horizon < 1 || c.horizon > MAX_HORIZON) {
    errs.push({ path: 'horizon', message: `Horizon must be a whole number of days from 1 to ${MAX_HORIZON}.` });
  }
  nonneg('initialBacklog', c.initialBacklog, 'Initial backlog');
  const d = c.demand;
  if (d.mode === 'constant') nonneg('demand.constant', d.constant, 'Arrivals per day');
  if (d.mode === 'list') {
    if (d.list.length !== c.horizon) errs.push({ path: 'demand.list', message: `Provide exactly one arrival value per day (${c.horizon}).` });
    d.list.forEach((v, i) => nonneg(`demand.list`, v, `Arrivals on day ${i + 1}`));
  }
  if (d.mode === 'random') {
    errs.push(...validateDiscrete(d.values, d.probs));
  }
  const cap = c.capacity;
  if (cap.mode === 'direct') nonneg('capacity.direct', cap.direct, 'Capacity');
  if (cap.mode === 'staff') {
    nonneg('capacity.staff', cap.staff, 'Staff count');
    nonneg('capacity.productivity', cap.productivity, 'Productivity');
  }
  if (cap.mode === 'list') {
    if (cap.list.length !== c.horizon) errs.push({ path: 'capacity.list', message: `Provide exactly one capacity value per day (${c.horizon}).` });
    cap.list.forEach((v, i) => nonneg('capacity.list', v, `Capacity on day ${i + 1}`));
  }
  if (c.schedule.enabled) {
    if (c.schedule.openDays.length !== 7 || c.schedule.paidDays.length !== 7) {
      errs.push({ path: 'schedule', message: 'Weekly schedule needs seven open/paid flags.' });
    }
  }
  if (c.abandonment.enabled) {
    const f = c.abandonment.fraction;
    if (!isNum(f) || f < 0 || f > 1) errs.push({ path: 'abandonment.fraction', message: 'Abandonment fraction must be between 0 and 1.' });
  }
  if (c.feedback.enabled) nonneg('feedback.alpha', c.feedback.alpha, 'Feedback α');
  if (c.cost.enabled) {
    nonneg('cost.costPerStaffDay', c.cost.costPerStaffDay, 'Cost per paid staff-day');
    nonneg('cost.holdingRate', c.cost.holdingRate, 'Backlog holding rate');
  }
  if (!Number.isInteger(c.replications) || c.replications < 1 || c.replications > MAX_REPLICATIONS) {
    errs.push({ path: 'replications', message: `Replications must be a whole number from 1 to ${MAX_REPLICATIONS}.` });
  }
  if (typeof c.seed !== 'string' || c.seed.length === 0 || c.seed.length > 64) {
    errs.push({ path: 'seed', message: 'Seed must be 1–64 characters.' });
  }
  return errs;
}

export function validateDiscrete(values: number[], probs: number[]): FieldError[] {
  const errs: FieldError[] = [];
  if (values.length === 0 || values.length !== probs.length) {
    errs.push({ path: 'demand.values', message: 'Each demand value needs exactly one probability.' });
    return errs;
  }
  if (values.length > MAX_DISCRETE_VALUES) errs.push({ path: 'demand.values', message: `Use at most ${MAX_DISCRETE_VALUES} values.` });
  values.forEach((v) => {
    if (!isNum(v) || v < 0) errs.push({ path: 'demand.values', message: 'Demand values must be finite and nonnegative.' });
  });
  let sum = 0;
  probs.forEach((p) => {
    if (!isNum(p) || p < 0) errs.push({ path: 'demand.probs', message: 'Probabilities must be finite and nonnegative.' });
    else sum += p;
  });
  if (Math.abs(sum - 1) > PROBABILITY_TOLERANCE) {
    errs.push({ path: 'demand.probs', message: `Probabilities sum to ${round(sum, 6)}, not 1 (tolerance ${PROBABILITY_TOLERANCE}). Use “Normalise” to preview a correction.` });
  }
  return errs;
}

/** Explicit, previewable normalisation; never applied silently. */
export function normaliseProbabilities(probs: number[]): number[] | null {
  const sum = probs.reduce((a, b) => a + (isNum(b) && b > 0 ? b : 0), 0);
  if (sum <= 0) return null;
  return probs.map((p) => (isNum(p) && p > 0 ? p / sum : 0));
}

export function discreteMean(values: number[], probs: number[]): number {
  return values.reduce((s, v, i) => s + v * probs[i], 0);
}

/** Inverse-CDF sampling from a finite discrete distribution. */
export function sampleDiscrete(values: number[], probs: number[], u: number): number {
  let cum = 0;
  for (let i = 0; i < values.length; i++) {
    cum += probs[i];
    if (u < cum) return values[i];
  }
  return values[values.length - 1];
}

/**
 * Arrival array for one replication. Deterministic modes ignore the stream.
 * In random mode one uniform is drawn per day, in day order.
 */
export function generateArrivals(c: SandboxConfig, rng: Uniform | null): number[] {
  const out: number[] = new Array(c.horizon);
  for (let t = 0; t < c.horizon; t++) {
    if (c.demand.mode === 'constant') out[t] = c.demand.constant;
    else if (c.demand.mode === 'list') out[t] = c.demand.list[t];
    else {
      if (!rng) throw new Error('Random demand requires an RNG stream.');
      out[t] = sampleDiscrete(c.demand.values, c.demand.probs, rng());
    }
  }
  return out;
}

export function arrivalsForReplication(c: SandboxConfig, replication: number): number[] {
  return generateArrivals(c, c.demand.mode === 'random' ? replicationStream(c.seed, replication) : null);
}

function dayFlags(c: SandboxConfig, t: number): { open: boolean; paid: boolean } {
  if (!c.schedule.enabled) return { open: true, paid: true };
  return { open: c.schedule.openDays[t % 7], paid: c.schedule.paidDays[t % 7] };
}

/** Nominal capacity C[t] before the optional feedback rule. Closed days → 0. */
export function nominalCapacity(c: SandboxConfig, t: number): number {
  const { open } = dayFlags(c, t);
  if (c.capacity.mode === 'list') return open ? c.capacity.list[t] : 0;
  if (!open) return 0;
  return c.capacity.mode === 'direct' ? c.capacity.direct : c.capacity.staff * c.capacity.productivity;
}

/** Run one complete trajectory for a given arrival array. Caller validates config. */
export function simulateTrace(c: SandboxConfig, arrivals: number[], replication = 0): DailyTrace {
  const rows: DailyRow[] = [];
  let B = c.initialBacklog;
  const frac = c.abandonment.enabled ? c.abandonment.fraction : 0;
  const alpha = c.feedback.enabled ? c.feedback.alpha : 0;
  const staffCostEnabled = c.cost.enabled && c.capacity.mode === 'staff';
  for (let t = 0; t < c.horizon; t++) {
    const { open, paid } = dayFlags(c, t);
    const A = arrivals[t];
    const nominal = nominalCapacity(c, t);
    const effective = alpha === 0 ? nominal : nominal / (1 + alpha * B);
    const available = B + A;
    const served = Math.min(available, effective);
    const remaining = available - served;
    const abandoned = frac * remaining;
    const end = remaining - abandoned;
    const staffCost = staffCostEnabled ? c.capacity.staff * c.cost.costPerStaffDay * (paid ? 1 : 0) : null;
    const holdingCost = c.cost.enabled ? c.cost.holdingRate * end : null;
    rows.push({
      day: t + 1,
      startBacklog: B,
      arrivals: A,
      open,
      paid,
      nominalCapacity: nominal,
      effectiveCapacity: effective,
      available,
      served,
      remaining,
      abandoned,
      endBacklog: end,
      staffCost,
      holdingCost,
      residual: B + A - served - abandoned - end,
    });
    B = end;
  }
  return { replication, rows, metrics: computeMetrics(c, rows) };
}

export function computeMetrics(c: SandboxConfig, rows: DailyRow[]): TraceMetrics {
  let arr = 0, srv = 0, ab = 0, endSum = 0, cap = 0, staff = 0, hold = 0, maxRes = 0;
  for (const r of rows) {
    arr += r.arrivals; srv += r.served; ab += r.abandoned; endSum += r.endBacklog;
    cap += r.effectiveCapacity;
    staff += r.staffCost ?? 0; hold += r.holdingCost ?? 0;
    maxRes = Math.max(maxRes, Math.abs(r.residual));
  }
  const staffEnabled = c.cost.enabled && c.capacity.mode === 'staff';
  return {
    totalArrivals: arr,
    totalServed: srv,
    totalAbandoned: ab,
    terminalBacklog: rows.length ? rows[rows.length - 1].endBacklog : c.initialBacklog,
    averageEndBacklog: rows.length ? endSum / rows.length : 0,
    totalEffectiveCapacity: cap,
    utilisation: cap > 0 ? srv / cap : null,
    totalStaffCost: staffEnabled ? staff : null,
    totalHoldingCost: c.cost.enabled ? hold : null,
    totalCost: c.cost.enabled ? (staffEnabled ? staff : 0) + hold : null,
    maxAbsResidual: maxRes,
  };
}

/** Conservation check across a trace using the documented tolerance (scaled by magnitude). */
export function conservationHolds(trace: DailyTrace, tol = CONSERVATION_TOLERANCE): boolean {
  return trace.rows.every((r) => Math.abs(r.residual) <= tol * Math.max(1, r.startBacklog + r.arrivals));
}

/**
 * Canonical scientific inputs only: inactive controls, notes, layout and timestamps excluded.
 * Changing an inactive draft value does not change the hash.
 */
export function canonicalInputs(c: SandboxConfig): Record<string, unknown> {
  const o: Record<string, unknown> = { engine: ENGINE_VERSION, horizon: c.horizon, initialBacklog: c.initialBacklog };
  const d = c.demand;
  o.demand = d.mode === 'constant' ? { mode: d.mode, constant: d.constant }
    : d.mode === 'list' ? { mode: d.mode, list: d.list }
    : { mode: d.mode, values: d.values, probs: d.probs };
  const cap = c.capacity;
  o.capacity = cap.mode === 'direct' ? { mode: cap.mode, direct: cap.direct }
    : cap.mode === 'staff' ? { mode: cap.mode, staff: cap.staff, productivity: cap.productivity }
    : { mode: cap.mode, list: cap.list };
  if (c.schedule.enabled) o.schedule = { open: c.schedule.openDays, paid: c.schedule.paidDays };
  if (c.abandonment.enabled) o.abandonment = c.abandonment.fraction;
  if (c.feedback.enabled) o.feedback = c.feedback.alpha;
  if (c.cost.enabled) o.cost = { staff: c.cost.costPerStaffDay, hold: c.cost.holdingRate, currency: c.cost.currency };
  if (d.mode === 'random') { o.replications = c.replications; o.seed = c.seed; }
  return o;
}

export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const keys = Object.keys(v as object).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(',')}}`;
}

/** FNV-1a 32-bit hex hash. Identifies inputs; not a security primitive. */
export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function configHash(c: SandboxConfig): string {
  return fnv1a(stableStringify(canonicalInputs(c)));
}

export function isStochastic(c: SandboxConfig): boolean {
  return c.demand.mode === 'random';
}

/** Readable list of scientific differences between two configs (for comparison panels). */
export function changedInputs(a: SandboxConfig, b: SandboxConfig): string[] {
  const ca = canonicalInputs(a), cb = canonicalInputs(b);
  const keys = new Set([...Object.keys(ca), ...Object.keys(cb)]);
  const labels: Record<string, string> = {
    horizon: 'Horizon', initialBacklog: 'Initial backlog', demand: 'Demand', capacity: 'Capacity',
    schedule: 'Weekly schedule', abandonment: 'Abandonment', feedback: 'Feedback rule', cost: 'Cost settings',
    replications: 'Replications', seed: 'Seed',
  };
  const out: string[] = [];
  for (const k of keys) {
    if (k === 'engine') continue;
    if (stableStringify(ca[k]) !== stableStringify(cb[k])) out.push(labels[k] ?? k);
  }
  return out;
}

/** Comparison semantics: a changed arrival process is a scenario comparison, not a policy effect. */
export function comparisonKind(a: SandboxConfig, b: SandboxConfig): 'paired-policy' | 'scenario' {
  const demandSame = stableStringify(canonicalInputs(a).demand) === stableStringify(canonicalInputs(b).demand)
    && a.horizon === b.horizon;
  return demandSame ? 'paired-policy' : 'scenario';
}

export function round(v: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}
