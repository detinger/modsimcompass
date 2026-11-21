/**
 * Reading pasted numbers for the validation calculator. Pure: no DOM, no React.
 *
 * Accepted: one value per line, or values separated by spaces, tabs, semicolons, or a comma followed by a space
 * (`12, 15, 9`). A comma between digits is a decimal comma (`12,5` and `7,25` on lines of their own are 12.5 and
 * 7.25). A single line with no spaces, such as `12,5,7`, is read as values separated by commas.
 * Thousands separators are not read.
 */
export interface ParsedNumbers {
  values: number[];
  /** Entries that are not numbers, as typed (at most the first five). */
  rejected: string[];
  /** How many entries were not numbers in total. */
  rejectedCount: number;
}

export const MAX_VALUES = 10_000;

const NUMBER = /^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const signed = (s: string) => s.trim().replace(/^\+/, '').replace(/^\u2212/, '-');
const strict = (s: string) => (NUMBER.test(s) ? Number(s) : NaN);

/** One value: a leading plus or a typographic minus is accepted, and so is a decimal comma. NaN when it is not a number. */
export function parseOne(token: string): number {
  return strict(signed(token).replace(/^(-?\d*),(\d+)$/, '$1.$2'));
}

export function parseNumbers(text: string): ParsedNumbers {
  const t = text.trim();
  if (!t) return { values: [], rejected: [], rejectedCount: 0 };
  const byComma = !/[\s;]/.test(t);
  // Otherwise a comma that ends a value (a space or the end of a line follows) separates values; one between digits is a decimal comma.
  const tokens = (byComma ? t.split(',') : t.split(/,(?=\s|$)|[\s;]+/)).map((x) => x.trim()).filter(Boolean);
  const values: number[] = [], rejected: string[] = [];
  let rejectedCount = 0;
  for (const tok of tokens) {
    const n = byComma ? strict(signed(tok)) : parseOne(tok);
    if (!Number.isFinite(n)) { rejectedCount++; if (rejected.length < 5) rejected.push(tok.length > 20 ? `${tok.slice(0, 19)}…` : tok); }
    else if (values.length < MAX_VALUES) values.push(n);
  }
  return { values, rejected, rejectedCount };
}

/**
 * Two columns pasted from a spreadsheet: one pair per line, the two values separated by a tab, a semicolon, a comma
 * with or without spaces after it (`12, 11`), or spaces. A comma between digits, with spaces separating the values,
 * is a decimal comma (`12,5 11,4`). A first line that is not two numbers is taken as a header and skipped.
 */
export interface ParsedPairs { observed: number[]; simulated: number[]; /** Lines after the first that were not two numbers. */ skipped: number; header: boolean }

export function parsePairs(text: string): ParsedPairs {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const observed: number[] = [], simulated: number[] = [];
  let skipped = 0, header = false;
  lines.forEach((line, i) => {
    const cells = (line.includes('\t') ? line.split('\t') : line.includes(';') ? line.split(';') : /,\s/.test(line) ? line.split(/\s*,\s+/) : /\s/.test(line) ? line.split(/\s+/) : line.split(','))
      .map((c) => c.trim()).filter(Boolean);
    const pair = cells.length === 2 ? cells.map(parseOne) : [];
    const ok = pair.length === 2 && pair.every(Number.isFinite);
    if (ok) { if (observed.length < MAX_VALUES) { observed.push(pair[0]); simulated.push(pair[1]); } }
    else if (i === 0) header = true;
    else skipped++;
  });
  return { observed, simulated, skipped, header };
}

/** The values as they are shown in a box: one per line. */
export const valuesText = (xs: readonly number[]): string => xs.join('\n');
