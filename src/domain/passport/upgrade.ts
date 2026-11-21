import { ID_PATTERN } from '../artefacts/clean';
import { kindDef } from '../artefacts/kinds';
import type { ArtefactData, ArtefactKind, CMEdge, CMNode, CMNodeType } from '../artefacts/types';
import { METHOD_BY_ID, type MethodId } from '../methods/registry';
import { RULE_VERSION, emptyAnswers } from '../methods/rules';
import { PASSPORT_SCHEMA_VERSION, type Inclusion, type ProjectDoc } from './schema';

/**
 * Brings a project of schema version 1 or 2 to version 3 (docs/TOOLBOX-SPEC.md §3.1).
 * Used by the importer and by the store for projects read from the device, which never pass through the importer.
 *
 * Version 3 adds `artefacts`. An older project gets a copy of what it already holds: its sketch as a conceptual
 * model, its method decision as a method choice, and its last sandbox run as a comparison. The project's own fields
 * are left exactly as they are. The copies have fixed ids, so upgrading the same project twice gives the same result.
 *
 * The backlog sandbox is retired: its last run lives on as the comparison copy, and the legacy `sandbox` field (with
 * the sandbox settings) is dropped from the result, as LEARN-TOOLBOX-PLAN.md §10 says. A project that is already at
 * version 3 and carries no such field is returned untouched (same object).
 */
export const UPGRADE_COPIES: Record<'concept-model' | 'method-choice' | 'comparison', { id: string; sourceId: string; title: string }> = {
  'concept-model': { id: 'inc-from-sketch', sourceId: 'project-sketch', title: 'Conceptual sketch' },
  'method-choice': { id: 'inc-from-method', sourceId: 'project-method', title: 'Method choice' },
  'comparison': { id: 'inc-from-sandbox', sourceId: 'project-sandbox', title: 'Backlog sandbox results' },
};

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (x: unknown) => (typeof x === 'string' ? x : '');
const isMethod = (m: unknown): m is MethodId => typeof m === 'string' && Object.hasOwn(METHOD_BY_ID, m);
const LEGACY_NODE: Record<string, CMNodeType> = { stakeholder: 'actor', variable: 'variable', entity: 'entity' };

function sketchCopy(doc: ProjectDoc): ArtefactData['concept-model'] | null {
  const rep = doc.passport?.representation;
  if (!rep || !Array.isArray(rep.nodes) || rep.nodes.length === 0) return null;
  // Ids written by the app are already safe; anything else gets a fresh one, and the arrows follow.
  const idOf = new Map<string, string>(), used = new Set<string>();
  const safeId = (old: unknown, prefix: string, i: number) => {
    let id = typeof old === 'string' && ID_PATTERN.test(old) && !used.has(old) ? old : `${prefix}-${i + 1}`;
    while (used.has(id)) id = `${id}x`;
    used.add(id);
    return id;
  };
  const nodes: CMNode[] = rep.nodes.filter(isObj).map((n, i) => {
    const id = safeId(n.id, 'n', i);
    if (typeof n.id === 'string' && !idOf.has(n.id)) idOf.set(n.id, id);
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    return { id, type: LEGACY_NODE[str(n.type)] ?? 'entity', label: str(n.label), x: num(n.x), y: num(n.y), zone: 'content' };
  });
  const edges: CMEdge[] = (Array.isArray(rep.relations) ? rep.relations : []).filter(isObj).flatMap((r, i) => {
    const from = idOf.get(str(r.from)), to = idOf.get(str(r.to));
    return from && to ? [{ id: safeId(r.id, 'r', i), from, to, kind: 'influence' as const, sign: '' as const, label: str(r.label).slice(0, 200) }] : [];
  });
  return { objectives: '', assumptions: '', simplifications: '', nodes, edges };
}

