import { describe, expect, it } from 'vitest';
import { ID_PATTERN } from '../src/domain/artefacts/clean';
import {
  CM_EDGE_KINDS, CM_LAYOUT, CM_NODE_H, CM_NODE_TYPES, CM_NODE_W, CM_ZONES, conceptFigure, conceptLists, conceptModel, edgeBends, edgePath,
  isRelationshipModel, labelParts, maxArrowsIn,
  freeSpot, frameOf, nodeRect, placeNode, routeBends, wrapText, zoneAt, zoneSlots, zoneXRange,
} from '../src/domain/artefacts/conceptModel';
import type { CMEdge, CMNode, ConceptModel } from '../src/domain/artefacts/types';
import { markdownToHtml } from '../src/exports/html';
import { isSafeSvg } from '../src/features/toolbox/SvgFigure';
import { arrange } from '../src/features/toolbox/concept/arrange';
import { COALESCE_MS, HISTORY_LIMIT, emptyHistory, record, redo, settle, tokenHolds, undo } from '../src/features/toolbox/concept/history';
import { addConstructs, addNode, autoKind, connect, focusAfterRemoval, moveNodes, moveToZone, nudge, removeElements, reverseEdge, setEdgeKind } from '../src/features/toolbox/concept/ops';
import { STARTERS, buildStarter, putStarter } from '../src/features/toolbox/concept/starters';

const model = (): ConceptModel => ({
  objectives: 'See how capacity changes the backlog.', assumptions: 'Unused capacity is lost.', simplifications: 'No priorities.',
  nodes: [
    { id: 'n1', type: 'lever', label: 'Daily capacity', x: 20, y: 126, zone: 'inputs' },
    { id: 'n2', type: 'stock', label: 'Open requests', x: 380, y: 126, zone: 'content' },
    { id: 'n3', type: 'outcome', label: 'Average backlog', x: 740, y: 126, zone: 'outputs' },
    { id: 'n4', type: 'external', label: 'Other offices', x: 940, y: 126, zone: 'outside' },
    { id: 'n5', type: 'note', label: 'Check the term dates', x: 380, y: 278, zone: 'content' },
  ],
  edges: [
    { id: 'e1', from: 'n1', to: 'n2', kind: 'influence', sign: '-', label: '' },
    { id: 'e2', from: 'n2', to: 'n3', kind: 'information', sign: '', label: 'measured as' },
  ],
});
const clean = (raw: unknown) => { const warnings: string[] = []; return { out: conceptModel.sanitize(raw, (m) => warnings.push(m)), warnings }; };
const overlapping = (a: CMNode, b: CMNode) => a.x < b.x + CM_NODE_W && b.x < a.x + CM_NODE_W && a.y < b.y + CM_NODE_H && b.y < a.y + CM_NODE_H;
const centreZone = (n: CMNode, d: Pick<ConceptModel, 'nodes'>) => zoneAt(n.x + CM_NODE_W / 2, n.y + CM_NODE_H / 2, frameOf(d));
let counter = 0;
const ids = (p: 'n' | 'e') => `${p}-t${++counter}`;

describe('conceptual model: sanitize', () => {
  it('keeps a valid model exactly, without warnings', () => {
    const { out, warnings } = clean(JSON.parse(JSON.stringify(model())));
    expect(out).toEqual(model());
    expect(warnings).toEqual([]);
  });
  it('brings back a position far off the canvas, and says so', () => {
    const raw = JSON.parse(JSON.stringify(model()));
    raw.nodes[0].x = 5e9; raw.nodes[1].y = -5e9;
    const { out, warnings } = clean(raw);
    expect(out!.nodes[0].x).toBe(100_000);
    expect(out!.nodes[1].y).toBe(-100_000);
    expect(warnings.join(' ')).toMatch(/brought back onto the canvas/);
  });
  it('drops the sign of a connection that is not an influence and refuses unknown kinds', () => {
    const raw = JSON.parse(JSON.stringify(model()));
    raw.edges[1].sign = '+';
    raw.edges.push({ id: 'e9', from: 'n1', to: 'n3', kind: 'causes', sign: '', label: '' });
    const { out } = clean(raw);
    expect(out!.edges.map((e) => [e.id, e.sign])).toEqual([['e1', '-'], ['e2', '']]);
  });
  it('leaves out a connection from an element to itself and the same connection twice, and says so', () => {
    const raw = JSON.parse(JSON.stringify(model()));
    raw.edges.push(
      { id: 'e7', from: 'n2', to: 'n2', kind: 'flow', sign: '', label: 'self' },
      { id: 'e8', from: 'n1', to: 'n2', kind: 'influence', sign: '+', label: 'again' },
      { id: 'e9', from: 'n2', to: 'n1', kind: 'influence', sign: '', label: 'the other way is fine' },
      { id: 'e10', from: 'n1', to: 'n2', kind: 'flow', sign: '', label: 'another kind is fine' },
    );
    const { out, warnings } = clean(raw);
    expect(out!.edges.map((e) => e.id)).toEqual(['e1', 'e2', 'e9', 'e10']);
    expect(warnings).toEqual(['edges[2]: joins an element to itself; left out.', 'edges[3]: the same connection again; left out.']);
  });
  it('takes a missing or unknown zone from the position, and keeps a zone the author chose', () => {
    const raw = JSON.parse(JSON.stringify(model()));
    raw.nodes[0].zone = 'nowhere'; // drawn in the Inputs column
    delete raw.nodes[2].zone; // drawn in the Outputs column
    raw.nodes[3].x = 1000; delete raw.nodes[3].zone; // drawn right of the frame
    raw.nodes[1].x = 1000; // stored as content: kept
    const { out, warnings } = clean(raw);
    expect(out!.nodes.map((n) => n.zone)).toEqual(['inputs', 'content', 'outputs', 'outside', 'content']);
    expect(warnings).toEqual(['nodes[0].zone: value not recognised; reset.']);
  });
});

