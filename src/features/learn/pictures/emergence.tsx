import { Pic, at, seeded } from './kit';
import { useFrames } from './motion';

/* ── Cellular automaton: ready → firing → resting → ready. A ready cell fires when one of its four neighbours fires. ──
   The three-state excitable rule is one of the families in the specialist cellular automata app. */

export const CA_COLS = 22, CA_ROWS = 9;
export type CaState = 0 | 1 | 2; // ready, firing, resting

/** One update of the excitable rule on a grid with a quiet border (cells outside the grid never fire). */
export function caStep(g: CaState[][]): CaState[][] {
  return g.map((row, r) => row.map((s, c) => {
    if (s === 1) return 2;
    if (s === 2) return 0;
    const fires = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([rr, cc]) => g[rr]?.[cc] === 1);
    return fires ? 1 : 0;
  }));
}

export const CA_GENS: CaState[][][] = (() => {
  const g0: CaState[][] = Array.from({ length: CA_ROWS }, () => Array<CaState>(CA_COLS).fill(0));
  g0[4][5] = 1;
  g0[3][16] = 1;
  const gens = [g0];
  for (let i = 1; i < 18; i++) gens.push(caStep(gens[i - 1]));
  return gens;
})();
const CA_HOLD = 2;
const CA_CELL = 11;

export function CellularPicture({ label }: { label: string }) {
  const { ref, frame, moving } = useFrames<SVGSVGElement>(650, 5);
  const k = Math.min(CA_GENS.length - 1, frame % (CA_GENS.length + CA_HOLD));
  const g = CA_GENS[k];
  const X0 = (280 - CA_COLS * CA_CELL) / 2, Y0 = 8;
  const NAMES = ['ready', 'firing', 'resting'];
  return (
    <Pic svgRef={ref} label={label} moving={moving}>
      {g.flatMap((row, r) => row.map((s, c) => (
        <rect key={`${r}-${c}`} className={`lp-cell is-s${s}`} x={X0 + c * CA_CELL} y={Y0 + r * CA_CELL} width={CA_CELL - 1.5} height={CA_CELL - 1.5} rx={2} />
      )))}
      {NAMES.map((n, i) => (
        <g key={n} transform={`translate(${X0 + i * 58} 117)`}>
          <rect className={`lp-cell is-s${i}`} width={9} height={9} rx={2} />
          <text className="lp-small lp-quiet" x={13} y={8}>{n}</text>
        </g>
      ))}
      <text className="lp-small lp-quiet" x={X0 + CA_COLS * CA_CELL} y={125} textAnchor="end">step {k}</text>
      <text className="lp-cap" x={X0} y={144}>fire if a neighbour fires, then rest</text>
    </Pic>
  );
}

/* ── Agent-based model: agents wander; each adopts an idea after enough contacts with adopters ──
   Agents and their own adoption rules, after the interaction models of the specialist ABM app. */

