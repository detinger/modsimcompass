import type { StepId } from '../passport/compass';
import { createProject, newId, type Inclusion, type InputRow, type ProjectDoc } from '../passport/schema';
import { isId, isObj, LIMITS, own, text, type Warn } from './clean';
import { isIsoTime, storable } from './file';
import { isArtefactKind, kindDef, KINDS } from './kinds';
import type { Artefact } from './types';

/**
 * Artefacts in a project (docs/TOOLBOX-SPEC.md §3.2 and §10 “Live projects”). The project keeps a full copy of what
 * was added, so its file and report stand on their own, and the copy follows its Toolbox original: every saved change
 * refreshes it. All functions mutate a draft and are called inside the store's `update`.
 *
 * A copy also writes some of the project's own fields (`KindDef.applyToProject`):
 * - Adding (or replacing a copy with another artefact) is a deliberate choice: the copy takes over the fields its kind
 *   writes, so the card and the fields never disagree. The labels of fields whose own text it replaced are returned,
 *   so the screen can say so next to its Undo.
 * - A live refresh (`{ live: true }`) keeps those fields the author's: it changes a field only while it still reads
 *   exactly as the previous copy wrote it, or while it is empty.
 * Input rows that a kind owns (`KindDef.ownsRows`, such as a data model's) belong to it and always follow it.
 */

export interface IncludeResult {
  inclusionId: string;
  /** The copy that was there before: the earlier version of the same copy, or one this artefact took the place of. */
  replaced: Inclusion | null;
  /** Fields that held text of the author's own and were overwritten by an explicit add, by their names on screen. */
  overwritten: string[];
}

/**
 * Adds an artefact to the project, or refreshes the copy that came from the same artefact. `live: true` is the
 * automatic refresh after the original was saved; without it the add is the author's explicit choice.
 */
export function includeArtefact(doc: ProjectDoc, a: Artefact, now: string, opts: { live?: boolean } = {}): IncludeResult {
  const def = kindDef(a.kind);
  const list = (doc.artefacts ??= []);
  const sameSource = list.findIndex((i) => i.sourceId === a.id && i.kind === a.kind);
  const sameKind = def.many ? -1 : list.findIndex((i) => i.kind === a.kind);
  const at = sameSource >= 0 ? sameSource : sameKind;
  const replaced = at >= 0 ? list[at] : null;
  // A refreshed copy keeps its id, so the input row of a data model stays the same row.
  const id = sameSource >= 0 ? list[sameSource].id : newId('inc');
  const copy = { id, sourceId: a.id, sourceRevision: a.revision, kind: a.kind, title: a.title, addedAt: now, data: structuredClone(storable(a).data) } as Inclusion;
  // What the earlier copy wrote, and the author left as it was, makes way for the new copy.
  const emptied = replaced && !ownsRows(replaced) ? unwrite(doc, replaced) : [];
  if (at >= 0) list[at] = copy; else list.push(copy);
  if (replaced && replaced.id !== id) dropOwnedRows(doc, replaced);
  const overwritten = opts.live ? (write(doc, copy, sameSource >= 0 ? replaced : null, new Set(emptied.map((e) => key(e.path)))), []) : take(doc, copy);
  if (!ownsRows(copy)) copy.wrote = holding(doc, copy);
  return { inclusionId: id, replaced, overwritten };
}

/**
 * Removes a copy. The input row of a data model goes with it, and so do the lines a check plan wrote that the author
 * has not changed (they record checks that are no longer part of the project). Other project fields are left as they
 * are: the step keeps its content, written by hand from then on.
 */
export function removeInclusion(doc: ProjectDoc, inclusionId: string): Inclusion | null {
  const list = doc.artefacts ?? [];
  const at = list.findIndex((i) => i.id === inclusionId);
  if (at < 0) return null;
  const removed = list[at];
  if (removed.kind === 'check-plan') unwrite(doc, removed);
  list.splice(at, 1);
  dropOwnedRows(doc, removed);
  return removed;
}

/** The Toolbox originals on this device that are newer than their copy in the project. A missing original is skipped. */
export function staleSources(doc: ProjectDoc, find: (artefactId: string) => Artefact | undefined): Artefact[] {
  const out: Artefact[] = [];
  for (const inc of Array.isArray(doc.artefacts) ? doc.artefacts : []) {
    const source = inc && find(inc.sourceId);
    if (source && source.kind === inc.kind && source.revision > inc.sourceRevision) out.push(source);
  }
  return out;
}