describe('conceptual model: zones', () => {
  const f = frameOf({ nodes: [] });
  const [, a, b, c] = CM_LAYOUT.columns;
  it('the column under a point decides the zone; only the right of the frame is outside', () => {
    expect(zoneAt(a / 2, 300, f)).toBe('inputs');
    expect(zoneAt((a + b) / 2, 300, f)).toBe('content');
    expect(zoneAt((b + c) / 2, 300, f)).toBe('outputs');
    for (const [x, y] of [[c + 1, 300], [f.outside.x + 50, 200], [c + 1, -50], [c + 1, 5000]]) expect(zoneAt(x, y, f)).toBe('outside');
    // Above, below and left of the frame is not outside: the column decides there too.
    expect([zoneAt(-1, 300, f), zoneAt(400, -1, f), zoneAt(400, f.height + 1, f), zoneAt(400, 10, f), zoneAt(400, f.height - 10, f)]).toEqual(['inputs', 'content', 'content', 'content', 'content']);
  });
  it('a drop inside the boundary is kept in the middle band; outside it stays where it was dropped', () => {
    const top = placeNode(400, 5, f);
    expect(top).toEqual({ x: 400, y: f.middleTop + CM_LAYOUT.padTop, zone: 'content' });
    const low = placeNode(20, f.height - CM_NODE_H - 2, f);
    expect(low.zone).toBe('inputs');
    expect(low.y).toBe(f.middleBottom - CM_LAYOUT.pad - CM_NODE_H);
    expect(placeNode(f.outside.x + 10.4, 700.6, f)).toEqual({ x: Math.round(f.outside.x + 10.4), y: 701, zone: 'outside' });
    // Below or left of the frame, an element is brought back into the middle band of the column it was over.
    expect(placeNode(400, f.height + 300, f)).toEqual({ x: 400, y: f.middleBottom - CM_LAYOUT.pad - CM_NODE_H, zone: 'content' });
    expect(placeNode(-500, -400, f)).toEqual({ x: 0, y: f.middleTop + CM_LAYOUT.padTop, zone: 'inputs' });
  });
  it('an element stays wholly inside its zone: it never sticks into the next column or over the frame', () => {
    const rect = (p: { x: number }) => [p.x, p.x + CM_NODE_W];
    const outputs = placeNode(c - CM_NODE_W / 2 - 1, 200, f);
    expect(outputs.zone).toBe('outputs');
    expect(rect(outputs)[1]).toBeLessThanOrEqual(c);
    const content = placeNode(b - CM_NODE_W / 2 - 1, 200, f);
    expect(content.zone).toBe('content');
    expect(rect(content)[1]).toBeLessThanOrEqual(b);
    const outside = placeNode(c - CM_NODE_W / 2 + 1, 200, f);
    expect(outside.zone).toBe('outside');
    expect(outside.x).toBeGreaterThanOrEqual(f.outside.x);
    for (const zone of CM_ZONES) { const [lo, hi] = zoneXRange(zone, f); expect(lo).toBeLessThanOrEqual(hi); }
  });
  it('a growing frame never changes a zone: an element dropped low stays in its column', () => {
    const d: ConceptModel = { ...model(), nodes: [], edges: [] };
    const low = addNode(d, 'entity', 'low', { x: 400, y: 700 }, 'Dropped below the frame');
    expect(low.zone).toBe('content');
    for (let i = 0; i < 30; i++) addNode(d, 'activity', `a${i}`);
    expect(frameOf(d).height).toBeGreaterThan(700);
    for (const n of d.nodes) expect(centreZone(n, d), n.id).toBe(n.zone);
    expect(conceptLists(d).excluded).toEqual([]);
  });
  it('the zone follows the centre of the element, not its corner', () => {
    expect(placeNode(a - CM_NODE_W / 2 - 1, 200, f).zone).toBe('inputs');
    expect(placeNode(a - CM_NODE_W / 2 + 1, 200, f).zone).toBe('content');
    expect(placeNode(c - CM_NODE_W / 2 + 1, 200, f).zone).toBe('outside');
  });
  it('the frame grows with the lowest element inside the boundary, not with those outside it', () => {
    const base = frameOf({ nodes: [] });
    expect(base.height).toBe(CM_LAYOUT.head + CM_LAYOUT.middle + CM_LAYOUT.foot);
    const tall = frameOf({ nodes: [{ id: 'x', type: 'entity', label: '', x: 400, y: 900, zone: 'content' }] });
    expect(tall.middleBottom).toBe(900 + CM_NODE_H + CM_LAYOUT.pad);
    const out = frameOf({ nodes: [{ id: 'x', type: 'entity', label: '', x: 940, y: 2000, zone: 'outside' }] });
    expect(out.height).toBe(base.height);
    expect(out.outside.h).toBe(2000 + CM_NODE_H + CM_LAYOUT.pad);
  });
  it('free spots lie in their zone and never on another element', () => {
    let d: ConceptModel = { ...model(), nodes: [] };
    for (const zone of CM_ZONES) {
      for (let i = 0; i < 9; i++) {
        const spot = freeSpot(d, zone);
        const n: CMNode = { id: `z${zone}${i}`, type: 'entity', label: '', x: spot.x, y: spot.y, zone };
        expect(d.nodes.some((m) => overlapping(m, n)), `${zone} ${i}`).toBe(false);
        d = { ...d, nodes: [...d.nodes, n] };
        expect(centreZone(n, d), `${zone} ${i}`).toBe(zone);
      }
    }
    expect(zoneSlots('content', frameOf(d))).toHaveLength(3);
  });
});

