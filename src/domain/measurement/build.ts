import type { ConstructMode, MeasuredConstruct, MeasuredItem, MeasurementData } from '../artefacts/types';
import { MAX_ITEMS } from './limits';
import {
  column, completeRows, cronbachAlpha, detectScale, groupByPrefix, isCaseNumber, itemSummary, itemTotal, reverseCode, straightLiners,
  type Cell, type ItemTotal, type Scale,
} from './stats';

/**
 * From a table of survey answers to measurement data, and the edits the tool makes to it. Pure: every function
 * returns new data or mutates a draft it is given. `rows` are always in the order of `d.items` (one value per item),
 * as typed or imported, before any reverse coding.
 */
export interface Survey { columns: string[]; labels?: string[]; rows: Cell[][] }

const ID = /[^A-Za-z0-9_-]+/g;
/** A valid, unique id for an item or construct, made from its name. */
export function idFrom(name: string, used: Set<string>, prefix: string): string {
  let base = name.replace(ID, '-').replace(/^[-_]+|[-_]+$/g, '').slice(0, 48) || prefix;
  if (!/^[A-Za-z0-9]/.test(base)) base = `${prefix}-${base}`;
  let id = base, k = 2;
  while (used.has(id)) id = `${base}-${k++}`;
  used.add(id);
  return id;
}

// ── Construct names ─────────────────────────────────────────────────────

const nameKey = (name: string) => name.trim().toLowerCase();
/** A name not yet in `taken` (compared without case): `name`, else `name 2`, `name 3`, … An empty name counts as “Construct”. */
export function uniqueName(name: string, taken: readonly string[]): string {
  const keys = new Set(taken.map(nameKey));
  if (!keys.has(nameKey(name))) return name;
  const base = name.trim() || 'Construct';
  let k = 2;
  while (keys.has(nameKey(`${base} ${k}`))) k++;
  return `${base} ${k}`;
}
/** True when another construct already has this name (compared without case). Each construct is one project row, named after it. */
export const nameTaken = (d: Pick<MeasurementData, 'constructs'>, id: string, name: string): boolean =>
  d.constructs.some((c) => c.id !== id && nameKey(c.name) === nameKey(name));

/** Columns that hold measured values: numeric, and not a case number such as 1, 2, 3, … */
export function itemColumns(survey: Survey): number[] {
  return survey.columns.map((_, j) => j).filter((j) => {
    const col = column(survey.rows, j);
    const numbers = col.filter((v) => v !== null).length;
    return numbers >= 3 && !isCaseNumber(col);
  });
}

/** The answers of the items, reverse-coded where marked. Without a scale nothing can be recoded. */
export function recoded(d: Pick<MeasurementData, 'items' | 'scale'>, rows: readonly Cell[][]): Cell[][] {
  const flip = d.items.map((it) => it.reverse && !!d.scale);
  return rows.map((r) => d.items.map((_, j) => { const v = r[j] ?? null; return v !== null && flip[j] ? reverseCode(v, d.scale as Scale) : v; }));
}

const itemIndex = (d: Pick<MeasurementData, 'items'>) => new Map(d.items.map((it, j) => [it.id, j]));

/** Recomputes the summaries, the alphas and the number of cases from the rows. */
export function refreshStats(d: MeasurementData, rows: readonly Cell[][]): void {
  const data = recoded(d, rows);
  d.cases = rows.length;
  d.items.forEach((it, j) => { it.summary = itemSummary(column(data, j)); });
  const at = itemIndex(d);
  for (const c of d.constructs) {
    const cols = c.items.map((id) => at.get(id)).filter((j): j is number => j !== undefined);
    c.alpha = c.mode === 'reflective' && cols.length >= 2 ? cronbachAlpha(completeRows(data, cols)) : null;
  }
}

/**
 * Measurement data from a survey: items from the measured columns (the first `MAX_ITEMS` of them; `dropped` says how
 * many more there were), constructs from the column names, statistics from the rows.
 */
