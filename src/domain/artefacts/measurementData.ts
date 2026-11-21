import { mdCell, mdLine, mdText } from '../../exports/mdText';
import { MAX_CONSTRUCTS, MAX_ITEMS, MAX_KEPT_CELLS, MAX_KEPT_ROWS } from '../measurement/limits';
import { uniqueName } from '../measurement/build';
import { tenCasesPerArrow } from '../measurement/stats';
import { newId, type InputRow, type ProjectDoc } from '../passport/schema';
import { isId, isNum, isObj, items as listOf, numOrNull, oneOf, own, sameData, text, type Warn } from './clean';
import type { KindDef } from './kinds';
import type { ConstructMode, ItemSummary, MeasuredConstruct, MeasuredItem, MeasurementData, MissingHandling } from './types';

/**
 * Measurement data (docs/LEARN-TOOLBOX-PLAN.md §5.3, method-aware inputs): a dataset of measured variables or survey
 * items, grouped into constructs. For statistical methods such as path analysis or structural equation models, where
 * fitting a distribution to each variable is the wrong tool. Raw rows are kept only when the user asks for it.
 */
const MODES: readonly ConstructMode[] = ['reflective', 'formative', 'single'];
const MISSING: readonly MissingHandling[] = ['undecided', 'none', 'listwise', 'pairwise', 'imputed'];
const ORIGINS = ['imported', 'example'] as const;
export const MODE_TEXT: Record<ConstructMode, string> = { reflective: 'Reflective', formative: 'Formative', single: 'Single item' };
export const MISSING_TEXT: Record<MissingHandling, string> = {
  undecided: 'Not decided', none: 'No missing values', listwise: 'Cases with a missing value are left out (listwise)',
  pairwise: 'Each statistic uses the cases it can (pairwise)', imputed: 'Missing values are imputed (see the note)',
};

const empty = (): MeasurementData => ({
  source: '', origin: 'imported', cases: 0, scale: null, missing: 'undecided', items: [], constructs: [], maxArrows: null, note: '', keepData: false, data: [],
});

function readSummary(x: unknown, path: string, warn: Warn): ItemSummary | null {
  if (x === null || x === undefined) return null;
  if (isObj(x)) {
    const n = own(x, 'n'), missing = own(x, 'missing'), skew = own(x, 'skew');
    const nums = ['mean', 'sd', 'min', 'max'].map((k) => own(x, k));
    if (isNum(n) && Number.isInteger(n) && n >= 0 && isNum(missing) && Number.isInteger(missing) && missing >= 0 && nums.every(isNum) && (skew === null || isNum(skew))) {
      const [mean, sd, min, max] = nums as number[];
      if (sd >= 0 && min <= max) return { n, missing, mean, sd, min, max, skew: skew as number | null };
    }
  }
  warn(`${path}: not an item summary; removed.`);
  return null;
}

