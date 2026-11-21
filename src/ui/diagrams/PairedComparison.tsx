import { useEffect, useMemo, useState } from 'react';
import { PAIRED, type PairMode } from '../../content/diagrams/specs';
import { GraphView, useGraphLayout, type Token } from './ElkGraph';
import { PAIRED_GRAPH } from './graphDefs';
import { WalkControls, useWalkthrough, useWidth } from './walkthrough';

/* A small, real experiment (seeded, so everyone sees the same picture): a daily backlog with random arrivals.
   Baseline clears 11 requests a day, the alternative 12. Outcome: mean backlog over 14 days. */
const DAYS = 14, RATE = 12, CAP_BASELINE = 11, CAP_ALTERNATIVE = 12, N = PAIRED.replications;

function uniform(seed: number): () => number {
  let a = seed;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function arrivals(seed: number): number[] {
  const u = uniform(seed), floor = Math.exp(-RATE);
  return Array.from({ length: DAYS }, () => { let k = 0, p = 1; do { k++; p *= u(); } while (p > floor); return k - 1; });
}
function meanBacklog(arr: number[], capacity: number): number {
  let backlog = 0, sum = 0;
  for (const a of arr) { backlog = Math.max(0, backlog + a - capacity); sum += backlog; }
  return sum / arr.length;
}
const RUNS = Array.from({ length: N }, (_, r) => {
  const same = arrivals(100 + r), other = arrivals(900 + r);
  const baseline = meanBacklog(same, CAP_BASELINE);
  return { same, other, baseline, paired: meanBacklog(same, CAP_ALTERNATIVE), unpaired: meanBacklog(other, CAP_ALTERNATIVE) };
});
const LO = -16, HI = 10;
const fmt = (v: number) => v.toFixed(1).replace('-', '−');


const NODE_STEP: Record<string, number> = { source: 1, source2: 1, baseline: 2, alternative: 2, difference: 3, distribution: 4 };
const EDGE_STEP: Record<string, number> = { 'feed-baseline': 2, 'feed-alternative': 2, 'out-baseline': 3, 'out-alternative': 3, collect: 4 };
const HOLD: Record<number, number> = { 4: 3900 };

function Bars({ values }: { values: number[] }) {
  const top = 22, step = 100 / values.length;
  return (
    <svg className="dgm-bars" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true">
      {values.map((v, i) => { const h = Math.max(2, (Math.min(v, top) / top) * 34); return <rect key={i} x={i * step + step * 0.16} y={34 - h} width={step * 0.68} height={h} rx={0.8} />; })}
    </svg>
  );
}

/** Stacked dot plot of the differences on a fixed axis, so the two modes can be compared by eye. */
function Dots({ values, width }: { values: number[]; width: number }) {
  const pad = 10, base = 62, pitch = 9.5;
  const x = (v: number) => pad + ((Math.max(LO, Math.min(HI, v)) - LO) / (HI - LO)) * (width - 2 * pad);
  const stacks = new Map<number, number>();
  const dots = values.map((v) => { const col = Math.round(x(v) / pitch); const k = stacks.get(col) ?? 0; stacks.set(col, k + 1); return { cx: col * pitch, cy: base - 6 - k * pitch, v }; });
  return (
    <svg className="dgm-dots" width={width} height={84} viewBox={`0 0 ${width} 84`} role="img" aria-label={`${values.length} differences on an axis from ${LO} to ${HI}; ${values.filter((v) => v < 0).length} are below zero.`}>
      <line className="dgm-axis" x1={pad - 4} x2={width - pad + 4} y1={base} y2={base} />
      <line className="dgm-zero" x1={x(0)} x2={x(0)} y1={2} y2={base + 4} />
      {[-10, 0, 10].map((t) => <text key={t} className="dgm-tick" x={x(t)} y={base + 18} textAnchor="middle">{t === 0 ? '0' : fmt(t).replace('.0', '')}</text>)}
      {dots.map((d, i) => <circle key={i} className="dgm-dot" cx={d.cx} cy={d.cy} r={4}><title>{`Replication ${i + 1}: ${fmt(d.v)}`}</title></circle>)}
    </svg>
  );
}

export default function PairedComparison() {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [mode, setMode] = useState<PairMode>('paired');
  const layout = useGraphLayout(PAIRED_GRAPH[mode], width);
  const walk = useWalkthrough(4, { intro: 1000, hold: (s) => HOLD[s] });
  const { reduced } = walk;

  // Replications completed so far. The last walkthrough step (and a mode switch) runs them one by one.
  const target = walk.has(4) ? N : 1;
  const [rep, setRep] = useState(reduced ? N : 1);
  useEffect(() => {
    if (rep === target) return;
    if (reduced || rep > target) { setRep(target); return; }
    const t = window.setTimeout(() => setRep((r) => r + 1), rep === 0 ? 320 : 150);
    return () => window.clearTimeout(t);
  }, [rep, target, reduced]);
  const running = rep < target;

  const run = RUNS[Math.max(1, rep) - 1];
  const alt = mode === 'paired' ? run.paired : run.unpaired;
  const diffs = useMemo(() => RUNS.slice(0, rep).map((r) => (mode === 'paired' ? r.paired : r.unpaired) - r.baseline), [rep, mode]);
  const below = diffs.filter((d) => d < 0).length;

  const off = (n: number) => (walk.has(n) ? '' : ' is-off');
  const now = (n: number) => (walk.walking && walk.shown === n ? ' is-new' : '');
  const choose = (m: PairMode) => { if (m === mode) return; setMode(m); walk.reset(); setRep(reduced ? N : 0); };

  const tokens: Token[] = [];
  if (!reduced && layout) {
    const feed = ['feed-baseline', 'feed-alternative'], out = ['out-baseline', 'out-alternative'];
    if (running) {
      feed.forEach((e) => tokens.push({ id: `loop-${e}`, edge: e, className: 'is-loop' }));
      out.forEach((e) => tokens.push({ id: `loop-${e}`, edge: e, className: `is-loop dgm-t-${e.slice(4)}`, delay: 150 }));
      tokens.push({ id: 'loop-collect', edge: 'collect', className: 'is-loop dgm-t-difference', delay: 300 });
    } else if (walk.walking && walk.shown === 2) feed.forEach((e) => [0, 220, 440].forEach((delay) => tokens.push({ id: `once-${e}-${delay}`, edge: e, delay: 300 + delay })));
    else if (walk.walking && walk.shown === 3) out.forEach((e) => tokens.push({ id: `once-${e}`, edge: e, className: `dgm-t-${e.slice(4)}`, delay: 250 }));
  }

  return (
    <div className="dgm-paired" ref={walk.hostRef} data-walk={walk.walking || running ? 'walk' : 'rest'} data-mode={mode}>
      <div className="dgm-modes" role="group" aria-label="Inputs given to the two policies">
        {PAIRED.modes.map((m) => (
          <button key={m.id} type="button" className="dgm-mode" aria-pressed={mode === m.id} onClick={() => choose(m.id)}>
            {m.label}<span className={`dgm-mode-tag is-${m.tag}`}>{m.tag}</span>
          </button>
        ))}
      </div>
      <div className="dgm-scroll" ref={ref}>
        {layout ? (
          <GraphView
            layout={layout}
            label={mode === 'paired'
              ? 'One arrival sequence feeds both the baseline and the alternative. Their two outcomes give one difference, and the differences from all replications are collected.'
              : 'Two separate arrival sequences feed the baseline and the alternative. Their two outcomes give one difference, and the differences from all replications are collected.'}
            tokens={tokens}
            nodeClass={(id) => `dgm-n-${id.replace('2', '')}${off(NODE_STEP[id])}${now(NODE_STEP[id])}`}
            edgeClass={(id) => `dgm-build${off(EDGE_STEP[id])}`}
            renderNode={(id, box) => {
              if (id === 'source' || id === 'source2') {
                const second = id === 'source2';
                return (
                  <>
                    <strong>{PAIRED.source}</strong>
                    <Bars values={second ? run.other : run.same} />
                    <span className="dgm-sub">{mode === 'paired' ? 'same for both' : second ? 'for the alternative' : 'for the baseline'}</span>
                  </>
                );
              }
              if (id === 'baseline' || id === 'alternative') {
                return (
                  <>
                    <strong><i className={`dgm-sw is-${id}`} aria-hidden="true" />{PAIRED[id]}</strong>
                    <span className="dgm-value"><span className="dgm-sub">{PAIRED.outcome}</span><b>{walk.has(3) ? fmt(id === 'baseline' ? run.baseline : alt) : '…'}</b></span>
                  </>
                );
              }
              if (id === 'difference') {
                return (
                  <>
                    <strong>{PAIRED.difference}</strong>
                    <span className="dgm-value">
                      <span className="dgm-formula" role="img" aria-label={PAIRED.differenceSub}><i className="dgm-sw is-alternative" />−<i className="dgm-sw is-baseline" />=</span>
                      <b>{fmt(alt - run.baseline)}</b>
                    </span>
                  </>
                );
              }
              return (
                <>
                  <strong>{rep} {rep === 1 ? PAIRED.distributionOne : PAIRED.distribution}</strong>
                  <Dots values={diffs} width={Math.round(box.w - 20)} />
                  <span className="dgm-sub dgm-verdict"><b>{below} of {diffs.length}</b> {PAIRED.verdict}</span>
                </>
              );
            }}
          />
        ) : <div className="dgm-placeholder" style={{ height: 320 }} />}
      </div>
      <WalkControls walk={walk} captions={PAIRED.steps[mode]} summary={PAIRED.summary[mode]} />
    </div>
  );
}