export const ABM = (() => {
  const u = seeded(9);
  const N = 24, STEPS = 28, R = 18, SPEED = 9;
  const X0 = 10, X1 = 166, Y0 = 12, Y1 = 118;
  const agents = Array.from({ length: N }, (_, i) => ({
    x: X0 + 8 + u() * (X1 - X0 - 16), y: Y0 + 8 + u() * (Y1 - Y0 - 16), h: u() * Math.PI * 2,
    /** Contacts needed before this agent adopts. */
    need: 1 + Math.floor(u() * 3), contacts: 0, on: i === 0,
  }));
  agents[0].x = (X0 + X1) / 2; agents[0].y = (Y0 + Y1) / 2; agents[0].need = 1;
  const frames: { x: number[]; y: number[]; on: boolean[]; links: [number, number][] }[] = [];
  const snap = (links: [number, number][]) => frames.push({ x: agents.map((a) => a.x), y: agents.map((a) => a.y), on: agents.map((a) => a.on), links });
  snap([]);
  for (let s = 1; s < STEPS; s++) {
    for (const a of agents) {
      a.h += (u() - 0.5) * 1.4;
      a.x += Math.cos(a.h) * SPEED; a.y += Math.sin(a.h) * SPEED;
      if (a.x < X0 + 5) { a.x = 2 * (X0 + 5) - a.x; a.h = Math.PI - a.h; }
      if (a.x > X1 - 5) { a.x = 2 * (X1 - 5) - a.x; a.h = Math.PI - a.h; }
      if (a.y < Y0 + 5) { a.y = 2 * (Y0 + 5) - a.y; a.h = -a.h; }
      if (a.y > Y1 - 5) { a.y = 2 * (Y1 - 5) - a.y; a.h = -a.h; }
    }
    const links: [number, number][] = [];
    agents.forEach((a, i) => {
      if (a.on) return;
      agents.forEach((b, j) => { if (b.on && Math.hypot(a.x - b.x, a.y - b.y) < R) { a.contacts++; links.push([j, i]); } });
    });
    for (const a of agents) if (!a.on && a.contacts >= a.need) a.on = true;
    snap(links);
  }
  const share = frames.map((f) => f.on.filter(Boolean).length / N);
  return { N, STEPS, X0, X1, Y0, Y1, need: agents.map((a) => a.need), frames, share };
})();
const ABM_HOLD = 4;

export function AbmPicture({ label }: { label: string }) {
  const { ref, frame, moving } = useFrames<SVGSVGElement>(700, 13);
  const k = Math.min(ABM.STEPS - 1, frame % (ABM.STEPS + ABM_HOLD));
  const f = ABM.frames[k];
  const CH = { x0: 188, x1: 270, y0: 22, y1: 104 };
  const cx = (s: number) => CH.x0 + (s / (ABM.STEPS - 1)) * (CH.x1 - CH.x0);
  const cy = (v: number) => CH.y1 - v * (CH.y1 - CH.y0);
  const curve = ABM.share.slice(0, k + 1).map((v, s) => `${s ? 'L' : 'M'}${cx(s).toFixed(1)},${cy(v).toFixed(1)}`).join(' ');
  const adopted = f.on.filter(Boolean).length;
  return (
    <Pic svgRef={ref} label={label} reset={k === 0} moving={moving} ms={700}>
      <rect className="lp-field" x={ABM.X0} y={ABM.Y0} width={ABM.X1 - ABM.X0} height={ABM.Y1 - ABM.Y0} rx={6} />
      {f.links.map(([a, b], i) => <line key={i} className="lp-link" x1={f.x[a]} y1={f.y[a]} x2={f.x[b]} y2={f.y[b]} />)}
      {f.x.map((x, i) => (
        <circle key={i} className={`lp-agent lp-move${f.on[i] ? ' is-on' : ''}`} r={2 + ABM.need[i] * 1.3} style={at(x, f.y[i])} />
      ))}
      <line className="lp-axis" x1={CH.x0} y1={CH.y1} x2={CH.x1} y2={CH.y1} />
      <line className="lp-axis" x1={CH.x0} y1={CH.y0} x2={CH.x0} y2={CH.y1} />
      <text className="lp-small lp-quiet" x={CH.x0 - 3} y={CH.y0 + 3} textAnchor="end">all</text>
      <text className="lp-small lp-quiet" x={(CH.x0 + CH.x1) / 2} y={CH.y0 - 8} textAnchor="middle">adopted</text>
      <text className="lp-small lp-quiet" x={CH.x1} y={CH.y1 + 10} textAnchor="end">time</text>
      <path className="lp-trace" d={curve} />
      <circle className="lp-dot is-hot" cx={cx(k)} cy={cy(ABM.share[k])} r={3} />
      <text className="lp-small lp-quiet" x={ABM.X0} y={131}>bigger dot: needs more contacts</text>
      <text className="lp-cap" x={ABM.X0} y={144}>step {k + 1} · {adopted} of {ABM.N} adopted</text>
    </Pic>
  );
}
