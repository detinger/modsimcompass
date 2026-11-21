import { describe, expect, it } from 'vitest';
import { checkLines } from '../src/domain/artefacts/checkPlan';
import { createArtefact } from '../src/domain/artefacts/file';
import { includeArtefact, refreshCopies, removeInclusion, staleSources, undoChange, undoRecord } from '../src/domain/artefacts/include';
import { savedRevision, showsProject } from '../src/app/artefacts';
import type { Artefact, ArtefactData, ArtefactKind } from '../src/domain/artefacts/types';
import { changedSinceReview } from '../src/domain/passport/compass';
import { importProjectObject } from '../src/domain/passport/importer';
import { createProject, type ProjectDoc } from '../src/domain/passport/schema';
import { passportHtml } from '../src/exports/html';
import { passportMarkdown } from '../src/exports/markdown';
import { projectJson } from '../src/exports/projectFile';
import { editPath } from '../src/features/project/ArtefactSlot';
import { fromStep } from '../src/features/toolbox/ToolPage';

/**
 * Live projects (docs/TOOLBOX-SPEC.md §10): a copy follows its Toolbox original, and the project's own fields stay
 * the author's. A refresh changes a field only while it still reads as the previous copy wrote it, or is empty.
 */

const T0 = '2026-11-21T10:00:00.000Z', T1 = '2026-11-21T11:00:00.000Z', T2 = '2026-11-21T12:00:00.000Z', T3 = '2026-11-21T13:00:00.000Z';

function art<K extends ArtefactKind>(kind: K, fill: (d: ArtefactData[K]) => void, id = `art-${kind}`): Artefact<K> {
  const a = createArtefact(kind, { now: T0, title: `My ${kind}` }) as Artefact<K>;
  fill(a.data);
  return { ...a, id, revision: 1 };
}
/** The next saved version of an artefact, as the editor stores it. */
function edited<K extends ArtefactKind>(a: Artefact<K>, change: (d: ArtefactData[K]) => void): Artefact<K> {
  const data = structuredClone(a.data);
  change(data);
  return { ...a, data, revision: a.revision + 1 };
}
const project = () => createProject({ now: T0 });
/** The automatic refresh after the original was saved. */
const refresh = (doc: ProjectDoc, a: Artefact, now: string) => includeArtefact(doc, a, now, { live: true });

const concept = () => art('concept-model', (d) => {
  d.objectives = 'Decide the daily capacity';
  d.nodes = [
    { id: 'n1', type: 'lever', label: 'Capacity', x: 0, y: 0, zone: 'inputs' },
    { id: 'n2', type: 'stock', label: 'Backlog', x: 200, y: 0, zone: 'content' },
  ];
  d.edges = [{ id: 'e1', from: 'n1', to: 'n2', kind: 'influence', sign: '-', label: '' }];
});
const method = () => art('method-choice', (d) => {
  d.primary = 'system-dynamics'; d.alternative = 'des';
  d.justification = 'A total that builds up over weeks.'; d.alternativeJustification = 'If waits matter.';
});
const plan = () => art('check-plan', (d) => {
  d.checks = [
    { id: 'v1', group: 'verification', text: 'Conservation holds', status: 'passed', evidence: 'Residual 0' },
    { id: 'a1', group: 'validation', text: 'Compare with October', status: 'planned', evidence: '' },
    { id: 'c1', group: 'calibration', text: 'Tune the arrival rate on September', status: 'done', evidence: '' },
  ];
});

