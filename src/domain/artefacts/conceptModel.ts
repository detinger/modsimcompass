import { mdCell, mdText, NOT_SPECIFIED } from '../../exports/mdText';
import type { MapNode, ProjectDoc } from '../passport/schema';
import { isId, isNum, isObj, items, oneOf, own, sameData, text, type Warn } from './clean';
import type { KindDef } from './kinds';
import type { CMEdge, CMEdgeKind, CMNode, CMNodeType, CMZone, ConceptModel } from './types';

export const CM_NODE_TYPES: readonly CMNodeType[] = ['actor', 'entity', 'resource', 'activity', 'stock', 'variable', 'lever', 'outcome', 'external', 'note'];
export const CM_NODE_LABELS: Record<CMNodeType, string> = {
  actor: 'Actor', entity: 'Entity', resource: 'Resource', activity: 'Activity', stock: 'Queue or stock',
  variable: 'Variable', lever: 'Lever', outcome: 'Outcome', external: 'External influence', note: 'Note',
};
export const CM_ZONES: readonly CMZone[] = ['inputs', 'content', 'outputs', 'outside'];
export const CM_ZONE_LABELS: Record<CMZone, string> = { inputs: 'Inputs', content: 'Content', outputs: 'Outputs', outside: 'Outside the boundary' };
export const CM_EDGE_KINDS: readonly CMEdgeKind[] = ['flow', 'influence', 'information', 'decides'];
export const CM_EDGE_LABELS: Record<CMEdgeKind, string> = { flow: 'flow', influence: 'influence', information: 'information', decides: 'decides' };
/** Longest label of an element; connection labels are shorter still. */
export const CM_LABEL_MAX = 500;

const empty = (): ConceptModel => ({ objectives: '', assumptions: '', simplifications: '', nodes: [], edges: [] });

function sanitize(raw: unknown, warn: Warn): ConceptModel | null {
  if (!isObj(raw)) return null;
  const rawNodes = items(own(raw, 'nodes'), 'nodes', warn), rawEdges = items(own(raw, 'edges'), 'edges', warn);
  if (!rawNodes || !rawEdges) return null;
  const nodes: CMNode[] = [], ids = new Set<string>();
  rawNodes.forEach((n, i) => {
    const id = isObj(n) ? own(n, 'id') : undefined;
    const type = isObj(n) ? CM_NODE_TYPES.find((t) => t === own(n, 'type')) : undefined;
    if (!isObj(n) || !isId(id) || ids.has(id) || !type) { warn(`nodes[${i}]: not a valid element; left out.`); return; }
    const x = own(n, 'x'), y = own(n, 'y');
    if (!isNum(x) || !isNum(y)) warn(`nodes[${i}]: position reset.`);
    ids.add(id);
    nodes.push({
      id, type, label: text(own(n, 'label'), `nodes[${i}].label`, warn, CM_LABEL_MAX),
      x: isNum(x) ? x : 0, y: isNum(y) ? y : 0, zone: oneOf(own(n, 'zone'), CM_ZONES, 'content', `nodes[${i}].zone`, warn),
    });
  });
  const edges: CMEdge[] = [], edgeIds = new Set<string>();
  rawEdges.forEach((e, i) => {
    const id = isObj(e) ? own(e, 'id') : undefined, from = isObj(e) ? own(e, 'from') : undefined, to = isObj(e) ? own(e, 'to') : undefined;
    const kind = isObj(e) ? CM_EDGE_KINDS.find((k) => k === own(e, 'kind')) : undefined;
    if (!isObj(e) || !isId(id) || edgeIds.has(id) || !kind || !isId(from) || !isId(to) || !ids.has(from) || !ids.has(to)) { warn(`edges[${i}]: not a valid connection; left out.`); return; }
    edgeIds.add(id);
    const sign = oneOf(own(e, 'sign'), ['', '+', '-'] as const, '', `edges[${i}].sign`, warn);
    edges.push({ id, from, to, kind, sign: kind === 'influence' ? sign : '', label: text(own(e, 'label'), `edges[${i}].label`, warn, 200) });
  });
  return {
    objectives: text(own(raw, 'objectives'), 'objectives', warn),
    assumptions: text(own(raw, 'assumptions'), 'assumptions', warn),
    simplifications: text(own(raw, 'simplifications'), 'simplifications', warn),
    nodes, edges,
  };
}

