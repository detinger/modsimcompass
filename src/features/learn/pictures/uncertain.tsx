import { Arrow, CurveArrow, Pic, at, seeded } from './kit';
import { useFrames } from './motion';

/* ── Monte Carlo: sample the inputs, add them up, repeat; the totals form a histogram ── */

const MC = (() => {
  const u = seeded(11);
  const normal = () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
  const tri = (a: number, c: number, b: number) => { const p = u(), f = (c - a) / (b - a); return p < f ? a + Math.sqrt(p * (b - a) * (c - a)) : b - Math.sqrt((1 - p) * (b - a) * (b - c)); };
  const N = 160, BINS = 14, LO = 4, HI = 18, BUDGET = 12;
  const runs = Array.from({ length: N }, () => { const a = tri(2, 3, 7), b = Math.min(11, Math.exp(1.25 + 0.42 * normal())); return { a, b, total: a + b }; });
  const bin = (t: number) => Math.max(0, Math.min(BINS - 1, Math.floor(((t - LO) / (HI - LO)) * BINS)));
  const final = Array<number>(BINS).fill(0);
  for (const r of runs) final[bin(r.total)]++;
  // Input curves: a triangular and a right-skewed density, drawn to the same small box.
  const curve = (pdf: (x: number) => number, lo: number, hi: number) => {
    const pts = Array.from({ length: 41 }, (_, i) => pdf(lo + ((hi - lo) * i) / 40));
    const top = Math.max(...pts);
    return `M0,30 ${pts.map((p, i) => `L${((i / 40) * 70).toFixed(1)},${(30 - (p / top) * 26).toFixed(1)}`).join(' ')} L70,30 Z`;
  };
  const triPdf = (x: number) => (x < 2 || x > 7 ? 0 : x < 3 ? x - 2 : (7 - x) / 4);
  const logPdf = (x: number) => (x <= 0 ? 0 : Math.exp(-((Math.log(x) - 1.25) ** 2) / (2 * 0.42 * 0.42)) / x);
  return { N, BINS, LO, HI, BUDGET, runs, bin, top: Math.max(...final), curveA: curve(triPdf, 1, 8), curveB: curve(logPdf, 0.5, 11), ax: (a: number) => ((a - 1) / 7) * 70, bx: (b: number) => ((b - 0.5) / 10.5) * 70 };
})();
const MC_STEPS = 20, MC_HOLD = 5;

export function MonteCarloPicture({ label }: { label: string }) {
  const { ref, frame } = useFrames<SVGSVGElement>(650, MC_STEPS + MC_HOLD - 1);
  const f = frame % (MC_STEPS + MC_HOLD);
  const n = Math.min(MC.N, (f + 1) * (MC.N / MC_STEPS));
  const counts = Array<number>(MC.BINS).fill(0);
  let over = 0;
  for (let i = 0; i < n; i++) { counts[MC.bin(MC.runs[i].total)]++; if (MC.runs[i].total > MC.BUDGET) over++; }
  const last = MC.runs[n - 1];
  const X0 = 152, X1 = 268, BASE = 112, TOP = 78;
  const bw = (X1 - X0) / MC.BINS;
  const hx = (t: number) => X0 + ((t - MC.LO) / (MC.HI - MC.LO)) * (X1 - X0);
  const budgetBin = MC.bin(MC.BUDGET);
  const sampling = f < MC_STEPS;
  return (
    <Pic svgRef={ref} label={label}>
      <text className="lp-quiet" x={12} y={16}>cost A</text>
      <g transform="translate(12 20)">
        <path className="lp-area" d={MC.curveA} />
        <line className="lp-axis" x1={0} y1={30} x2={70} y2={30} />
        {sampling && <circle className="lp-dot is-hot" r={3.5} cy={30} style={at(MC.ax(last.a), 0)} />}
      </g>
      <text className="lp-quiet" x={12} y={76}>cost B</text>
      <g transform="translate(12 80)">
        <path className="lp-area" d={MC.curveB} />
        <line className="lp-axis" x1={0} y1={30} x2={70} y2={30} />
        {sampling && <circle className="lp-dot is-hot" r={3.5} cy={30} style={at(MC.bx(last.b), 0)} />}
      </g>
      <Arrow x1={86} y1={42} x2={106} y2={60} hot={sampling} />
      <Arrow x1={86} y1={98} x2={106} y2={80} hot={sampling} />
      <circle className="lp-node" cx={116} cy={70} r={11} />
      <text className="lp-strong" x={116} y={74.5} textAnchor="middle" style={{ fontSize: 14 }}>+</text>
      <Arrow x1={128} y1={70} x2={146} y2={70} hot={sampling} />
      {counts.map((c, i) => {
        const h = (c / MC.top) * TOP;
        return <rect key={i} className={`lp-bar${i >= budgetBin ? ' is-over' : ''}`} x={X0 + i * bw + 0.6} y={BASE - h} width={bw - 1.2} height={h} />;
      })}
      <line className="lp-axis" x1={X0 - 2} y1={BASE} x2={X1 + 2} y2={BASE} />
      <line className="lp-mark" x1={hx(MC.BUDGET)} y1={26} x2={hx(MC.BUDGET)} y2={BASE} />
      <text className="lp-quiet" x={hx(MC.BUDGET) + 4} y={30}>budget</text>
      {sampling && <circle className="lp-dot is-hot" r={3.5} cy={BASE + 7} style={at(hx(Math.max(MC.LO, Math.min(MC.HI, last.total))), 0)} />}
      <text className="lp-cap" x={X1} y={140} textAnchor="end">{n} runs · over budget {Math.round((over / n) * 100)}%</text>
      <text className="lp-quiet" x={X0} y={140}>total</text>
    </Pic>
  );
}

