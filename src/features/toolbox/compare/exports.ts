import { analyse, comparison, differenceSvg, EXAMPLE_CAPTION, isPaired, policiesSvg, policyNames } from '../../../domain/artefacts/comparison';
import type { Comparison } from '../../../domain/artefacts/types';
import { headingText, htmlReport } from '../data/report';

/**
 * The exports of Fair comparison (docs/LEARN-TOOLBOX-PLAN.md §5.5) as text. Pure: the page hands the result to
 * `downloadFile`. The numbers and the pictures come from `comparison.ts`, so the files say what the page says.
 */

/**
 * One text cell of a CSV file: quoted, quotes doubled. A cell a spreadsheet would read as a formula
 * (it starts with `=`, `+`, `-` or `@`, also after spaces) gets a leading apostrophe.
 */
export function csvCell(s: string): string {
  const t = /^\s*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s) ? `'${s}` : s;
  return `"${t.replace(/"/g, '""')}"`;
}

/**
 * One row per replication, after a first line that marks the example as such. Paired results add the difference (alternative − baseline) of each row.
 * Results that are not paired have no row-by-row difference; a shorter list leaves its cells empty.
 */
export function differencesCsv(d: Comparison): string {
  const names = policyNames(d);
  const paired = isPaired(d);
  const head = ['replication', csvCell(names.baseline), csvCell(names.alternative), ...(paired ? [csvCell('difference (alternative - baseline)')] : [])];
  const n = Math.max(d.baseline.length, d.alternative.length);
  // The example says so on its first line, so a saved copy cannot pass for real results.
  const rows = [...(d.origin === 'example' ? [csvCell(`# ${EXAMPLE_CAPTION}`)] : []), head.join(',')];
  for (let i = 0; i < n; i++) {
    const b = d.baseline[i], a = d.alternative[i];
    rows.push([String(i + 1), b === undefined ? '' : String(b), a === undefined ? '' : String(a), ...(paired ? [String(Number((a - b).toPrecision(12)))] : [])].join(','));
  }
  return `${rows.join('\r\n')}\r\n`;
}

/** The comparison summary as Markdown: the artefact's report section under its name. */
export function summaryMarkdown(title: string, d: Comparison, exportedAt: string): string {
  const name = headingText(title, 'Comparison');
  const kind = isPaired(d) ? 'paired: both policies faced the same random inputs in each replication' : 'not paired';
  const L = [`# ${name}`, '', `Comparison of two policies from replication results, ${kind}. Exported ${exportedAt.slice(0, 10)}.`, ''];
  if (d.origin === 'example') L.push('> Example data, not results of a project.', '');
  L.push(...comparison.markdown(d));
  return `${L.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

export function summaryHtml(title: string, d: Comparison, exportedAt: string): string {
  const name = headingText(title, 'Comparison');
  const an = analyse(d);
  const figures = [
    { svg: differenceSvg(d), label: an.difference.kind === 'paired' ? 'The paired differences, one dot per replication, with the 95% interval' : 'The difference between the policies with its 95% Welch interval' },
    { svg: policiesSvg(d), label: 'Each policy: mean, 95% interval for the mean, and 5th to 95th percentile of the replications' },
  ];
  return htmlReport({ title: `${name} — comparison`, kicker: d.origin === 'example' ? 'Comparison · example data' : 'Comparison', md: summaryMarkdown(title, d, exportedAt), figures, generatedAt: exportedAt });
}

/** The picture as an SVG file: the dot plot for paired results, the two policies otherwise. Null without results for both. */
export function plotSvg(d: Comparison): string | null {
  const svg = comparison.figure(d);
  return svg ? `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n` : null;
}