describe('conceptual model: edits', () => {
  it('an element added without a position goes to its home zone; dropped, it takes the zone under it', () => {
    const d: ConceptModel = { ...model(), nodes: [], edges: [] };
    expect(addNode(d, 'lever', 'a').zone).toBe('inputs');
    expect(addNode(d, 'outcome', 'b').zone).toBe('outputs');
    expect(addNode(d, 'external', 'c').zone).toBe('outside');
    expect(addNode(d, 'activity', 'd').zone).toBe('content');
    expect(addNode(d, 'lever', 'e', { x: 400, y: 200 }).zone).toBe('content');
    for (const n of d.nodes) expect(centreZone(n, d)).toBe(n.zone);
  });
  it('picks a sensible kind for a new connection', () => {
    expect(autoKind('stock', 'activity')).toBe('flow');
    expect(autoKind('entity', 'stock')).toBe('flow');
    expect(autoKind('actor', 'lever')).toBe('decides');
    expect(autoKind('lever', 'stock')).toBe('influence');
    expect(autoKind('variable', 'outcome')).toBe('influence');
    expect(autoKind('stock', 'outcome')).toBe('information');
    expect(autoKind('note', 'stock')).toBe('information');
    expect(autoKind('actor', 'note')).toBe('information');
    for (const a of CM_NODE_TYPES) for (const b of CM_NODE_TYPES) expect(CM_EDGE_KINDS).toContain(autoKind(a, b));
  });
  it('refuses a connection to itself, to a missing element, or the same kind again', () => {
    const d = model();
    expect(connect(d, 'n1', 'n1', 'flow', 'x1')).toEqual({ ok: false, reason: 'self' });
    expect(connect(d, 'n1', 'nope', 'flow', 'x2')).toEqual({ ok: false, reason: 'missing' });
    const same = connect(d, 'n1', 'n2', 'influence', 'x3', '+');
    expect(same.ok).toBe(false);
    expect(!same.ok && same.reason).toBe('same');
    const other = connect(d, 'n1', 'n2', 'flow', 'x4', '+', 'served');
    expect(other.ok && other.edge).toEqual({ id: 'x4', from: 'n1', to: 'n2', kind: 'flow', sign: '', label: 'served' });
    expect(conceptModel.sanitize(JSON.parse(JSON.stringify(d)), () => { throw new Error('no warning expected'); })).toEqual(d);
  });
  it('a deleted element takes its connections with it', () => {
    const d = model();
    removeElements(d, ['n2']);
    expect(d.nodes.map((n) => n.id)).toEqual(['n1', 'n3', 'n4', 'n5']);
    expect(d.edges).toEqual([]);
    const e = model();
    removeElements(e, [], ['e2']);
    expect(e.edges.map((x) => x.id)).toEqual(['e1']);
  });
  it('moving an element updates its zone from where it lands', () => {
    const d = model();
    moveNodes(d, [{ id: 'n2', x: 950, y: 300 }]);
    expect(d.nodes[1]).toMatchObject({ x: 950, y: 300, zone: 'outside' });
    moveNodes(d, [{ id: 'n2', x: 20.4, y: 3 }]);
    expect(d.nodes[1]).toMatchObject({ x: 20, y: CM_LAYOUT.head + CM_LAYOUT.padTop, zone: 'inputs' });
    nudge(d, ['n2'], 200, 0);
    expect(d.nodes[1].zone).toBe('content');
    expect(d.nodes[1].x).toBe(220);
    moveToZone(d, 'n2', 'outputs');
    expect(d.nodes[1].zone).toBe('outputs');
    expect(centreZone(d.nodes[1], d)).toBe('outputs');
    expect(d.nodes.filter((n) => n.id !== 'n2').some((n) => overlapping(n, d.nodes[1]))).toBe(false);
  });
  it('the arrow keys step an element across a column border, both ways, and stop at the left edge', () => {
    const d = model();
    const n3 = () => d.nodes[2];
    // Outputs, at the right edge of its column: the next nudge to the right crosses into the outside area.
    nudge(d, ['n3'], 8, 0); nudge(d, ['n3'], 8, 0); nudge(d, ['n3'], 8, 0);
    expect(n3().zone).toBe('outputs');
    nudge(d, ['n3'], 8, 0);
    expect(n3()).toMatchObject({ zone: 'outside', x: frameOf(d).outside.x });
    nudge(d, ['n3'], -8, 0);
    expect(n3().zone).toBe('outputs');
    expect(n3().x + CM_NODE_W).toBeLessThanOrEqual(CM_LAYOUT.width);
    nudge(d, ['n3'], -40, 0);
    expect(n3().zone).toBe('outputs');
    nudge(d, ['n3'], -40, 0);
    expect(n3().zone).toBe('content');
    const n1 = d.nodes[0];
    nudge(d, ['n1'], -40, 0); nudge(d, ['n1'], -40, 0);
    expect(n1).toMatchObject({ zone: 'inputs', x: 0 });
    for (const n of d.nodes) expect(centreZone(n, d), n.id).toBe(n.zone);
  });
  it('after a delete the keyboard goes to the next element, the one before at the end, or the start of a deleted connection', () => {
    const d = model();
    expect(focusAfterRemoval(d, ['n2'], [])).toBe('n3');
    expect(focusAfterRemoval(d, ['n5'], [])).toBe('n4');
    expect(focusAfterRemoval(d, ['n4', 'n5'], [])).toBe('n3');
    expect(focusAfterRemoval(d, [], ['e2'])).toBe('n2');
    expect(focusAfterRemoval(d, d.nodes.map((n) => n.id), [])).toBeNull();
    expect(focusAfterRemoval({ nodes: [], edges: [] }, [], [])).toBeNull();
  });
  it('only an influence keeps a sign; a connection can be turned round', () => {
    const d = model();
    setEdgeKind(d.edges[0], 'flow');
    expect(d.edges[0]).toMatchObject({ kind: 'flow', sign: '' });
    reverseEdge(d, 'e2');
    expect(d.edges[1]).toMatchObject({ from: 'n3', to: 'n2' });
  });
});

