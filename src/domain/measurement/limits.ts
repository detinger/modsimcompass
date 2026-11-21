import type { Cell } from './stats';

/** Limits of a measurement data artefact, enforced by its sanitizer and by the tool. */
export const MAX_ITEMS = 500;
export const MAX_CONSTRUCTS = 200;
/** Raw rows kept with an artefact: at most this many cases, and at most this many cells in all. */
export const MAX_KEPT_ROWS = 10_000;
export const MAX_KEPT_CELLS = 200_000;

/** The rows that can be kept with an artefact: all of them, or the first ones that fit the limits. */
export function keptRows(rows: readonly Cell[][], items: number): Cell[][] {
  const max = Math.min(MAX_KEPT_ROWS, items > 0 ? Math.floor(MAX_KEPT_CELLS / items) : MAX_KEPT_ROWS);
  return rows.slice(0, max).map((r) => r.slice(0, items));
}
