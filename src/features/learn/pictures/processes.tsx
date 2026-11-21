import { Arrow, CurveArrow, Pic, at } from './kit';
import { useFrames } from './motion';

/* ── Petri net: a token splits into two branches; the join fires only when both inputs are marked ──
   Notation follows the specialist Petri net app: round places holding token dots, bar-shaped transitions. */

type PlaceId = 'start' | 'a1' | 'b1' | 'a2' | 'b2' | 'end';
type TransId = 'split' | 'pick' | 'pay' | 'join';
const PN_PLACE: Record<PlaceId, { x: number; y: number; label?: string }> = {
  start: { x: 24, y: 66, label: 'order' }, a1: { x: 100, y: 34 }, b1: { x: 100, y: 98 },
  a2: { x: 178, y: 34 }, b2: { x: 178, y: 98 }, end: { x: 256, y: 66, label: 'ship' },
};
const PN_TRANS: Record<TransId, { x: number; y: number; ins: PlaceId[]; outs: PlaceId[]; label: string; below: boolean }> = {
  split: { x: 62, y: 66, ins: ['start'], outs: ['a1', 'b1'], label: 'split', below: true },
  pick: { x: 139, y: 34, ins: ['a1'], outs: ['a2'], label: 'pick', below: false },
  pay: { x: 139, y: 98, ins: ['b1'], outs: ['b2'], label: 'pay', below: true },
  join: { x: 217, y: 66, ins: ['a2', 'b2'], outs: ['end'], label: 'join', below: true },
};
/** Each frame: where the two tokens are, which transition just fired, and the caption. Token b hides under token a until the split. */
const PN_FRAMES: { a: PlaceId; b: PlaceId; fired: TransId | null; cap: string }[] = [
  { a: 'start', b: 'start', fired: null, cap: 'a token marks one order' },
  { a: 'a1', b: 'b1', fired: 'split', cap: 'split: one token becomes two' },
  { a: 'a2', b: 'b1', fired: 'pick', cap: 'picking is done first' },
  { a: 'a2', b: 'b1', fired: null, cap: 'join waits: one input is empty' },
  { a: 'a2', b: 'b2', fired: 'pay', cap: 'payment is done too' },
  { a: 'end', b: 'end', fired: 'join', cap: 'join fires: both inputs are marked' },
  { a: 'end', b: 'end', fired: null, cap: 'join fires: both inputs are marked' },
];
const R_PLACE = 11;

/** Arc from a place edge to a transition bar, or back. */
function pnArc(p: PlaceId, t: TransId, toTrans: boolean) {
  const P = PN_PLACE[p], T = PN_TRANS[t];
  const dx = T.x - P.x, dy = T.y - P.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
  const px = P.x + ux * (R_PLACE + 1.5), py = P.y + uy * (R_PLACE + 1.5);
  const k = (Math.abs(dx) - 5) / Math.abs(dx);
  const tx = P.x + dx * k, ty = P.y + dy * k;
  return toTrans ? { x1: px, y1: py, x2: tx, y2: ty } : { x1: tx, y1: ty, x2: px - ux * 1.5, y2: py - uy * 1.5 };
}

