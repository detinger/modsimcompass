import { Arrow, Pic } from './kit';
import { useFrames } from './motion';

/* ── Path analysis: direct and indirect paths between three measured variables ── */

const PATH_STAGES: { hot: string; cap: string }[] = [
  { hot: '', cap: 'three measured variables' },
  { hot: 'c', cap: 'direct effect 0.2' },
  { hot: 'a', cap: 'through skills: 0.5 …' },
  { hot: 'ab', cap: 'through skills: 0.5 × 0.6 = 0.3' },
  { hot: 'abc', cap: 'total effect 0.2 + 0.3 = 0.5' },
  { hot: 'abc', cap: 'total effect 0.2 + 0.3 = 0.5' },
];

export function PathPicture({ label }: { label: string }) {
  const { ref, frame } = useFrames<SVGSVGElement>(1300, 4);
  const s = PATH_STAGES[frame % PATH_STAGES.length];
  const on = (k: string) => s.hot.includes(k);
  const box = (x: number, y: number, text: string) => (
    <g>
      <rect className="lp-node" x={x} y={y} width={84} height={30} rx={5} />
      <text x={x + 42} y={y + 19} textAnchor="middle">{text}</text>
    </g>
  );
  return (
    <Pic svgRef={ref} label={label}>
      <Arrow x1={54} y1={90} x2={116} y2={48} hot={on('a')} w={on('a') ? 2.5 : 1.5} />
      <Arrow x1={164} y1={48} x2={226} y2={90} hot={on('b')} w={on('b') ? 2.5 : 1.5} />
      <Arrow x1={98} y1={107} x2={182} y2={107} hot={on('c')} w={on('c') ? 2.5 : 1.5} />
      <text className={on('a') ? 'lp-strong' : 'lp-quiet'} x={76} y={66} textAnchor="end">0.5</text>
      <text className={on('b') ? 'lp-strong' : 'lp-quiet'} x={204} y={66}>0.6</text>
      <text className={on('c') ? 'lp-strong' : 'lp-quiet'} x={140} y={101} textAnchor="middle">0.2</text>
      {box(12, 92, 'Training')}
      {box(98, 16, 'Skills')}
      {box(184, 92, 'Satisfaction')}
      <text className="lp-cap" x={140} y={143} textAnchor="middle">{s.cap}</text>
    </Pic>
  );
}

/* ── CB-SEM: hidden constructs explain their indicators; theory links the constructs ── */

const SEM_STAGES: { hot: string; cap: string }[] = [
  { hot: '', cap: 'a theory about hidden constructs' },
  { hot: 'l', cap: 'each construct explains its indicators' },
  { hot: 'lr', cap: 'each construct explains its indicators' },
  { hot: 'e', cap: 'indicators also carry error' },
  { hot: 's', cap: 'theory links the constructs' },
  { hot: 'lrs', cap: 'tested against the covariances' },
  { hot: 'lrs', cap: 'tested against the covariances' },
];

export function CbSemPicture({ label }: { label: string }) {
  const { ref, frame } = useFrames<SVGSVGElement>(1300, 5);
  const s = SEM_STAGES[frame % SEM_STAGES.length];
  const on = (k: string) => s.hot.includes(k);
  const construct = (cx: number, name: string, side: 'l' | 'r', names: string[]) => (
    <g>
      {[-30, 0, 30].map((dx, i) => (
        <g key={dx}>
          <Arrow x1={cx + dx * 0.45} y1={66} x2={cx + dx} y2={92} hot={on(side)} w={on(side) ? 2.2 : 1.5} size={6} />
          <rect className="lp-node" x={cx + dx - 10} y={93} width={20} height={20} rx={2} />
          <text className="lp-small" x={cx + dx} y={107} textAnchor="middle">{names[i]}</text>
          <Arrow x1={cx + dx} y1={129} x2={cx + dx} y2={114} hot={on('e')} size={5} w={1.2} />
          <circle className={`lp-err${on('e') ? ' is-hot' : ''}`} cx={cx + dx} cy={133} r={4.5} />
        </g>
      ))}
      <ellipse className={`lp-node${on(side) || on('s') ? ' is-soft' : ''}`} cx={cx} cy={48} rx={41} ry={18} />
      <text x={cx} y={52} textAnchor="middle">{name}</text>
    </g>
  );
  return (
    <Pic svgRef={ref} label={label}>
      <text className="lp-cap" x={140} y={16} textAnchor="middle">{s.cap}</text>
      <Arrow x1={124} y1={48} x2={156} y2={48} hot={on('s')} w={on('s') ? 2.8 : 1.5} />
      {construct(82, 'Usefulness', 'l', ['x₁', 'x₂', 'x₃'])}
      {construct(198, 'Intention', 'r', ['y₁', 'y₂', 'y₃'])}
    </Pic>
  );
}

