import { describe, expect, it } from 'vitest';
import {
  arrivalsForReplication, changedInputs, comparisonKind, configHash, conservationHolds, defaultConfig,
  normaliseProbabilities, sampleDiscrete, simulateTrace, validateConfig,
} from '../src/domain/sandbox/engine';
import type { SandboxConfig } from '../src/domain/sandbox/types';
import { createRng, cyrb128, replicationStream } from '../src/domain/sandbox/rng';
import { applyChunk, newRunRecord, runAll, runChunk } from '../src/domain/sandbox/experiment';
import { histogram, mean, pairedDifferences, quantile, sampleSD, tInterval, tQuantile } from '../src/domain/sandbox/stats';

function cfg(over: Partial<SandboxConfig> & { A?: number | number[]; C?: number | number[] }): SandboxConfig {
  const c = defaultConfig();
  const { A, C, ...rest } = over;
  Object.assign(c, rest);
  if (Array.isArray(A)) c.demand = { ...c.demand, mode: 'list', list: A };
  else if (typeof A === 'number') c.demand = { ...c.demand, mode: 'constant', constant: A };
  if (Array.isArray(C)) c.capacity = { ...c.capacity, mode: 'list', list: C };
  else if (typeof C === 'number') c.capacity = { ...c.capacity, mode: 'direct', direct: C };
  return c;
}
const run = (c: SandboxConfig) => {
  expect(validateConfig(c)).toEqual([]);
  return simulateTrace(c, arrivalsForReplication(c, 0));
};

describe('PLAN §6.3 fixed scientific fixtures', () => {
  it('Accumulation: B0=0, A=12, C=10, 5 days → 2,4,6,8,10; served 50', () => {
    const t = run(cfg({ horizon: 5, initialBacklog: 0, A: 12, C: 10 }));
    expect(t.rows.map((r) => r.endBacklog)).toEqual([2, 4, 6, 8, 10]);
    expect(t.metrics.totalServed).toBe(50);
    expect(t.metrics.terminalBacklog).toBe(10);
    expect(conservationHolds(t)).toBe(true);
  });
  it('Balanced: A=10, C=10 → backlog stays 0', () => {
    const t = run(cfg({ horizon: 30, initialBacklog: 0, A: 10, C: 10 }));
    expect(t.rows.every((r) => r.endBacklog === 0)).toBe(true);
    expect(t.metrics.utilisation).toBe(1);
  });
  it('Drain: B0=20, A=5, C=10 → 15,10,5,0,0; served 45', () => {
    const t = run(cfg({ horizon: 5, initialBacklog: 20, A: 5, C: 10 }));
    expect(t.rows.map((r) => r.endBacklog)).toEqual([15, 10, 5, 0, 0]);
    expect(t.metrics.totalServed).toBe(45);
    expect(t.metrics.utilisation).toBeCloseTo(45 / 50, 12);
  });
  it('Closed: B0=3, arrivals [2,4], capacities [0,0] → 5,9; served 0; utilisation undefined', () => {
    const t = run(cfg({ horizon: 2, initialBacklog: 3, A: [2, 4], C: [0, 0] }));
    expect(t.rows.map((r) => r.endBacklog)).toEqual([5, 9]);
    expect(t.metrics.totalServed).toBe(0);
    expect(t.metrics.utilisation).toBeNull();
  });
  it('Abandonment: A=12, C=10, f=.25, one day → served 10, abandoned .5, ending 1.5', () => {
    const c = cfg({ horizon: 1, initialBacklog: 0, A: 12, C: 10 });
    c.abandonment = { enabled: true, fraction: 0.25 };
    const t = run(c);
    expect(t.rows[0].served).toBe(10);
    expect(t.rows[0].abandoned).toBeCloseTo(0.5, 12);
    expect(t.rows[0].endBacklog).toBeCloseTo(1.5, 12);
    expect(t.metrics.totalAbandoned).toBeCloseTo(0.5, 12);
  });
  it('Feedback identity: alpha=0 reproduces the base model exactly for every fixture', () => {
    const fixtures = [
      cfg({ horizon: 5, initialBacklog: 0, A: 12, C: 10 }),
      cfg({ horizon: 5, initialBacklog: 20, A: 5, C: 10 }),
      cfg({ horizon: 2, initialBacklog: 3, A: [2, 4], C: [0, 0] }),
    ];
    for (const base of fixtures) {
      const fb = structuredClone(base);
      fb.feedback = { enabled: true, alpha: 0 };
      expect(run(fb).rows).toEqual(run(base).rows);
    }
  });
  it('Feedback reduces effective capacity when backlog is positive', () => {
    const c = cfg({ horizon: 3, initialBacklog: 10, A: 10, C: 10 });
    c.feedback = { enabled: true, alpha: 0.1 };
    const t = run(c);
    expect(t.rows[0].effectiveCapacity).toBeCloseTo(10 / 2, 12);
    expect(conservationHolds(t)).toBe(true);
  });
});