export function PetriPicture({ label }: { label: string }) {
  const { ref, frame, moving } = useFrames<SVGSVGElement>(1250, 3);
  const k = frame % PN_FRAMES.length;
  const f = PN_FRAMES[k];
  const marked = new Set<PlaceId>([f.a, f.b]);
  const enabled = (t: TransId) => PN_TRANS[t].ins.every((p) => marked.has(p));
  const waiting = f.fired === null && f.a === 'a2' && f.b === 'b1';
  return (
    <Pic svgRef={ref} label={label} reset={k === 0} moving={moving} ms={620}>
      {(Object.keys(PN_TRANS) as TransId[]).flatMap((t) => [
        ...PN_TRANS[t].ins.map((p) => <Arrow key={`${p}-${t}`} {...pnArc(p, t, true)} size={6} hot={f.fired === t} />),
        ...PN_TRANS[t].outs.map((p) => <Arrow key={`${t}-${p}`} {...pnArc(p, t, false)} size={6} hot={f.fired === t} />),
      ])}
      {(Object.keys(PN_PLACE) as PlaceId[]).map((p) => {
        const P = PN_PLACE[p];
        return (
          <g key={p}>
            <circle className={`lp-node${marked.has(p) ? ' is-soft' : ''}`} cx={P.x} cy={P.y} r={R_PLACE} />
            {P.label && <text className="lp-small lp-quiet" x={P.x} y={P.y + R_PLACE + 11} textAnchor="middle">{P.label}</text>}
          </g>
        );
      })}
      {(Object.keys(PN_TRANS) as TransId[]).map((t) => {
        const T = PN_TRANS[t];
        const cls = f.fired === t ? ' is-fired' : t === 'join' && waiting ? ' is-wait' : enabled(t) ? ' is-on' : '';
        return (
          <g key={t}>
            <rect className={`lp-trans${cls}`} x={T.x - 3.5} y={T.y - 13} width={7} height={26} rx={1.5} />
            <text className="lp-small lp-quiet" x={T.x} y={T.below ? T.y + 25 : T.y - 18} textAnchor="middle">{T.label}</text>
          </g>
        );
      })}
      <circle className="lp-token lp-move" r={4.2} style={at(PN_PLACE[f.a].x, PN_PLACE[f.a].y)} />
      <circle className="lp-token lp-move" r={4.2} style={{ ...at(PN_PLACE[f.b].x, PN_PLACE[f.b].y), opacity: f.b === f.a ? 0 : 1 }} />
      <text className="lp-cap" x={140} y={144} textAnchor="middle">{f.cap}</text>
    </Pic>
  );
}

/* ── System dynamics: a stock with an inflow and an outflow; the outflow grows with the level ──
   Stock-and-flow glyphs follow the specialist system dynamics app: a box for the stock, a valve on a pipe,
   clouds where the pipe leaves the model boundary, and a thin information link. */

const SD = (() => {
  const K = 0.25, T = 28, STEP_AT = 8, L0 = 8;
  const inflow = (t: number) => (t < STEP_AT ? 2 : 4);
  const level = [L0];
  for (let t = 1; t <= T; t++) { const L = level[t - 1]; level.push(L + inflow(t - 1) - K * L); }
  return { K, T, STEP_AT, inflow, level, MAX: 18 };
})();
const SD_HOLD = 5;

function Cloud({ x, y }: { x: number; y: number }) {
  return <path className="lp-cloud" d={`M${x - 9},${y + 5} a5,5 0 0 1 1,-9 a6,6 0 0 1 10,-3 a5,5 0 0 1 8,4 a4.5,4.5 0 0 1 -1,8 Z`} />;
}
function Valve({ x, y, hot }: { x: number; y: number; hot?: boolean }) {
  return (
    <g className={`lp-valve${hot ? ' is-hot' : ''}`}>
      <path d={`M${x - 8},${y - 8} L${x},${y} L${x - 8},${y + 8} Z M${x + 8},${y - 8} L${x},${y} L${x + 8},${y + 8} Z`} />
      <line x1={x} y1={y} x2={x} y2={y - 12} />
      <circle cx={x} cy={y - 13} r={2} />
    </g>
  );
}

