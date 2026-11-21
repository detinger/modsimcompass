import { VV, type PairMode } from '../../content/diagrams/specs';
import { WIDTH_MAX, WIDTH_MIN, WIDTH_STEP, layoutKey, type Dir, type GraphDef } from './layoutCore';

/**
 * Sizes and connections of the three node–edge diagrams, for a direction and an available width.
 * Kept free of React so the build-time generator and the tests can enumerate every case.
 */

/** Real system → conceptual model (a container with inputs → content → outputs) → computer model. */
export function conceptGraph(dir: Dir, width: number): GraphDef {
  const wide = dir === 'RIGHT';
  const row = wide || width >= 500;
  const partW = row ? 122 : Math.min(250, width - 56);
  const partH = row ? 72 : 60;
  const end = wide ? { w: 150, h: 112 } : { w: row ? 230 : partW + 28, h: 76 };
  return {
    spacing: { layer: wide ? 36 : 32 },
    nodes: [
      { id: 'real', ...end },
      {
        id: 'model', w: 0, h: 0, dir: row ? 'RIGHT' : 'DOWN',
        pad: row ? { top: 106, right: 14, bottom: 86, left: 14 } : { top: 124, right: 14, bottom: 150, left: 14 },
        children: [{ id: 'inputs', w: partW, h: partH }, { id: 'content', w: partW, h: partH }, { id: 'outputs', w: partW, h: partH }],
        edges: [{ id: 'feed', from: 'inputs', to: 'content' }, { id: 'produce', from: 'content', to: 'outputs' }],
      },
      { id: 'computer', ...end },
    ],
    edges: [{ id: 'abstract', from: 'real', to: 'model' }, { id: 'implement', from: 'model', to: 'computer' }],
  };
}

/** The build chain runs through the middle; each check is a loop on its own side, so no two links cross. */
export function vvGraph(dir: Dir, width: number): GraphDef {
  const wide = dir === 'RIGHT';
  const [flowIn, flowOut, sideA, sideB] = wide ? (['WEST', 'EAST', 'NORTH', 'SOUTH'] as const) : (['NORTH', 'SOUTH', 'WEST', 'EAST'] as const);
  const labels = wide || width >= 540;
  const w = wide ? 168 : labels ? 210 : Math.min(210, width - 104);
  const h = wide ? 112 : 78;
  return {
    spacing: { layer: wide ? 22 : 34 },
    nodes: [
      { id: 'real', w, h, ports: { out: flowOut, validation: sideA, calibration: sideB } },
      { id: 'concept', w, h, ports: { in: flowIn, out: flowOut, verification: sideB } },
      { id: 'computer', w, h, ports: { in: flowIn, verification: sideB, calibration: sideB, validation: sideA } },
    ],
    edges: [
      { id: 'abstract', from: 'real.out', to: 'concept.in', label: VV.abstract },
      { id: 'implement', from: 'concept.out', to: 'computer.in', label: VV.implement },
      { id: 'verification', from: 'computer.verification', to: 'concept.verification', label: labels ? 'Verification' : undefined },
      { id: 'validation', from: 'computer.validation', to: 'real.validation', label: labels ? 'Validation' : undefined },
      { id: 'calibration', from: 'real.calibration', to: 'computer.calibration', label: labels ? 'Calibration' : undefined },
    ],
  };
}

function pairedGraph(mode: PairMode, dir: Dir, width: number): GraphDef {
  const wide = dir === 'RIGHT';
  const room = width - 12;
  const half = Math.min(210, Math.floor((room - 22) / 2));
  const policy = { w: wide ? 162 : half, h: !wide && half < 152 ? 96 : 74 }; // a narrow policy box puts the value on its own line
  const source = { w: wide ? 150 : mode === 'paired' ? Math.min(240, room) : half, h: 108 };
  const flow = [
    { id: 'baseline', ...policy }, { id: 'alternative', ...policy },
    { id: 'difference', w: wide ? 132 : Math.min(240, room), h: 80 },
    { id: 'distribution', w: wide ? 236 : Math.min(420, room), h: 172 },
  ];
  const tail = [{ id: 'out-baseline', from: 'baseline', to: 'difference' }, { id: 'out-alternative', from: 'alternative', to: 'difference' }, { id: 'collect', from: 'difference', to: 'distribution' }];
  return mode === 'paired'
    ? { spacing: { layer: 34 }, nodes: [{ id: 'source', ...source }, ...flow], edges: [{ id: 'feed-baseline', from: 'source', to: 'baseline' }, { id: 'feed-alternative', from: 'source', to: 'alternative' }, ...tail] }
    : { spacing: { layer: 34 }, nodes: [{ id: 'source', ...source }, { id: 'source2', ...source }, ...flow], edges: [{ id: 'feed-baseline', from: 'source', to: 'baseline' }, { id: 'feed-alternative', from: 'source2', to: 'alternative' }, ...tail] };
}

export const PAIRED_GRAPH: Record<PairMode, (dir: Dir, width: number) => GraphDef> = { paired: (d, w) => pairedGraph('paired', d, w), unpaired: (d, w) => pairedGraph('unpaired', d, w) };

export const BUILDERS: Record<string, (dir: Dir, width: number) => GraphDef> = { concept: conceptGraph, vv: vvGraph, paired: PAIRED_GRAPH.paired, unpaired: PAIRED_GRAPH.unpaired };

/** Every distinct graph the app can ask for: each builder, both directions, every snapped width. */
export function allVariants(): { key: string; name: string; dir: Dir; def: GraphDef }[] {
  const seen = new Map<string, { key: string; name: string; dir: Dir; def: GraphDef }>();
  for (const [name, build] of Object.entries(BUILDERS)) {
    for (const dir of ['RIGHT', 'DOWN'] as const) {
      for (let w = WIDTH_MIN; w <= WIDTH_MAX; w += WIDTH_STEP) {
        const def = build(dir, w), key = layoutKey(def, dir);
        if (!seen.has(key)) seen.set(key, { key, name, dir, def });
      }
    }
  }
  return [...seen.values()];
}
