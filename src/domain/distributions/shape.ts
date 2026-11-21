import type { Law } from './laws';

/**
 * The picture of a distribution: where to draw it and how high. One function serves the charts on screen
 * and the small figure of a data model, so both always show the same shape.
 *
 * Continuous laws give a density curve. Discrete laws give probability bars: one per value when there are
 * few, wider bars that add up neighbouring values when there are many.
 */
export interface ShapeBar { /** A bar covers the values from `x0` to `x1`; both are the same for a single value. */ x0: number; x1: number; p: number }
export interface ModelShape {
  discrete: boolean;
  /** The range that is drawn. */
  lo: number; hi: number;
  curve: { x: number; y: number }[];
  bars: ShapeBar[];
  /** True when every bar sits on a whole number, so a bar may be one unit wide. */
  lattice: boolean;
  /** Height of the picture. A density that shoots up at an edge is cut here. */
  top: number;
  /** Null when the law has no mean, or it lies outside the range drawn. */
  mean: number | null;
}

const finite = (x: number) => Number.isFinite(x);

/** The central range of a continuous law: nearly everything, without letting a heavy tail squash the picture. */
export function centralRange(law: Law): [number, number] {
  let a = law.inv(0.001), b = law.inv(0.999);
  const q25 = law.inv(0.25), q75 = law.inv(0.75), iqr = q75 - q25;
  if (iqr > 0 && finite(iqr)) { a = Math.max(a, q25 - 6 * iqr); b = Math.min(b, q75 + 6 * iqr); }
  if (!finite(a) || !finite(b) || !(b > a)) { const m = law.inv(0.5); return [finite(m) ? m - 1 : -1, finite(m) ? m + 1 : 1]; }
  return [a, b];
}

function continuousShape(law: Law, range: [number, number] | undefined, points: number): ModelShape {
  const [a, b] = centralRange(law);
  const pad = (b - a) * 0.04;
  const lo = Math.min(a - pad, range ? range[0] : Infinity), hi = Math.max(b + pad, range ? range[1] : -Infinity);
  const curve: { x: number; y: number }[] = [];
  for (let i = 0; i <= points; i++) {
    const x = lo + ((hi - lo) * i) / points, y = law.pdf(x);
    curve.push({ x, y: finite(y) && y > 0 ? y : y === Infinity ? Infinity : 0 });
  }
  // The usual height of the curve, read where most of the probability lies. An edge that runs to infinity is cut above it.
  let usual = 0;
  for (let p = 0.1; p < 0.905; p += 0.05) { const y = law.pdf(law.inv(p)); if (finite(y) && y > usual) usual = y; }
  const peak = curve.reduce((m, c) => (finite(c.y) && c.y > m ? c.y : m), 0);
  const top = usual > 0 ? Math.min(Math.max(peak, usual), usual * 1.25) : peak || 1;
  for (const c of curve) if (!(c.y <= top)) c.y = top;
  return { discrete: false, lo, hi, curve, bars: [], lattice: false, top, mean: meanInside(law, lo, hi) };
}

function meanInside(law: Law, lo: number, hi: number): number | null {
  return !law.undefinedMean && finite(law.mean) && law.mean >= lo && law.mean <= hi ? law.mean : null;
}

function discreteShape(law: Law, range: [number, number] | undefined, maxBars: number): ModelShape {
  const seen = new Set<number>();
  for (let i = 0; i < 400; i++) { const v = law.inv((i + 0.5) / 400); if (finite(v)) seen.add(v); }
  const support = [...seen].sort((x, y) => x - y);
  if (!support.length) return { discrete: true, lo: 0, hi: 1, curve: [], bars: [], lattice: false, top: 1, mean: null };
  const min = support[0], max = support[support.length - 1];
  const lattice = support.every(Number.isInteger);
  const below = (x: number) => law.cdf(x) - law.pdf(x);
  let bars: ShapeBar[];
  if (lattice) {
    const from = Math.min(min, range && Number.isInteger(range[0]) ? range[0] : min), to = Math.max(max, range && Number.isInteger(range[1]) ? range[1] : max);
    const width = Math.max(1, Math.ceil((to - from + 1) / maxBars));
    bars = [];
    for (let x0 = from; x0 <= to; x0 += width) {
      const x1 = Math.min(to, x0 + width - 1);
      bars.push({ x0, x1, p: Math.max(0, width === 1 ? law.pdf(x0) : law.cdf(x1) - below(x0)) });
    }
  } else if (support.length <= maxBars) {
    bars = support.map((v) => ({ x0: v, x1: v, p: law.pdf(v) }));
  } else {
    const bins = Math.min(maxBars, 40), step = (max - min) / bins;
    bars = Array.from({ length: bins }, (_, i) => {
      const x0 = min + i * step, x1 = i === bins - 1 ? max : min + (i + 1) * step;
      return { x0, x1, p: Math.max(0, (i === bins - 1 ? law.cdf(x1) : below(x1)) - below(x0)) };
    });
  }
  const first = bars[0].x0, last = bars[bars.length - 1].x1;
  const pad = lattice ? 0.5 * (bars[0].x1 - bars[0].x0 + 1) : Math.max((last - first) * 0.06, last === first ? 1 : 0);
  let lo = first - pad, hi = last + pad;
  if (range) { lo = Math.min(lo, range[0]); hi = Math.max(hi, range[1]); }
  return { discrete: true, lo, hi, curve: [], bars, lattice, top: Math.max(...bars.map((b) => b.p), 1e-9), mean: meanInside(law, lo, hi) };
}

/** `range` widens the picture so that it also holds, for example, the data it is compared with. */
export function modelShape(law: Law, opts: { range?: [number, number]; points?: number; maxBars?: number } = {}): ModelShape {
  return law.discrete ? discreteShape(law, opts.range, opts.maxBars ?? 60) : continuousShape(law, opts.range, opts.points ?? 120);
}

/** Round axis values (1, 2 or 5 times a power of ten apart) inside [lo, hi]. */
export function axisTicks(lo: number, hi: number, target = 5): number[] {
  if (!finite(lo) || !finite(hi) || !(hi > lo)) return finite(lo) ? [lo] : [];
  const raw = (hi - lo) / target, pow = 10 ** Math.floor(Math.log10(raw)), n = raw / pow;
  const step = (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * pow;
  const out: number[] = [];
  for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + step * 1e-9; k++) out.push(Number((k * step).toPrecision(12)));
  return out;
}
