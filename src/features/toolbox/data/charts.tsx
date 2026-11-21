import { useId, useMemo } from 'react';
import type { Law } from '../../../domain/distributions/laws';
import { allWholeNumbers, binCount, histogram, integerHistogram, sig, type SampleSummary } from '../../../domain/distributions/sample';
import { axisTicks, modelShape, type ModelShape } from '../../../domain/distributions/shape';
import { useWidth } from '../../../ui/charts';

/**
 * Charts of Data and inputs. Colours come from the theme tokens; data in the first chart colour, the model in the
 * second. Every chart has a text table beside it. Marks follow the app's chart grammar: hairline axes,
 * 2 px lines, bars no wider than 24 px with rounded tops, native tooltips on every mark.
 */

const num = (x: number) => sig(x, 4).replace('-', '−');

interface Bin { from: number; to: number; count: number; h: number }

/** Data binned on the scale of the model: density for a continuous model, share per value for a discrete one. */
function dataBins(values: number[], shape: ModelShape | null, lo: number, hi: number): Bin[] {
  const n = values.length;
  if (!n) return [];
  if ((!shape || shape.discrete) && allWholeNumbers(values) && (!shape || shape.lattice)) {
    const width = shape?.bars.length ? shape.bars[0].x1 - shape.bars[0].x0 + 1 : 1;
    const span = Math.max(1, Math.ceil((hi - lo) / width));
    return integerHistogram(values, Math.min(60, span)).map((b) => ({ from: b.from - 0.5, to: b.to + 0.5, count: b.count, h: b.count / n }));
  }
  const raw = histogram(values, lo, hi, binCount(n));
  const w = raw.length ? raw[0].to - raw[0].from || 1 : 1;
  return raw.map((b) => ({ ...b, h: shape?.discrete ? b.count / n : b.count / (n * w) }));
}

/**
 * Data as a histogram with the model drawn over it. Either may be missing: data alone (before a model is set),
 * or a model alone (described without data).
 */
