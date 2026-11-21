import { mdCell, mdLine, mdText } from '../../exports/mdText';
import { deltaAicLabel } from '../distributions/fitting';
import { modelLaw, modelMoments } from '../distributions/inputModel';
import { FAMILIES, describeLaw, isKind, type Kind } from '../distributions/laws';
import { allWholeNumbers, binCount, histogram, integerHistogram } from '../distributions/sample';
import { axisTicks, modelShape } from '../distributions/shape';
import { newId, type Availability, type InputRow, type ProjectDoc } from '../passport/schema';
import { isNum, isObj, items, numbers, oneOf, own, sameData, text, type Warn } from './clean';
import type { KindDef } from './kinds';
import type { DataModel } from './types';

/** Families whose single parameter is a list of numbers: probabilities, or the observations themselves. */
export const LIST_FAMILIES: readonly Kind[] = ['categorical', 'empirical'];
export const LIST_FAMILY_MAX = 256;
const ORIGINS = ['fitted', 'described', 'manual'] as const;
const AVAILABILITIES: readonly Availability[] = ['', 'have', 'obtainable', 'assume'];
const ORIGIN_TEXT: Record<DataModel['origin'], string> = { fitted: 'Fitted to data', described: 'Described without data', manual: 'Set by hand' };
const AVAILABILITY_TEXT: Record<Availability, string> = { '': 'Not decided', have: 'Have it', obtainable: 'Can get it', assume: 'Must assume' };

const empty = (): DataModel => ({
  name: '', unit: '', family: 'normal', params: [0, 1], origin: 'manual', provenance: '', uncertainty: '', availability: '', plan: '',
  summary: null, fit: null, generator: { seed: '12345', n: 100 }, keepData: false, data: [],
});

/** True when `params` has the number of values the family takes. */
export const paramsFit = (family: Kind, params: number[]): boolean =>
  (LIST_FAMILIES.includes(family) ? params.length >= 1 && params.length <= LIST_FAMILY_MAX : params.length === FAMILIES[family].params.length);
/** The parameter fields `lawFor` and `describeLaw` expect for a stored model. */
export const lawFields = (family: Kind, params: number[]): (number | string)[] => (LIST_FAMILIES.includes(family) ? [params.join(', ')] : [...params]);
/** The distribution in words, for example “Gamma(shape 2, scale 3)”. */
export function describeModel(d: Pick<DataModel, 'family' | 'params'>): string {
  if (d.family === 'empirical' && d.params.length > 12) return `Empirical(${d.params.length} equally weighted observations)`;
  if (d.family === 'empirical') return `Empirical(observations ${d.params.join(', ')})`;
  if (d.family === 'categorical') return `Categorical(probabilities ${d.params.join(', ')})`;
  return describeLaw(d.family, lawFields(d.family, d.params));
}
/** Raw data leaves memory only when the user asked to keep it. */
export const withoutUnkeptData = (d: DataModel): DataModel => (d.keepData || d.data.length === 0 ? d : { ...d, data: [] });

function readSummary(x: unknown, warn: Warn): DataModel['summary'] {
  if (x === null || x === undefined) return null;
  if (isObj(x)) {
    const n = own(x, 'n'), m = own(x, 'mean'), sd = own(x, 'sd'), min = own(x, 'min'), max = own(x, 'max');
    if (isNum(n) && Number.isInteger(n) && n >= 0 && isNum(m) && isNum(sd) && isNum(min) && isNum(max)) return { n, mean: m, sd, min, max };
  }
  warn('summary: not a data summary; removed.');
  return null;
}

function readFit(x: unknown, warn: Warn): DataModel['fit'] {
  if (x === null || x === undefined) return null;
  const bad = () => { warn('fit: not a fit record; removed.'); return null; };
  if (!isObj(x)) return bad();
  const rank = own(x, 'rank'), ksD = own(x, 'ksD'), list = items(own(x, 'candidates'), 'fit.candidates', warn, 50);
  if (!isNum(rank) || !Number.isInteger(rank) || rank < 1 || !list || !(ksD === null || ksD === undefined || isNum(ksD))) return bad();
  const candidates: { family: Kind; aic: number }[] = [];
  for (const c of list) {
    const family = isObj(c) ? own(c, 'family') : undefined, aic = isObj(c) ? own(c, 'aic') : undefined;
    if (typeof family !== 'string' || !isKind(family) || !isNum(aic)) return bad();
    candidates.push({ family, aic });
  }
  return { rank, candidates, ksD: isNum(ksD) ? ksD : null };
}

