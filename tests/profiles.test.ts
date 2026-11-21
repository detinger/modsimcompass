import { describe, expect, it } from 'vitest';
import { METHOD_PROFILES, profileFor } from '../src/domain/methods/profiles';
import { METHODS } from '../src/domain/methods/registry';
import { GENERAL_CHECKS, standardChecks } from '../src/content/checks';

describe('method profiles', () => {
  it('cover every method in the registry, and nothing else', () => {
    expect(Object.keys(METHOD_PROFILES).sort()).toEqual(METHODS.map((m) => m.id).sort());
  });
  it('skip only general checks that exist', () => {
    const ids = new Set(GENERAL_CHECKS.map((c) => c.id));
    for (const [m, p] of Object.entries(METHOD_PROFILES)) for (const id of p.skipGeneral) expect(ids.has(id), `${m}: ${id}`).toBe(true);
  });
  it('agree with themselves: statistical models are estimated, collect measured variables and plan an analysis', () => {
    for (const p of Object.values(METHOD_PROFILES)) {
      if (p.model === 'statistical') expect([p.calibration, p.inputs, p.experiment]).toEqual(['estimation', 'measurement', 'analysis-plan']);
      if (p.experiment === 'policy-experiment') expect(p.stochastic).toBe(true);
      if (!p.stochastic) expect(p.skipGeneral).toContain('g-same-seed');
    }
  });
  it('have no profile without a method', () => {
    expect(profileFor('')).toBeNull();
    expect(profileFor('pls-sem')?.calibration).toBe('estimation');
  });
  it('shape the standard checks: no seed check for a model without random numbers, checks in every group for every method', () => {
    for (const [m, p] of Object.entries(METHOD_PROFILES)) {
      const all = (['verification', 'validation', 'calibration'] as const).map((g) => standardChecks(m as keyof typeof METHOD_PROFILES, g));
      if (!p.stochastic) expect(all[0].general.map((k) => k.id), m).not.toContain('g-same-seed');
      for (const r of all) expect(r.general.length + r.specific.length, m).toBeGreaterThan(0);
    }
  });
});