export function SystemDynamicsPicture({ label }: { label: string }) {
  const { ref, frame, moving } = useFrames<SVGSVGElement>(430, SD.T);
  const t = Math.min(SD.T, frame % (SD.T + SD_HOLD));
  const L = SD.level[t], inF = SD.inflow(t), outF = SD.K * L;
  const TANK = { x: 112, y: 12, w: 56, h: 54 };
  const fillH = (L / SD.MAX) * TANK.h;
  const CH = { x0: 40, x1: 268, y0: 84, y1: 126 };
  const cx = (k: number) => CH.x0 + (k / SD.T) * (CH.x1 - CH.x0);
  const cy = (v: number) => CH.y1 - (v / SD.MAX) * (CH.y1 - CH.y0);
  const trace = SD.level.slice(0, t + 1).map((v, k) => `${k ? 'L' : 'M'}${cx(k).toFixed(1)},${cy(v).toFixed(1)}`).join(' ');
  const cap = t < SD.STEP_AT ? 'steady: inflow equals outflow' : t < SD.STEP_AT + 5 ? 'inflow rises: the level climbs' : t < SD.STEP_AT + 13 ? 'more level, more outflow: feedback' : 'a new balance, higher up';
  return (
    <Pic svgRef={ref} label={label} reset={t === 0} moving={moving}>
      <Cloud x={14} y={40} />
      <line className="lp-pipe" x1={24} y1={40} x2={TANK.x} y2={40} strokeWidth={2 + inF} />
      <line className="lp-pipe-flow" x1={24} y1={40} x2={TANK.x} y2={40} />
      <Valve x={66} y={40} hot={t >= SD.STEP_AT && t < SD.STEP_AT + 3} />
      <text className="lp-small lp-quiet" x={66} y={60} textAnchor="middle">inflow {inF}</text>
      <rect className="lp-node" x={TANK.x} y={TANK.y} width={TANK.w} height={TANK.h} rx={2} />
      <rect className="lp-fill" x={TANK.x + 1} y={TANK.y + TANK.h - fillH} width={TANK.w - 2} height={Math.max(0, fillH - 1)} />
      <text x={TANK.x + TANK.w / 2} y={TANK.y + 14} textAnchor="middle">level</text>
      <text className="lp-strong" x={TANK.x + TANK.w / 2} y={TANK.y + 27} textAnchor="middle">{L.toFixed(1)}</text>
      <line className="lp-pipe" x1={TANK.x + TANK.w} y1={40} x2={256} y2={40} strokeWidth={2 + outF} />
      <line className="lp-pipe-flow" x1={TANK.x + TANK.w} y1={40} x2={256} y2={40} />
      <Valve x={214} y={40} />
      <text className="lp-small lp-quiet" x={214} y={60} textAnchor="middle">outflow {outF.toFixed(1)}</text>
      <Cloud x={266} y={40} />
      <CurveArrow d={`M${TANK.x + TANK.w - 6},${TANK.y - 1} C${TANK.x + TANK.w + 12},${-4} ${200},${2} ${210},${22}`} x={211} y={23} angle={68} hot dashed size={6} w={1.3} />
      <text className="lp-strong" x={222} y={20}>+</text>
      <line className="lp-axis" x1={CH.x0} y1={CH.y1} x2={CH.x1} y2={CH.y1} />
      <line className="lp-axis" x1={CH.x0} y1={CH.y0} x2={CH.x0} y2={CH.y1} />
      <text className="lp-small lp-quiet" x={CH.x0 - 4} y={CH.y0 + 6} textAnchor="end">level</text>
      <text className="lp-small lp-quiet" x={CH.x1} y={CH.y1 + 9} textAnchor="end">time</text>
      <line className="lp-mark" x1={cx(SD.STEP_AT)} y1={CH.y0 - 2} x2={cx(SD.STEP_AT)} y2={CH.y1} />
      <path className="lp-trace" d={trace} />
      <circle className="lp-dot is-hot" cx={cx(t)} cy={cy(L)} r={3} />
      <text className="lp-cap" x={CH.x0} y={144}>{cap}</text>
    </Pic>
  );
}

/* ── Queueing theory: as utilisation nears one, the line grows sharply (one server, L = ρ / (1 − ρ)) ── */

const Q_STAGES = [0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 0.95];
const Q_MAX_DOTS = 8;
export const queueLength = (rho: number) => rho / (1 - rho);