describe('conceptual model: auto-arrange', () => {
  it('keeps every element in its zone, with no overlaps, and changes nothing else', () => {
    const d = model();
    d.nodes.push({ id: 'n6', type: 'activity', label: 'Service', x: 0, y: 0, zone: 'content' }, { id: 'n7', type: 'resource', label: 'Staff', x: 9, y: 9, zone: 'content' });
    d.edges.push({ id: 'e3', from: 'n2', to: 'n6', kind: 'flow', sign: '', label: '' }, { id: 'e4', from: 'n6', to: 'n2', kind: 'information', sign: '', label: '' }, { id: 'e5', from: 'n7', to: 'n6', kind: 'influence', sign: '+', label: '' });
    const nodes = arrange(d);
    const after = { ...d, nodes };
    expect(nodes.map((n) => [n.id, n.type, n.label, n.zone])).toEqual(d.nodes.map((n) => [n.id, n.type, n.label, n.zone]));
    for (const n of nodes) expect(centreZone(n, after), n.id).toBe(n.zone);
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) expect(overlapping(nodes[i], nodes[j]), `${nodes[i].id} ${nodes[j].id}`).toBe(false);
    // A connection points forward: the source of a flow sits left of its target.
    const x = (id: string) => nodes.find((n) => n.id === id)!.x;
    expect(x('n2')).toBeLessThan(x('n6'));
  });
  it('grows the middle band for a crowded zone and still keeps every element inside', () => {
    const many: CMNode[] = Array.from({ length: 14 }, (_, i) => ({ id: `m${i}`, type: 'variable', label: `V${i}`, x: 0, y: 0, zone: i % 2 ? 'inputs' : 'content' }));
    const d: ConceptModel = { objectives: '', assumptions: '', simplifications: '', nodes: many, edges: [] };
    const nodes = arrange(d);
    for (const n of nodes) expect(centreZone(n, { nodes })).toBe(n.zone);
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) expect(overlapping(nodes[i], nodes[j])).toBe(false);
    expect(frameOf({ nodes }).middleBottom).toBeGreaterThan(CM_LAYOUT.head + CM_LAYOUT.middle);
  });
});