export function buildFromSurvey(survey: Survey, opts: { source: string; origin: MeasurementData['origin']; reverse?: readonly string[] }): { data: MeasurementData; rows: Cell[][]; dropped: number } {
  const all = itemColumns(survey);
  const cols = all.slice(0, MAX_ITEMS);
  const used = new Set<string>(), usedC = new Set<string>();
  const items: MeasuredItem[] = cols.map((j) => ({
    id: idFrom(survey.columns[j], used, 'item'), column: survey.columns[j], label: survey.labels?.[j] ?? '',
    reverse: !!opts.reverse?.includes(survey.columns[j]), summary: null,
  }));
  const rows = survey.rows.map((r) => cols.map((j) => r[j] ?? null));
  const names: string[] = [];
  const constructs: MeasuredConstruct[] = groupByPrefix(items.map((it) => it.column)).map((g) => {
    const name = uniqueName(g.name, names);
    names.push(name);
    return { id: idFrom(g.name, usedC, 'construct'), name, mode: g.columns.length > 1 ? 'reflective' : 'single', items: g.columns.map((k) => items[k].id), alpha: null };
  });
  const data: MeasurementData = {
    source: opts.source, origin: opts.origin, cases: rows.length, scale: detectScale(items.map((_, k) => column(rows, k))), missing: 'undecided',
    items, constructs, maxArrows: null, note: '', keepData: false, data: [],
  };
  if (!rows.some((r) => r.some((v) => v === null))) data.missing = 'none';
  refreshStats(data, rows);
  return { data, rows, dropped: all.length - cols.length };
}

// ── Edits (the tool calls these inside `setData`) ───────────────────────

/** Recomputes when the rows are on screen. Without them, what cannot be recomputed is cleared rather than left wrong. */
function after(d: MeasurementData, rows: readonly Cell[][] | null, touched: readonly MeasuredConstruct[]): void {
  if (rows) { refreshStats(d, rows); return; }
  for (const c of touched) c.alpha = null;
}

/** Renames a construct. A name another construct already has is refused (false): each construct is one named project row. */
export function renameConstruct(d: MeasurementData, id: string, name: string): boolean {
  const c = d.constructs.find((x) => x.id === id);
  const next = name.slice(0, 200);
  if (!c || nameTaken(d, id, next)) return false;
  c.name = next;
  return true;
}

/** A construct with one item can only be `single`; one with more items is reflective or formative. */
export const modesFor = (c: Pick<MeasuredConstruct, 'items'>): ConstructMode[] => (c.items.length > 1 ? ['reflective', 'formative'] : ['single']);

export function setMode(d: MeasurementData, id: string, mode: ConstructMode, rows: readonly Cell[][] | null): void {
  const c = d.constructs.find((x) => x.id === id);
  if (!c || !modesFor(c).includes(mode)) return;
  c.mode = mode;
  after(d, rows, [c]);
}

/** Moves an item to another construct, or to a new one (`to` null). Empty constructs disappear; modes follow the item counts. */
export function moveItem(d: MeasurementData, itemId: string, to: string | null, rows: readonly Cell[][] | null): void {
  const from = d.constructs.find((c) => c.items.includes(itemId));
  if (!from || from.id === to) return;
  let target = to ? d.constructs.find((c) => c.id === to) : undefined;
  if (to && !target) return;
  from.items = from.items.filter((x) => x !== itemId);
  if (!target) {
    const item = d.items.find((it) => it.id === itemId)!;
    target = { id: idFrom(`${item.column}-c`, new Set(d.constructs.map((c) => c.id)), 'construct'), name: uniqueName(item.column, d.constructs.map((c) => c.name)), mode: 'single', items: [], alpha: null };
    d.constructs.splice(d.constructs.indexOf(from) + 1, 0, target);
  }
  target.items.push(itemId);
  for (const c of [from, target]) {
    if (c.items.length <= 1) c.mode = 'single';
    else if (c.mode === 'single') c.mode = 'reflective';
  }
  d.constructs = d.constructs.filter((c) => c.items.length > 0);
  after(d, rows, [from, target]);
}

/**
 * Marks an item as reverse-coded or not. With the rows on screen everything is recomputed; without them the item's
 * summary is turned round on the scale (mean and extremes mirrored, skew reversed) and its construct's alpha cleared.
 */