const names = (nodes: CMNode[]) => nodes.map((n) => n.label.trim()).filter(Boolean);
const short = (list: string[], max = 4) => (list.length > max ? `${list.slice(0, max).join(', ')} and ${list.length - max} more` : list.join(', '));
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** What a connection is called when it has no label of its own. */
export const edgeName = (e: CMEdge): string => e.label.trim() || (e.kind === 'influence' && e.sign ? `influence ${e.sign === '+' ? '+' : '−'}` : CM_EDGE_LABELS[e.kind]);

function summary(d: ConceptModel): string[] {
  const things = d.nodes.filter((n) => n.type !== 'note');
  if (!things.length && !d.objectives.trim()) return ['Nothing drawn yet.'];
  const L = [`${count(things.length, 'element')}, ${count(d.edges.length, 'connection')}`];
  const levers = names(d.nodes.filter((n) => n.type === 'lever')), outcomes = names(d.nodes.filter((n) => n.type === 'outcome'));
  const outside = names(d.nodes.filter((n) => n.zone === 'outside' && n.type !== 'note'));
  if (levers.length) L.push(`Levers: ${short(levers)}`);
  if (outcomes.length) L.push(`Outcomes: ${short(outcomes)}`);
  if (outside.length) L.push(`Left out: ${short(outside)}`);
  return L;
}

function markdown(d: ConceptModel): string[] {
  const L = [`- **Objectives:** ${mdText(d.objectives)}`, `- **Assumptions:** ${mdText(d.assumptions)}`, `- **Simplifications:** ${mdText(d.simplifications)}`, ''];
  const things = d.nodes.filter((n) => n.type !== 'note');
  if (!things.length) return [...L, `Elements: _${NOT_SPECIFIED}_`, ''];
  L.push('| Element | Type | Where |', '| --- | --- | --- |');
  things.forEach((n) => L.push(`| ${mdCell(n.label)} | ${CM_NODE_LABELS[n.type]} | ${CM_ZONE_LABELS[n.zone]} |`));
  L.push('');
  const label = (id: string) => d.nodes.find((n) => n.id === id)?.label ?? '';
  if (d.edges.length) {
    L.push('| From | Connection | To |', '| --- | --- | --- |');
    d.edges.forEach((e) => L.push(`| ${mdCell(label(e.from))} | ${mdCell(edgeName(e))} | ${mdCell(label(e.to))} |`));
    L.push('');
  }
  const notes = d.nodes.filter((n) => n.type === 'note' && n.label.trim());
  notes.forEach((n) => L.push(`- **Note:** ${mdText(n.label)}`));
  if (notes.length) L.push('');
  return L;
}

const LEGACY_TYPE: Record<CMNodeType, MapNode['type'] | null> = {
  actor: 'stakeholder', variable: 'variable', lever: 'variable', outcome: 'variable', stock: 'variable',
  entity: 'entity', resource: 'entity', activity: 'entity', external: 'entity', note: null,
};

function applyToProject(doc: ProjectDoc, d: ConceptModel): void {
  const rep = doc.passport.representation;
  const kept = d.nodes.filter((n) => LEGACY_TYPE[n.type] !== null);
  const ids = new Set(kept.map((n) => n.id));
  rep.nodes = kept.map((n) => ({ id: n.id, type: LEGACY_TYPE[n.type]!, label: n.label, x: n.x, y: n.y }));
  rep.relations = d.edges.filter((e) => ids.has(e.from) && ids.has(e.to)).map((e) => ({ id: e.id, from: e.from, to: e.to, label: edgeName(e), directed: true }));
  if (!rep.notes.trim()) {
    rep.notes = [['Objectives', d.objectives], ['Assumptions', d.assumptions], ['Simplifications', d.simplifications]]
      .filter(([, value]) => value.trim()).map(([name, value]) => `${name}: ${value.trim()}`).join('\n');
  }
}

export const conceptModel: KindDef<'concept-model'> = {
  kind: 'concept-model', label: 'Conceptual model', toolPath: '/toolbox/concept', step: 'scope', many: false,
  empty, sanitize, isEmpty: (d) => sameData(d, empty()), summary, markdown, figure: () => null, applyToProject,
};