describe('conservation, schedules, capacity modes and costs', () => {
  it('conservation holds across random fractional scenarios', () => {
    const c = defaultConfig();
    c.demand.mode = 'random';
    c.abandonment = { enabled: true, fraction: 0.137 };
    c.feedback = { enabled: true, alpha: 0.03 };
    c.horizon = 120;
    for (let r = 0; r < 20; r++) expect(conservationHolds(simulateTrace(c, arrivalsForReplication(c, r)))).toBe(true);
  });
  it('closed days have zero capacity but receive arrivals', () => {
    const c = cfg({ horizon: 7, initialBacklog: 0, A: 10, C: 10 });
    c.schedule.enabled = true;
    const t = run(c);
    expect(t.rows[5].effectiveCapacity).toBe(0);
    expect(t.rows[5].arrivals).toBe(10);
    expect(t.rows.map((r) => r.endBacklog)).toEqual([0, 0, 0, 0, 0, 10, 20]);
  });
  it('staff capacity = staff × productivity; staff cost on paid days only; inactive controls ignored', () => {
    const c = cfg({ horizon: 7, initialBacklog: 0, A: 8 });
    c.capacity = { ...c.capacity, mode: 'staff', staff: 2, productivity: 5, direct: 999 };
    c.schedule = { enabled: true, openDays: [true, true, true, true, true, false, false], paidDays: [true, true, true, true, true, true, false] };
    c.cost = { enabled: true, costPerStaffDay: 100, holdingRate: 1, currency: 'EUR' };
    const t = run(c);
    expect(t.rows[0].nominalCapacity).toBe(10);
    expect(t.metrics.totalStaffCost).toBe(2 * 100 * 6);
    expect(t.metrics.totalHoldingCost).toBe(t.rows.reduce((s, r) => s + r.endBacklog, 0));
  });
  it('direct capacity has no staff cost (undefined, not zero)', () => {
    const c = cfg({ horizon: 3, A: 5, C: 5 });
    c.cost.enabled = true;
    expect(run(c).metrics.totalStaffCost).toBeNull();
  });
});

