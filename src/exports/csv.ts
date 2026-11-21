/**
 * A text cell for CSV files written by the app: a cell that a spreadsheet would read as a formula gets a leading
 * apostrophe, and the cell is quoted when it holds a comma, a quote or a line break. Numbers are written as they are.
 * (The backlog sandbox's results table, the only CSV of earlier versions, was retired with the sandbox.)
 */
export function csvText(s: string): string {
  let t = s;
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  if (/[",\n\r]/.test(t)) t = `"${t.replace(/"/g, '""')}"`;
  return t;
}
