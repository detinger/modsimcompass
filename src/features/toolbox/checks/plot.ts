import { compareValidation, formatNumber } from '../../../domain/artefacts/checkPlan';
import type { CheckPlan } from '../../../domain/artefacts/types';

/**
 * The validation plot as standalone SVG markup: observed and simulated values case by case, and simulated
 * against observed with the line of perfect agreement. The same markup is shown on the page (through
 * `SvgFigure`) and saved as a file, so what is exported is what was seen.
 *
 * Pure: no DOM, no React. All text is escaped; nothing is loaded from anywhere.
 */
export interface PlotOptions {
  /** Width in pixels. Two panels sit side by side from 640 px, otherwise they stack. */
  width: number;
  /** For a file opened on its own: literal colours, a white ground and a heading with the measure. */
  standalone?: boolean;
}

const TOKENS = {
  surface: ['--chart-surface', '#ffffff'], text: ['--text', '#17202c'], muted: ['--text-muted', '#4b5867'],
  grid: ['--chart-grid', '#e1e0d9'], axis: ['--chart-axis', '#c3c2b7'],
  observed: ['--chart-1', '#2a78d6'], simulated: ['--chart-2', '#eb6834'], pair: ['--chart-3', '#1baf7a'],
} as const;
type Token = keyof typeof TOKENS;

/**
 * Escapes text for SVG. Beyond the markup characters it also encodes `=`, `:`, `(` and `@`, so that no words a
 * user types can look like an attribute, an address or a style rule to the safety check of `SvgFigure`.
 */