describe('conceptual model: starters', () => {
  for (const s of STARTERS) {
    it(`${s.label}: a valid model, neatly inside its zones`, () => {
      const built = buildStarter(s.id, ids);
      const d: ConceptModel = { objectives: '', assumptions: '', simplifications: '', nodes: built.nodes, edges: built.edges };
      const warnings: string[] = [];
      expect(conceptModel.sanitize(JSON.parse(JSON.stringify(d)), (m) => warnings.push(m))).toEqual(d);
      expect(warnings).toEqual([]);
      expect(d.nodes.length).toBeGreaterThanOrEqual(4);
      expect(d.edges.length).toBeGreaterThanOrEqual(5);
      for (const n of d.nodes) { expect(n.id).toMatch(ID_PATTERN); expect(centreZone(n, d), n.label).toBe(n.zone); }
      for (let i = 0; i < d.nodes.length; i++) for (let j = i + 1; j < d.nodes.length; j++) expect(overlapping(d.nodes[i], d.nodes[j])).toBe(false);
      // The process and mechanism starters use every zone; the acceptance model is constructs and their outcome only.
      if (s.id !== 'acceptance') {
        expect(new Set(d.nodes.map((n) => n.zone))).toEqual(new Set(CM_ZONES));
        expect(d.nodes.some((n) => n.type === 'lever')).toBe(true);
      }
      expect(d.nodes.some((n) => n.type === 'outcome')).toBe(true);
      expect(isSafeSvg(conceptFigure(d))).toBe(true);
    });
  }
  it('Technology acceptance: four constructs with five positive paths; frame texts fill only empty fields', () => {
    const built = buildStarter('acceptance', ids);
    const name = (id: string) => labelParts(built.nodes.find((n) => n.id === id)!.label).abbr;
    expect(built.nodes.map((n) => [labelParts(n.label).abbr, n.type, n.zone])).toEqual([
      ['PEOU', 'variable', 'content'], ['PU', 'variable', 'content'], ['ATT', 'variable', 'content'], ['BI', 'outcome', 'outputs'],
    ]);
    expect(built.nodes.map((n) => labelParts(n.label).main)).toEqual(['Perceived ease of use', 'Perceived usefulness', 'Attitude', 'Intention to use']);
    expect(built.edges.map((e) => `${name(e.from)}→${name(e.to)} ${e.kind}${e.sign}`)).toEqual([
      'PEOU→PU influence+', 'PEOU→ATT influence+', 'PU→ATT influence+', 'PU→BI influence+', 'ATT→BI influence+',
    ]);
    const d: ConceptModel = { ...conceptModel.empty(), assumptions: 'Mine.' };
    putStarter(d, built);
    expect(d.objectives).toBe('Which beliefs drive the intention to use the new tool?');
    expect(d.assumptions).toBe('Mine.');
    expect(maxArrowsIn(d)).toBe(2);
    expect(isRelationshipModel(d)).toBe(true);
    // Constructs from measurement data named by their abbreviations are already there.
    expect(addConstructs(d, ['peou', 'PU', 'ATT', 'BI', 'Trust'], () => 'n-trust')).toEqual(['n-trust']);
  });
});

