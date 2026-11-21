import { CHECK_GROUP_LABELS, CHECK_GROUPS, CHECK_STATUS_LABELS, checkPlan } from '../../../domain/artefacts/checkPlan';
import type { CheckPlan } from '../../../domain/artefacts/types';
import { mdLine } from '../../../exports/mdText';

/**
 * The tool's own exports as text (docs/LEARN-TOOLBOX-PLAN.md §5.4). Pure functions; the page hands the result to
 * `downloadFile`. The validation plot is in `plot.ts`.
 */

/**
 * One text cell of a CSV file. A cell that a spreadsheet would read as a formula (it starts with `=`, `+`, `-`
 * or `@`, also after spaces, or with a tab or a line break) gets a leading apostrophe, so it is shown as text.
 * Every text cell is quoted, with quotes doubled, so commas and line breaks stay inside the cell.
 */
export function csvCell(s: string): string {
  const t = /^[\s]*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s) ? `'${s}` : s;
  return `"${t.replace(/"/g, '""')}"`;
}

/** Check plan as CSV: one row per check, in the order of the plan. Columns: group, check, status, evidence. */
export function checkPlanCsv(d: CheckPlan): string {
  const lines = ['group,check,status,evidence'];
  for (const g of CHECK_GROUPS) {
    for (const c of d.checks) {
      if (c.group !== g || !c.text.trim()) continue;
      lines.push([csvCell(CHECK_GROUP_LABELS[g]), csvCell(c.text.trim()), csvCell(CHECK_STATUS_LABELS[c.status]), csvCell(c.evidence.trim())].join(','));
    }
  }
  return `${lines.join('\r\n')}\r\n`;
}

/** Check plan as a Markdown file: the artefact's name as the heading, then the same section the project report shows. */
export function checkPlanMarkdownFile(title: string, d: CheckPlan, exportedAt: string): string {
  const name = mdLine(title).replace(/^#+\s*/, '') || 'Check plan';
  return [`# ${name}`, '', `Check plan: verification, validation and calibration. Exported ${exportedAt.slice(0, 10)}.`, '', ...checkPlan.markdown(d)].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