function methodCopy(doc: ProjectDoc): ArtefactData['method-choice'] | null {
  const rep = doc.passport?.representation;
  if (!rep) return null;
  const primary = isMethod(rep.primaryMethod) ? rep.primaryMethod : '', alternative = isMethod(rep.alternativeMethod) ? rep.alternativeMethod : '';
  if (!primary && !alternative) return null;
  const m = doc.methods;
  return {
    answers: { ...emptyAnswers(), ...(isObj(m?.answers) ? m.answers : {}) }, ruleVersion: str(m?.ruleVersion) || RULE_VERSION,
    shortlist: Array.isArray(m?.shortlist) ? m.shortlist.filter(isMethod) : [],
    primary, alternative, justification: str(rep.justification), alternativeJustification: str(rep.alternativeJustification),
  };
}

function sandboxCopy(doc: ProjectDoc): ArtefactData['comparison'] | null {
  const run = doc.sandbox?.lastRun;
  if (!isObj(run) || !isObj(run.baseline) || !Array.isArray(run.baseline.summaries)) return null;
  const values = (list: unknown): number[] | null => {
    if (!Array.isArray(list)) return null;
    const xs = list.map((s) => (isObj(s) ? s.averageEndBacklog : undefined));
    return xs.every((x): x is number => typeof x === 'number' && Number.isFinite(x)) ? xs : null;
  };
  const baseline = values(run.baseline.summaries);
  const alternative = isObj(run.alternative) ? values(run.alternative.summaries) : [];
  if (!baseline || !alternative || baseline.length === 0) return null;
  const cancelled = run.status === 'partial' ? ' The run was cancelled, so the results are partial.' : '';
  return {
    outcome: 'Average end-of-day backlog', unit: 'request-equivalents', direction: 'lower',
    baselineLabel: str(run.baseline.label).slice(0, 200) || 'Baseline', alternativeLabel: (isObj(run.alternative) ? str(run.alternative.label).slice(0, 200) : '') || 'Alternative',
    baseline, alternative, paired: run.comparisonKind === 'paired-policy' && baseline.length === alternative.length,
    minimumDifference: null, targetHalfWidth: null, origin: 'imported',
    note: `Copied from the backlog sandbox run of this project (seed ${str(run.seed).slice(0, 80) || 'not recorded'}, ${baseline.length} replication${baseline.length === 1 ? '' : 's'}).${cancelled}`,
  };
}

const BUILD: { [K in keyof typeof UPGRADE_COPIES]: (doc: ProjectDoc) => ArtefactData[K] | null } = {
  'concept-model': sketchCopy, 'method-choice': methodCopy, 'comparison': sandboxCopy,
};

/** Returns the project at the current schema version. `note` receives one line per change, for the import summary. */
export function upgradeProject(doc: ProjectDoc, note: (m: string) => void = () => {}): ProjectDoc {
  const from = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 1;
  const hasList = Array.isArray(doc.artefacts);
  const legacy = Object.hasOwn(doc, 'sandbox');
  if (from >= PASSPORT_SCHEMA_VERSION && hasList && !legacy) return doc;
  const artefacts: Inclusion[] = hasList ? [...doc.artefacts] : [];
  if (from < 3) {
    const made: string[] = [];
    for (const kind of Object.keys(UPGRADE_COPIES) as (keyof typeof UPGRADE_COPIES)[]) {
      if (artefacts.some((i) => i.kind === kind)) continue;
      let data: ArtefactData[ArtefactKind] | null = null;
      // A stored project was never validated; a copy that cannot be built is skipped, the project still opens.
      try { const built = BUILD[kind](doc); data = built && kindDef(kind).sanitize(built, () => {}); } catch { data = null; }
      if (!data) continue;
      const { id, sourceId, title } = UPGRADE_COPIES[kind];
      artefacts.push({ id, sourceId, sourceRevision: 0, kind, title, addedAt: str(doc.updatedAt) || str(doc.createdAt), data } as Inclusion);
      made.push(kindDef(kind).label.toLowerCase());
    }
    if (made.length) note(`Kept as artefacts of the project: ${made.join(', ')}.`);
  }
  const rest: ProjectDoc = { ...doc };
  delete rest.sandbox;
  return { ...rest, schemaVersion: Math.max(from, PASSPORT_SCHEMA_VERSION), artefacts };
}
