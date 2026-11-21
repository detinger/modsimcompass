/**
 * Reads a delimited text file (CSV) into columns of numbers, entirely in the browser.
 *
 * - Separator: comma, semicolon or tab, guessed from the first lines; or none (one value per line).
 * - Quoted cells follow the usual rules: "a ""quoted"" word", separators and line breaks inside quotes.
 * - A byte-order mark is ignored; `\r\n`, `\n` and `\r` line endings may be mixed; blank lines are skipped and counted.
 * - The first row is taken as a header when it holds no numbers.
 * - Decimal commas: a column whose cells look like `12,5` and never use a decimal point is read with decimal commas.
 * - Nothing is dropped silently: per column the blank cells and the cells that are not numbers are counted,
 *   with the first few shown together with their line in the file. Short and long rows are counted too.
 */
export const CSV_MAX_BYTES = 5 * 1024 * 1024;
export const CSV_MAX_COLUMNS = 200;
/** A column is offered for fitting when it has at least this many numbers and they are at least half of its filled cells. */
export const CSV_MIN_NUMBERS = 3;

export type CsvSeparator = ',' | ';' | '\t' | 'none';
export const SEPARATOR_NAME: Record<CsvSeparator, string> = { ',': 'comma', ';': 'semicolon', '\t': 'tab', none: 'none (one column)' };

export interface CsvRejected { /** Line in the file, counted from 1. */ line: number; text: string }
export interface CsvColumn {
  index: number; name: string;
  /** The numbers, in file order. */
  values: number[];
  blank: number;
  /** Cells that hold something that is not a number. */
  rejected: number;
  rejectedSamples: CsvRejected[];
  decimalComma: boolean;
  offered: boolean;
}
export interface CsvTable {
  separator: CsvSeparator; separatorGuessed: boolean;
  header: boolean; headerGuessed: boolean;
  /** Data rows: without the header and without blank lines. */
  rows: number;
  blankLines: number;
  /** Rows with fewer or more cells than the first row. */
  raggedRows: number;
  /** Line where a quotation mark opens and never closes, or null. */
  unclosedQuoteLine: number | null;
  columns: CsvColumn[];
  /** The first data rows as text, for a preview. */
  preview: string[][];
}
export type CsvResult = { ok: true; table: CsvTable } | { ok: false; error: string };

interface Row { cells: string[]; line: number }

/** Splits the text into rows of cells. A cell that was not quoted is trimmed. */
function readRows(text: string, sep: CsvSeparator): { rows: Row[]; blankLines: number; unclosed: number | null } {
  const rows: Row[] = [];
  const n = text.length;
  let blankLines = 0, unclosed: number | null = null;
  let cells: string[] = [], cell = '', wasQuoted = false, rowQuoted = false, inQuotes = false;
  let line = 1, startLine = 1, quoteLine = 0, segmentStart = 0, i = 0;
  // Unquoted runs are copied in one piece; `segmentStart` marks where the current run began.
  const take = (end: number) => { if (end > segmentStart) cell += text.slice(segmentStart, end); };
  const endCell = () => { cells.push(wasQuoted ? cell : cell.trim()); cell = ''; wasQuoted = false; };
  const endRow = () => {
    endCell();
    if (cells.length === 1 && cells[0] === '' && !rowQuoted) blankLines++; else rows.push({ cells, line: startLine });
    cells = []; rowQuoted = false;
  };
  while (i < n) {
    const c = text.charCodeAt(i);
    if (inQuotes) {
      if (c === 34 /* " */) {
        take(i);
        if (text.charCodeAt(i + 1) === 34) { cell += '"'; i += 2; segmentStart = i; continue; }
        inQuotes = false; i++; segmentStart = i; continue;
      }
      if (c === 13 /* \r */) { take(i); cell += '\n'; if (text.charCodeAt(i + 1) === 10) i++; line++; i++; segmentStart = i; continue; }
      if (c === 10) line++;
      i++; continue;
    }
    if (c === 34 && sep !== 'none' && !wasQuoted && text.slice(segmentStart, i).trim() === '' && cell === '') {
      inQuotes = true; wasQuoted = true; rowQuoted = true; quoteLine = line; i++; segmentStart = i; continue;
    }
    if (sep !== 'none' && c === sep.charCodeAt(0)) { take(i); endCell(); i++; segmentStart = i; continue; }
    if (c === 13 || c === 10) {
      take(i);
      if (c === 13 && text.charCodeAt(i + 1) === 10) i++;
      endRow(); line++; startLine = line; i++; segmentStart = i; continue;
    }
    i++;
  }
  take(n);
  if (inQuotes) unclosed = quoteLine;
  if (cell !== '' || cells.length > 0 || wasQuoted) endRow();
  return { rows, blankLines, unclosed };
}

/** How often `sep` occurs in a line, outside quotes. */
function countOutsideQuotes(lineText: string, sep: string): number {
  let count = 0, quoted = false;
  for (let i = 0; i < lineText.length; i++) {
    const ch = lineText[i];
    if (ch === '"') quoted = !quoted; else if (ch === sep && !quoted) count++;
  }
  return count;
}

const ONE_DECIMAL_COMMA = /^\s*"?[-+\u2212]?\d+,\d+"?\s*$/;