export function QueueingPicture({ label }: { label: string }) {
  const { ref, frame, moving } = useFrames<SVGSVGElement>(1300, 4);
  const rho = Q_STAGES[frame % Q_STAGES.length];
  const L = queueLength(rho);
  const waiting = Math.max(0, Math.round(L) - 1);
  const shown = Math.min(Q_MAX_DOTS, waiting);
  const CH = { x0: 160, x1: 262, y0: 18, y1: 116 };
  const LMAX = 20;
  const px = (r: number) => CH.x0 + r * (CH.x1 - CH.x0);
  const py = (v: number) => CH.y1 - (Math.min(v, LMAX) / LMAX) * (CH.y1 - CH.y0);
  const curve = Array.from({ length: 60 }, (_, i) => { const r = (i / 59) * 0.952; return `${i ? 'L' : 'M'}${px(r).toFixed(1)},${py(queueLength(r)).toFixed(1)}`; }).join(' ');
  return (
    <Pic svgRef={ref} label={label} moving={moving} ms={500}>
      <Arrow x1={8} y1={34} x2={22} y2={50} size={6} hot />
      <text className="lp-small lp-quiet" x={6} y={26}>arrive</text>
      {Array.from({ length: Q_MAX_DOTS }, (_, i) => (
        <circle key={i} className="lp-token lp-pop" cx={96 - i * 9.5} cy={64} r={3.6} style={{ opacity: i < shown ? 1 : 0 }} />
      ))}
      {waiting > Q_MAX_DOTS && <text className="lp-small lp-strong" x={13} y={67} textAnchor="middle">+{waiting - Q_MAX_DOTS}</text>}
      <text className="lp-small lp-quiet" x={60} y={84} textAnchor="middle">line</text>
      <circle className="lp-node is-soft" cx={118} cy={64} r={13} />
      <circle className="lp-token" cx={118} cy={64} r={4} />
      <text className="lp-small lp-quiet" x={118} y={90} textAnchor="middle">server</text>
      <Arrow x1={132} y1={64} x2={148} y2={64} size={6} />
      <line className="lp-axis" x1={CH.x0} y1={CH.y1} x2={CH.x1 + 4} y2={CH.y1} />
      <line className="lp-axis" x1={CH.x0} y1={CH.y0} x2={CH.x0} y2={CH.y1} />
      <line className="lp-mark" x1={px(1)} y1={CH.y0} x2={px(1)} y2={CH.y1} />
      <path className="lp-trace" d={curve} />
      <circle className="lp-ring lp-move" r={4.5} style={at(px(rho), py(L))} />
      {[0, 0.5, 1].map((r) => <text key={r} className="lp-small lp-quiet" x={px(r)} y={CH.y1 + 10} textAnchor="middle">{r}</text>)}
      <text className="lp-small lp-quiet" x={CH.x0 - 4} y={CH.y0 + 4} textAnchor="end">20</text>
      <text className="lp-small lp-quiet" x={CH.x0 - 4} y={CH.y1} textAnchor="end">0</text>
      <text className="lp-small lp-quiet" x={(CH.x0 + CH.x1) / 2} y={CH.y0 - 6} textAnchor="middle">in system</text>
      <text className="lp-cap" x={8} y={144}>busy {Math.round(rho * 100)}% · on average {L < 10 ? L.toFixed(1) : Math.round(L)} in system</text>
    </Pic>
  );
}

/* ── Discrete-event simulation: items arrive, queue, are served and leave; the clock jumps from event to event ──
   The event clock follows the theory page of the specialist DES app. An illustrative trace, not data. */

const DES = (() => {
  const arrive = [0.5, 1.5, 2.2, 5.8, 6.4];
  const service = [2.0, 1.6, 1.4, 1.2, 1.0];
  const start: number[] = [], end: number[] = [];
  arrive.forEach((a, i) => { start.push(Math.max(a, i ? end[i - 1] : 0)); end.push(start[i] + service[i]); });
  const events = [
    ...arrive.map((t, i) => ({ t, kind: 'arrive' as const, who: i })),
    ...end.map((t, i) => ({ t, kind: 'leave' as const, who: i })),
  ].sort((a, b) => a.t - b.t);
  return { arrive, start, end, events, TMAX: 9 };
})();