describe('conceptual model: relationship models and constructs', () => {
  it('reads an abbreviation in brackets at the end of a label', () => {
    expect(labelParts('Perceived usefulness (PU)')).toEqual({ main: 'Perceived usefulness', abbr: 'PU' });
    expect(labelParts('Word of mouth (eWOM)')).toEqual({ main: 'Word of mouth', abbr: 'eWOM' });
    expect(labelParts('Queue (waiting)')).toEqual({ main: 'Queue (waiting)', abbr: '' });
    expect(labelParts('Cost (Euro)')).toEqual({ main: 'Cost (Euro)', abbr: '' });
    expect(labelParts('Costs (in euros) per day')).toEqual({ main: 'Costs (in euros) per day', abbr: '' });
    expect(labelParts('  Plain  ')).toEqual({ main: 'Plain', abbr: '' });
  });
  it('counts the arrows into each construct, once per source, over influence paths between constructs only', () => {
    const n = (id: string, type: CMNode['type']): CMNode => ({ id, type, label: id, x: 0, y: 0, zone: 'content' });
    const e = (id: string, from: string, to: string, kind: CMEdge['kind'] = 'influence') => ({ id, from, to, kind, sign: '' as const, label: '' });
    const d = { nodes: [n('a', 'variable'), n('b', 'variable'), n('c', 'variable'), n('y', 'outcome'), n('s', 'stock')], edges: [
      e('1', 'a', 'y'), e('2', 'b', 'y'), e('3', 'c', 'y'), e('4', 'a', 'y'), e('5', 's', 'y'), e('6', 'a', 'b', 'flow'), e('7', 'a', 'b'),
    ] };
    expect(maxArrowsIn(d)).toBe(3); // a, b, c into y; the second a → y and the stock do not count
    expect(isRelationshipModel(d)).toBe(true);
    expect(maxArrowsIn({ nodes: d.nodes, edges: [e('9', 's', 'a'), e('8', 'a', 'b', 'information')] })).toBe(0);
    expect(isRelationshipModel({ nodes: d.nodes, edges: [] })).toBe(false);
  });
  it('adds each construct once, as a variable in the content column, skipping names already there in any case', () => {
    const d: ConceptModel = { ...conceptModel.empty(), nodes: [{ id: 'n1', type: 'variable', label: 'Trust', x: 200, y: 126, zone: 'content' }] };
    let k = 0;
    const added = addConstructs(d, ['PEOU', 'trust', ' PU ', 'peou', '', 'ATT'], () => `c${++k}`);
    expect(added).toEqual(['c1', 'c2', 'c3']);
    expect(d.nodes.slice(1).map((n) => [n.label, n.type, n.zone])).toEqual([['PEOU', 'variable', 'content'], ['PU', 'variable', 'content'], ['ATT', 'variable', 'content']]);
    // Reading order: the first free slots of the top row, left to right.
    const [peou, pu, att] = d.nodes.slice(1);
    expect(peou.y === pu.y && pu.y === att.y && peou.x < pu.x && pu.x < att.x).toBe(false); // Trust holds one slot of the top row
    expect([peou, pu, att].map((n) => [n.x, n.y]).sort((a, b) => a[1] - b[1] || a[0] - b[0])).toEqual([peou, pu, att].map((n) => [n.x, n.y]));
    for (const x of d.nodes) expect(centreZone(x, d)).toBe('content');
    for (let i = 0; i < d.nodes.length; i++) for (let j = i + 1; j < d.nodes.length; j++) expect(overlapping(d.nodes[i], d.nodes[j])).toBe(false);
    expect(addConstructs(d, ['pu'], () => 'x')).toEqual([]);
  });
});

