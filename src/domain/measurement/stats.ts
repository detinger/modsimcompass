import type { ItemSummary } from '../artefacts/types';

/**
 * Statistics for measured variables and survey items. Pure functions, no DOM. They describe the data and screen it;
 * none of them tests a hypothesis, and none gives a p-value.
 *
 * A cell is a number or null (missing). A table is rows of cells: one row per case, one column per item.
 */
export type Cell = number | null;
export interface Scale { min: number; max: number }

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
/** Sample variance (n − 1). NaN for fewer than two values. */
export function variance(xs: readonly number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
}

/** A reverse-coded answer recoded on its scale: on 1–7, a 7 becomes a 1 and a 2 becomes a 6. */
export const reverseCode = (x: number, scale: Scale): number => scale.min + scale.max - x;

/**
 * Sample skewness, adjusted (the common spreadsheet SKEW): n / ((n − 1)(n − 2)) · Σ ((x − mean) / s)³, with s the
 * sample standard deviation. Null with fewer than three values or no spread.
 */
export function skewness(xs: readonly number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const m = mean(xs), s = Math.sqrt(variance(xs));
  if (!(s > 0)) return null;
  return (n / ((n - 1) * (n - 2))) * xs.reduce((acc, x) => acc + ((x - m) / s) ** 3, 0);
}

/** n, missing, mean, standard deviation (n − 1), minimum, maximum and skewness of one item. Null when it has no values. */
export function itemSummary(values: readonly Cell[]): ItemSummary | null {
  const xs = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (!xs.length) return null;
  let min = Infinity, max = -Infinity;
  for (const x of xs) { if (x < min) min = x; if (x > max) max = x; }
  return { n: xs.length, missing: values.length - xs.length, mean: mean(xs), sd: xs.length > 1 ? Math.sqrt(variance(xs)) : 0, min, max, skew: skewness(xs) };
}

/** How often each value of the scale was given (whole numbers only), for a small bar chart of a Likert item. */
export function valueCounts(values: readonly Cell[], scale: Scale): { value: number; count: number }[] {
  const out: { value: number; count: number }[] = [];
  for (let v = scale.min; v <= scale.max; v++) out.push({ value: v, count: 0 });
  for (const x of values) if (x !== null && Number.isInteger(x) && x >= scale.min && x <= scale.max) out[x - scale.min].count++;
  return out;
}

/** The columns of a table, each as a list of cells. */
export const column = (rows: readonly Cell[][], j: number): Cell[] => rows.map((r) => r[j] ?? null);

/** Rows in which every listed column has a value (listwise), as plain numbers in the order of `cols`. */
export function completeRows(rows: readonly Cell[][], cols: readonly number[]): number[][] {
  const out: number[][] = [];
  for (const r of rows) {
    const vals = cols.map((j) => r[j]);
    if (vals.every((v): v is number => v !== null && v !== undefined && Number.isFinite(v))) out.push(vals);
  }
  return out;
}

/**
 * Cronbach's alpha of k items over complete cases: k / (k − 1) · (1 − Σ var(item) / var(sum)), sample variances.
 * Null for fewer than two items or two cases, or when the sum does not vary.
 */
export function cronbachAlpha(matrix: readonly number[][]): number | null {
  const k = matrix[0]?.length ?? 0;
  if (k < 2 || matrix.length < 2) return null;
  const itemVar = Array.from({ length: k }, (_, j) => variance(matrix.map((r) => r[j])));
  const totalVar = variance(matrix.map((r) => r.reduce((s, x) => s + x, 0)));
  if (!(totalVar > 0)) return null;
  return (k / (k - 1)) * (1 - itemVar.reduce((s, v) => s + v, 0) / totalVar);
}

/** Pearson correlation; null with fewer than three pairs or no spread in either variable. */
export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = mean(xs.slice(0, n)), my = mean(ys.slice(0, n));
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

export interface ItemTotal {
  /** Corrected item–total correlation: the item against the sum of the other items. */
  r: number | null;
  /** Alpha of the construct without this item. */
  alphaIfDeleted: number | null;
}

