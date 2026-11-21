import type { StepId } from '../passport/compass';
import { newId, type Inclusion, type ProjectDoc } from '../passport/schema';
import { isId, isObj, LIMITS, own, text, type Warn } from './clean';
import { isIsoTime, storable } from './file';
import { isArtefactKind, kindDef, KINDS } from './kinds';
import type { Artefact } from './types';

/**
 * Artefacts in a project (docs/TOOLBOX-SPEC.md §3.2). The project keeps a copy of what was added.
 * All functions mutate a draft and are called inside the store's `update`.
 */

/**
 * Adds an artefact to the project, or refreshes the copy that came from the same artefact (“Update from Toolbox”).
 * `replaced` is the copy that was there before: the earlier version of the same copy, or, for a kind a project
 * holds only once, the copy of another artefact that this one took the place of.
 */
export function includeArtefact(doc: ProjectDoc, a: Artefact, now: string): { inclusionId: string; replaced: Inclusion | null } {
  const def = kindDef(a.kind);
  const list = (doc.artefacts ??= []);
  const sameSource = list.findIndex((i) => i.sourceId === a.id && i.kind === a.kind);
  const sameKind = def.many ? -1 : list.findIndex((i) => i.kind === a.kind);
  const at = sameSource >= 0 ? sameSource : sameKind;
  const replaced = at >= 0 ? list[at] : null;
  // A refreshed copy keeps its id, so the input row of a data model stays the same row.
  const id = sameSource >= 0 ? list[sameSource].id : newId('inc');
  const copy = { id, sourceId: a.id, sourceRevision: a.revision, kind: a.kind, title: a.title, addedAt: now, data: structuredClone(storable(a).data) } as Inclusion;
  if (at >= 0) list[at] = copy; else list.push(copy);
  if (replaced && replaced.id !== id) dropOwnedRows(doc, replaced);
  def.applyToProject(doc, copy.data, id);
  return { inclusionId: id, replaced };
}

function dropOwnedRows(doc: ProjectDoc, inc: Inclusion): void {
  if (inc.kind === 'data-model') doc.passport.inputs = doc.passport.inputs.filter((r) => r.inclusion !== inc.id);
}

/** Removes a copy. The input row of a data model goes with it; other project fields are left as they are. */
export function removeInclusion(doc: ProjectDoc, inclusionId: string): Inclusion | null {
  const list = doc.artefacts ?? [];
  const at = list.findIndex((i) => i.id === inclusionId);
  if (at < 0) return null;
  const [removed] = list.splice(at, 1);
  dropOwnedRows(doc, removed);
  return removed;
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
 * not a valid copy is left out with a warning. A kind a project holds only once keeps its first copy.
 */
export function sanitizeInclusions(raw: unknown, warn: Warn, now: string): Inclusion[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) { warn('artefacts: expected a list; no artefacts were imported.'); return []; }
  if (raw.length > LIMITS.list) warn(`artefacts: list shortened to ${LIMITS.list} items.`);
  const out: Inclusion[] = [], ids = new Set<string>(), single = new Set<string>();
  raw.slice(0, LIMITS.list).forEach((x, i) => {
    const drop = (why: string) => warn(`artefacts[${i}]: ${why}; left out.`);
    if (!isObj(x)) return drop('not an artefact');
    const id = own(x, 'id'), sourceId = own(x, 'sourceId'), sourceRevision = own(x, 'sourceRevision'), kind = own(x, 'kind'), addedAt = own(x, 'addedAt');
    if (!isId(id) || ids.has(id) || !isId(sourceId)) return drop('missing or repeated id');
    if (!isArtefactKind(kind)) return drop('unknown kind');
    if (typeof sourceRevision !== 'number' || !Number.isInteger(sourceRevision) || sourceRevision < 0) return drop('invalid revision');
    const def = kindDef(kind);
    if (!def.many && single.has(kind)) return drop(`a project holds one ${def.label.toLowerCase()}`);
    const data = def.sanitize(own(x, 'data'), (m) => warn(`artefacts[${i}].${m}`));
    if (!data) return drop(`the ${def.label.toLowerCase()} is not in a recognised format`);
    ids.add(id); single.add(kind);
    out.push({ id, sourceId, sourceRevision, kind, title: text(own(x, 'title'), `artefacts[${i}].title`, warn, LIMITS.title), addedAt: isIsoTime(addedAt) ? addedAt : now, data } as Inclusion);
  });
  return out;
}