/* ── PLS-SEM: indicator weights settle, then the composite predicts ── */

const PLS_WEIGHTS = [[0.33, 0.33, 0.34], [0.44, 0.34, 0.22], [0.52, 0.31, 0.17], [0.56, 0.3, 0.14], [0.58, 0.29, 0.13]];
const PLS_STAGES: { round: number; path: boolean; r2: boolean; cap: string }[] = [
  { round: 0, path: false, r2: false, cap: 'start with equal weights' },
  { round: 1, path: false, r2: false, cap: 'weights adjust, round 1' },
  { round: 2, path: false, r2: false, cap: 'weights adjust, round 2' },
  { round: 3, path: false, r2: false, cap: 'weights adjust, round 3' },
  { round: 4, path: false, r2: false, cap: 'weights settle' },
  { round: 4, path: true, r2: false, cap: 'the composite predicts the outcome' },
  { round: 4, path: true, r2: true, cap: 'check the prediction on new data' },
  { round: 4, path: true, r2: true, cap: 'check the prediction on new data' },
];
const hexagon = (cx: number, cy: number, r: number) => Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * 0.82 * Math.sin(a)).toFixed(1)}`; }).join(' ');

export function PlsPicture({ label }: { label: string }) {
  const { ref, frame } = useFrames<SVGSVGElement>(1100, 6);
  const s = PLS_STAGES[frame % PLS_STAGES.length];
  const w = PLS_WEIGHTS[s.round];
  const ys = [34, 68, 102];
  return (
    <Pic svgRef={ref} label={label}>
      {ys.map((y, i) => (
        <g key={y}>
          <Arrow x1={34} y1={y} x2={76} y2={68 + (y - 68) * 0.3} hot={!s.path} w={1 + w[i] * 7} size={8} />
          <rect className="lp-node" x={12} y={y - 10} width={20} height={20} rx={2} />
          <text className="lp-small" x={22} y={y + 4} textAnchor="middle">{['x₁', 'x₂', 'x₃'][i]}</text>
          <text className="lp-small lp-quiet" x={44} y={y + (i === 0 ? -5 : i === 1 ? -6 : 13)}>{w[i].toFixed(2).slice(1)}</text>
        </g>
      ))}
      <Arrow x1={134} y1={68} x2={172} y2={68} hot={s.path} w={s.path ? 3 : 1.5} />
      {[46, 90].map((y, i) => (
        <g key={y}>
          <Arrow x1={248} y1={y} x2={226} y2={68 + (y - 68) * 0.4} w={1.5} size={6} />
          <rect className="lp-node" x={249} y={y - 10} width={20} height={20} rx={2} />
          <text className="lp-small" x={259} y={y + 4} textAnchor="middle">{['y₁', 'y₂'][i]}</text>
        </g>
      ))}
      <polygon className="lp-node is-soft" points={hexagon(104, 68, 30)} />
      <text x={104} y={72} textAnchor="middle">Drivers</text>
      <polygon className={`lp-node${s.r2 ? ' is-soft' : ''}`} points={hexagon(200, 68, 30)} />
      <text x={200} y={s.r2 ? 66 : 72} textAnchor="middle">Loyalty</text>
      {s.r2 && <text className="lp-small lp-strong" x={200} y={79} textAnchor="middle">R² 0.46</text>}
      <text className="lp-cap" x={140} y={140} textAnchor="middle">{s.cap}</text>
    </Pic>
  );
}