describe('a copy follows its original', () => {
  it('a conceptual model edited in the Toolbox: the copy and the fields it wrote follow; hand-written notes stay', () => {
    const doc = project();
    const a = concept();
    includeArtefact(doc, a, T1);
    expect(doc.passport.representation.notes).toBe('Objectives: Decide the daily capacity');
    const b = edited(a, (d) => { d.nodes[1].label = 'Open requests'; d.objectives = 'Choose the capacity'; });
    refresh(doc, b, T2);
    expect(doc.artefacts[0]).toMatchObject({ sourceRevision: 2, addedAt: T2 });
    expect(doc.passport.representation.nodes.map((n) => n.label)).toEqual(['Capacity', 'Open requests']);
    expect(doc.passport.representation.notes).toBe('Objectives: Choose the capacity'); // untouched, so it follows
    doc.passport.representation.notes = 'Agreed with the office: daily totals only.';
    refresh(doc, edited(b, (d) => { d.objectives = 'Something else'; }), T3);
    expect(doc.passport.representation.notes).toBe('Agreed with the office: daily totals only.'); // the author's own text
  });

  it('a method choice: the choice follows, a justification edited in the project is kept', () => {
    const doc = project();
    const a = method();
    includeArtefact(doc, a, T1);
    doc.passport.representation.justification = 'Rewritten in the project after the meeting.';
    refresh(doc, edited(a, (d) => { d.primary = 'des'; d.alternative = 'system-dynamics'; d.justification = 'Waits matter after all.'; d.alternativeJustification = 'Totals as a check.'; }), T2);
    const rep = doc.passport.representation;
    expect(rep.primaryMethod).toBe('des');
    expect(rep.alternativeMethod).toBe('system-dynamics');
    expect(rep.justification).toBe('Rewritten in the project after the meeting.');
    expect(rep.alternativeJustification).toBe('Totals as a check.');
    expect(doc.methods.decidedAt).toBe(T2);
  });

  it('a check plan: an untouched group follows or empties; an edited one is kept', () => {
    const doc = project();
    const a = plan();
    includeArtefact(doc, a, T1);
    doc.passport.evaluation.validation += '\nAlso: ask the office lead.';
    const kept = doc.passport.evaluation.validation;
    const b = edited(a, (d) => { d.checks = d.checks.filter((c) => c.group !== 'calibration'); d.checks[0].status = 'failed'; d.checks[1].status = 'done'; });
    refresh(doc, b, T2);
    expect(doc.passport.evaluation.verification).toBe(checkLines(b.data, 'verification').join('\n'));
    expect(doc.passport.evaluation.calibration).toBe('');
    expect(doc.passport.evaluation.validation).toBe(kept);
  });

  it('a data model: its own input row always follows it and stays the same row', () => {
    const doc = project();
    const a = art('data-model', (d) => { d.name = 'Arrivals'; d.unit = 'per day'; d.family = 'normal'; d.params = [12, 2]; d.provenance = 'Tickets'; });
    includeArtefact(doc, a, T1);
    const row = doc.passport.inputs[0];
    refresh(doc, edited(a, (d) => { d.name = 'Arrivals per day'; d.params = [14, 2]; }), T2);
    expect(doc.passport.inputs).toHaveLength(1);
    expect(doc.passport.inputs[0]).toMatchObject({ id: row.id, name: 'Arrivals per day', inclusion: doc.artefacts[0].id });
    expect(doc.passport.inputs[0].value).toMatch(/14/);
  });

});