/** The separator the first lines agree on most. A tie goes to tab, then semicolon, then comma. */
export function guessSeparator(text: string): CsvSeparator {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '').slice(0, 40);
  if (!lines.length) return 'none';
  let best: CsvSeparator = 'none', bestScore = 0;
  for (const sep of ['\t', ';', ','] as const) {
    const counts = lines.map((l) => countOutsideQuotes(l, sep)).filter((c) => c > 0);
    if (!counts.length) continue;
    const tally = new Map<number, number>();
    for (const c of counts) tally.set(c, (tally.get(c) ?? 0) + 1);
    const score = Math.max(...tally.values());
    if (score > bestScore) { best = sep; bestScore = score; }
  }
  // One column of decimal commas (“12,5” on every line) is not two columns of whole numbers.
  if (best === ',') {
    const body = ONE_DECIMAL_COMMA.test(lines[0]) || countOutsideQuotes(lines[0], ',') > 0 ? lines : lines.slice(1);
    if (body.length > 0 && body.every((l) => ONE_DECIMAL_COMMA.test(l))) return 'none';
  }
  return best;
}

const PLAIN_NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
const COMMA_NUMBER = /^[-+]?\d+,\d+(?:[eE][-+]?\d+)?$/;
const GROUPED = /^[-+]?\d{1,3}(?:[ \u00a0\u202f\u2009]\d{3})+(?:[.,]\d+)?$/;

/** A cell as it will be read: trimmed, a typographic minus made plain, digit-group spaces removed. */
function tidy(cell: string, sep: CsvSeparator): string {
  let t = cell.trim();
  if (sep === 'none' && t.length >= 2 && t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1).replace(/""/g, '"').trim();
  t = t.replace(/^\u2212/, '-');
  if (GROUPED.test(t)) t = t.replace(/[ \u00a0\u202f\u2009]/g, '');
  return t;
}

const looksNumeric = (t: string): boolean => PLAIN_NUMBER.test(t) || COMMA_NUMBER.test(t);

function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const k = (seen.get(name) ?? 0) + 1;
    seen.set(name, k);
    return k === 1 ? name : `${name} (${k})`;
  });
}

/**
 * `separator` and `header` override what would otherwise be guessed.
 * The result lists every column; `offered` marks the ones with enough numbers to model.
 */
export function parseCsv(source: string, opts: { separator?: CsvSeparator; header?: boolean } = {}): CsvResult {
  if (typeof source !== 'string') return { ok: false, error: 'The file could not be read as text.' };
  if (source.length > CSV_MAX_BYTES) return { ok: false, error: 'The file is larger than 5 MB.' };
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  if (text.includes('\u0000')) return { ok: false, error: 'This does not look like a text file. Save the data as CSV and try again.' };
  if (text.trim() === '') return { ok: false, error: 'The file is empty.' };

  const separator = opts.separator ?? guessSeparator(text);
  const { rows: all, blankLines, unclosed } = readRows(text, separator);
  if (!all.length) return { ok: false, error: 'The file is empty.' };
  const width = all.reduce((w, r) => Math.max(w, r.cells.length), 0);
  if (width > CSV_MAX_COLUMNS) return { ok: false, error: `The file has more than ${CSV_MAX_COLUMNS} columns. Is the separator right?` };

  const first = all[0].cells.map((c) => tidy(c, separator));
  const guessedHeader = first.some((c) => c !== '') && !first.some(looksNumeric);
  const header = opts.header ?? guessedHeader;
  const body = header ? all.slice(1) : all;
  const expected = all[0].cells.length;
  const raggedRows = body.filter((r) => r.cells.length !== expected).length;

  const names = uniqueNames(Array.from({ length: width }, (_, i) => {
    const given = header ? (all[0].cells[i] ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) : '';
    return given || `Column ${i + 1}`;
  }));

  const columns: CsvColumn[] = names.map((name, index) => {
    const cells = body.map((r) => tidy(r.cells[index] ?? '', separator));
    const usesComma = cells.some((t) => COMMA_NUMBER.test(t));
    const usesPoint = cells.some((t) => t.includes('.') && PLAIN_NUMBER.test(t));
    const decimalComma = usesComma && !usesPoint;
    const values: number[] = [], rejectedSamples: CsvRejected[] = [];
    let blank = 0, rejected = 0;
    cells.forEach((t, k) => {
      if (t === '') { blank++; return; }
      const v = PLAIN_NUMBER.test(t) ? Number(t) : decimalComma && COMMA_NUMBER.test(t) ? Number(t.replace(',', '.')) : NaN;
      if (Number.isFinite(v)) { values.push(v); return; }
      rejected++;
      if (rejectedSamples.length < 5) rejectedSamples.push({ line: body[k].line, text: t.replace(/\s+/g, ' ').slice(0, 40) });
    });
    return { index, name, values, blank, rejected, rejectedSamples, decimalComma, offered: values.length >= CSV_MIN_NUMBERS && values.length >= rejected };
  });

  return {
    ok: true,
    table: {
      separator, separatorGuessed: opts.separator === undefined, header, headerGuessed: opts.header === undefined,
      rows: body.length, blankLines, raggedRows, unclosedQuoteLine: unclosed, columns,
      preview: body.slice(0, 5).map((r) => Array.from({ length: width }, (_, i) => (r.cells[i] ?? '').replace(/\s+/g, ' ').slice(0, 40))),
    },
  };
}
