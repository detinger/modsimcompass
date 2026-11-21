import { describe, expect, it } from 'vitest';
import { TEMPLATES, originalsFor, startFromTemplate } from '../src/content/templates';
import { workedExampleCopy } from '../src/content/workedExample';
import { CM_NODE_H, CM_NODE_W, frameOf, zoneAt } from '../src/domain/artefacts/conceptModel';
import type { Artefact, CheckPlan, ConceptModel, DataModel, MeasurementData, MethodChoice } from '../src/domain/artefacts/types';
import { profileFor } from '../src/domain/methods/profiles';
import { checkpointReadiness, CHECKPOINT_DEFS, compassWarnings } from '../src/domain/passport/compass';
import { parseProjectJson } from '../src/domain/passport/importer';
import { projectJson } from '../src/exports/projectFile';

const NOW = '2026-11-21T00:00:00.000Z';
const of = <T,>(artefacts: Artefact[], kind: Artefact['kind']) => artefacts.filter((a) => a.kind === kind).map((a) => a.data as T);

/** Starting from an example gives a project with real artefacts: steps 2 to 5 are done the way the Toolbox does them. */
describe('the artefacts of each template', () => {
  for (const t of TEMPLATES) {
    describe(t.id, () => {
      const { project, artefacts } = startFromTemplate(t, { now: NOW });
      const p = project.passport;
      const primary = t.content.representation.primaryMethod;
      const statistical = profileFor(primary)?.model === 'statistical';

      it('has a conceptual model, a method choice, its data and a check plan, each in the project and in My artefacts', () => {
        expect(t.artefacts).toBeDefined();
        const kinds = artefacts.map((a) => a.kind);
        expect(kinds.filter((k) => k === 'concept-model')).toHaveLength(1);
        expect(kinds.filter((k) => k === 'method-choice')).toHaveLength(1);
        expect(kinds.filter((k) => k === 'check-plan')).toHaveLength(1);
        expect(kinds.filter((k) => k === 'data-model' || k === 'measurement-data').length).toBeGreaterThanOrEqual(1);
        if (statistical) expect(kinds).toContain('measurement-data');
        expect(project.artefacts.map((i) => i.sourceId).sort()).toEqual(artefacts.map((a) => a.id).sort());
        for (const i of project.artefacts) expect(i.sourceRevision).toBe(1);
        for (const a of artefacts) expect(a.title.trim().length, a.kind).toBeGreaterThan(5);
        const titles = artefacts.map((a) => a.title);
        expect(new Set(titles).size, 'artefact titles are unique').toBe(titles.length);
      });

      it('draws the conceptual model inside its zones, without overlaps, with what is left out named in the scope', () => {
        const [m] = of<ConceptModel>(artefacts, 'concept-model');
        expect(m.nodes.length).toBeGreaterThanOrEqual(7);
        for (const txt of [m.objectives, m.assumptions, m.simplifications]) expect(txt.trim().length).toBeGreaterThan(40);
        const f = frameOf(m);
        for (const n of m.nodes) {
          if (n.zone !== 'outside') expect(zoneAt(n.x + CM_NODE_W / 2, n.y, f), n.label).toBe(n.zone);
          else expect(n.x, n.label).toBeGreaterThan(f.width);
        }
        for (const [i, a] of m.nodes.entries()) for (const b of m.nodes.slice(i + 1)) {
          expect(Math.abs(a.x - b.x) >= CM_NODE_W || Math.abs(a.y - b.y) >= CM_NODE_H + 8, `${a.label} / ${b.label}`).toBe(true);
        }
        for (const n of m.nodes.filter((x) => x.type === 'lever')) expect(n.zone, n.label).toBe('inputs');
        for (const n of m.nodes.filter((x) => x.type === 'outcome')) expect(n.zone, n.label).toBe('outputs');
        for (const n of m.nodes.filter((x) => x.type === 'external')) { expect(n.zone, n.label).toBe('outside'); expect(p.scope.exclusions).toContain(n.label); }
        expect(m.nodes.some((n) => n.type === 'lever') && m.nodes.some((n) => n.type === 'outcome')).toBe(true);
        const ids = new Set(m.nodes.map((n) => n.id));
        expect(ids.size).toBe(m.nodes.length);
        for (const e of m.edges) { expect(ids.has(e.from) && ids.has(e.to), e.id).toBe(true); expect(e.label.trim(), e.id).not.toBe(''); }
      });

      it('records method-chooser answers whose shortlist contains the chosen method', () => {
        const [c] = of<MethodChoice>(artefacts, 'method-choice');
        expect(c.shortlist).toContain(primary);
        expect(c.primary).toBe(primary);
        expect(project.methods.shortlist).toEqual(c.shortlist);
        expect(p.representation.justification).toBe(t.content.representation.justification);
      });

      it('fits its synthetic data with the Data tool, keeps the data, and labels the rows synthetic', () => {
        for (const [k, d] of of<DataModel>(artefacts, 'data-model').entries()) {
          const spec = t.artefacts!.data[k];
          if (spec.source === 'synthetic') {
            expect(d.origin, d.name).toBe('fitted');
            expect(d.keepData && d.data.length >= 30 && d.data.length <= 500, d.name).toBe(true);
            expect(d.summary?.n, d.name).toBe(d.data.length);
            expect(d.fit?.rank, d.name).toBe(1);
          } else expect(d.origin, d.name).toBe('described');
          expect(d.provenance.trim().length && d.uncertainty.trim().length, d.name).toBeTruthy();
        }
        const fitted = new Set(project.artefacts.filter((i) => i.kind === 'data-model' && (i.data as DataModel).origin === 'fitted').map((i) => i.id));
        for (const r of p.inputs.filter((x) => x.inclusion && fitted.has(x.inclusion))) expect(r.sourceType, r.name).toBe('synthetic');
        // A row is written once: by hand, or by its artefact.
        const names = p.inputs.map((r) => r.name.trim().toLowerCase());
        expect(new Set(names).size).toBe(names.length);
      });

      it('gives a statistical project a survey that screens like a decent real one', () => {
        for (const d of of<MeasurementData>(artefacts, 'measurement-data')) {
          expect(d.origin).toBe('example');
          expect(d.cases).toBeGreaterThanOrEqual(100);
          expect(d.scale).toEqual({ min: 1, max: 7 });
          expect(d.missing).not.toBe('undecided');
          expect(d.keepData && d.data.length).toBe(d.cases);
          for (const c of d.constructs.filter((x) => x.mode === 'reflective')) expect(c.alpha ?? 0, c.name).toBeGreaterThan(0.6);
        }
      });

      it('plans its checks for its own method, and writes them into step 5', () => {
        const [plan] = of<CheckPlan>(artefacts, 'check-plan');
        expect(plan.method).toBe(primary);
        expect(plan.checks.every((c) => c.status === 'planned' && c.evidence === '')).toBe(true);
        for (const g of ['verification', 'validation', 'calibration'] as const) expect(plan.checks.filter((c) => c.group === g).length, g).toBeGreaterThanOrEqual(1);
        expect(plan.checks.length).toBeLessThanOrEqual(12);
        expect(plan.validation.observed).toEqual([]);
        for (const v of Object.values(p.evaluation)) expect(v.trim().length).toBeGreaterThan(0);
      });

      it('starts with nothing missing or to check in steps 1 to 6, and only step 7 still to do', () => {
        expect(compassWarnings(project).filter((w) => w.severity !== 'tip').map((w) => `${w.step}: ${w.message}`)).toEqual([]);
        for (const c of CHECKPOINT_DEFS) expect(checkpointReadiness(project, c.id), c.id).toEqual([]);
      });

      it('is the same on every device: the data come from seeds', () => {
        const again = startFromTemplate(t, { now: NOW }).artefacts;
        const strip = (xs: Artefact[]) => xs.map((a) => ({ kind: a.kind, title: a.title, data: a.data }));
        expect(strip(again)).toEqual(strip(artefacts));
      });

      it('keeps every copy through a project file', () => {
        const back = parseProjectJson(projectJson(project));
        expect(back.ok).toBe(true);
        if (!back.ok) return;
        expect(back.project.artefacts.map((i) => i.kind)).toEqual(project.artefacts.map((i) => i.kind));
        expect(back.project.passport.inputs.length).toBe(p.inputs.length);
      });
    });
  }

  it('the worked example’s copy gets its originals too, each copy linked to one', () => {
    const copy = workedExampleCopy({ now: NOW });
    const originals = originalsFor(copy, NOW);
    expect(originals).toHaveLength(copy.artefacts.length);
    for (const [i, inc] of copy.artefacts.entries()) {
      expect(inc.sourceId).toBe(originals[i].id);
      expect(originals[i].data).toEqual(inc.data);
      expect(originals[i].kind).toBe(inc.kind);
    }
  });
});
