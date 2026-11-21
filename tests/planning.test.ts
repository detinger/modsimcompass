import { describe, expect, it } from 'vitest';
import { checkpointReadiness, compassWarnings, laterSteps, setStillPlanning, stillPlanning } from '../src/domain/passport/compass';
import { parseProjectJson } from '../src/domain/passport/importer';
import { createProject, type ProjectDoc } from '../src/domain/passport/schema';
import { passportHtml } from '../src/exports/html';
import { passportMarkdown } from '../src/exports/markdown';
import { projectJson } from '../src/exports/projectFile';

const of = (doc: ProjectDoc, step: string) => compassWarnings(doc).filter((w) => w.step === step);
const gaps = (doc: ProjectDoc, step: string) => of(doc, step).filter((w) => w.severity === 'gap').map((w) => w.id);

/** “Still planning” on every step (compass-rules-v5): what step 7 did, every step can now do. */
describe('still planning, on every step', () => {
  it('an empty step marked as still planning lists nothing as missing, only that it comes later', () => {
    const d = createProject();
    expect(gaps(d, 'evaluation')).toEqual(['verification', 'validation']);
    expect(checkpointReadiness(d, 'baseline').length).toBe(2);
    setStillPlanning(d.passport, 'evaluation', true);
    expect(gaps(d, 'evaluation')).toEqual([]);
    expect(of(d, 'evaluation').map((w) => [w.id, w.severity])).toEqual([['planning-evaluation', 'tip']]);
    // As for step 7: the checkpoint does not count what is due later.
    expect(checkpointReadiness(d, 'baseline')).toEqual([]);
    // Other steps are untouched.
    expect(gaps(d, 'frame').length).toBeGreaterThan(0);
  });

  it('once something is written in the step, the usual open items come back', () => {
    const d = createProject();
    setStillPlanning(d.passport, 'evaluation', true);
    d.passport.evaluation.verification = 'Units and a known simple case.';
    expect(gaps(d, 'evaluation')).toEqual(['validation']);
    expect(of(d, 'evaluation').some((w) => w.id === 'planning-evaluation')).toBe(false);
  });

  it('any field written in the step brings its open items back', () => {
    const d = createProject();
    setStillPlanning(d.passport, 'scope', true);
    expect(gaps(d, 'scope')).toEqual([]);
    d.passport.scope.boundary = 'The helpdesk queue.';
    expect(gaps(d, 'scope').length).toBeGreaterThan(0);
  });

  it('is stored for steps 1 to 6 in step order; step 7 keeps the project’s planning stage', () => {
    const d = createProject();
    setStillPlanning(d.passport, 'experiment', true);
    setStillPlanning(d.passport, 'frame', true);
    setStillPlanning(d.passport, 'frame', true);
    expect(d.passport.identity.later).toEqual(['frame', 'experiment']);
    expect(laterSteps(d.passport).map((s) => s.number)).toEqual([1, 6]);
    setStillPlanning(d.passport, 'conclude', true);
    expect(d.passport.identity.stage).toBe('planning');
    expect(d.passport.identity.later).toEqual(['frame', 'experiment']);
    expect(stillPlanning(d.passport, 'conclude')).toBe(true);
    setStillPlanning(d.passport, 'frame', false);
    setStillPlanning(d.passport, 'experiment', false);
    expect(d.passport.identity).not.toHaveProperty('later');
    expect(stillPlanning(d.passport, 'frame')).toBe(false);
  });

  it('survives a project file; unknown or repeated steps are dropped on import', () => {
    const d = createProject();
    setStillPlanning(d.passport, 'inputs', true);
    const back = parseProjectJson(projectJson(d));
    expect(back.ok && back.project.passport.identity.later).toEqual(['inputs']);
    const raw = JSON.parse(projectJson(d));
    raw.passport.identity.later = ['scope', 'bogus', 'frame', 'frame', 'conclude', 7];
    const cleaned = parseProjectJson(JSON.stringify(raw));
    expect(cleaned.ok && cleaned.project.passport.identity.later).toEqual(['frame', 'scope']);
    raw.passport.identity.later = 'frame';
    const none = parseProjectJson(JSON.stringify(raw));
    expect(none.ok && none.project.passport.identity).not.toHaveProperty('later');
  });

  it('the reports say which steps are still being planned', () => {
    const d = createProject({ title: 'Planned' });
    setStillPlanning(d.passport, 'scope', true);
    setStillPlanning(d.passport, 'evaluation', true);
    expect(passportMarkdown(d)).toContain('Still planning: step 2 (Concept and scope), step 5 (Verification and validation). They come later.');
    expect(passportHtml(d)).toContain('<li>Still planning: <b>step 2, step 5</b></li>');
    expect(passportMarkdown(createProject())).not.toContain('Still planning');
  });
});