describe('an explicit add takes over the fields its kind writes, and says what it replaced', () => {
  it('adding overwrites typed fields, so the card and the fields agree, and names the text it replaced', () => {
    const doc = project();
    doc.passport.representation.primaryMethod = 'des';
    doc.passport.representation.justification = 'Written by hand before the chooser.';
    const res = includeArtefact(doc, art('method-choice', (d) => { d.primary = 'pls-sem'; d.justification = 'Constructs from the survey.'; }), T1);
    expect(doc.passport.representation.primaryMethod).toBe('pls-sem');
    expect(doc.passport.representation.justification).toBe('Constructs from the survey.');
    expect(res.overwritten).toEqual(['Primary method', 'Justification']);
  });

  it('nothing is named when the fields were empty, or when they held only what the earlier copy wrote', () => {
    const doc = project();
    expect(includeArtefact(doc, method(), T1).overwritten).toEqual([]);
    const other = art('method-choice', (d) => { d.primary = 'abm'; d.justification = 'Agents choose.'; }, 'art-other');
    const res = includeArtefact(doc, other, T2); // replacing with another artefact
    expect(res.replaced?.sourceId).toBe('art-method-choice');
    expect(res.overwritten).toEqual([]);
    expect(doc.passport.representation).toMatchObject({ primaryMethod: 'abm', justification: 'Agents choose.' });
  });

  it('replacing with another artefact also overwrites text edited by hand, and names it', () => {
    const doc = project();
    includeArtefact(doc, plan(), T1);
    doc.passport.evaluation.verification = 'My own verification plan.';
    const b = art('check-plan', (d) => { d.checks = [{ id: 'x', group: 'verification', text: 'Units', status: 'planned', evidence: '' }]; }, 'art-plan-b');
    const res = includeArtefact(doc, b, T2);
    expect(doc.passport.evaluation.verification).toBe(checkLines(b.data, 'verification').join('\n'));
    expect(res.overwritten).toEqual(['Verification']);
    expect(doc.passport.evaluation.calibration).toBe(''); // the earlier plan's untouched lines are taken back
  });

  it('a live refresh never names or overwrites edited text; an explicit add of the same artefact does', () => {
    const doc = project();
    const a = method();
    includeArtefact(doc, a, T1);
    doc.passport.representation.justification = 'Edited in the project.';
    const b = edited(a, (d) => { d.justification = 'Changed in the Toolbox.'; });
    expect(refresh(doc, b, T2).overwritten).toEqual([]);
    expect(doc.passport.representation.justification).toBe('Edited in the project.');
    const c = edited(b, (d) => { d.justification = 'Changed again.'; });
    expect(includeArtefact(doc, c, T3).overwritten).toEqual(['Justification']);
    expect(doc.passport.representation.justification).toBe('Changed again.');
  });

  it('the chooser record and owned input rows are never named', () => {
    const doc = project();
    doc.passport.inputs.push({ id: 'in-hand', name: 'Typed', value: '5', unit: 'x', sourceType: 'expert', provenance: 'Me', uncertainty: '' });
    const dm = art('data-model', (d) => { d.name = 'Arrivals'; d.unit = 'per day'; d.family = 'normal'; d.params = [12, 2]; });
    expect(includeArtefact(doc, dm, T1).overwritten).toEqual([]);
    expect(doc.passport.inputs[0]).toMatchObject({ id: 'in-hand', name: 'Typed' });
    doc.methods.decidedAt = '2026-01-01T00:00:00.000Z';
    expect(includeArtefact(doc, method(), T2).overwritten).toEqual([]);
  });

  it('removing a check plan clears its untouched lines; other kinds leave the step as it is', () => {
    const doc = project();
    const p = includeArtefact(doc, plan(), T1);
    const c = includeArtefact(doc, concept(), T1);
    removeInclusion(doc, p.inclusionId);
    removeInclusion(doc, c.inclusionId);
    expect(doc.passport.evaluation).toMatchObject({ verification: '', validation: '', calibration: '' });
    expect(doc.passport.representation.nodes).toHaveLength(2);
  });
});

describe('which copies are refreshed', () => {
  it('only copies whose original on this device has a higher revision; a missing original is left alone', () => {
    const doc = project();
    const a = concept(), m = method(), p = plan();
    for (const x of [a, m, p]) includeArtefact(doc, x, T1);
    const device = new Map<string, Artefact>([[a.id, edited(a, (d) => { d.nodes[0].label = 'Staff'; })], [m.id, m]]); // p is not on this device
    const find = (id: string) => device.get(id);
    expect(staleSources(doc, find).map((x) => x.id)).toEqual([a.id]);
    expect(refreshCopies(doc, find, T2)).toBe(1);
    expect(doc.passport.representation.nodes[0].label).toBe('Staff');
    expect(staleSources(doc, find)).toEqual([]);
    expect(refreshCopies(doc, find, T3)).toBe(0);
    expect(doc.artefacts.find((i) => i.sourceId === p.id)?.addedAt).toBe(T1);
  });

  it('an original of another kind, or an older revision, is never taken', () => {
    const doc = project();
    const a = concept();
    includeArtefact(doc, { ...a, revision: 5 }, T1);
    expect(staleSources(doc, () => ({ ...a, revision: 4 }))).toEqual([]);
    expect(staleSources(doc, () => ({ ...method(), id: a.id, revision: 9 }) as Artefact)).toEqual([]);
    expect(staleSources({ ...doc, artefacts: undefined } as unknown as ProjectDoc, () => a)).toEqual([]);
  });
});