/** Brings every copy whose original has moved on up to date. Returns how many copies were refreshed. */
export function refreshCopies(doc: ProjectDoc, find: (artefactId: string) => Artefact | undefined, now: string): number {
  const stale = staleSources(doc, find);
  for (const a of stale) includeArtefact(doc, a, now, { live: true });
  return stale.length;
}

// ── Writing a copy into the project's own fields ─────────────────────────

type Path = string[];
const key = (p: Path) => p.join('.');
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isPlain = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const blank = (x: unknown) => x === undefined || x === null || (typeof x === 'string' && x.trim() === '') || (Array.isArray(x) && x.length === 0);
const get = (o: unknown, path: Path): unknown => path.reduce<unknown>((x, k) => (isPlain(x) ? x[k] : undefined), o);
function put(o: unknown, path: Path, value: unknown): void {
  let x = o;
  for (const k of path.slice(0, -1)) { if (!isPlain(x)) return; x = x[k]; }
  if (isPlain(x)) x[path[path.length - 1]] = structuredClone(value);
}
/** Where two projects differ: objects are walked, lists and values compared whole. The copies themselves are skipped. */
function changed(a: unknown, b: unknown, path: Path = [], out: Path[] = []): Path[] {
  if (isPlain(a) && isPlain(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (!(path.length === 0 && k === 'artefacts')) changed(a[k], b[k], [...path, k], out);
  } else if (!same(a, b)) out.push(path);
  return out;
}
/** A project as `inc` leaves it. */
function applied(doc: ProjectDoc, inc: Inclusion): ProjectDoc {
  const s = structuredClone(doc);
  kindDef(inc.kind).applyToProject(s, inc.data as never, inc.id);
  return s;
}

/**
 * Project fields a kind's `applyToProject` may read (a check plan without a method of its own takes the project's
 * primary method for its wording). The scratch project a footprint is measured on carries them from the real project,
 * except where the copy writes the field itself.
 */
const CONTEXT: Path[] = [['passport', 'representation', 'primaryMethod']];

/**
 * What a copy writes on its own: a scratch project before and after it, and the fields that differ. The scratch project
 * is empty but for the context the real project `doc` gives. Null for a copy that never passed the importer.
 */
function footprint(inc: Inclusion, doc?: ProjectDoc): { empty: ProjectDoc; out: ProjectDoc; paths: Path[] } | null {
  try {
    const scratch = () => ({ ...createProject({ now: typeof inc.addedAt === 'string' ? inc.addedAt : undefined }), artefacts: [inc] });
    let empty: ProjectDoc = scratch(), out = applied(empty, inc), paths = changed(empty, out);
    const context = doc ? CONTEXT.filter((p) => !paths.some((q) => key(q) === key(p)) && !blank(get(doc, p))) : [];
    if (context.length) {
      empty = scratch();
      for (const p of context) put(empty, p, get(doc, p));
      out = applied(empty, inc); paths = changed(empty, out);
    }
    return { empty, out, paths };
  } catch { return null; }
}

/** The fields of the copy's footprint that hold exactly what it writes: recorded as `wrote` when the copy is stored. */
function holding(doc: ProjectDoc, inc: Inclusion): string[] {
  const f = footprint(inc, doc);
  return f ? f.paths.filter((p) => same(get(doc, p), get(f.out, p))).map(key) : [];
}

/**
 * Takes back what a copy wrote: each field it writes (measured on an empty project, with the copy in it) that still
 * holds exactly what it wrote goes back to empty. A field the author has changed since is left alone; when the copy
 * recorded what it wrote (`wrote`), only those fields are considered. Returns what it emptied, with the old values.
 */
function unwrite(doc: ProjectDoc, inc: Inclusion): { path: Path; value: unknown }[] {
  const f = footprint(inc, doc);
  if (!f) return [];
  const wrote = Array.isArray(inc.wrote) ? new Set(inc.wrote) : null;
  const emptied: { path: Path; value: unknown }[] = [];
  for (const p of f.paths) {
    if (wrote && !wrote.has(key(p))) continue;
    const value = get(doc, p);
    if (same(value, get(f.out, p))) { emptied.push({ path: p, value: structuredClone(value) }); put(doc, p, get(f.empty, p)); }
  }
  return emptied;
}

/** Names of the fields a copy can write, as the steps show them. The method chooser's own record is not text and is not named. */
const FIELD_NAMES: Record<string, string> = {
  'passport.representation.nodes': 'Conceptual sketch', 'passport.representation.relations': 'Conceptual sketch', 'passport.representation.notes': 'Concept',
  'passport.representation.primaryMethod': 'Primary method', 'passport.representation.alternativeMethod': 'Alternative method',
  'passport.representation.justification': 'Justification', 'passport.representation.alternativeJustification': 'Why the alternative',
  'passport.evaluation.verification': 'Verification', 'passport.evaluation.validation': 'Validation', 'passport.evaluation.calibration': 'Calibration',
};
const fieldName = (p: Path): string | null => (p[0] === 'methods' ? null : FIELD_NAMES[p.join('.')] ?? p[p.length - 1]);

/** An explicit add: the copy takes over every field it writes. Returns the names of fields whose own text it replaced. */
function take(doc: ProjectDoc, inc: Inclusion): string[] {
  if (ownsRows(inc)) { kindDef(inc.kind).applyToProject(doc, inc.data as never, inc.id); return []; }
  let out: ProjectDoc;
  try { out = applied(doc, inc); } catch { return []; }
  const lost = new Set<string>();
  for (const p of changed(doc, out)) {
    const name = fieldName(p);
    if (name && !blank(get(doc, p))) lost.add(name);
    put(doc, p, get(out, p));
  }
  return [...lost];
}

/**
 * A live refresh: writes a copy into fields that are empty only. When the earlier copy recorded what it wrote, a field
 * it wrote that the author has since cleared or changed (one it did not just take back) stays the author's, so a field
 * cleared on purpose stays clear; fields the earlier copy never wrote are filled while empty. Without that record
 * (projects saved before it existed) every empty field is filled. The input rows a kind owns always follow it.
 */
function write(doc: ProjectDoc, inc: Inclusion, prev: Inclusion | null, emptied: Set<string>): void {
  if (ownsRows(inc)) { kindDef(inc.kind).applyToProject(doc, inc.data as never, inc.id); return; }
  let out: ProjectDoc;
  try { out = applied(doc, inc); } catch { return; }
  const before = prev && Array.isArray(prev.wrote) ? new Set((footprint(prev, doc)?.paths ?? []).map(key)) : null;
  for (const p of changed(doc, out)) {
    if (!blank(get(doc, p))) continue;
    if (before && before.has(key(p)) && !emptied.has(key(p))) continue; // the author's: cleared or changed after the copy wrote it
    put(doc, p, get(out, p));
  }
}

/** A kind that owns project input rows (`KindDef.ownsRows`, such as a data model): its rows belong to it and follow it. */
const ownsRows = (inc: Inclusion) => !!kindDef(inc.kind).ownsRows;

function dropOwnedRows(doc: ProjectDoc, inc: Inclusion): void {
  if (ownsRows(inc)) doc.passport.inputs = doc.passport.inputs.filter((r) => r.inclusion !== inc.id);
}

// ── Undo of an add or a remove, without touching later edits ─────────────

/** What a change to a project's copies did: the copies and owned rows it touched, as they were, and the fields it changed. */
export interface UndoRecord {
  /** Ids of the copies the change added, refreshed, replaced or removed. */
  ids: string[];
  copies: { inc: Inclusion; index: number }[];
  rows: { row: InputRow; index: number }[];
  fields: { path: Path; before: unknown; after: unknown }[];
}

/** Records a change to the copies `ids`, from the project as it was (`before`) to the project as it is (`after`). */
export function undoRecord(before: ProjectDoc, after: ProjectDoc, ids: string[]): UndoRecord {
  const set = new Set(ids);
  const copies = (before.artefacts ?? []).map((inc, index) => ({ inc: structuredClone(inc), index })).filter((c) => set.has(c.inc.id));
  const rows = before.passport.inputs.map((row, index) => ({ row: structuredClone(row), index })).filter((r) => !!r.row.inclusion && set.has(r.row.inclusion));
  // Input rows are taken back by owner above; every other field the change touched is recorded with both values.
  const fields = changed(before, after).filter((p) => !(p[0] === 'passport' && p[1] === 'inputs'))
    .map((path) => ({ path, before: structuredClone(get(before, path)), after: structuredClone(get(after, path)) }));
  return { ids: [...set], copies, rows, fields };
}

/**
 * Takes a recorded change back. The copies it touched return as they were (unless a copy of the same artefact, or of a
 * kind a project holds once, has been added since), with their owned rows; a field returns to its earlier value only
 * while it still holds what the change wrote. Edits made after the change are kept.
 */
export function undoChange(doc: ProjectDoc, rec: UndoRecord): void {
  const set = new Set(rec.ids);
  const list = (doc.artefacts ??= []).filter((i) => !set.has(i.id));
  const back = new Set<string>();
  for (const { inc, index } of [...rec.copies].sort((x, y) => x.index - y.index)) {
    const def = kindDef(inc.kind);
    if (list.some((i) => i.sourceId === inc.sourceId && i.kind === inc.kind) || (!def.many && list.some((i) => i.kind === inc.kind))) continue;
    list.splice(Math.min(index, list.length), 0, structuredClone(inc));
    back.add(inc.id);
  }
  doc.artefacts = list;
  const inputs = doc.passport.inputs.filter((r) => !r.inclusion || !set.has(r.inclusion));
  for (const { row, index } of [...rec.rows].sort((x, y) => x.index - y.index)) if (row.inclusion && back.has(row.inclusion)) inputs.splice(Math.min(index, inputs.length), 0, structuredClone(row));
  doc.passport.inputs = inputs;
  for (const f of rec.fields) if (same(get(doc, f.path), f.after)) put(doc, f.path, f.before);
}

/** Whether a copy still matches the Toolbox artefact it came from. */
export function inclusionState(inc: Inclusion, source: Artefact | undefined): 'current' | 'outdated' | 'source-missing' {
  if (!source) return 'source-missing';
  return source.revision === inc.sourceRevision ? 'current' : 'outdated';
}

/** The copies that belong to a project step, in the order they were added. */
export function inclusionsFor(doc: ProjectDoc, step: StepId): Inclusion[] {
  return (doc.artefacts ?? []).filter((i) => KINDS[i.kind].step === step);
}

/** The copy of an artefact in a project, if it was added. */
export function inclusionOf(doc: ProjectDoc, artefactId: string): Inclusion | undefined {
  return (doc.artefacts ?? []).find((i) => i.sourceId === artefactId);
}

/**
 * Reads the `artefacts` list of a project file. Each copy is rebuilt with its kind's sanitizer; anything that is
 * not a valid copy is left out with a warning. A kind a project holds only once keeps its first copy, and so does an
 * artefact that appears twice.
 */
const WROTE_PATH = /^[A-Za-z][A-Za-z0-9_-]{0,63}(\.[A-Za-z0-9_-]{1,64}){0,7}$/;

export function sanitizeInclusions(raw: unknown, warn: Warn, now: string): Inclusion[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) { warn('artefacts: expected a list; no artefacts were imported.'); return []; }
  if (raw.length > LIMITS.list) warn(`artefacts: list shortened to ${LIMITS.list} items.`);
  const out: Inclusion[] = [], ids = new Set<string>(), single = new Set<string>(), sources = new Set<string>();
  raw.slice(0, LIMITS.list).forEach((x, i) => {
    const drop = (why: string) => warn(`artefacts[${i}]: ${why}; left out.`);
    if (!isObj(x)) return drop('not an artefact');
    const id = own(x, 'id'), sourceId = own(x, 'sourceId'), sourceRevision = own(x, 'sourceRevision'), kind = own(x, 'kind'), addedAt = own(x, 'addedAt');
    if (!isId(id) || ids.has(id) || !isId(sourceId)) return drop('missing or repeated id');
    if (!isArtefactKind(kind)) return drop('unknown kind');
    if (typeof sourceRevision !== 'number' || !Number.isInteger(sourceRevision) || sourceRevision < 0) return drop('invalid revision');
    const def = kindDef(kind);
    if (!def.many && single.has(kind)) return drop(`a project holds one ${def.label.toLowerCase()}`);
    // Two copies of one Toolbox artefact could never both be updated: the first is kept.
    if (sources.has(`${kind}:${sourceId}`)) return drop('a second copy of the same artefact');
    const data = def.sanitize(own(x, 'data'), (m) => warn(`artefacts[${i}].${m}`));
    if (!data) return drop(`the ${def.label.toLowerCase()} is not in a recognised format`);
    ids.add(id); single.add(kind); sources.add(`${kind}:${sourceId}`);
    const inc = { id, sourceId, sourceRevision, kind, title: text(own(x, 'title'), `artefacts[${i}].title`, warn, LIMITS.title), addedAt: isIsoTime(addedAt) ? addedAt : now, data } as Inclusion;
    // Which fields the copy wrote: dot paths of field names only. Anything else drops the record, and the copy behaves as before it existed.
    const wrote = own(x, 'wrote');
    if (Array.isArray(wrote)) {
      if (wrote.length <= 500 && wrote.every((w) => typeof w === 'string' && WROTE_PATH.test(w))) inc.wrote = [...new Set(wrote as string[])];
      else warn(`artefacts[${i}].wrote: not a list of field names; ignored.`);
    }
    out.push(inc);
  });
  return out;
}