describe('conceptual model: undo history', () => {
  it('undo and redo walk through the snapshots', () => {
    let h = emptyHistory<number>();
    h = record(h, 1, null, 0);
    h = record(h, 2, null, 10);
    const u = undo(h, 3)!;
    expect(u.state).toBe(2);
    const u2 = undo(u.history, 2)!;
    expect(u2.state).toBe(1);
    expect(undo(u2.history, 1)).toBeNull();
    const r = redo(u2.history, 1)!;
    expect(r.state).toBe(2);
    expect(redo(r.history, 2)!.state).toBe(3);
  });
  it('quick changes with the same key are one step; a new change clears what could be redone', () => {
    let h = emptyHistory<string>();
    h = record(h, 'a', 'label:n1', 1000);
    h = record(h, 'ab', 'label:n1', 1000 + COALESCE_MS - 1);
    h = record(h, 'abc', 'label:n1', 1000 + 2 * COALESCE_MS - 2);
    expect(h.past).toEqual(['a']);
    h = record(h, 'abcd', 'label:n2', 5000);
    expect(h.past).toEqual(['a', 'abcd']);
    h = record(h, 'x', 'label:n2', 5000 + COALESCE_MS + 1);
    expect(h.past).toHaveLength(3);
    const u = undo(h, 'y')!;
    expect(u.history.future).toEqual(['y']);
    expect(record(u.history, 'z', null, 9000).future).toEqual([]);
  });
  it('a step that typing took back to where it began (Escape) is dropped', () => {
    const same = (a: string, b: string) => a === b;
    let h = record(emptyHistory<string>(), 'Queue', 'label:n1', 1000);
    expect(settle(h, 'Queue x', same).past).toEqual(['Queue']);
    h = record(h, 'Queue x', 'label:n1', 1500);
    const back = settle(h, 'Queue', same);
    expect(back.past).toEqual([]);
    expect(back.key).toBeNull();
    // A change without a key (a delete, a move) is never dropped this way.
    expect(settle(record(emptyHistory<string>(), 'a', null, 0), 'a', same).past).toEqual(['a']);
  });
  it('an Undo offered in a message holds only for its artefact and only until the next change', () => {
    const t = { owner: 'art-a', version: 7 };
    expect(tokenHolds(t, 'art-a', 7)).toBe(true);
    expect(tokenHolds(t, 'art-b', 7)).toBe(false);
    expect(tokenHolds(t, 'art-a', 8)).toBe(false);
  });
  it('keeps at most the last steps', () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < HISTORY_LIMIT + 30; i++) h = record(h, i, null, i * 10_000);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0]).toBe(30);
  });
});

describe('conceptual model: geometry', () => {
  it('a connection runs from outline to outline', () => {
    const a = nodeRect({ x: 0, y: 0 }), b = nodeRect({ x: 400, y: 0 });
    const g = edgePath(a, b, 0, 0);
    expect(g.start).toEqual({ x: CM_NODE_W, y: CM_NODE_H / 2 });
    expect(g.end).toEqual({ x: 400, y: CM_NODE_H / 2 });
    expect(g.path.startsWith('M')).toBe(true);
  });
  it('opposite connections between one pair bow apart; a lone one is straight', () => {
    const bends = edgeBends([{ id: 'a', from: 'n1', to: 'n2' }, { id: 'b', from: 'n2', to: 'n1' }, { id: 'c', from: 'n1', to: 'n3' }]);
    expect(bends.get('c')).toBe(0);
    const ra = nodeRect({ x: 0, y: 0 }), rb = nodeRect({ x: 400, y: 0 });
    const ga = edgePath(ra, rb, bends.get('a')!), gb = edgePath(rb, ra, bends.get('b')!);
    expect(Math.sign(ga.labelY - CM_NODE_H / 2)).toBe(-Math.sign(gb.labelY - CM_NODE_H / 2));
    expect(Math.abs(ga.labelY - gb.labelY)).toBeGreaterThan(20);
  });
  it('a connection that would run under another element is bowed round it', () => {
    const n = (id: string, x: number): CMNode => ({ id, type: 'entity', label: id, x, y: 200, zone: 'content' });
    const d = { nodes: [n('a', 0), n('b', 220), n('c', 440)], edges: [{ id: 'e', from: 'a', to: 'c' }, { id: 'f', from: 'a', to: 'b' }] };
    const bends = routeBends(d);
    expect(bends.get('f')).toBe(0);
    const bend = bends.get('e')!;
    expect(Math.abs(bend)).toBeGreaterThan(0);
    const g = edgePath(nodeRect(d.nodes[0]), nodeRect(d.nodes[2]), bend, 0);
    const mid = { x: (g.start.x + 2 * g.control.x + g.end.x) / 4, y: (g.start.y + 2 * g.control.y + g.end.y) / 4 };
    const r = nodeRect(d.nodes[1]);
    expect(mid.y < r.y || mid.y > r.y + r.h).toBe(true);
  });
  it('wraps text into lines and marks what was cut', () => {
    expect(wrapText('Average waiting time per day', 12, 2)).toEqual(['Average', 'waiting…']);
    expect(wrapText('Extraordinarily long', 8, 1)).toEqual(['Extraor…']);
    expect(wrapText('Short', 12, 2)).toEqual(['Short']);
    expect(wrapText('', 12, 2)).toEqual([]);
  });
});

