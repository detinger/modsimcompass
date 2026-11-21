import { describe, expect, it } from 'vitest';
import { TEMPLATES, projectFromTemplate, templateRef } from '../src/content/templates';
import { EXAMPLE_TITLE, WORKED_EXAMPLE_ID, workedExample, workedExampleCopy } from '../src/content/workedExample';
import { METHOD_BY_ID } from '../src/domain/methods/registry';
import { STEPS, stepsStarted } from '../src/domain/passport/compass';
import { parseProjectJson } from '../src/domain/passport/importer';
import { passportGaps } from '../src/domain/passport/schema';
import { projectJson } from '../src/exports/projectFile';

const filled = (s: unknown) => typeof s === 'string' && s.trim().length > 0;

/** The examples on the Project page: planned projects from IT and information systems (src/content/templates). */
describe('project templates', () => {
  it('have unique ids and each uses its own method', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    const methods = TEMPLATES.map((t) => t.content.representation.primaryMethod);
    expect(new Set(methods).size).toBe(methods.length);
  });

  for (const t of TEMPLATES) {
    describe(t.id, () => {
      const c = t.content;
      it('has a short card', () => {
        expect(t.title.split(/\s+/).length).toBeLessThanOrEqual(6);
        expect(t.pitch.length).toBeLessThanOrEqual(120);
        expect(filled(t.area) && filled(t.data)).toBe(true);
        expect(t.shows.length).toBeGreaterThanOrEqual(2);
        expect(t.shows.length).toBeLessThanOrEqual(3);
        for (const s of t.shows) expect(s.length).toBeLessThanOrEqual(64);
      });
      it('names a method and a different, justified alternative', () => {
        const r = c.representation;
        expect(METHOD_BY_ID[r.primaryMethod]).toBeDefined();
        expect(METHOD_BY_ID[r.alternativeMethod]).toBeDefined();
        expect(r.alternativeMethod).not.toBe(r.primaryMethod);
        expect(filled(r.justification) && filled(r.alternativeJustification)).toBe(true);
      });
      it('fills steps 1 to 6', () => {
        for (const v of Object.values(c.decision)) expect(filled(v)).toBe(true);
        for (const v of Object.values(c.scope)) expect(filled(v)).toBe(true);
        for (const v of Object.values(c.evaluation)) expect(filled(v)).toBe(true);
        for (const v of Object.values(c.experiment)) expect(filled(v)).toBe(true);
        expect(projectFromTemplate(t).passport.inputs.length).toBeGreaterThanOrEqual(4);
        expect(c.assumptions.length).toBeGreaterThanOrEqual(3);
        expect(c.outcomes.length).toBeGreaterThanOrEqual(1);
      });
      it('gives every input a unit, a source and its provenance, and every assumption its check', () => {
        for (const r of c.inputs) {
          expect(filled(r.name) && filled(r.value) && filled(r.unit) && filled(r.provenance) && filled(r.uncertainty), r.id).toBe(true);
          expect(r.sourceType, r.id).not.toBe('unspecified');
          if (r.availability && r.availability !== 'have') expect(filled(r.plan), r.id).toBe(true);
          expect(r.inclusion, r.id).toBeUndefined();
        }
        for (const a of c.assumptions) for (const v of Object.values(a)) expect(filled(v), a.id).toBe(true);
        for (const o of c.outcomes) expect(filled(o.metric) && filled(o.unit) && filled(o.criterion) && o.direction !== '', o.id).toBe(true);
      });
      it('keeps row ids unique and the sketch connected to its own elements', () => {
        const rep = projectFromTemplate(t).passport.representation;
        for (const rows of [c.inputs, c.assumptions, c.outcomes, rep.nodes, rep.relations]) {
          const ids = rows.map((r) => r.id);
          expect(new Set(ids).size).toBe(ids.length);
        }
        expect(rep.nodes.length).toBeGreaterThan(0);
        const nodes = new Set(rep.nodes.map((n) => n.id));
        for (const r of rep.relations) expect(nodes.has(r.from) && nodes.has(r.to), r.id).toBe(true);
      });
      it('starts a planning project with steps 1 to 6 started and only the conclusion open', () => {
        const doc = projectFromTemplate(t, { now: '2026-11-21T00:00:00.000Z' });
        expect(doc.passport.identity.title).toBe(t.title);
        expect(doc.passport.identity.stage).toBe('planning');
        expect(doc.origin).toEqual({ kind: 'example', ref: templateRef(t) });
        expect(Object.values(doc.passport.conclusion).every((v) => v === '')).toBe(true);
        expect(stepsStarted(doc.passport)).toEqual(STEPS.filter((s) => s.id !== 'conclude').map((s) => s.id));
        // A construct row of measurement data has no unit of its own (its items are on the survey scale).
        const measured = new Set(doc.artefacts.filter((i) => i.kind === 'measurement-data').map((i) => i.id));
        const unitless = new Set(doc.passport.inputs.filter((r) => r.inclusion && measured.has(r.inclusion)).map((r) => `in-unit-${r.id}`));
        expect(passportGaps(doc).map((g) => g.id).filter((id) => !unitless.has(id))).toEqual(['limitations']);
      });
      it('is copied, so editing the new project never changes the template', () => {
        const doc = projectFromTemplate(t);
        doc.passport.decision.question = 'changed';
        doc.passport.inputs[0].value = 'changed';
        expect(t.content.decision.question).not.toBe('changed');
        expect(t.content.inputs[0].value).not.toBe('changed');
      });
      it('survives a project file round trip unchanged', () => {
        const doc = projectFromTemplate(t, { now: '2026-11-21T00:00:00.000Z' });
        const res = parseProjectJson(projectJson(doc));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.project.passport).toEqual(doc.passport);
        expect(res.project.origin).toEqual(doc.origin);
      });
    });
  }
});

/** The worked example on the Project page: starting from it gives the reader an editable copy of the finished project. */
describe('editable copy of the worked example', () => {
  it('keeps all seven steps and every artefact, under a new id, with the checkpoints back to draft', () => {
    const ref = workedExample();
    const copy = workedExampleCopy({ now: '2026-11-21T00:00:00.000Z' });
    expect(copy.id).not.toBe(WORKED_EXAMPLE_ID);
    expect(copy.origin).toEqual({ kind: 'copy', ref: WORKED_EXAMPLE_ID });
    expect(copy.passport.identity.title).toBe(EXAMPLE_TITLE);
    expect(stepsStarted(copy.passport, copy.artefacts)).toEqual(STEPS.map((s) => s.id));
    expect(copy.artefacts).toEqual(ref.artefacts);
    expect(copy.passport.conclusion).toEqual(ref.passport.conclusion);
    expect(Object.values(copy.passport.review).every((c) => c.status === 'draft' && c.notes === '')).toBe(true);
  });
  it('is a separate project: editing it leaves the reference example as it was', () => {
    const copy = workedExampleCopy({ title: 'Mine' });
    copy.passport.decision.question = 'changed';
    expect(copy.passport.identity.title).toBe('Mine');
    expect(workedExample().passport.decision.question).not.toBe('changed');
  });
});