function sanitize(raw: unknown, warn: Warn): MeasurementData | null {
  if (!isObj(raw)) return null;
  const rawItems = listOf(own(raw, 'items'), 'items', warn, MAX_ITEMS), rawConstructs = listOf(own(raw, 'constructs'), 'constructs', warn, MAX_CONSTRUCTS);
  const rawData = own(raw, 'data');
  if (!rawItems || !rawConstructs || !Array.isArray(rawData)) return null;

  const items: MeasuredItem[] = [], ids = new Set<string>();
  /** Which stored columns of the raw rows belong to an item that was kept. */
  const keptColumn: boolean[] = [];
  rawItems.forEach((it, i) => {
    const id = isObj(it) ? own(it, 'id') : undefined;
    if (!isObj(it) || !isId(id) || ids.has(id)) { warn(`items[${i}]: not a valid item; left out.`); keptColumn.push(false); return; }
    ids.add(id);
    keptColumn.push(true);
    items.push({
      id, column: text(own(it, 'column'), `items[${i}].column`, warn, 200), label: text(own(it, 'label'), `items[${i}].label`, warn, 500),
      reverse: own(it, 'reverse') === true, summary: readSummary(own(it, 'summary'), `items[${i}].summary`, warn),
    });
  });

  // Each item belongs to one construct at most; the first construct that names it keeps it.
  const constructs: MeasuredConstruct[] = [], cids = new Set<string>(), placed = new Set<string>();
  rawConstructs.forEach((c, i) => {
    const id = isObj(c) ? own(c, 'id') : undefined, list = isObj(c) ? listOf(own(c, 'items'), `constructs[${i}].items`, warn, MAX_ITEMS) : null;
    if (!isObj(c) || !isId(id) || cids.has(id) || !list) { warn(`constructs[${i}]: not a valid construct; left out.`); return; }
    cids.add(id);
    const its = list.filter((x): x is string => typeof x === 'string' && ids.has(x) && !placed.has(x));
    if (its.length !== list.length) warn(`constructs[${i}].items: unknown or repeated items removed.`);
    its.forEach((x) => placed.add(x));
    if (!its.length) { warn(`constructs[${i}]: no items left; left out.`); return; }
    let mode = oneOf(own(c, 'mode'), MODES, its.length > 1 ? 'reflective' : 'single', `constructs[${i}].mode`, warn);
    if ((mode === 'single') !== (its.length === 1)) { warn(`constructs[${i}].mode: does not fit the number of items; reset.`); mode = its.length > 1 ? 'reflective' : 'single'; }
    let alpha = numOrNull(own(c, 'alpha'), `constructs[${i}].alpha`, warn);
    if (alpha !== null && (alpha > 1 || its.length < 2)) { warn(`constructs[${i}].alpha: not a possible value; cleared.`); alpha = null; }
    // Each construct is one project row, named after it: a repeated name (compared without case) gets a number.
    const given = text(own(c, 'name'), `constructs[${i}].name`, warn, 200);
    const name = uniqueName(given, constructs.map((x) => x.name));
    if (name !== given) warn(`constructs[${i}].name: another construct has this name; renamed “${name}”.`);
    constructs.push({ id, name, mode, items: its, alpha });
  });

  const cases = own(raw, 'cases');
  const rawScale = own(raw, 'scale');
  let scale: MeasurementData['scale'] = null;
  if (isObj(rawScale) && isNum(own(rawScale, 'min')) && isNum(own(rawScale, 'max')) && (own(rawScale, 'min') as number) < (own(rawScale, 'max') as number)) {
    scale = { min: own(rawScale, 'min') as number, max: own(rawScale, 'max') as number };
  } else if (rawScale !== null && rawScale !== undefined) warn('scale: not a scale; cleared.');
  let maxArrows = numOrNull(own(raw, 'maxArrows'), 'maxArrows', warn);
  if (maxArrows !== null && !(Number.isInteger(maxArrows) && maxArrows >= 0 && maxArrows <= 100)) { warn('maxArrows: not a count of arrows; cleared.'); maxArrows = null; }

  // Raw rows only when kept, one value per item, within the limits.
  const keepData = own(raw, 'keepData') === true;
  let data: (number | null)[][] = [];
  if (!keepData && rawData.length) warn('data: raw data was not marked to be kept; left out.');
  if (keepData) {
    const width = items.length, maxRows = Math.min(MAX_KEPT_ROWS, width ? Math.floor(MAX_KEPT_CELLS / width) : 0);
    if (rawData.length > maxRows) warn(`data: shortened to ${maxRows} rows.`);
    let trimmed = false;
    for (const r of rawData.slice(0, maxRows)) {
      if (!Array.isArray(r) || r.length < rawItems.length || !r.every((v) => v === null || isNum(v))) return null;
      if (r.length > rawItems.length) trimmed = true;
    }
    // A row wider than the items (a file with more items than the limit, say) loses its extra columns.
    if (trimmed) warn(`data: values beyond the ${rawItems.length} items removed from each row.`);
    // Rows follow the items as stored; a left-out item takes its column with it.
    data = rawData.slice(0, maxRows).map((r) => (r as (number | null)[]).slice(0, rawItems.length).filter((_, j) => keptColumn[j]));
  }

  return {
    source: text(own(raw, 'source'), 'source', warn), origin: oneOf(own(raw, 'origin'), ORIGINS, 'imported', 'origin', warn),
    cases: isNum(cases) && Number.isInteger(cases) && cases >= 0 && cases <= 10_000_000 ? cases : 0,
    scale, missing: oneOf(own(raw, 'missing'), MISSING, 'undecided', 'missing', warn),
    items, constructs, maxArrows, note: text(own(raw, 'note'), 'note', warn), keepData, data,
  };
}