function sanitize(raw: unknown, warn: Warn): DataModel | null {
  if (!isObj(raw)) return null;
  const family = own(raw, 'family'), generator = own(raw, 'generator');
  const params = numbers(own(raw, 'params'), 'params', warn, LIST_FAMILY_MAX), data = numbers(own(raw, 'data'), 'data', warn);
  if (typeof family !== 'string' || !isKind(family) || !params || !paramsFit(family, params) || !isObj(generator) || !data) return null;
  const keepData = own(raw, 'keepData') === true;
  if (!keepData && data.length) warn('data: raw data was not marked to be kept; left out.');
  const n = own(generator, 'n');
  const validN = isNum(n) && Number.isInteger(n) && n >= 1 && n <= 100_000;
  if (!validN && n !== undefined) warn('generator.n: reset to 100.');
  return {
    name: text(own(raw, 'name'), 'name', warn, 200), unit: text(own(raw, 'unit'), 'unit', warn, 200),
    family, params,
    origin: oneOf(own(raw, 'origin'), ORIGINS, 'manual', 'origin', warn),
    provenance: text(own(raw, 'provenance'), 'provenance', warn), uncertainty: text(own(raw, 'uncertainty'), 'uncertainty', warn),
    availability: oneOf(own(raw, 'availability'), AVAILABILITIES, '', 'availability', warn), plan: text(own(raw, 'plan'), 'plan', warn),
    summary: readSummary(own(raw, 'summary'), warn), fit: readFit(own(raw, 'fit'), warn),
    generator: { seed: text(own(generator, 'seed'), 'generator.seed', warn, 200), n: validN ? (n as number) : 100 },
    keepData, data: keepData ? data : [],
  };
}

const num = (x: number) => String(Number(x.toPrecision(4)));

/** Mean of the model in a few words, or nothing when it has none or the parameters are not valid. */
function meanText(d: DataModel): string {
  const law = modelLaw(d);
  if (!law) return '';
  const { mean } = modelMoments(law, d);
  return mean === null ? 'no mean' : `mean ${num(mean)}`;
}

function originLine(d: DataModel): string {
  const n = d.summary?.n;
  if (d.origin === 'fitted') {
    const of = d.fit ? (d.fit.rank === 1 ? `, lowest AIC of ${d.fit.candidates.length}` : `, rank ${d.fit.rank} of ${d.fit.candidates.length} by AIC`) : '';
    return n ? `Fitted to ${n} values${of}` : `Fitted to data${of}`;
  }
  if (d.origin === 'described') return 'Described without data';
  return n ? `Set by hand, beside ${n} values` : 'Set by hand';
}

function summary(d: DataModel): string[] {
  const m = meanText(d);
  const L = [`${d.name.trim() || 'Unnamed input'}${d.unit.trim() ? ` (${d.unit.trim()})` : ''}`, `${describeModel(d)}${m ? ` · ${m}` : ''}`, originLine(d)];
  if (d.availability) L.push(`Data: ${AVAILABILITY_TEXT[d.availability].toLowerCase()}`);
  if (d.provenance.trim()) L.push(`Source: ${d.provenance.trim().split(/\r?\n/)[0].slice(0, 80)}`);
  return L.slice(0, 5);
}

function markdown(d: DataModel): string[] {
  const L = [
    `- **Input:** ${mdText(d.name)}`, `- **Unit:** ${mdText(d.unit)}`, `- **Model:** ${describeModel(d)}`,
  ];
  const law = modelLaw(d);
  if (law) {
    const { mean, sd } = modelMoments(law, d);
    L.push(`- **Model mean and spread:** ${mean === null ? 'no mean (averages never settle)' : `mean ${num(mean)}${sd === null ? '' : `; standard deviation ${num(sd)}`}`}; possible values: ${FAMILIES[d.family].support}`);
  }
  L.push(
    `- **How it was chosen:** ${ORIGIN_TEXT[d.origin]}${d.origin === 'fitted' ? ' (maximum likelihood, candidates ranked by AIC)' : ''}`,
    `- **Source:** ${mdText(d.provenance)}`, `- **Uncertainty:** ${mdText(d.uncertainty)}`, `- **Data status:** ${AVAILABILITY_TEXT[d.availability]}`,
  );
  if (d.plan.trim()) L.push(`- **Plan to get the data:** ${mdText(d.plan)}`);
  if (d.summary) L.push(`- **Data summary:** ${d.summary.n} values; mean ${num(d.summary.mean)}; standard deviation ${num(d.summary.sd)}; range ${num(d.summary.min)} to ${num(d.summary.max)}`);
  if (d.keepData && d.data.length) L.push(`- **Data kept with the artefact:** ${d.data.length} values`);
  L.push(`- **Synthetic data:** ${d.generator.n} values drawn from the model with seed “${mdLine(d.generator.seed) || '0'}”. Generated, not observed.`);
  L.push('');
  if (d.fit && d.fit.candidates.length) {
    const best = Math.min(...d.fit.candidates.map((c) => c.aic));
    L.push('| Candidate | AIC (lower fits better) | Difference from the lowest | Support |', '| --- | --- | --- | --- |');
    d.fit.candidates.forEach((c, i) => L.push(`| ${mdCell(FAMILIES[c.family].title)}${i + 1 === d.fit!.rank ? ' (chosen)' : ''} | ${num(c.aic)} | ${num(c.aic - best)} | ${deltaAicLabel(c.aic - best)} |`));
    L.push('', `The chosen model ranked ${d.fit.rank} of ${d.fit.candidates.length}.${d.fit.ksD === null ? '' : ` Largest gap between the data and the fitted curve (Kolmogorov–Smirnov distance): ${num(d.fit.ksD)}.`} No p-value is given: with parameters estimated from the same data it would not be valid.`, '');
  }
  return L;
}