/** For each item of a construct: its corrected item–total correlation and the alpha without it. Complete cases only. */
export function itemTotal(matrix: readonly number[][]): ItemTotal[] {
  const k = matrix[0]?.length ?? 0;
  return Array.from({ length: k }, (_, j) => {
    const rest = matrix.map((r) => r.filter((_, i) => i !== j));
    return {
      r: k >= 2 ? pearson(matrix.map((r) => r[j]), rest.map((r) => r.reduce((s, x) => s + x, 0))) : null,
      alphaIfDeleted: k >= 3 ? cronbachAlpha(rest) : null,
    };
  });
}

/**
 * Cases that gave the same answer to every item they answered (straight-lining), counted over the listed columns.
 * Only cases that answered at least `minItems` of them are judged.
 */
export function straightLiners(rows: readonly Cell[][], cols: readonly number[], minItems = 3): number {
  let n = 0;
  for (const r of rows) {
    const vals = cols.map((j) => r[j]).filter((v): v is number => v !== null && v !== undefined);
    if (vals.length >= minItems && vals.every((v) => v === vals[0])) n++;
  }
  return n;
}

/**
 * The common answer scale of the items: whole numbers only, from 2 to 11 points (a 1–5 or 0–10 scale, say).
 * Null when the values are not all whole numbers or span a wider range.
 */
export function detectScale(columns: readonly Cell[][]): Scale | null {
  let min = Infinity, max = -Infinity, any = false;
  for (const col of columns) for (const v of col) {
    if (v === null) continue;
    if (!Number.isInteger(v)) return null;
    any = true;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!any || max - min < 1 || max - min > 10) return null;
  return { min, max };
}

/**
 * The construct name in an item's column name: the trailing number and the separator before it removed (PEOU_2 → PEOU,
 * Q1_1 → Q1). Without a separator, trailing digits go (PEOU1 → PEOU).
 */
export function constructPrefix(name: string): string {
  const t = name.trim();
  const sep = /^(.+?)[\s_.-]+\d+$/.exec(t);
  if (sep) return sep[1].trim();
  const m = /^(.*?[^\d\s_.-])\d+$/.exec(t);
  return m ? m[1].trim() : t;
}

/**
 * Columns grouped into constructs by their name prefix, in the order the constructs first appear. Case is ignored
 * when grouping; a column with no number at its end stands alone.
 */
export function groupByPrefix(names: readonly string[]): { name: string; columns: number[] }[] {
  const groups: { key: string; name: string; columns: number[] }[] = [];
  names.forEach((col, j) => {
    const hasNumber = /\d$/.test(col.trim());
    const name = hasNumber ? constructPrefix(col) : col.trim();
    const key = hasNumber ? name.toLowerCase() : `\u0000${j}`;
    const g = groups.find((x) => x.key === key);
    if (g) g.columns.push(j); else groups.push({ key, name: name || col, columns: [j] });
  });
  return groups.map(({ name, columns }) => ({ name, columns }));
}

/** True for 1, 2, 3, … (whole numbers going up by one): a case number, not a measured variable. */
export const isCaseNumber = (xs: readonly Cell[]): boolean => xs.length > 1 && xs.every((v, i) => v !== null && Number.isInteger(v) && v === (xs[0] as number) + i);

/** A column that numbers the rows rather than measuring anything: 1, 2, 3, … in order, or a name such as id, case or row. */
export function looksLikeRowNumber(name: string, values: readonly Cell[]): boolean {
  const words = name.trim().toLowerCase().replace(/[_\-.#]+/g, ' ').split(/\s+/).filter(Boolean);
  const named = words.length > 0 && words.length <= 3 && words.some((w) => ['id', 'case', 'row', 'index', 'nr', 'no'].includes(w))
    && words.every((w) => ['id', 'case', 'row', 'index', 'nr', 'no', 'number', 'respondent', 'record'].includes(w));
  return named || isCaseNumber(values);
}

/** The most arrows that point into one element: the busiest construct of a structural model. */
export function maxInDegree(edges: readonly { from: string; to: string }[]): number {
  const n = new Map<string, number>();
  for (const e of edges) if (e.from !== e.to) n.set(e.to, (n.get(e.to) ?? 0) + 1);
  return Math.max(0, ...n.values());
}

/** The rough floor of ten cases for every arrow into the busiest construct. A rule of thumb, not a power analysis. */
export const tenCasesPerArrow = (maxArrows: number): number => 10 * Math.max(0, Math.round(maxArrows));