export function DesPicture({ label }: { label: string }) {
  const { ref, frame, moving } = useFrames<SVGSVGElement>(1150, 3);
  const k = frame % (DES.events.length + 3);
  const shownEvents = DES.events.slice(0, Math.min(k, DES.events.length));
  const now = shownEvents.length ? shownEvents[shownEvents.length - 1].t : 0;
  const last = shownEvents[shownEvents.length - 1];
  const queue = DES.arrive.map((_, i) => i).filter((i) => DES.arrive[i] <= now && DES.start[i] > now);
  const pos = (i: number) => {
    if (DES.arrive[i] > now) return { x: 10, y: 44, o: 0 };
    if (DES.end[i] <= now) return { x: 238, y: 44, o: 0 };
    if (DES.start[i] <= now) return { x: 150, y: 44, o: 1 };
    return { x: 108 - queue.indexOf(i) * 19, y: 44, o: 1 };
  };
  const TL = { x0: 18, x1: 266, y: 112 };
  const tx = (t: number) => TL.x0 + (t / DES.TMAX) * (TL.x1 - TL.x0);
  const inService = DES.arrive.findIndex((_, i) => DES.start[i] <= now && DES.end[i] > now);
  const cap = !last ? 'empty system, clock at 0' : last.kind === 'arrive'
    ? `t ${now.toFixed(1)} · #${last.who + 1} arrives${DES.start[last.who] > now ? ' and waits' : ''}`
    : `t ${now.toFixed(1)} · #${last.who + 1} leaves${inService >= 0 ? `, #${inService + 1} starts` : ''}`;
  return (
    <Pic svgRef={ref} label={label} reset={k === 0} moving={moving} ms={560}>
      <text className="lp-small lp-quiet" x={10} y={22} textAnchor="middle">arrive</text>
      <text className="lp-small lp-quiet" x={84} y={22} textAnchor="middle">line</text>
      <text className="lp-small lp-quiet" x={150} y={22} textAnchor="middle">server</text>
      <text className="lp-small lp-quiet" x={226} y={22} textAnchor="middle">leave</text>
      <line className="lp-axis" x1={46} y1={57} x2={122} y2={57} />
      <rect className={`lp-node${inService >= 0 ? ' is-soft' : ''}`} x={134} y={28} width={32} height={32} rx={6} />
      <Arrow x1={170} y1={44} x2={204} y2={44} size={6} />
      {DES.arrive.map((_, i) => {
        const p = pos(i);
        return (
          <g key={i} className="lp-move" style={{ ...at(p.x, p.y), opacity: p.o }}>
            <circle className="lp-entity" r={8} />
            <text className="lp-small" y={3} textAnchor="middle">{i + 1}</text>
          </g>
        );
      })}
      <line className="lp-axis" x1={TL.x0} y1={TL.y} x2={TL.x1} y2={TL.y} />
      {shownEvents.map((e, i) => e.kind === 'arrive'
        ? <path key={i} className="lp-ev is-arrive" d={`M${tx(e.t)},${TL.y - 10} l-4,7 h8 Z`} />
        : <path key={i} className="lp-ev is-leave" d={`M${tx(e.t)},${TL.y + 10} l-4,-7 h8 Z`} />)}
      <g className="lp-move lp-clock" style={at(tx(now), 0)}>
        <line x1={0} y1={TL.y - 22} x2={0} y2={TL.y + 12} />
        <text className="lp-small" x={0} y={TL.y - 25} textAnchor="middle">clock</text>
      </g>
      <text className="lp-small lp-quiet" x={TL.x1} y={TL.y + 20} textAnchor="end">▲ arrive · ▼ leave</text>
      <text className="lp-cap" x={8} y={144}>{cap}</text>
    </Pic>
  );
}