describe('conceptual model: picture', () => {
  it('draws nothing for an empty model, unless asked for the empty frame', () => {
    expect(conceptFigure(conceptModel.empty())).toBeNull();
    expect(conceptModel.figure(conceptModel.empty())).toBeNull();
    expect(isSafeSvg(conceptFigure(conceptModel.empty(), { force: true }))).toBe(true);
  });
  it('is a self-contained, safe SVG with every element and the frame texts', () => {
    const svg = conceptModel.figure(model())!;
    expect(isSafeSvg(svg)).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('Objectives');
    expect(svg).toContain('Outside the boundary');
    expect(svg).toContain('Unused capacity is lost.');
    expect(svg).toContain('measured as');
    for (const word of ['Daily', 'capacity', 'Open', 'requests', 'Other', 'offices']) expect(svg).toContain(word);
    // Colours are CSS variables with a fallback, so a file looks right outside the app.
    expect(svg).toMatch(/var\(--primary, #1f5f8b\)/);
    expect(svg).not.toMatch(/href|<image|<script|<foreignObject/i);
  });
  it('escapes hostile text so it cannot become markup', () => {
    const d = model();
    d.nodes[0].label = '<script>alert(1)</script>';
    d.edges[1].label = '"><img src=x onerror=alert(1)>';
    d.objectives = '</text><svg onload=alert(1)>';
    const svg = conceptFigure(d)!;
    expect(isSafeSvg(svg)).toBe(true);
    expect(svg).not.toContain('<script');
    expect(svg).not.toMatch(/<img|<svg onload/);
    expect(svg).toContain('&lt;script&gt;');
    // Even words that only look like markup to the safety check are drawn, not refused.
    d.nodes[1].label = 'javascript: url(x) @import onload=1 href=x';
    expect(isSafeSvg(conceptFigure(d))).toBe(true);
  });
  it('gives each picture its own ids, so two pictures on one page do not share arrow heads', () => {
    const one = conceptFigure(model())!, other = conceptFigure({ ...model(), objectives: 'Another aim' })!;
    const id = (s: string) => s.match(/marker id="([^"]+)-flow"/)![1];
    expect(id(one)).not.toBe(id(other));
    expect(id(one)).toBe(id(conceptFigure(model())!));
  });
  it('shows the outside area only when something is left out', () => {
    const d = model();
    d.nodes = d.nodes.filter((n) => n.zone !== 'outside');
    expect(conceptFigure(d)).not.toContain('Outside the boundary');
  });
});

describe('conceptual model: text', () => {
  it('summary names levers, outcomes and what is left out, in at most five lines', () => {
    const lines = conceptModel.summary(model());
    expect(lines).toEqual([
      '4 elements, 2 connections', 'Aim: See how capacity changes the backlog.', 'Levers: Daily capacity', 'Outcomes: Average backlog', 'Left out: Other offices',
    ]);
    expect(conceptModel.summary(conceptModel.empty())).toEqual(['Nothing drawn yet.']);
  });
  it('the lists for the project leave notes out', () => {
    const d = model();
    d.nodes.push({ id: 'n9', type: 'note', label: 'Ask the team', x: 950, y: 300, zone: 'outside' });
    expect(conceptLists(d)).toEqual({ levers: ['Daily capacity'], outcomes: ['Average backlog'], excluded: ['Other offices'] });
  });
  it('markdown lists elements by zone, connections in words, then levers, outcomes and what is left out', () => {
    const md = conceptModel.markdown(model());
    expect(md).toContain('| Inputs | Daily capacity | Lever |');
    expect(md).toContain('| Outside the boundary | Other offices | External influence |');
    expect(md).toContain('| Daily capacity | influence − | Open requests |');
    expect(md).toContain('| Open requests | information: measured as | Average backlog |');
    expect(md).toContain('- **Levers:** Daily capacity');
    expect(md).toContain('- **Left out:** Other offices');
    expect(md).toContain('- **Note:** Check the term dates');
    const zones = md.filter((l) => l.startsWith('| ') && !l.startsWith('| Where') && !l.startsWith('| ---') && /\| (Inputs|Content|Outputs|Outside the boundary) \|/.test(l)).map((l) => l.split('|')[1].trim());
    expect(zones).toEqual(['Inputs', 'Content', 'Outputs', 'Outside the boundary']);
  });
  it('user text in markdown cannot create structure or markup', () => {
    const d = model();
    const hostile = '| a | b |\n# Heading\n- item\n<script>alert(1)</script>';
    d.nodes[0].label = hostile; d.nodes[4].label = hostile; d.edges[1].label = hostile; d.objectives = hostile;
    const md = conceptModel.markdown(d);
    expect(md.some((l) => /^#/.test(l))).toBe(false);
    const html = markdownToHtml(md.join('\n'));
    expect(html).not.toMatch(/<(script|h1|h2|h3)\b/i);
    expect(html).toContain('&lt;script&gt;');
    expect(html.match(/<table>/g)).toHaveLength(2);
  });
});