/* ── Markov chain: a marker hops between states; only the current state decides the next move ── */

const MK = (() => {
  const P = [[0.6, 0.3, 0.1], [0.3, 0.4, 0.3], [0.2, 0.4, 0.4]];
  const pos = [{ x: 62, y: 50 }, { x: 218, y: 50 }, { x: 140, y: 106 }];
  const names = ['Sunny', 'Cloudy', 'Rainy'];
  const u = seeded(5);
  const STEPS = 32;
  const path = [0];
  for (let k = 1; k < STEPS; k++) {
    const row = P[path[k - 1]], r = u();
    path.push(r < row[0] ? 0 : r < row[0] + row[1] ? 1 : 2);
  }
  const R = 21;
  /** The two arrows between a pair of states run side by side, each shifted to its own right. */
  const edge = (i: number, j: number) => {
    const a = pos[i], b = pos[j], len = Math.hypot(b.x - a.x, b.y - a.y);
    const dx = (b.x - a.x) / len, dy = (b.y - a.y) / len, nx = -dy * 5, ny = dx * 5;
    return {
      x1: a.x + dx * (R + 2) + nx, y1: a.y + dy * (R + 2) + ny, x2: b.x - dx * (R + 3) + nx, y2: b.y - dy * (R + 3) + ny,
      lx: (a.x + b.x) / 2 + nx * 2.6, ly: (a.y + b.y) / 2 + ny * 2.6 + 3.5,
    };
  };
  return { P, pos, names, path, STEPS, R, edge };
})();

export function MarkovPicture({ label }: { label: string }) {
  const { ref, frame } = useFrames<SVGSVGElement>(1000, 13);
  const k = frame % MK.STEPS;
  const cur = MK.path[k];
  const visits = [0, 0, 0];
  for (let i = 0; i <= k; i++) visits[MK.path[i]]++;
  const pairs: [number, number][] = [[0, 1], [1, 0], [0, 2], [2, 0], [1, 2], [2, 1]];
  const loop = (i: number, hot: boolean) => {
    const { x, y } = MK.pos[i];
    if (i === 2) {
      const lx = x - MK.R;
      return (
        <g key={`loop${i}`}>
          <CurveArrow d={`M${lx + 2},${y - 9} C${lx - 20},${y - 16} ${lx - 20},${y + 16} ${lx + 1},${y + 9}`} x={lx + 3} y={y + 8} angle={-25} hot={hot} size={6} />
          {hot && <text className="lp-small lp-strong" x={lx - 19} y={y + 3.5} textAnchor="end">{MK.P[i][i]}</text>}
        </g>
      );
    }
    const ty = y - MK.R;
    return (
      <g key={`loop${i}`}>
        <CurveArrow d={`M${x - 9},${ty + 2} C${x - 16},${ty - 20} ${x + 16},${ty - 20} ${x + 9},${ty + 1}`} x={x + 8} y={ty + 3} angle={115} hot={hot} size={6} />
        {hot && <text className="lp-small lp-strong" x={x + 16} y={ty - 8}>{MK.P[i][i]}</text>}
      </g>
    );
  };
  return (
    <Pic svgRef={ref} label={label} reset={k === 0}>
      {pairs.map(([i, j]) => {
        const e = MK.edge(i, j), hot = i === cur;
        return (
          <g key={`${i}${j}`}>
            <Arrow x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} hot={hot} w={hot ? 2 : 1.2} size={6} />
            {hot && <text className="lp-small lp-strong" x={e.lx} y={e.ly} textAnchor="middle">{MK.P[i][j]}</text>}
          </g>
        );
      })}
      {[0, 1, 2].map((i) => loop(i, i === cur))}
      {MK.pos.map((p, i) => (
        <g key={i}>
          <circle className={`lp-node${i === cur ? ' is-soft' : ''}`} cx={p.x} cy={p.y} r={MK.R} />
          <text x={p.x} y={p.y - 1} textAnchor="middle">{MK.names[i]}</text>
          <text className="lp-small lp-quiet" x={p.x} y={p.y + 11} textAnchor="middle">{Math.round((visits[i] / (k + 1)) * 100)}%</text>
        </g>
      ))}
      <circle className="lp-ring lp-move" r={MK.R + 3.5} style={at(MK.pos[cur].x, MK.pos[cur].y)} />
      <text className="lp-cap" x={12} y={143}>day {k + 1}</text>
      <text className="lp-quiet" x={268} y={143} textAnchor="end">share of days so far</text>
    </Pic>
  );
}
