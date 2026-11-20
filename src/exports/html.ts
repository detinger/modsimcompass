import type { ProjectDoc } from '../domain/passport/schema';
import type { ReplicationSummary } from '../domain/sandbox/types';
import { pairedDifferences, summarise } from '../domain/sandbox/stats';
import { APP_NAME, passportMarkdown } from './markdown';
import { describeRunStatus, fmt, runIsStale } from './runInfo';

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function inline(s: string): string {
  // s is already HTML-escaped.
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, '$1<em>$2</em>');
}

/**
 * Safe renderer for the Markdown subset produced by passportMarkdown. HTML is escaped first.
 * Inside a list item, indented lines that are not sub-items continue the item on a new line
 * (multi-line learner text).
 */
export function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let i = 0;
  const isSub = (l: string) => /^ {3}- /.test(l);
  /** Consume the continuation lines of the current list item: exactly `indent` spaces, then text. */
  const continuation = (indent: number): string => {
    const pad = ' '.repeat(indent);
    let html = '';
    while (i < lines.length && lines[i].startsWith(pad) && lines[i].length > indent && lines[i][indent] !== ' ') { html += `<br>${inline(escapeHtml(lines[i].slice(indent)))}`; i++; }
    return html;
  };
  const splitRow = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
  while (i < lines.length) {
    const raw = lines[i];
    const l = escapeHtml(raw);
    if (/^#{1,3} /.test(raw)) {
      const level = raw.match(/^#+/)![0].length;
      out.push(`<h${level}>${inline(l.replace(/^#+ /, ''))}</h${level}>`);
      i++;
    } else if (raw.startsWith('|')) {
      const header = splitRow(raw);
      i += 2; // skip separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(splitRow(lines[i])); i++; }
      out.push('<div class="table-wrap"><table><thead><tr>' + header.map((h) => `<th scope="col">${inline(escapeHtml(h))}</th>`).join('') + '</tr></thead><tbody>'
        + rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(escapeHtml(c))}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>');
    } else if (/^- /.test(raw)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) { const first = inline(escapeHtml(lines[i].slice(2))); i++; items.push(`<li>${first}${continuation(2)}</li>`); }
      out.push(`<ul>${items.join('')}</ul>`);
    } else if (/^\d+\. /.test(raw)) {
      const items: string[] = [];
      while (i < lines.length && (/^\d+\. /.test(lines[i]) || isSub(lines[i]))) {
        if (/^\d+\. /.test(lines[i])) {
          let item = inline(escapeHtml(lines[i].replace(/^\d+\. /, '')));
          i++;
          const sub: string[] = [];
          while (i < lines.length && isSub(lines[i])) { const first = inline(escapeHtml(lines[i].trim().slice(2))); i++; sub.push(`<li>${first}${continuation(5)}</li>`); }
          if (sub.length) item += `<ul>${sub.join('')}</ul>`;
          items.push(`<li>${item}</li>`);
        } else i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
    } else if (raw.startsWith('> ')) {
      out.push(`<p class="note">${inline(escapeHtml(raw.slice(2)))}</p>`);
      i++;
    } else if (raw.trim() === '') {
      i++;
    } else {
      out.push(`<p>${inline(l)}</p>`);
      i++;
    }
  }
  return out.join('\n');
}

