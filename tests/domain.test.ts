import { describe, expect, it } from 'vitest';
import { emptyAnswers, evaluateRules, RULES, RULE_VERSION } from '../src/domain/methods/rules';
import { METHODS, SPECIALIST_APPS, appForMethod } from '../src/domain/methods/registry';
import { completeness, createProject, passportGaps } from '../src/domain/passport/schema';

describe('method rules', () => {
  it('all-unsure answers → more information needed, with missing-information requests', () => {
    const a = evaluateRules(emptyAnswers());
    expect(a.status).toBe('more-information-needed');
    expect(a.candidates).toHaveLength(0);
    expect(a.missing.length).toBeGreaterThan(0);
    expect(a.ruleVersion).toBe(RULE_VERSION);
  });
  it('latent constructs → both CB-SEM and PLS-SEM with the measurement caveat', () => {
    const a = evaluateRules({ ...emptyAnswers(), latent: 'yes' });
    const ids = a.candidates.map((c) => c.method);
    expect(ids).toEqual(expect.arrayContaining(['cb-sem', 'pls-sem']));
    for (const c of a.candidates.filter((x) => x.method.endsWith('sem'))) expect(c.caveats.join(' ')).toMatch(/measurement model/);
  });
  it('simple queues suggest queueing theory and DES as a complementary alternative', () => {
    const ids = evaluateRules({ ...emptyAnswers(), queues: 'simple' }).candidates.map((c) => c.method);
    expect(ids).toEqual(expect.arrayContaining(['queueing-theory', 'des']));
  });
  it('every candidate exposes at least one human-readable reason; rule ids are unique', () => {
    const a = evaluateRules({ ...emptyAnswers(), feedback: 'yes', heterogeneous: 'yes', spatial: 'yes', uncertainInputs: 'yes', finiteStates: 'yes', concurrency: 'yes', observedRelations: 'yes' });
    expect(a.candidates.length).toBeGreaterThanOrEqual(7);
    for (const c of a.candidates) expect(c.reasons.length).toBeGreaterThan(0);
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });
  it('registry: 11 methods; queueing theory shares the DES Playground; no invented URLs', () => {
    expect(METHODS).toHaveLength(11);
    expect(appForMethod('queueing-theory')).toBe(appForMethod('des'));
    expect(appForMethod('queueing-theory').url).toBe('https://desplayground.netlify.app');
    for (const app of Object.values(SPECIALIST_APPS)) if (app.url) expect(app.urlSource).toBeTruthy();
  });
});

describe('passport completeness is separate from validity and review', () => {
  it('a new project has 0 started sections and lists gaps', () => {
    const d = createProject({ title: 'Untitled project' });
    expect(completeness(d.passport).started).toBe(0);
    expect(passportGaps(d).length).toBeGreaterThan(5);
  });
  it('filling fields changes completeness only, never review status', () => {
    const d = createProject({ title: 'Seats' });
    d.passport.decision.question = 'Q';
    expect(completeness(d.passport).started).toBe(2);
    expect(d.passport.review.final.status).toBe('draft');
  });
});