// ── Words ─────────────────────────────────────────────────────────────────

const num = (x: number) => String(Number(x.toPrecision(3)));
const a2 = (x: number) => x.toFixed(2).replace('-', '−');
const scaleText = (s: MeasurementData['scale']) => (s ? `${s.min}–${s.max}` : 'no common scale');
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** “4 items · 1–7 · α 0.86”: one construct in a few words, as its project row shows it. */
export function constructLine(d: Pick<MeasurementData, 'scale'>, c: MeasuredConstruct): string {
  const parts = [plural(c.items.length, 'item'), scaleText(d.scale)];
  if (c.alpha !== null) parts.push(`α ${a2(c.alpha)}`);
  if (c.mode === 'formative') parts.push('formative');
  return parts.join(' · ');
}

/** The sample-size note: ten cases per arrow into the busiest construct, a rough floor and nothing more. */
export function sampleSizeText(d: Pick<MeasurementData, 'maxArrows' | 'cases'>): string | null {
  if (d.maxArrows === null || d.maxArrows < 1) return null;
  const floor = tenCasesPerArrow(d.maxArrows);
  return `The busiest construct has ${plural(d.maxArrows, 'arrow')} pointing at it. A rough floor of ten cases per arrow asks for ${floor} cases; there are ${d.cases}. A rule of thumb, not a power analysis.`;
}

function summary(d: MeasurementData): string[] {
  if (!d.items.length) return [d.source.trim() ? `Source: ${mdLine(d.source).slice(0, 80)}` : 'No data yet.'];
  const L = [`${plural(d.constructs.length, 'construct')}, ${plural(d.items.length, 'item')}`, `${d.cases} cases · scale ${scaleText(d.scale)}`];
  const alphas = d.constructs.filter((c) => c.alpha !== null).map((c) => `${mdLine(c.name) || 'Unnamed'} α ${a2(c.alpha!)}`);
  if (alphas.length) L.push(alphas.join(' · ').slice(0, 120));
  if (d.origin === 'example') L.push('Example data, not responses from real people');
  else if (d.source.trim()) L.push(`Source: ${mdLine(d.source).slice(0, 80)}`);
  return L.slice(0, 5);
}

function markdown(d: MeasurementData): string[] {
  const L = [
    `- **Source:** ${mdText(d.source)}`, ...(d.origin === 'example' ? ['- **Origin:** example data made by the app, not responses from real people'] : []),
    `- **Cases:** ${d.cases}`, `- **Scale:** ${scaleText(d.scale)}`, `- **Missing values:** ${MISSING_TEXT[d.missing]}`,
    `- **Constructs and items:** ${plural(d.constructs.length, 'construct')}, ${plural(d.items.length, 'item')}`,
  ];
  if (d.keepData && d.data.length) L.push(`- **Data kept with the artefact:** ${d.data.length} cases`);
  const ss = sampleSizeText(d);
  if (ss) L.push(`- **Sample size:** ${ss}`);
  if (d.note.trim()) L.push(`- **Note:** ${mdText(d.note)}`);
  L.push('');
  if (d.constructs.length) {
    const byId = new Map(d.items.map((it) => [it.id, it]));
    L.push('| Construct | Mode | Items | Cronbach’s alpha |', '| --- | --- | --- | --- |');
    for (const c of d.constructs) L.push(`| ${mdCell(c.name)} | ${MODE_TEXT[c.mode]} | ${mdCell(c.items.map((id) => byId.get(id)?.column ?? id).join(', '))} | ${c.alpha === null ? '—' : a2(c.alpha)} |`);
    L.push('', 'Alpha is a quick screen of internal consistency for reflective constructs. It is not evidence that a construct is valid.', '');
    L.push('| Construct | Item | Label | Reverse-coded | n | Missing | Mean | SD | Min | Max | Skew |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const c of d.constructs) for (const id of c.items) {
      const it = byId.get(id);
      if (!it) continue;
      const s = it.summary;
      L.push(`| ${mdCell(c.name)} | ${mdCell(it.column)} | ${mdCell(it.label)} | ${it.reverse ? 'yes' : 'no'} | ${s ? `${s.n} | ${s.missing} | ${num(s.mean)} | ${num(s.sd)} | ${num(s.min)} | ${num(s.max)} | ${s.skew === null ? '—' : a2(s.skew)}` : '— | — | — | — | — | — | —'} |`);
    }
    L.push('', 'Summaries are after reverse coding.', '');
  }
  return L;
}

