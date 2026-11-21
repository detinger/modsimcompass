import { CM_LAYOUT, CM_NODE_H, CM_NODE_W, frameOf } from '../../../domain/artefacts/conceptModel';
import type { CMNode, CMZone, ConceptModel } from '../../../domain/artefacts/types';

/**
 * Auto-arrange that respects the zones: every element stays in its zone and only its position changes.
 * Inputs, outputs and the outside area are single columns; the content is laid out in up to three layers
 * following its connections (a longest-path layering with cycles broken), ordered to keep crossings low.
 * No layout library is needed at run time.
 */

const PITCH = CM_LAYOUT.rowPitch;

/** Layer of each content element: 0 for those with nothing flowing in, otherwise one more than their deepest source. */
function layers(ids: string[], links: [string, string][]): Map<string, number> {
  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const [a, b] of links) out.get(a)?.push(b);
  // Break cycles: an edge back to an element still on the depth-first path is ignored.
  const state = new Map<string, 1 | 2>(), kept: [string, string][] = [];
  const visit = (v: string) => {
    state.set(v, 1);
    for (const w of out.get(v) ?? []) {
      const s = state.get(w);
      if (s === 1) continue;
      kept.push([v, w]);
      if (!s) visit(w);
    }
    state.set(v, 2);
  };
  ids.forEach((id) => { if (!state.has(id)) visit(id); });
  const into = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const [a, b] of kept) into.get(b)!.push(a);
  const layer = new Map<string, number>();
  const depth = (v: string, guard: Set<string>): number => {
    const known = layer.get(v);
    if (known !== undefined) return known;
    guard.add(v);
    const preds = into.get(v)!.filter((u) => !guard.has(u));
    const value = preds.length ? 1 + Math.max(...preds.map((u) => depth(u, guard))) : 0;
    guard.delete(v);
    layer.set(v, value);
    return value;
  };
  ids.forEach((id) => depth(id, new Set()));
  return layer;
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Arranged copy of the elements. Connections and zones are left as they are. */
export function arrange(d: ConceptModel): CMNode[] {
  const f = frameOf({ nodes: [] });
  const byZone = (z: CMZone) => d.nodes.filter((n) => n.zone === z);
  const content = byZone('content');
  const contentIds = new Set(content.map((n) => n.id));
  const links = d.edges.filter((e) => contentIds.has(e.from) && contentIds.has(e.to) && e.from !== e.to).map((e) => [e.from, e.to] as [string, string]);
  const connected = new Set(links.flat());

  // Columns of the content: connected elements by layer, the rest added to the shortest columns.
  const layer = layers(content.filter((n) => connected.has(n.id)).map((n) => n.id), links);
  const depth = layer.size ? Math.max(...layer.values()) + 1 : 0;
  const loose = content.filter((n) => !connected.has(n.id)).sort((a, b) => a.y - b.y || a.x - b.x);
  const k = Math.max(1, Math.min(3, depth || loose.length));
  const cols: CMNode[][] = Array.from({ length: k }, () => []);
  content.filter((n) => connected.has(n.id)).sort((a, b) => a.y - b.y || a.x - b.x)
    .forEach((n) => cols[depth <= 3 ? layer.get(n.id)! : Math.floor((layer.get(n.id)! * 3) / depth)].push(n));
  for (const n of loose) cols.reduce((a, b) => (b.length < a.length ? b : a)).push(n);

  // Order within each column by the average position of neighbours (two sweeps each way).
  const order = new Map<string, number>();
  const setOrder = (list: CMNode[]) => list.forEach((n, i) => order.set(n.id, i));
  const neighbours = (id: string, dir: 'in' | 'out') => d.edges.filter((e) => (dir === 'in' ? e.to === id : e.from === id)).map((e) => (dir === 'in' ? e.from : e.to));
  const sortBy = (list: CMNode[], dir: 'in' | 'out') => {
    const score = (n: CMNode) => { const xs = neighbours(n.id, dir).map((id) => order.get(id)).filter((v): v is number => v !== undefined); return xs.length ? mean(xs) : order.get(n.id) ?? 0; };
    return [...list].sort((a, b) => score(a) - score(b));
  };
  const inputs = byZone('inputs').sort((a, b) => a.y - b.y || a.x - b.x);
  const outputs = byZone('outputs').sort((a, b) => a.y - b.y || a.x - b.x);
  const outside = byZone('outside').sort((a, b) => a.y - b.y || a.x - b.x);
  [inputs, outputs, outside, ...cols].forEach(setOrder);
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < cols.length; i++) { cols[i] = sortBy(cols[i], 'in'); setOrder(cols[i]); }
    const outs = sortBy(outputs, 'in'); outputs.splice(0, outputs.length, ...outs); setOrder(outputs);
    for (let i = cols.length - 1; i >= 0; i--) { cols[i] = sortBy(cols[i], 'out'); setOrder(cols[i]); }
    const ins = sortBy(inputs, 'out'); inputs.splice(0, inputs.length, ...ins); setOrder(inputs);
  }
  const outs = [...outside].sort((a, b) => {
    const s = (n: CMNode) => { const xs = [...neighbours(n.id, 'in'), ...neighbours(n.id, 'out')].map((id) => order.get(id)).filter((v): v is number => v !== undefined); return xs.length ? mean(xs) : order.get(n.id) ?? 0; };
    return s(a) - s(b);
  });

  // Vertical placement: each column is centred in a middle band tall enough for the longest one.
  const tallest = Math.max(1, inputs.length, outputs.length, ...cols.map((c) => c.length));
  const block = (n: number) => n * PITCH - (PITCH - CM_NODE_H);
  const room = CM_LAYOUT.padTop + CM_LAYOUT.pad;
  const band = Math.max(CM_LAYOUT.middle, block(tallest) + room);
  const pos = new Map<string, { x: number; y: number }>();
  const column = (list: CMNode[], x: number, top = f.middleTop + CM_LAYOUT.padTop + (band - room - block(list.length)) / 2) =>
    list.forEach((n, i) => pos.set(n.id, { x: Math.round(x), y: Math.round(top + i * PITCH) }));
  const [, a, b, c] = f.columns;
  const centreX = (lo: number, hi: number) => lo + (hi - lo - CM_NODE_W) / 2;
  column(inputs, centreX(0, a));
  column(outputs, centreX(b, c));
  const width = (b - a) / k;
  cols.forEach((list, i) => column(list, centreX(a + i * width, a + (i + 1) * width)));
  column(outs, centreX(f.outside.x, f.outside.x + f.outside.w), f.middleTop + CM_LAYOUT.padTop);
  return d.nodes.map((n) => ({ ...n, ...(pos.get(n.id) ?? {}) }));
}