function resultsHtml(doc: ProjectDoc): string {
  const run = doc.sandbox.lastRun;
  if (!run) return '<h2>Appendix — sandbox results in detail</h2><p><em>No sandbox run included.</em></p>';
  const stale = runIsStale(doc);
  const parts: string[] = ['<h2>Appendix — sandbox results in detail</h2>', '<p>Detail for the sandbox run reported in step 6.</p>'];
  parts.push(`<p class="status">${escapeHtml(describeRunStatus(run))}${stale ? ' <strong>From earlier settings: the model inputs have changed since this run.</strong>' : ''}</p>`);
  parts.push(`<p>Daily aggregate backlog model (engine ${escapeHtml(run.engineVersion)}, RNG ${escapeHtml(run.rngVersion)}, seed <code>${escapeHtml(run.seed)}</code>, model revision ${run.modelRevision}). Units: request-equivalents. This model does not estimate individual waiting times.</p>`);
  if (run.comparisonKind === 'paired-policy') parts.push('<p>Same arrival traces in each policy pair.</p>');
  if (run.comparisonKind === 'scenario') parts.push('<p><strong>Scenario comparison: inputs differ.</strong> Differences are not an isolated policy effect.</p>');
  const policies = [run.baseline, ...(run.alternative ? [run.alternative] : [])];
  const rows: string[] = [];
  const metric = (label: string, get: (s: ReplicationSummary) => number | null) => {
    for (const p of policies) {
      const xs = p.summaries.map(get).filter((x): x is number => x !== null);
      if (!xs.length) { rows.push(`<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(p.label)}</td><td colspan="4">Not defined</td></tr>`); continue; }
      const s = summarise(xs);
      const ci = s.ci.unavailableReason ? escapeHtml(s.ci.unavailableReason) : `${fmt(s.ci.lower)} to ${fmt(s.ci.upper)}`;
      rows.push(`<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(p.label)}</td><td class="num">${fmt(s.mean)}</td><td class="num">${xs.length > 1 ? `${fmt(s.p05)} to ${fmt(s.p95)}` : '—'}</td><td>${ci}</td><td class="num">${xs.length}</td></tr>`);
    }
  };
  metric('Terminal backlog (req-eq)', (s) => s.terminalBacklog);
  metric('Average end-of-day backlog (req-eq)', (s) => s.averageEndBacklog);
  metric('Total served (req-eq)', (s) => s.totalServed);
  metric('Total abandoned (req-eq)', (s) => s.totalAbandoned);
  metric('Utilisation (served ÷ effective capacity)', (s) => s.utilisation);
  if (run.baselineSnapshot.cost.enabled) metric(`Total cost (${run.baselineSnapshot.cost.currency})`, (s) => s.totalCost);
  parts.push('<div class="table-wrap"><table><caption>Replication-level summary. Mean; 5th–95th percentile of outcomes (not a confidence interval); approximate 95% t interval for the mean.</caption><thead><tr><th scope="col">Outcome</th><th scope="col">Policy</th><th scope="col">Mean</th><th scope="col">Outcome 5th–95th pct.</th><th scope="col">95% CI of mean</th><th scope="col">n</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>');
  if (run.alternative) {
    const d = pairedDifferences(run.baseline.summaries.map((s) => s.terminalBacklog), run.alternative.summaries.map((s) => s.terminalBacklog));
    const s = summarise(d);
    parts.push(`<p>Paired difference in terminal backlog (alternative − baseline): mean ${fmt(s.mean)} req-eq; ${s.ci.unavailableReason ? escapeHtml(s.ci.unavailableReason) : `approximate 95% t interval ${fmt(s.ci.lower)} to ${fmt(s.ci.upper)}`} (n = ${d.length}).</p>`);
  }
  const t = run.baseline.retainedTrace;
  if (t) {
    parts.push('<div class="table-wrap"><table><caption>Baseline daily table, replication ' + (t.replication + 1) + ' (retained trajectory). Request-equivalents.</caption><thead><tr>'
      + ['Day', 'Start', 'Arrivals', 'Effective capacity', 'Served', 'Abandoned', 'End'].map((h) => `<th scope="col">${h}</th>`).join('') + '</tr></thead><tbody>'
      + t.rows.map((r) => `<tr><td class="num">${r.day}</td><td class="num">${fmt(r.startBacklog)}</td><td class="num">${fmt(r.arrivals)}</td><td class="num">${fmt(r.effectiveCapacity)}</td><td class="num">${fmt(r.served)}</td><td class="num">${fmt(r.abandoned)}</td><td class="num">${fmt(r.endBacklog)}</td></tr>`).join('')
      + '</tbody></table></div>');
  }
  return parts.join('\n');
}

const REPORT_CSS = `
:root{color-scheme:light;--text:#17202c;--muted:#4b5867;--border:#d6dce5;--bg:#ffffff;--subtle:#eef1f5;--primary:#1f5f8b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.55 Inter,'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
main{max-width:76ch;margin:0 auto;padding:32px 20px 48px}h1{font-size:26px;font-weight:650;line-height:1.25;letter-spacing:-.01em}
h2{font-size:20px;font-weight:650;margin-top:32px;border-bottom:1px solid var(--border);padding-bottom:4px}h3{font-size:15px;font-weight:650;margin:20px 0 6px}li{margin:3px 0}code{font-family:'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace;font-size:12.5px;background:var(--subtle);padding:1px 4px;border-radius:4px}
.table-wrap{overflow-x:auto;margin:10px 0}table{border-collapse:collapse;width:100%;font-size:13px}caption{text-align:left;color:var(--muted);font-size:12px;padding:4px 0}
th,td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}thead th{background:var(--subtle);font-size:12px}td.num{text-align:right;font-variant-numeric:tabular-nums}
.note{background:var(--subtle);border-left:3px solid var(--primary);padding:8px 12px}.status{font-weight:600}.meta{color:var(--muted);font-size:12px}
@media print{main{max-width:none;padding:0}thead{display:table-header-group}h2{break-after:avoid}tr{break-inside:avoid}}
`;

export function passportHtml(doc: ProjectDoc, opts: { includeAuthor?: boolean; generatedAt?: string } = {}): string {
  const title = doc.passport.identity.title || 'Untitled project';
  const body = markdownToHtml(passportMarkdown(doc, opts));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="${APP_NAME}">
<title>${escapeHtml(title)} — model passport</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<main>
${body}
${resultsHtml(doc)}
<p class="meta">Standalone report generated by ${APP_NAME}${opts.generatedAt ? ` on ${escapeHtml(opts.generatedAt)}` : ''}. No external resources are loaded. Print with your browser (Print → Save as PDF) if you need a PDF.</p>
</main>
</body>
</html>
`;
}