// ── Picture ───────────────────────────────────────────────────────────────

const xml = (s: string) => s.replace(/[&<>"'=:@()]/g, (c) => `&#${c.charCodeAt(0)};`);
const clip = (s: string, n: number) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };
const r1 = (x: number) => String(Math.round(x * 10) / 10);
const FIG_STYLE = '<style>'
  + ".msf text{font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:10.5px;fill:#17202c;fill:var(--text,#17202c)}"
  + '.msf .c{fill:#f7ebe3;fill:var(--fam-processes-soft,#f7ebe3);stroke:#a65a2e;stroke:var(--fam-processes,#a65a2e);stroke-width:1.5}'
  + '.msf .c.f{stroke-dasharray:5 3}'
  + '.msf .i{fill:#ffffff;fill:var(--bg-elevated,#ffffff);stroke:#4b5867;stroke:var(--text-muted,#4b5867);stroke-width:1.2}'
  + '.msf .a{fill:none;stroke:#4b5867;stroke:var(--text-muted,#4b5867);stroke-width:1.1}'
  + '.msf .h{fill:#4b5867;fill:var(--text-muted,#4b5867)}'
  + '.msf .n{font-weight:700;font-size:11.5px}.msf .q{fill:#4b5867;fill:var(--text-muted,#4b5867)}'
  + '</style>';

/**
 * Constructs and their items: an oval per construct (dashed when formative), a square per item, arrows from a
 * reflective construct to its items and from items to a formative one. A single-item construct is its item alone.
 * Null while there are no items.
 */
function figure(d: MeasurementData): string | null {
  if (!d.items.length || !d.constructs.length) return null;
  const W = 360, BOX = 46, GAP = 6, X_ITEMS = 140, PAD = 10, MAX_SHOWN = 10, MAX_BOXES = 4;
  const shown = d.constructs.slice(0, MAX_SHOWN);
  const byId = new Map(d.items.map((it) => [it.id, it]));
  const parts: string[] = [];
  let y = PAD;
  const box = (x: number, top: number, label: string) => `<rect class="i" x="${r1(x)}" y="${r1(top)}" width="${BOX}" height="22" rx="3"/><text x="${r1(x + BOX / 2)}" y="${r1(top + 14.5)}" text-anchor="middle">${xml(label)}</text>`;
  const arrow = (x0: number, y0: number, x1: number, y1: number) => {
    const ang = Math.atan2(y1 - y0, x1 - x0), hx = x1 - 6 * Math.cos(ang), hy = y1 - 6 * Math.sin(ang);
    return `<line class="a" x1="${r1(x0)}" y1="${r1(y0)}" x2="${r1(hx)}" y2="${r1(hy)}"/>`
      + `<path class="h" d="M${r1(x1)},${r1(y1)} L${r1(hx - 3.2 * Math.sin(ang))},${r1(hy + 3.2 * Math.cos(ang))} L${r1(hx + 3.2 * Math.sin(ang))},${r1(hy - 3.2 * Math.cos(ang))} Z"/>`;
  };
  for (const c of shown) {
    const label = clip(c.name || 'Unnamed', 14);
    if (c.mode === 'single') {
      parts.push(box(X_ITEMS, y, clip(byId.get(c.items[0])?.column ?? '', 7)));
      parts.push(`<text class="n" x="${PAD}" y="${r1(y + 14.5)}">${xml(label)}</text><text class="q" x="${X_ITEMS - 8}" y="${r1(y + 14.5)}" text-anchor="end">single</text>`);
      y += 34;
      continue;
    }
    // The items sit below the level of the oval and every arrow ends on the top of its box, so no arrow crosses a box.
    const cy = y + 15, top = y + 36;
    parts.push(`<ellipse class="c${c.mode === 'formative' ? ' f' : ''}" cx="60" cy="${r1(cy)}" rx="50" ry="15"/><text class="n" x="60" y="${r1(cy + 4)}" text-anchor="middle">${xml(label)}</text>`);
    if (c.alpha !== null) parts.push(`<text class="q" x="60" y="${r1(cy + 28)}" text-anchor="middle">${xml(`α ${a2(c.alpha)}`)}</text>`);
    const many = c.items.length > MAX_BOXES;
    const labels = (many ? c.items.slice(0, MAX_BOXES - 1) : c.items).map((id) => clip(byId.get(id)?.column ?? '', 7));
    if (many) labels.push(`+${c.items.length - (MAX_BOXES - 1)}`);
    labels.forEach((text, k) => {
      const bx = X_ITEMS + k * (BOX + GAP), tx = bx + BOX / 2;
      parts.push(box(bx, top, text));
      // Each arrow leaves the oval at its own height, so the fan stays readable.
      const sy = cy + 6 - (12 * k) / Math.max(1, labels.length - 1); // nearest box from the lowest point: no two arrows cross
      parts.push(c.mode === 'formative' ? arrow(tx, top, 109, sy) : arrow(109, sy, tx, top - 1));
    });
    y += 68;
  }
  if (d.constructs.length > MAX_SHOWN) { parts.push(`<text class="q" x="${PAD}" y="${r1(y + 6)}">${xml(`and ${d.constructs.length - MAX_SHOWN} more constructs`)}</text>`); y += 16; }
  const H = Math.round(y + PAD - 6);
  return `<svg xmlns="http://www.w3.org/2000/svg" class="msf" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${FIG_STYLE}${parts.join('')}</svg>`;
}

// ── Project ───────────────────────────────────────────────────────────────

/**
 * One input row per construct, owned by the copy (`inclusion`). A refresh rewrites the rows in place, keeping their ids
 * while the constructs keep their order; rows for constructs that are gone are removed.
 */
function applyToProject(doc: ProjectDoc, d: MeasurementData, inclusionId: string): void {
  const inputs = doc.passport.inputs;
  const owned = inputs.filter((r) => r.inclusion === inclusionId);
  const at = owned.length ? inputs.indexOf(owned[0]) : inputs.length;
  const byId = new Map(d.items.map((it) => [it.id, it]));
  const rows: InputRow[] = d.constructs.map((c, k) => ({
    id: owned[k]?.id ?? newId('in'), name: c.name, value: constructLine(d, c), unit: '',
    sourceType: d.origin === 'example' ? 'synthetic' : 'observed', provenance: d.source,
    uncertainty: `Measured by ${c.items.map((id) => byId.get(id)?.column ?? id).join(', ')}`.slice(0, 2000),
    availability: 'have', inclusion: inclusionId,
  }));
  doc.passport.inputs = [...inputs.slice(0, at).filter((r) => r.inclusion !== inclusionId), ...rows, ...inputs.slice(at).filter((r) => r.inclusion !== inclusionId)];
}

export const measurementData: KindDef<'measurement-data'> = {
  kind: 'measurement-data', label: 'Measurement data', toolPath: '/toolbox/data', step: 'inputs', many: true, ownsRows: true,
  empty, sanitize, isEmpty: (d) => sameData(d, empty()), summary, markdown, figure, applyToProject,
};