// ── Picture ──────────────────────────────────────────────────────────────

/** Text inside the picture: markup characters, and those a link, a style or an event attribute would need, become entities. */
const xml = (s: string) => s.replace(/[&<>"'=:@()]/g, (c) => `&#${c.charCodeAt(0)};`);
const clip = (s: string, n: number) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };
const r1 = (x: number) => String(Math.round(x * 10) / 10);
const tick = (t: number) => String(Number(t.toPrecision(6))).replace('-', '−');

/* A literal colour first, then the app's token: a viewer without CSS variables keeps the literal, so a saved picture prints well. */
const FIG_STYLE = '<style>'
  + '.dmf text{font-family:Inter,system-ui,-apple-system,\'Segoe UI\',Roboto,sans-serif;font-size:11px;fill:#4b5867;fill:var(--text-muted,#4b5867)}'
  + '.dmf .t{font-size:12.5px;font-weight:650;fill:#17202c;fill:var(--text,#17202c)}'
  + '.dmf .ax{fill:none;stroke:#c3c2b7;stroke:var(--chart-axis,#c3c2b7);stroke-width:1}'
  + '.dmf .data{fill:#2a78d6;fill:var(--chart-1,#2a78d6);opacity:.38}'
  + '.dmf .area{fill:#eb6834;fill:var(--chart-2,#eb6834);opacity:.12}'
  + '.dmf .line{fill:none;stroke:#eb6834;stroke:var(--chart-2,#eb6834);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}'
  + '.dmf .bar{fill:#eb6834;fill:var(--chart-2,#eb6834)}'
  + '.dmf .range{fill:none;stroke:#2a78d6;stroke:var(--chart-1,#2a78d6);stroke-width:2;stroke-linecap:round}'
  + '.dmf .mean{fill:#2a78d6;fill:var(--chart-1,#2a78d6)}'
  + '</style>';

/**
 * The model as a picture: its density curve (continuous) or probability bars (discrete). When the data was kept,
 * its histogram stands behind the curve on the same scale; when only a summary was kept, the range of the data
 * and its mean are marked under the axis. Null while the artefact is empty or the parameters are not valid.
 */
function figure(d: DataModel): string | null {
  if (sameData(d, empty())) return null;
  const law = modelLaw(d);
  if (!law) return null;
  const kept = d.keepData && d.data.length >= 2 ? d.data : null;
  const dataRange: [number, number] | undefined = kept ? [Math.min(...kept), Math.max(...kept)] : d.summary ? [d.summary.min, d.summary.max] : undefined;
  let shape;
  try { shape = modelShape(law, { range: dataRange, points: 90, maxBars: 40 }); } catch { return null; }
  if (!(shape.hi > shape.lo)) return null;

  const W = 360, padL = 14, padR = 14, top = 30, plotH = 92, base = top + plotH;
  const marker = !kept && d.summary ? 16 : 0;
  const H = base + marker + 44;
  const x = (v: number) => padL + ((Math.max(shape.lo, Math.min(shape.hi, v)) - shape.lo) / (shape.hi - shape.lo)) * (W - padL - padR);

  // Data histogram on the scale of the model: density for a continuous model, share per value for a discrete one.
  let bins: { from: number; to: number; h: number }[] = [];
  if (kept) {
    const n = kept.length;
    if (shape.discrete && shape.lattice && allWholeNumbers(kept)) {
      const width = shape.bars.length ? shape.bars[0].x1 - shape.bars[0].x0 + 1 : 1;
      bins = integerHistogram(kept, Math.max(1, Math.ceil((shape.hi - shape.lo) / width))).map((b) => ({ from: b.from - 0.5, to: b.to + 0.5, h: b.count / n }));
    } else {
      const raw = histogram(kept, shape.lo, shape.hi, binCount(n));
      const w = raw.length ? raw[0].to - raw[0].from : 1;
      bins = raw.map((b) => ({ from: b.from, to: b.to, h: shape.discrete ? b.count / n : b.count / (n * w) }));
    }
  }
  const modelTop = shape.discrete ? Math.max(...shape.bars.map((b) => b.p), 1e-12) : shape.top;
  const yTop = Math.max(modelTop, ...bins.map((b) => b.h)) * 1.08 || 1;
  const y = (h: number) => base - (Math.min(h, yTop) / yTop) * plotH;

  const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" class="dmf" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${FIG_STYLE}`];
  parts.push(`<text class="t" x="${padL}" y="17">${xml(clip(describeModel(d), 52))}</text>`);
  for (const b of bins) if (b.h > 0) parts.push(`<rect class="data" x="${r1(x(b.from) + 1)}" y="${r1(y(b.h))}" width="${r1(Math.max(1, x(b.to) - x(b.from) - 2))}" height="${r1(base - y(b.h))}"/>`);
  if (shape.discrete) {
    const slot = (W - padL - padR) / Math.max(1, shape.bars.length);
    for (const b of shape.bars) {
      const cx = (x(b.x0) + x(b.x1)) / 2, w = Math.max(2, Math.min(24, (b.x1 > b.x0 ? x(b.x1 + (shape.lattice ? 1 : 0)) - x(b.x0) : slot) - 3));
      const h = base - y(b.p);
      if (h > 0.2) parts.push(`<rect class="bar" x="${r1(cx - w / 2)}" y="${r1(y(b.p))}" width="${r1(w)}" height="${r1(h)}" rx="${h > 4 ? 2 : 0}"/>`);
    }
  } else {
    const pts = shape.curve.map((c) => `${r1(x(c.x))},${r1(y(c.y))}`);
    parts.push(`<path class="area" d="M${r1(x(shape.lo))},${base} L${pts.join(' L')} L${r1(x(shape.hi))},${base} Z"/>`);
    parts.push(`<path class="line" d="M${pts.join(' L')}"/>`);
  }
  parts.push(`<line class="ax" x1="${padL}" x2="${W - padR}" y1="${base}" y2="${base}"/>`);
  if (!kept && d.summary) {
    const ry = base + 10;
    parts.push(`<line class="range" x1="${r1(x(d.summary.min))}" x2="${r1(x(d.summary.max))}" y1="${ry}" y2="${ry}"/>`);
    parts.push(`<circle class="mean" cx="${r1(x(d.summary.mean))}" cy="${ry}" r="4"/>`);
  }
  const ticksAt = axisTicks(shape.lo, shape.hi, 4);
  const ty = base + marker + 15;
  for (const t of ticksAt) parts.push(`<text x="${r1(x(t))}" y="${ty}" text-anchor="middle">${tick(t)}</text>`);
  const unit = mdLine(d.unit);
  const legend = [shape.discrete ? 'Bars: model' : 'Curve: model', ...(kept ? [`Shaded: ${kept.length} data values`] : d.summary ? ['Line: data range, dot: data mean'] : [])].join('  ·  ');
  parts.push(`<text x="${W / 2}" y="${ty + 18}" text-anchor="middle">${xml(clip(unit ? `${unit}  ·  ${legend}` : legend, 64))}</text>`);
  parts.push('</svg>');
  return parts.join('');
}

function applyToProject(doc: ProjectDoc, d: DataModel, inclusionId: string): void {
  const inputs = doc.passport.inputs;
  let row = inputs.find((r) => r.inclusion === inclusionId);
  if (!row) { row = { id: newId('in'), name: '', value: '', unit: '', sourceType: 'assumed', provenance: '', uncertainty: '', inclusion: inclusionId } satisfies InputRow; inputs.push(row); }
  row.name = d.name; row.value = describeModel(d); row.unit = d.unit;
  row.sourceType = d.origin === 'fitted' ? 'observed' : 'assumed';
  row.provenance = d.provenance; row.uncertainty = d.uncertainty;
  // Optional fields are absent when empty, as everywhere else in a project.
  if (d.availability) row.availability = d.availability; else delete row.availability;
  if (d.plan.trim()) row.plan = d.plan; else delete row.plan;
}

export const dataModel: KindDef<'data-model'> = {
  kind: 'data-model', label: 'Data model', toolPath: '/toolbox/data', step: 'inputs', many: true, ownsRows: true,
  empty, sanitize, isEmpty: (d) => sameData(d, empty()), summary, markdown, figure, applyToProject,
};