export function setReverse(d: MeasurementData, itemId: string, on: boolean, rows: readonly Cell[][] | null): void {
  const it = d.items.find((x) => x.id === itemId);
  if (!it || !d.scale || it.reverse === on) return;
  it.reverse = on;
  if (!rows && it.summary) {
    const s = it.summary, sc = d.scale;
    it.summary = { ...s, mean: reverseCode(s.mean, sc), min: reverseCode(s.max, sc), max: reverseCode(s.min, sc), skew: s.skew === null ? null : -s.skew };
  }
  after(d, rows, d.constructs.filter((c) => c.items.includes(itemId)));
}

/**
 * The answers as given, per item: the summaries hold reverse-coded values, so a reversed item's range is turned back.
 * Null when no item has a summary.
 */
function rawRange(d: MeasurementData): { min: number; max: number } | null {
  let min = Infinity, max = -Infinity;
  for (const it of d.items) {
    const s = it.summary;
    if (!s) continue;
    const [lo, hi] = it.reverse && d.scale ? [d.scale.min + d.scale.max - s.max, d.scale.min + d.scale.max - s.min] : [s.min, s.max];
    min = Math.min(min, lo); max = Math.max(max, hi);
  }
  return Number.isFinite(min) ? { min, max } : null;
}

/**
 * Sets the answer scale the items were asked on (1–7, say). It must hold every answer given, and it is what reverse
 * coding, ranges and bars use. Returns a short reason when the scale is refused, or null when it was set.
 * Without the rows, a reversed item's summary moves with the scale's ends; its spread and the alphas do not change.
 */
export function setScale(d: MeasurementData, scale: { min: number; max: number } | null, rows: readonly Cell[][] | null): string | null {
  if (scale === null) {
    if (d.items.some((it) => it.reverse)) return 'Reverse-coded items need a scale.';
    d.scale = null;
    if (rows) refreshStats(d, rows);
    return null;
  }
  const { min, max } = scale;
  if (!Number.isInteger(min) || !Number.isInteger(max)) return 'Use whole numbers.';
  if (max - min < 1 || max - min > 100) return 'The highest point must be above the lowest, within 100 points.';
  const seen = rows ? rawRangeOf(rows) : rawRange(d);
  if (seen && (seen.min < min || seen.max > max)) return `The answers run from ${seen.min} to ${seen.max}; the scale must include them.`;
  const old = d.scale;
  d.scale = { min, max };
  if (rows) { refreshStats(d, rows); return null; }
  if (old) {
    const shift = min + max - (old.min + old.max);
    for (const it of d.items) if (it.reverse && it.summary) it.summary = { ...it.summary, mean: it.summary.mean + shift, min: it.summary.min + shift, max: it.summary.max + shift };
  }
  return null;
}
function rawRangeOf(rows: readonly Cell[][]): { min: number; max: number } | null {
  let min = Infinity, max = -Infinity;
  for (const r of rows) for (const v of r) if (v !== null && Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; }
  return Number.isFinite(min) ? { min, max } : null;
}

export function setLabel(d: MeasurementData, itemId: string, label: string): void {
  const it = d.items.find((x) => x.id === itemId);
  if (it) it.label = label.slice(0, 500);
}

// ── The screens ─────────────────────────────────────────────────────────

export interface ConstructScreen {
  construct: MeasuredConstruct;
  /** Complete cases used for alpha. */
  n: number;
  alpha: number | null;
  items: (ItemTotal & { item: MeasuredItem })[];
}

/** Alpha and item–total correlations per construct, from the rows (after reverse coding). Formative and single constructs get none. */
export function reliabilityScreen(d: MeasurementData, rows: readonly Cell[][]): ConstructScreen[] {
  const data = recoded(d, rows), at = itemIndex(d);
  return d.constructs.map((c) => {
    const cols = c.items.map((id) => at.get(id)).filter((j): j is number => j !== undefined);
    const matrix = completeRows(data, cols);
    const reflective = c.mode === 'reflective' && cols.length >= 2;
    const totals = reflective ? itemTotal(matrix) : cols.map(() => ({ r: null, alphaIfDeleted: null }));
    return { construct: c, n: matrix.length, alpha: reflective ? cronbachAlpha(matrix) : null, items: cols.map((j, k) => ({ ...totals[k], item: d.items[j] })) };
  });
}

/** Cases that answered every item the same, over all items. */
export const straightLining = (d: MeasurementData, rows: readonly Cell[][]): number => straightLiners(rows, d.items.map((_, j) => j));