export const svgText = (s: string): string => s.replace(/[&<>"'=:(@]/g, (ch) => `&#${ch.charCodeAt(0)};`);

const clip = (s: string, max: number) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t; };
const r2 = (x: number) => (Math.round(x * 100) / 100).toString();

/** Round tick values (1, 2 or 5 × a power of ten apart) covering [lo, hi]. */
export function axisTicks(lo: number, hi: number, target = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
  if (hi <= lo) { const pad = Math.abs(lo) > 0 ? Math.abs(lo) * 0.1 : 1; lo -= pad; hi += pad; }
  const raw = (hi - lo) / target, p = 10 ** Math.floor(Math.log10(raw)), n = raw / p;
  const step = (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
  const out: number[] = [];
  for (let k = Math.floor(lo / step + 1e-9); k * step < hi + step * (1 - 1e-9); k++) out.push(Number((k * step).toPrecision(12)));
  return out;
}

const tickLabel = (t: number) => formatNumber(t);

export function validationPlotSvg(v: CheckPlan['validation'], { width, standalone = false }: PlotOptions): string | null {
  const cmp = compareValidation(v.observed, v.simulated, v.tolerancePct);
  if (!cmp.ok) return null;
  const col = (t: Token) => (standalone ? TOKENS[t][1] : `var(${TOKENS[t][0]}, ${TOKENS[t][1]})`);
  const n = cmp.n, obs = v.observed, sim = v.simulated;

  const W = Math.max(280, Math.round(width));
  const side = W >= 640;
  const GAP = 28, HEAD = standalone ? 34 : 0, PH = 290;
  const pw = side ? (W - GAP) / 2 : W;
  const H = HEAD + (side ? PH : PH * 2 + 18);
  const L = 54, R = 16, T = 50, B = 42;

  // One value scale for both panels: the same numbers mean the same height everywhere.
  const all = [...obs, ...sim];
  const ticks = axisTicks(Math.min(...all), Math.max(...all));
  const lo = ticks[0], hi = ticks[ticks.length - 1], span = hi - lo || 1;

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Inter, system-ui, -apple-system, Segoe UI, sans-serif" font-size="11">`);
  if (standalone) {
    out.push(`<rect width="${W}" height="${H}" fill="${col('surface')}"/>`);
    out.push(`<text x="4" y="18" font-size="14" font-weight="650" fill="${col('text')}">${svgText(clip(v.measure, 80) || 'Observed and simulated values')}</text>`);
    out.push(`<text x="${W - 4}" y="18" text-anchor="end" fill="${col('muted')}">${svgText(`${n} pair${n === 1 ? '' : 's'} compared`)}</text>`);
  }

  const frame = (px: number, py: number, title: string, xLabel: string, yLabel: string) => {
    const x0 = px + L, x1 = px + pw - R, y0 = py + T, y1 = py + PH - B;
    const y = (val: number) => y1 - ((val - lo) / span) * (y1 - y0);
    out.push(`<text x="${r2(px + 4)}" y="${py + 14}" font-size="13" font-weight="650" fill="${col('text')}">${svgText(title)}</text>`);
    for (const t of ticks) {
      out.push(`<line x1="${r2(x0)}" x2="${r2(x1)}" y1="${r2(y(t))}" y2="${r2(y(t))}" stroke="${col('grid')}"/>`);
      out.push(`<text x="${r2(x0 - 7)}" y="${r2(y(t) + 4)}" text-anchor="end" fill="${col('muted')}">${svgText(tickLabel(t))}</text>`);
    }
    out.push(`<line x1="${r2(x0)}" x2="${r2(x1)}" y1="${r2(y1)}" y2="${r2(y1)}" stroke="${col('axis')}"/>`);
    out.push(`<text x="${r2((x0 + x1) / 2)}" y="${py + PH - 6}" text-anchor="middle" fill="${col('muted')}">${svgText(xLabel)}</text>`);
    out.push(`<text transform="translate(${r2(px + 12)} ${r2((y0 + y1) / 2)}) rotate(-90)" text-anchor="middle" fill="${col('muted')}">${svgText(yLabel)}</text>`);
    return { x0, x1, y0, y1, y };
  };
  const dot = (cx: number, cy: number, token: Token) => `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="4.5" fill="${col(token)}" stroke="${col('surface')}" stroke-width="2"/>`;
  const square = (cx: number, cy: number, token: Token) => `<rect x="${r2(cx - 4)}" y="${r2(cy - 4)}" width="8" height="8" rx="1.5" fill="${col(token)}" stroke="${col('surface')}" stroke-width="2"/>`;

  // ── Panel 1: case by case ──
  {
    const px = 0, py = HEAD;
    const f = frame(px, py, 'Case by case', 'Case', clip(v.measure, 34) || 'Value');
    const x = (i: number) => (n === 1 ? (f.x0 + f.x1) / 2 : f.x0 + 10 + (i / (n - 1)) * (f.x1 - f.x0 - 20));
    // Legend: line pattern and marker shape as well as colour.
    const ly = py + 32;
    out.push(`<line x1="${px + 6}" x2="${px + 30}" y1="${ly}" y2="${ly}" stroke="${col('observed')}" stroke-width="2"/>${dot(px + 18, ly, 'observed')}`);
    out.push(`<text x="${px + 37}" y="${ly + 4}" font-size="12" fill="${col('text')}">Observed</text>`);
    out.push(`<line x1="${px + 108}" x2="${px + 132}" y1="${ly}" y2="${ly}" stroke="${col('simulated')}" stroke-width="2" stroke-dasharray="6 3"/>${square(px + 120, ly, 'simulated')}`);
    out.push(`<text x="${px + 139}" y="${ly + 4}" font-size="12" fill="${col('text')}">Simulated</text>`);
    // Case numbers along the bottom: at most eight, always whole.
    const stepX = Math.max(1, Math.ceil(n / 8));
    for (let i = 0; i < n; i += stepX) out.push(`<text x="${r2(x(i))}" y="${r2(f.y1 + 15)}" text-anchor="middle" fill="${col('muted')}">${i + 1}</text>`);
    if (n > 1) {
      out.push(`<polyline fill="none" stroke="${col('observed')}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${obs.map((o, i) => `${r2(x(i))},${r2(f.y(o))}`).join(' ')}"/>`);
      out.push(`<polyline fill="none" stroke="${col('simulated')}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="6 3" points="${sim.map((s, i) => `${r2(x(i))},${r2(f.y(s))}`).join(' ')}"/>`);
    }
    if (n <= 40) for (let i = 0; i < n; i++) out.push(dot(x(i), f.y(obs[i]), 'observed'), square(x(i), f.y(sim[i]), 'simulated'));
    // One hover target per case, as tall as the plot.
    if (n <= 400) {
      const band = n === 1 ? f.x1 - f.x0 : (f.x1 - f.x0 - 20) / (n - 1);
      for (let i = 0; i < n; i++) {
        out.push(`<rect x="${r2(x(i) - band / 2)}" y="${r2(f.y0)}" width="${r2(band)}" height="${r2(f.y1 - f.y0)}" fill="transparent"><title>${svgText(`Case ${i + 1}: observed ${formatNumber(obs[i])}, simulated ${formatNumber(sim[i])}`)}</title></rect>`);
      }
    }
  }

  // ── Panel 2: simulated against observed ──
  {
    const px = side ? pw + GAP : 0, py = HEAD + (side ? 0 : PH + 18);
    const f = frame(px, py, 'Simulated against observed', 'Observed', 'Simulated');
    const x = (val: number) => f.x0 + ((val - lo) / span) * (f.x1 - f.x0);
    const ly = py + 32;
    out.push(`<line x1="${r2(px + 6)}" x2="${r2(px + 30)}" y1="${ly}" y2="${ly}" stroke="${col('muted')}" stroke-width="1.5"/>`);
    out.push(`<text x="${r2(px + 37)}" y="${ly + 4}" font-size="12" fill="${col('text')}">Line of perfect agreement</text>`);
    for (const t of ticks) out.push(`<text x="${r2(x(t))}" y="${r2(f.y1 + 15)}" text-anchor="middle" fill="${col('muted')}">${svgText(tickLabel(t))}</text>`);
    out.push(`<line x1="${r2(x(lo))}" y1="${r2(f.y(lo))}" x2="${r2(x(hi))}" y2="${r2(f.y(hi))}" stroke="${col('muted')}" stroke-width="1.5"/>`);
    const shown = Math.min(n, 2000);
    for (let i = 0; i < shown; i++) out.push(`<circle cx="${r2(x(obs[i]))}" cy="${r2(f.y(sim[i]))}" r="4.5" fill="${col('pair')}" fill-opacity="0.85" stroke="${col('surface')}" stroke-width="${n > 200 ? 1 : 2}"/>`);
    if (n <= 400) {
      for (let i = 0; i < n; i++) {
        out.push(`<circle cx="${r2(x(obs[i]))}" cy="${r2(f.y(sim[i]))}" r="10" fill="transparent"><title>${svgText(`Case ${i + 1}: observed ${formatNumber(obs[i])}, simulated ${formatNumber(sim[i])}`)}</title></circle>`);
      }
    }
    // The two means: the point the tolerance is about.
    const mx = x(cmp.meanObserved), my = f.y(cmp.meanSimulated);
    out.push(`<g><circle cx="${r2(mx)}" cy="${r2(my)}" r="8" fill="none" stroke="${col('surface')}" stroke-width="5"/><circle cx="${r2(mx)}" cy="${r2(my)}" r="8" fill="none" stroke="${col('text')}" stroke-width="2"/>`
      + `<path d="M${r2(mx - 4)},${r2(my)} H${r2(mx + 4)} M${r2(mx)},${r2(my - 4)} V${r2(my + 4)}" stroke="${col('text')}" stroke-width="2" stroke-linecap="round"/>`
      + `<title>${svgText(`Means: observed ${formatNumber(cmp.meanObserved)}, simulated ${formatNumber(cmp.meanSimulated)}`)}</title></g>`);
    const right = mx < f.x1 - 60;
    out.push(`<text x="${r2(mx + (right ? 13 : -13))}" y="${r2(my + 4)}" text-anchor="${right ? 'start' : 'end'}" font-size="12" font-weight="650" fill="${col('text')}" stroke="${col('surface')}" stroke-width="3" paint-order="stroke">means</text>`);
  }

  out.push('</svg>');
  return out.join('');
}
