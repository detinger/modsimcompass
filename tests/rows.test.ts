import { expect, it } from 'vitest';
import { createProject } from '../src/domain/passport/schema';
import { includeArtefact } from '../src/domain/artefacts/include';
import { createArtefact } from '../src/domain/artefacts/file';
import { parseProjectJson } from '../src/domain/passport/importer';
import { projectJson } from '../src/exports/projectFile';
it('a project file keeps one input row per construct of measurement data, and still drops a repeated row', () => {
  const doc = createProject({ title: 'TAM', id: 'prj-tam', now: '2026-11-21T00:00:00.000Z' });
  const a = createArtefact('measurement-data', { now: '2026-11-21T00:00:00.000Z' }) as any;
  a.revision = 1;
  a.data.source = 'Survey'; a.data.cases = 200;
  a.data.items = ['PEOU1','PEOU2','PU1','PU2','ATT1','ATT2','BI1','BI2'].map((c, i) => ({ id: `i${i}`, column: c, label: c, reverse: false, summary: null }));
  a.data.constructs = ['PEOU','PU','ATT','BI'].map((n, k) => ({ id: `c${k}`, name: n, mode: 'reflective', items: [`i${2*k}`, `i${2*k+1}`], alpha: null }));
  includeArtefact(doc, a, '2026-11-21T00:00:00.000Z');
  const rows = doc.passport.inputs.filter((r) => r.inclusion);
  expect(rows.length).toBe(4);
  const back = parseProjectJson(projectJson(doc));
  if (!back.ok) throw new Error(back.error);
  expect(back.project.passport.inputs.filter((r) => r.inclusion).map((r) => r.name)).toEqual(['PEOU', 'PU', 'ATT', 'BI']);
  // a stale duplicate of one construct row is still removed
  const dup = structuredClone(doc); dup.passport.inputs.push({ ...rows[0], id: 'in-dup' });
  const back2 = parseProjectJson(projectJson(dup));
  if (!back2.ok) throw new Error(back2.error);
  expect(back2.project.passport.inputs.filter((r) => r.inclusion).length).toBe(4);
});

it('two constructs that were both named “Trust” keep both their rows through a project file', () => {
  const now = '2026-11-21T00:00:00.000Z';
  const doc = createProject({ title: 'Trust survey', now });
  const a = createArtefact('measurement-data', { now }) as any;
  a.revision = 1;
  a.data.source = 'Survey'; a.data.cases = 120;
  a.data.items = ['TA1', 'TA2', 'TB1', 'TB2'].map((c, i) => ({ id: `i${i}`, column: c, label: '', reverse: false, summary: null }));
  // An older or hand-edited file: two constructs with the same name (the tool itself refuses this).
  a.data.constructs = [{ id: 'c0', name: 'Trust', mode: 'reflective', items: ['i0', 'i1'], alpha: null }, { id: 'c1', name: 'trust', mode: 'reflective', items: ['i2', 'i3'], alpha: null }];
  const file = { ...JSON.parse(projectJson(doc)), artefacts: [{ id: 'inc-ms', sourceId: 'art-ms', sourceRevision: 1, kind: 'measurement-data', title: 'Trust', addedAt: now, data: a.data }] };
  const back = parseProjectJson(JSON.stringify(file));
  if (!back.ok) throw new Error(back.error);
  const copy = back.project.artefacts[0];
  if (copy.kind !== 'measurement-data') throw new Error('kind');
  expect(copy.data.constructs.map((c) => c.name)).toEqual(['Trust', 'trust 2']);
  expect(back.warnings.join('\n')).toMatch(/another construct has this name; renamed “trust 2”/);
  // Both rows are written (the missing ones restored from the copy) and survive a second round trip.
  const rows = back.project.passport.inputs.filter((r) => r.inclusion === copy.id);
  expect(rows.map((r) => r.name)).toEqual(['Trust', 'trust 2']);
  const again = parseProjectJson(projectJson(back.project));
  if (!again.ok) throw new Error(again.error);
  expect(again.project.passport.inputs.filter((r) => r.inclusion).map((r) => r.name)).toEqual(['Trust', 'trust 2']);
  // Included from the Toolbox, the rows are named apart from the start.
  const direct = createProject({ now });
  const src = { ...a, data: { ...a.data, constructs: copy.data.constructs } };
  includeArtefact(direct, src, now);
  const back3 = parseProjectJson(projectJson(direct));
  if (!back3.ok) throw new Error(back3.error);
  expect(back3.project.passport.inputs.filter((r) => r.inclusion)).toHaveLength(2);
});