describe('checkpoint honesty: changed since review', () => {
  const reviewed = () => {
    const doc = project();
    const a = concept(), m = method();
    includeArtefact(doc, a, T1);
    includeArtefact(doc, m, T1);
    doc.passport.review.proposal = { ...doc.passport.review.proposal, status: 'self-reviewed', reviewedAt: T2 };
    return { doc, a, m };
  };

  it('a copy of a covered step that changed after the review is listed; others are not', () => {
    const { doc, a, m } = reviewed();
    expect(changedSinceReview(doc, 'proposal')).toEqual([]);
    includeArtefact(doc, edited(m, (d) => { d.primary = 'abm'; }), T3); // step 3 belongs to the design checkpoint
    expect(changedSinceReview(doc, 'proposal')).toEqual([]);
    includeArtefact(doc, edited(a, (d) => { d.nodes[0].label = 'Staff'; }), T3);
    expect(changedSinceReview(doc, 'proposal').map((i) => i.kind)).toEqual(['concept-model']);
  });

  it('nothing is claimed for a draft, or for a review whose time was never recorded', () => {
    const { doc, a } = reviewed();
    includeArtefact(doc, edited(a, (d) => { d.nodes[0].label = 'Staff'; }), T3);
    expect(changedSinceReview({ ...doc, passport: { ...doc.passport, review: { ...doc.passport.review, proposal: { ...doc.passport.review.proposal, status: 'draft' } } } }, 'proposal')).toEqual([]);
    const { reviewedAt: _ignored, ...noTime } = doc.passport.review.proposal;
    void _ignored;
    expect(changedSinceReview({ ...doc, passport: { ...doc.passport, review: { ...doc.passport.review, proposal: noTime } } }, 'proposal')).toEqual([]);
  });

  it('the report says so under the checkpoint, escaped', () => {
    const { doc, a } = reviewed();
    includeArtefact(doc, { ...edited(a, (d) => { d.nodes[0].label = 'Staff'; }), title: 'Sketch <b>v2</b>' }, T3);
    const md = passportMarkdown(doc);
    expect(md).toMatch(/- \*\*Changed since review:\*\* “Sketch <b>v2<\/b>” changed after the review recorded 21 Nov 2026, 12:00 UTC\./);
    const html = passportHtml(doc, { generatedAt: T3 });
    expect(html).toContain('Changed since review:</strong> “Sketch &lt;b&gt;v2&lt;/b&gt;”');
    expect(passportMarkdown(reviewed().doc)).not.toMatch(/Changed since review/);
  });

  it('the review time travels in the project file, only as a time and only past draft', () => {
    const { doc } = reviewed();
    const o = JSON.parse(projectJson(doc));
    const res = importProjectObject(o, { now: T3 });
    if (!res.ok) throw new Error(res.error);
    expect(res.project.passport.review.proposal.reviewedAt).toBe(T2);
    o.passport.review.proposal.reviewedAt = 'yesterday';
    o.passport.review.design = { ...o.passport.review.design, status: 'draft', reviewedAt: T2 };
    const bad = importProjectObject(o, { now: T3 });
    if (!bad.ok) throw new Error(bad.error);
    expect('reviewedAt' in bad.project.passport.review.proposal).toBe(false);
    expect('reviewedAt' in bad.project.passport.review.design).toBe(false);
  });
});

describe('editing from the project', () => {
  it('the Edit address opens the tool on the original, with the step to go back to', () => {
    const doc = project();
    const { inclusionId } = includeArtefact(doc, concept(), T1);
    const inc = doc.artefacts.find((i) => i.id === inclusionId)!;
    expect(editPath(inc)).toBe('/toolbox/concept/art-concept-model?from=scope');
    expect(editPath(inc, 'art-new')).toBe('/toolbox/concept/art-new?from=scope');
    expect(fromStep('/toolbox/concept/art-1?from=scope')).toBe('scope');
    expect(fromStep('/toolbox/concept/art-1?from=evaluation&x=1')).toBe('evaluation');
    expect(fromStep('/toolbox/concept/art-1?from=__proto__')).toBeNull();
    expect(fromStep('/toolbox/concept/art-1')).toBeNull();
  });
});