describe('validation rejects invalid inputs without clipping', () => {
  it('rejects negative, non-finite and out-of-range values', () => {
    const c = defaultConfig();
    c.capacity.direct = -1;
    c.initialBacklog = Number.NaN;
    c.horizon = 0;
    const paths = validateConfig(c).map((e) => e.path);
    expect(paths).toContain('capacity.direct');
    expect(paths).toContain('initialBacklog');
    expect(paths).toContain('horizon');
    expect(c.capacity.direct).toBe(-1); // not silently clipped
  });
  it('rejects probabilities not summing to one; normalisation is explicit', () => {
    const c = defaultConfig();
    c.demand = { ...c.demand, mode: 'random', values: [8, 12, 16], probs: [0.2, 0.5, 0.2] };
    expect(validateConfig(c).some((e) => e.path === 'demand.probs')).toBe(true);
    const n = normaliseProbabilities(c.demand.probs)!;
    expect(n.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(c.demand.probs).toEqual([0.2, 0.5, 0.2]);
  });
  it('abandonment fraction outside [0,1] is invalid', () => {
    const c = defaultConfig();
    c.abandonment = { enabled: true, fraction: 1.2 };
    expect(validateConfig(c).some((e) => e.path === 'abandonment.fraction')).toBe(true);
  });
});

describe('seeded RNG and sampler', () => {
  it('reference vectors for sfc32-cyrb128-v1 are stable', () => {
    expect(cyrb128('modsim-1')).toEqual(REF_HASH);
    const r = createRng('modsim-1');
    expect([r(), r(), r()].map((v) => Math.round(v * 1e9))).toEqual(REF_UNIFORMS);
  });
  it('same seed + replication → identical stream; different replication → different stream', () => {
    const a = replicationStream('s', 3), b = replicationStream('s', 3), c = replicationStream('s', 4);
    const va = [a(), a(), a()], vb = [b(), b(), b()], vc = [c(), c(), c()];
    expect(va).toEqual(vb);
    expect(va).not.toEqual(vc);
    va.forEach((u) => { expect(u).toBeGreaterThanOrEqual(0); expect(u).toBeLessThan(1); });
  });
  it('inverse-CDF sampling boundaries', () => {
    const v = [8, 12, 16], p = [0.25, 0.5, 0.25];
    expect(sampleDiscrete(v, p, 0)).toBe(8);
    expect(sampleDiscrete(v, p, 0.2499)).toBe(8);
    expect(sampleDiscrete(v, p, 0.25)).toBe(12);
    expect(sampleDiscrete(v, p, 0.75)).toBe(16);
    expect(sampleDiscrete(v, p, 0.999999)).toBe(16);
  });
  it('empirical mean of default demand approaches 12', () => {
    const c = defaultConfig();
    c.demand.mode = 'random';
    c.horizon = 365;
    const all = Array.from({ length: 50 }, (_, r) => arrivalsForReplication(c, r)).flat();
    expect(Math.abs(mean(all) - 12)).toBeLessThan(0.2);
  });
});

describe('replications, pairing and chunk independence', () => {
  const base = () => { const c = defaultConfig(); c.demand.mode = 'random'; c.replications = 40; return c; };
  it('results do not depend on chunking (worker scheduling)', () => {
    const b = base(), a = { ...base(), capacity: { ...base().capacity, direct: 12 } };
    const meta = { id: 'r', projectId: 'p', modelRevision: 1, createdAt: 'x' };
    const whole = runAll(b, a, meta);
    let chunked = newRunRecord({ ...meta, base: b, alt: a });
    for (const [f, t] of [[0, 7], [7, 8], [8, 40]]) chunked = applyChunk(chunked, runChunk(b, a, f, t));
    expect(chunked.baseline.summaries).toEqual(whole.baseline.summaries);
    expect(chunked.alternative!.summaries).toEqual(whole.alternative!.summaries);
  });
  it('policy pairs share identical arrival arrays; scenario comparisons are labelled', () => {
    const b = base(), a = structuredClone(b);
    a.capacity.direct = 12;
    expect(comparisonKind(b, a)).toBe('paired-policy');
    const run1 = runAll(b, a, { id: 'r', projectId: 'p', modelRevision: 1, createdAt: 'x' });
    const bt = run1.baseline.retainedTrace!, at = run1.alternative!.retainedTrace!;
    expect(at.rows.map((r) => r.arrivals)).toEqual(bt.rows.map((r) => r.arrivals));
    for (let i = 0; i < 40; i++) expect(run1.alternative!.summaries[i].totalArrivals).toBe(run1.baseline.summaries[i].totalArrivals);
    const s = structuredClone(b);
    s.demand.values = [6, 12, 18];
    expect(comparisonKind(b, s)).toBe('scenario');
    expect(changedInputs(b, s)).toEqual(['Demand']);
  });
  it('seeded replay is identical', () => {
    const meta = { id: 'r', projectId: 'p', modelRevision: 1, createdAt: 'x' };
    expect(runAll(base(), null, meta).baseline.summaries).toEqual(runAll(base(), null, meta).baseline.summaries);
  });
  it('deterministic demand needs exactly one replication', () => {
    const c = defaultConfig();
    const r = runAll(c, null, { id: 'r', projectId: 'p', modelRevision: 1, createdAt: 'x' });
    expect(r.requestedReplications).toBe(1);
    expect(r.completedReplications).toBe(1);
  });
  it('hash ignores inactive drafts and changes with scientific inputs', () => {
    const c = defaultConfig();
    const h = configHash(c);
    const inactive = structuredClone(c);
    inactive.abandonment.fraction = 0.9; // disabled
    inactive.capacity.staff = 99; // direct mode
    expect(configHash(inactive)).toBe(h);
    const changed = structuredClone(c);
    changed.capacity.direct = 11;
    expect(configHash(changed)).not.toBe(h);
  });
});

describe('statistics against independent references', () => {
  it('t quantiles match published tables', () => {
    const ref: [number, number][] = [[1, 12.7062047], [2, 4.3026527], [5, 2.5705818], [9, 2.2621572], [29, 2.0452296], [99, 1.9842169]];
    for (const [df, q] of ref) expect(tQuantile(0.975, df)).toBeCloseTo(q, 6);
  });
  it('mean, SD and type-7 quantiles', () => {
    const xs = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(mean(xs)).toBe(5);
    expect(sampleSD(xs)).toBeCloseTo(2.1380899, 6); // R: sd(c(2,4,4,4,5,5,7,9))
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.05)).toBeCloseTo(1.45, 10); // R type 7
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95)).toBeCloseTo(9.55, 10);
    expect(quantile([3, 1, 2], 0.5)).toBe(2);
  });
  it('t interval reference and n=1 unavailability', () => {
    const ci = tInterval([10, 12, 14, 16, 18]);
    // mean 14, sd = sqrt(10) = 3.1623, t(.975,4) = 2.7764451 → hw = 3.9264
    expect(ci.mean).toBe(14);
    expect(ci.halfWidth!).toBeCloseTo(2.7764451 * Math.sqrt(10) / Math.sqrt(5), 5);
    expect(tInterval([5]).unavailableReason).toBe('Interval unavailable: one replication.');
  });
  it('paired differences: alternative − baseline per replication', () => {
    const d = pairedDifferences([10, 8, 12], [7, 6, 9]);
    expect(d).toEqual([-3, -2, -3]);
    expect(mean(d)).toBeCloseTo(-8 / 3, 12);
  });
  it('histogram counts all observations', () => {
    const xs = [1, 2, 2, 3, 9, 10];
    expect(histogram(xs, 3).reduce((s, b) => s + b.count, 0)).toBe(6);
  });
});

// Pinned regression vectors (generated once from the documented algorithm).
const REF_HASH: [number, number, number, number] = [1023335733, 1867084240, 1033647875, 895353781];
const REF_UNIFORMS: number[] = [628599494, 185166312, 884275444];