export function ModelChart({ values, law, unit, dataLabel = 'Data', modelLabel = 'Model', height = 250, title }: {
  values?: number[] | null; law?: Law | null; unit?: string; dataLabel?: string; modelLabel?: string; height?: number; title: string;
}) {
  const [box, W] = useWidth(640);
  const tableId = useId();
  const data = useMemo(() => (values && values.length ? values : null), [values]);
  const view = useMemo(() => {
    let dlo = Infinity, dhi = -Infinity;
    if (data) for (const v of data) { if (v < dlo) dlo = v; if (v > dhi) dhi = v; }
    let shape: ModelShape | null = null;
    if (law) { try { shape = modelShape(law, { range: data ? [dlo, dhi] : undefined, points: 160, maxBars: 60 }); } catch { shape = null; } }
    let lo = shape ? shape.lo : dlo, hi = shape ? shape.hi : dhi;
    if (!(hi > lo)) { lo -= 1; hi += 1; }
    if (!shape && data) { const pad = (hi - lo) * 0.04; lo -= pad; hi += pad; }
    const bins = data ? dataBins(data, shape, lo, hi) : [];
    const modelTop = shape ? (shape.discrete ? Math.max(...shape.bars.map((b) => b.p), 1e-12) : shape.top) : 0;
    const top = Math.max(modelTop, ...bins.map((b) => b.h), 1e-12) * 1.1;
    return { shape, lo, hi, bins, top };
  }, [data, law]);
  if (!data && !view.shape) return null;
  const { shape, lo, hi, bins, top } = view;
  const H = height, L = 14, R = 14, T = 12, B = 40, plotH = H - T - B, base = T + plotH;
  const x = (v: number) => L + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (W - L - R);
  const y = (h: number) => base - (Math.min(h, top) / top) * plotH;
  const ticks = axisTicks(lo, hi, Math.max(3, Math.floor(W / 90)));
  const discrete = !!shape?.discrete;
  const unitText = unit?.trim() ? unit.trim() : 'Value';

  const modelMarks = !shape ? null : discrete ? shape.bars.map((b, i) => {
    const slot = (W - L - R) / Math.max(1, shape.bars.length);
    const span = b.x1 > b.x0 ? x(b.x1 + (shape.lattice ? 1 : 0)) - x(b.x0) : slot;
    const w = Math.max(2, Math.min(24, span - 3)), cx = (x(b.x0) + x(b.x1)) / 2, h = base - y(b.p);
    if (h < 0.3) return null;
    return <path key={i} className="dm-model-bar" d={`M${cx - w / 2},${base} V${y(b.p) + Math.min(4, h / 2)} q0,-${Math.min(4, h / 2)} ${Math.min(4, w / 2)},-${Math.min(4, h / 2)} H${cx + w / 2 - Math.min(4, w / 2)} q${Math.min(4, w / 2)},0 ${Math.min(4, w / 2)},${Math.min(4, h / 2)} V${base} Z`}>
      <title>{b.x0 === b.x1 ? `${num(b.x0)}` : `${num(b.x0)} to ${num(b.x1)}`}: model {num(b.p * 100)}%</title>
    </path>;
  }) : (() => {
    const pts = shape.curve.map((c) => `${x(c.x).toFixed(1)},${y(c.y).toFixed(1)}`);
    return <>
      <path className="dm-model-area" d={`M${x(lo).toFixed(1)},${base} L${pts.join(' L')} L${x(hi).toFixed(1)},${base} Z`} />
      <path className="dm-model-line" d={`M${pts.join(' L')}`} />
    </>;
  })();

  return (
    <figure className="dm-chart">
      <div ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${title}. ${data ? `${dataLabel}: ${data.length} values as bars.` : ''} ${shape ? `${modelLabel} drawn as ${discrete ? 'bars' : 'a curve'}.` : ''} Table below.`}>
          {[0.25, 0.5, 0.75].map((f) => <line key={f} className="dm-grid" x1={L} x2={W - R} y1={base - f * plotH} y2={base - f * plotH} />)}
          {bins.map((b, i) => b.count > 0 && (
            <rect key={i} className={shape ? 'dm-data-bar is-under' : 'dm-data-bar'} x={x(b.from) + 1} y={y(b.h)} width={Math.max(1, x(b.to) - x(b.from) - 2)} height={base - y(b.h)} rx={Math.min(3, (base - y(b.h)) / 2)}>
              <title>{`${num(b.from)} to ${num(b.to)}: ${b.count} value${b.count === 1 ? '' : 's'}`}</title>
            </rect>
          ))}
          {modelMarks}
          <line className="dm-axis" x1={L} x2={W - R} y1={base} y2={base} />
          {ticks.map((t) => <g key={t}><line className="dm-axis" x1={x(t)} x2={x(t)} y1={base} y2={base + 4} /><text className="dm-tick" x={x(t)} y={base + 17} textAnchor="middle">{num(t)}</text></g>)}
          <text className="dm-tick" x={(L + W - R) / 2} y={H - 4} textAnchor="middle">{unitText}</text>
        </svg>
      </div>
      <figcaption className="dm-legend">
        {data && <span><i className="dm-key is-data" aria-hidden="true" />{dataLabel} ({data.length})</span>}
        {shape && <span><i className={`dm-key ${discrete ? 'is-model-bar' : 'is-model-line'}`} aria-hidden="true" />{modelLabel}</span>}
        <span className="dm-legend-note">Height: {discrete ? 'share of values' : 'density'}</span>
      </figcaption>
      <details className="dm-table-fold">
        <summary>As a table</summary>
        <div className="table-wrap tall" tabIndex={0} role="region" aria-labelledby={tableId}>
          <table className="data">
            <caption id={tableId}>{title}</caption>
            <thead><tr><th scope="col">From</th><th scope="col">To</th>{data && <th scope="col" className="num">{dataLabel}: count</th>}{data && <th scope="col" className="num">Share</th>}{law && <th scope="col" className="num">{modelLabel}: share</th>}</tr></thead>
            <tbody>
              {(bins.length ? bins : (shape?.bars.length ? shape.bars.map((b) => ({ from: b.x0, to: b.x1, count: 0, h: 0 })) : evenBins(lo, hi, 12))).map((b, i) => (
                <tr key={i}>
                  <td>{num(b.from)}</td><td>{num(b.to)}</td>
                  {data && <td className="num">{b.count}</td>}
                  {data && <td className="num">{num((b.count / data.length) * 100)}%</td>}
                  {law && <td className="num">{num(Math.max(0, modelShare(law, b.from, b.to)) * 100)}%</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

const evenBins = (lo: number, hi: number, k: number): Bin[] => Array.from({ length: k }, (_, i) => ({ from: lo + ((hi - lo) * i) / k, to: lo + ((hi - lo) * (i + 1)) / k, count: 0, h: 0 }));

/** Probability the model gives to [from, to]; for a discrete model the whole numbers inside it. */
function modelShare(law: Law, from: number, to: number): number {
  if (law.discrete) {
    const below = (v: number) => law.cdf(v) - law.pdf(v);
    return law.cdf(to) - below(from === to ? from : Math.ceil(from));
  }
  return law.cdf(to) - law.cdf(from);
}

/** Q–Q plot: sorted data against the model's quantiles. On the diagonal: the shapes agree. */
export function QQChart({ pairs, unit }: { pairs: { theoretical: number; sample: number }[]; unit?: string }) {
  const [box, W0] = useWidth(420);
  const tableId = useId();
  const pts = useMemo(() => {
    const ok = pairs.filter((p) => Number.isFinite(p.theoretical) && Number.isFinite(p.sample));
    if (ok.length <= 400) return ok;
    const step = ok.length / 400;
    return Array.from({ length: 400 }, (_, i) => ok[Math.floor(i * step)]);
  }, [pairs]);
  if (pts.length < 2) return null;
  const W = Math.min(W0, 440), H = Math.min(320, Math.max(220, W * 0.72)), L = 48, R = 12, T = 12, B = 40;
  let lo = Infinity, hi = -Infinity;
  for (const p of pts) { lo = Math.min(lo, p.theoretical, p.sample); hi = Math.max(hi, p.theoretical, p.sample); }
  if (!(hi > lo)) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.04; lo -= pad; hi += pad;
  const x = (v: number) => L + ((v - lo) / (hi - lo)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = axisTicks(lo, hi, 4);
  const deciles = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95].map((p) => pairs[Math.min(pairs.length - 1, Math.max(0, Math.round(p * pairs.length - 0.5)))]).filter(Boolean);
  return (
    <figure className="dm-chart">
      <div ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Q–Q plot: data quantiles against model quantiles. Points on the diagonal mean the shapes agree. Table below.">
          {ticks.map((t) => <g key={t}>
            <line className="dm-grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text className="dm-tick" x={L - 6} y={y(t) + 4} textAnchor="end">{num(t)}</text>
            <text className="dm-tick" x={x(t)} y={H - B + 16} textAnchor="middle">{num(t)}</text>
          </g>)}
          <line className="dm-axis" x1={L} x2={W - R} y1={H - B} y2={H - B} />
          <line className="dm-axis" x1={L} x2={L} y1={T} y2={H - B} />
          <line className="dm-diagonal" x1={x(lo)} y1={y(lo)} x2={x(hi)} y2={y(hi)} />
          {pts.map((p, i) => <circle key={i} className="dm-qq-dot" cx={x(p.theoretical)} cy={y(p.sample)} r={4}><title>{`Model ${num(p.theoretical)}, data ${num(p.sample)}`}</title></circle>)}
          <text className="dm-tick" x={(L + W - R) / 2} y={H - 4} textAnchor="middle">Model quantile{unit?.trim() ? ` (${unit.trim()})` : ''}</text>
          <text className="dm-tick" transform={`translate(12 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle">Data</text>
        </svg>
      </div>
      <details className="dm-table-fold">
        <summary>As a table</summary>
        <div className="table-wrap" tabIndex={0} role="region" aria-labelledby={tableId}>
          <table className="data">
            <caption id={tableId}>Data and model at the same quantiles</caption>
            <thead><tr><th scope="col">Quantile</th><th scope="col" className="num">Data</th><th scope="col" className="num">Model</th></tr></thead>
            <tbody>{deciles.map((p, i) => <tr key={i}><td>{['5%', '10%', '25%', 'Median', '75%', '90%', '95%'][i]}</td><td className="num">{num(p.sample)}</td><td className="num">{num(p.theoretical)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Where the values lie: the middle half as a box, 5% to 95% as a line, the extremes as dots, the mean as a diamond. */
export function RangeStrip({ s, unit }: { s: SampleSummary; unit?: string }) {
  const [box, W] = useWidth(560);
  const H = 64, L = 14, R = 14, mid = 22;
  let lo = s.min, hi = s.max;
  if (!(hi > lo)) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.03; lo -= pad; hi += pad;
  const x = (v: number) => L + ((v - lo) / (hi - lo)) * (W - L - R);
  const ticks = axisTicks(lo, hi, Math.max(3, Math.floor(W / 100)));
  const label = `Middle half from ${num(s.q25)} to ${num(s.q75)}, median ${num(s.median)}, 5% to 95% from ${num(s.q05)} to ${num(s.q95)}, all values from ${num(s.min)} to ${num(s.max)}, mean ${num(s.mean)}.`;
  return (
    <div ref={box} className="dm-strip">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label}>
        <line className="dm-strip-whisker" x1={x(s.q05)} x2={x(s.q95)} y1={mid} y2={mid}><title>{`5% to 95%: ${num(s.q05)} to ${num(s.q95)}`}</title></line>
        <rect className="dm-strip-box" x={x(s.q25)} y={mid - 9} width={Math.max(2, x(s.q75) - x(s.q25))} height={18} rx={5}><title>{`Middle half: ${num(s.q25)} to ${num(s.q75)}`}</title></rect>
        <line className="dm-strip-median" x1={x(s.median)} x2={x(s.median)} y1={mid - 9} y2={mid + 9}><title>{`Median ${num(s.median)}`}</title></line>
        <circle className="dm-strip-end" cx={x(s.min)} cy={mid} r={4}><title>{`Smallest ${num(s.min)}`}</title></circle>
        <circle className="dm-strip-end" cx={x(s.max)} cy={mid} r={4}><title>{`Largest ${num(s.max)}`}</title></circle>
        <path className="dm-strip-mean" d={`M${x(s.mean)},${mid - 15} l5,5 l-5,5 l-5,-5 Z`}><title>{`Mean ${num(s.mean)}`}</title></path>
        <line className="dm-axis" x1={L} x2={W - R} y1={mid + 16} y2={mid + 16} />
        {ticks.map((t) => <text key={t} className="dm-tick" x={x(t)} y={mid + 32} textAnchor="middle">{num(t)}</text>)}
        {unit?.trim() && <text className="dm-tick" x={W - R} y={H - 2} textAnchor="end">{unit.trim()}</text>}
      </svg>
      <p className="dm-strip-key" aria-hidden="true"><span><i className="k-box" />middle half</span><span><i className="k-line" />5% to 95%</span><span><i className="k-mid" />median</span><span><i className="k-mean" />mean</span></p>
    </div>
  );
}

/** A tiny histogram for a column card. Decorative: the card states the numbers in words. */
export function MiniHist({ values }: { values: number[] }) {
  const bars = useMemo(() => {
    if (values.length < 2) return [];
    let lo = Infinity, hi = -Infinity;
    for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const b = histogram(values, lo, hi > lo ? hi : lo + 1, 16);
    const top = Math.max(...b.map((x) => x.count), 1);
    return b.map((x) => x.count / top);
  }, [values]);
  return (
    <svg className="dm-mini" viewBox="0 0 96 28" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {bars.map((h, i) => <rect key={i} x={i * 6 + 0.6} y={28 - Math.max(1, h * 26)} width={4.8} height={Math.max(1, h * 26)} rx={1.2} />)}
    </svg>
  );
}