describe('review fixes: cleared fields, undo, revisions', () => {
  it('a field the author cleared stays clear through later refreshes; a field the copy never wrote is filled', () => {
    const doc = project();
    let m = method();
    m.data.alternativeJustification = '';
    includeArtefact(doc, m, T1);
    expect(doc.artefacts[0].wrote).toEqual(expect.arrayContaining(['passport.representation.justification']));
    doc.passport.representation.justification = ''; // cleared on purpose
    m = edited(m, (d) => { d.justification = 'Weeks of build-up.'; d.alternativeJustification = 'Now there is a reason.'; });
    refresh(doc, m, T2);
    expect(doc.passport.representation.justification).toBe('');
    expect(doc.passport.representation.alternativeJustification).toBe('Now there is a reason.');
    m = edited(m, (d) => { d.justification = 'Again a new reason.'; });
    refresh(doc, m, T3);
    expect(doc.passport.representation.justification).toBe('');
    expect(doc.passport.representation.primaryMethod).toBe('system-dynamics');
  });

  it('a copy stored before `wrote` existed refreshes as before: every empty field is filled', () => {
    const doc = project();
    let m = method();
    includeArtefact(doc, m, T1);
    delete doc.artefacts[0].wrote;
    doc.passport.representation.justification = '';
    m = edited(m, (d) => { d.justification = 'New.'; });
    refresh(doc, m, T2);
    expect(doc.passport.representation.justification).toBe('New.');
  });

  it('`wrote` travels in the project file; anything but field names is ignored with a warning', () => {
    const doc = project();
    includeArtefact(doc, method(), T1);
    const raw = JSON.parse(projectJson(doc));
    const back = importProjectObject(raw);
    if (!back.ok) throw new Error(back.error);
    expect(back.project.artefacts[0].wrote).toEqual(doc.artefacts[0].wrote);
    raw.artefacts[0].wrote = ['passport.representation.justification', '<script>'];
    const bad = importProjectObject(raw);
    if (!bad.ok) throw new Error(bad.error);
    expect(bad.project.artefacts[0].wrote).toBeUndefined();
    expect(bad.warnings.join(' ')).toMatch(/wrote: not a list of field names/);
  });

  it('undo after Remove puts back the copy, its rows and the lines it took, and keeps later edits', () => {
    const doc = project();
    const p = includeArtefact(doc, plan(), T1);
    const dm = includeArtefact(doc, art('data-model', (d) => { d.name = 'Arrivals'; d.unit = 'per day'; d.family = 'normal'; d.params = [12, 2]; }), T1);
    doc.passport.inputs.push({ id: 'in-hand', name: 'Typed', value: '5', unit: 'x', sourceType: 'expert', provenance: 'Me', uncertainty: '' });
    const lines = structuredClone(doc.passport.evaluation);
    for (const id of [p.inclusionId, dm.inclusionId]) {
      const before = structuredClone(doc);
      removeInclusion(doc, id);
      const rec = undoRecord(before, doc, [id]);
      doc.passport.identity.title = `Edited after removing ${id}`; // a later edit
      undoChange(doc, rec);
      expect(doc.passport.identity.title).toBe(`Edited after removing ${id}`);
    }
    expect(doc.artefacts.map((i) => i.id).sort()).toEqual([p.inclusionId, dm.inclusionId].sort());
    expect(doc.passport.evaluation).toEqual(lines);
    expect(doc.passport.inputs.map((r) => r.name)).toEqual(['Arrivals', 'Typed']);
  });

  it('undo of an explicit add takes back only the add, also when it replaced another copy', () => {
    const doc = project();
    const first = method();
    includeArtefact(doc, first, T1);
    const other = { ...method(), id: 'art-other', title: 'Other choice' };
    other.data.primary = 'des'; other.data.justification = 'Waits matter.';
    const before = structuredClone(doc);
    const r = includeArtefact(doc, other, T2);
    const rec = undoRecord(before, doc, [r.inclusionId, ...(r.replaced ? [r.replaced.id] : [])]);
    doc.passport.decision.stakeholder = 'Typed after the add';
    undoChange(doc, rec);
    expect(doc.artefacts.map((i) => i.sourceId)).toEqual([first.id]);
    expect(doc.passport.representation.primaryMethod).toBe('system-dynamics');
    expect(doc.passport.decision.stakeholder).toBe('Typed after the add');
  });

  it('a check plan without a method in a PLS-SEM project takes its lines back when removed', () => {
    const doc = project();
    doc.passport.representation.primaryMethod = 'pls-sem';
    const p = plan();
    p.data.method = '';
    p.data.calibration = { parameters: 'Loadings', tunedOn: 'Wave 1', validatedOn: 'Hold-out' };
    const r = includeArtefact(doc, p, T1);
    expect(doc.passport.evaluation.calibration).toMatch(/Estimated on: Wave 1/);
    removeInclusion(doc, r.inclusionId);
    expect(doc.passport.evaluation).toMatchObject({ verification: '', validation: '', calibration: '' });
  });

  it('a saved revision is never behind a stored one, so a copy can never be ahead of its original', () => {
    expect(savedRevision(6, 5)).toBe(6);
    expect(savedRevision(6, 10)).toBe(11);
    expect(savedRevision(6, 6)).toBe(7);
    expect(savedRevision(3, null)).toBe(3);
    expect(['/project', '/project/scope', '/project/checkpoints?x=1'].every(showsProject)).toBe(true);
    expect(['/', '/projects', '/toolbox/concept', '/example/scope'].some(showsProject)).toBe(false);
  });
});
