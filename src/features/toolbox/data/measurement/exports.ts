import { measurementData, MODE_TEXT } from '../../../../domain/artefacts/measurementData';
import type { MeasurementData } from '../../../../domain/artefacts/types';
import { reliabilityScreen } from '../../../../domain/measurement/build';
import type { Cell } from '../../../../domain/measurement/stats';
import { csvCell } from '../../compare/exports';
import { headingText } from '../report';

/**
 * The exports of measurement data as text: the data dictionary (Markdown and CSV) and the item summaries (CSV).
 * Pure; the page hands the result to `downloadFile`. No p-values anywhere.
 */
const n = (x: number | null | undefined) => (x === null || x === undefined || !Number.isFinite(x) ? '' : String(Number(x.toPrecision(6))));

export function dictionaryMarkdown(title: string, d: MeasurementData, exportedAt: string): string {
  const L = [`# ${headingText(title, 'Measurement data')}`, '', `Data dictionary: measured variables grouped into constructs. Exported ${exportedAt.slice(0, 10)}.`, ''];
  if (d.origin === 'example') L.push('> Example data made by the app, not responses from real people.', '');
  L.push(...measurementData.markdown(d));
  return `${L.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

/** One row per item: its construct and how it is coded. */
export function dictionaryCsv(d: MeasurementData): string {
  const byId = new Map(d.items.map((it) => [it.id, it]));
  const lines = ['construct,mode,item,label,reverse_coded,scale_min,scale_max'];
  for (const c of d.constructs) for (const id of c.items) {
    const it = byId.get(id);
    if (!it) continue;
    lines.push([csvCell(c.name), csvCell(MODE_TEXT[c.mode]), csvCell(it.column), csvCell(it.label), it.reverse ? 'yes' : 'no', n(d.scale?.min), n(d.scale?.max)].join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

/** One row per item: summary after reverse coding, and with the answers on screen the item–total correlation and the alpha without it. */
export function itemSummariesCsv(d: MeasurementData, rows: Cell[][] | null): string {
  const screen = rows ? reliabilityScreen(d, rows) : null;
  const extra = new Map(screen?.flatMap((s) => s.items.map((x) => [x.item.id, x])) ?? []);
  const byId = new Map(d.items.map((it) => [it.id, it]));
  const lines = ['construct,item,n,missing,mean,sd,min,max,skew,item_total_r_corrected,alpha_without_item,construct_alpha'];
  for (const c of d.constructs) for (const id of c.items) {
    const it = byId.get(id), s = it?.summary, x = extra.get(id);
    if (!it) continue;
    lines.push([csvCell(c.name), csvCell(it.column), n(s?.n), n(s?.missing), n(s?.mean), n(s?.sd), n(s?.min), n(s?.max), n(s?.skew), n(x?.r), n(x?.alphaIfDeleted), n(c.alpha)].join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
