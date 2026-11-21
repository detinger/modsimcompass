import type { ProjectDoc } from '../domain/passport/schema';
import type { ReplicationSummary } from '../domain/sandbox/types';
import { pairedDifferences, summarise } from '../domain/sandbox/stats';
import { METHOD_BY_ID } from '../domain/methods/registry';
import { STEPS, compassWarnings, stepsStarted } from '../domain/passport/compass';
import { APP_NAME, passportMarkdown, stepHeading } from './markdown';
import { describeRunStatus, fmt, runIsStale } from './runInfo';

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Whole numbers written into markup. Anything else (a tampered file) becomes a dash, never markup. */
const int = (n: unknown): string => (typeof n === 'number' && Number.isFinite(n) ? String(Math.trunc(n)) : '—');

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
 * (multi-line user text).
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
  parts.push(`<p>Daily aggregate backlog model (engine ${escapeHtml(run.engineVersion)}, RNG ${escapeHtml(run.rngVersion)}, seed <code>${escapeHtml(run.seed)}</code>, model revision ${int(run.modelRevision)}). Units: request-equivalents. This model does not estimate individual waiting times.</p>`);
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
  if (run.alternative && run.alternative.summaries.length && run.baseline.summaries.length) {
    const d = pairedDifferences(run.baseline.summaries.map((s) => s.terminalBacklog), run.alternative.summaries.map((s) => s.terminalBacklog));
    const s = summarise(d);
    // Only identical arrival traces make the difference a paired one.
    const kind = run.comparisonKind === 'paired-policy' ? 'Paired difference' : 'Difference';
    parts.push(`<p>${kind} in terminal backlog (alternative − baseline): mean ${fmt(s.mean)} req-eq; ${s.ci.unavailableReason ? escapeHtml(s.ci.unavailableReason) : `approximate 95% t interval ${fmt(s.ci.lower)} to ${fmt(s.ci.upper)}`} (n = ${d.length}).</p>`);
  }
  const t = run.baseline.retainedTrace;
  if (t) {
    parts.push('<div class="table-wrap"><table><caption>Baseline daily table, replication ' + int(t.replication + 1) + ' (retained trajectory). Request-equivalents.</caption><thead><tr>'
      + ['Day', 'Start', 'Arrivals', 'Effective capacity', 'Served', 'Abandoned', 'End'].map((h) => `<th scope="col">${h}</th>`).join('') + '</tr></thead><tbody>'
      + t.rows.map((r) => `<tr><td class="num">${int(r.day)}</td><td class="num">${fmt(r.startBacklog)}</td><td class="num">${fmt(r.arrivals)}</td><td class="num">${fmt(r.effectiveCapacity)}</td><td class="num">${fmt(r.served)}</td><td class="num">${fmt(r.abandoned)}</td><td class="num">${fmt(r.endBacklog)}</td></tr>`).join('')
      + '</tbody></table></div>');
  }
  return parts.join('\n');
}

const REPORT_CSS = `
:root{color-scheme:light dark;--text:#17202c;--muted:#4b5867;--border:#d6dce5;--bg:#f4f6f9;--paper:#ffffff;--subtle:#eef1f5;--primary:#1f5f8b;--primary-soft:#e3eef7;
--t1:#3b6fe0;--t2:#2e8f7a;--t3:#7c4ddb;--t4:#a65a2e;--t5:#1f5f8b;--t6:#b96a1c;--t7:#2f855a}
@media screen and (prefers-color-scheme:dark){:root{--text:#e6ebf1;--muted:#b2bdcb;--border:#2b3645;--bg:#0f141b;--paper:#171e27;--subtle:#1c2430;--primary:#5aa7d8;--primary-soft:#16314a;
--t1:#7ea2f0;--t2:#5cc4ab;--t3:#ae8cf0;--t4:#e09a6d;--t5:#5aa7d8;--t6:#f0a457;--t7:#6fcf97}}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.55 Inter,'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
main{max-width:84ch;margin:0 auto;padding:28px 16px 56px}
.cover,.toc,.sec{background:var(--paper);border:1px solid var(--border);border-radius:14px;padding:22px 26px;margin:0 0 16px}
.cover{border-top:6px solid var(--primary);padding-top:20px}
.eyebrow{margin:0 0 4px;font-size:12px;font-weight:650;letter-spacing:.08em;text-transform:uppercase;color:var(--primary)}
h1{font-size:28px;font-weight:680;line-height:1.2;letter-spacing:-.015em;margin:0 0 10px}
.cover p{margin:4px 0;color:var(--muted);font-size:12.5px}.cover .note{color:var(--text);font-size:13px;margin:14px 0 10px}
.lead{margin:16px 0 4px;padding:14px 16px;background:var(--primary-soft);border-radius:10px}
.lead span{display:block;font-size:11.5px;font-weight:650;letter-spacing:.06em;text-transform:uppercase;color:var(--primary);margin-bottom:2px}
.cover .lead p{margin:0;font-size:17px;line-height:1.4;font-weight:560;color:var(--text)}
.chips{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0;padding:0}
.chips li{margin:0;border:1px solid var(--border);border-radius:999px;padding:3px 11px;font-size:12.5px;background:var(--paper)}.chips b{font-weight:650}
.toc{padding:14px 26px}.toc ol{list-style:none;display:flex;flex-wrap:wrap;gap:6px 8px;margin:0;padding:0}.toc li{margin:0}
.toc a{display:inline-flex;align-items:center;gap:7px;color:var(--text);text-decoration:none;font-size:13px;font-weight:560;padding:4px 11px 4px 5px;border-radius:999px;background:var(--subtle)}
.toc a:hover,.toc a:focus-visible{outline:2px solid var(--primary);outline-offset:1px}
.toc i{font-style:normal;display:inline-grid;place-items:center;min-width:22px;height:22px;border-radius:999px;background:var(--tone,var(--muted));color:var(--paper);font-size:12px;font-weight:700}
.toc .plain a{padding-left:11px}
.sec{border-left:6px solid var(--tone,var(--border))}
.t1{--tone:var(--t1)}.t2{--tone:var(--t2)}.t3{--tone:var(--t3)}.t4{--tone:var(--t4)}.t5{--tone:var(--t5)}.t6{--tone:var(--t6)}.t7{--tone:var(--t7)}
h2{font-size:20px;font-weight:670;line-height:1.25;margin:0 0 10px;color:var(--tone,var(--text))}
h3{font-size:15px;font-weight:650;margin:20px 0 6px}p{margin:8px 0}ul,ol{margin:8px 0;padding-left:22px}li{margin:5px 0}li ul{margin:4px 0}
code{font-family:'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace;font-size:12.5px;background:var(--subtle);padding:1px 4px;border-radius:4px}
.table-wrap{overflow-x:auto;margin:12px 0;border:1px solid var(--border);border-radius:10px}table{border-collapse:collapse;width:100%;font-size:13px}
caption{text-align:left;color:var(--muted);font-size:12px;padding:8px 10px;border-bottom:1px solid var(--border)}
th,td{border-bottom:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}tbody tr:last-child>*{border-bottom:0}
thead th{background:var(--subtle);font-size:12px}tbody th{font-weight:600}td.num{text-align:right;font-variant-numeric:tabular-nums}
.note{background:var(--subtle);border-left:3px solid var(--primary);border-radius:0 8px 8px 0;padding:8px 12px}.status{font-weight:600}
.meta{color:var(--muted);font-size:12px;text-align:center;margin-top:20px}
@page{margin:16mm 14mm}
@media print{:root{color-scheme:light}body{background:#fff;font-size:11.5pt}main{max-width:none;padding:0}.toc{display:none}
.cover,.sec{border-radius:0;border-width:0 0 0 0;padding:0;margin:0 0 18pt}.cover{border-top:4pt solid var(--primary);padding-top:10pt}
.sec{border-left:0}.sec h2{border-bottom:1.5pt solid var(--tone,var(--border));padding-bottom:3pt}
thead{display:table-header-group}h2,h3{break-after:avoid}tr,li{break-inside:avoid}.table-wrap{overflow:visible;border:0;border-radius:0}th,td{border:1px solid var(--border)}tbody tr:last-child>*{border-bottom:1px solid var(--border)}.lead{background:none;border:1pt solid var(--border)}}
`;

const SECTION_IDS: Record<string, string> = { 'Additional notes': 'notes', 'Open items at export time': 'open-items', Checkpoints: 'checkpoints' };

/** Splits the Markdown at its level-2 headings. User text never starts a line with “#”, so only real sections split. */
function sections(md: string): { head: string; parts: { heading: string; md: string }[] } {
  const lines = md.split('\n');
  const head: string[] = [];
  const parts: { heading: string; md: string[] }[] = [];
  for (const l of lines) {
    if (l.startsWith('## ')) parts.push({ heading: l.slice(3), md: [l] });
    else if (parts.length) parts[parts.length - 1].md.push(l);
    else head.push(l);
  }
  return { head: head.join('\n'), parts: parts.map((p) => ({ heading: p.heading, md: p.md.join('\n') })) };
}

export function passportHtml(doc: ProjectDoc, opts: { includeAuthor?: boolean; generatedAt?: string } = {}): string {
  const title = doc.passport.identity.title || 'Untitled project';
  const { head, parts } = sections(passportMarkdown(doc, opts));
  const question = doc.passport.decision.question.trim();
  const rep = doc.passport.representation;
  const method = rep.primaryMethod && Object.hasOwn(METHOD_BY_ID, rep.primaryMethod) ? METHOD_BY_ID[rep.primaryMethod as keyof typeof METHOD_BY_ID].name : '';
  const open = compassWarnings(doc);
  const count = (sev: string) => open.filter((w) => w.severity === sev).length;
  const chips = [
    `<li><b>${stepsStarted(doc.passport).length} of ${STEPS.length}</b> steps started</li>`,
    ...(method ? [`<li>Method: <b>${escapeHtml(method)}</b></li>`] : []),
    `<li>Open items: <b>${count('gap')}</b> missing · <b>${count('check')}</b> to check</li>`,
  ];
  const toc: string[] = [];
  const body = parts.map((part) => {
    const step = STEPS.find((s) => stepHeading(s) === part.heading);
    const id = step ? `step-${step.number}` : SECTION_IDS[part.heading] ?? 'section';
    toc.push(step ? `<li class="t${step.number}"><a href="#${id}"><i>${step.number}</i>${escapeHtml(step.title)}</a></li>` : `<li class="plain"><a href="#${id}">${escapeHtml(part.heading)}</a></li>`);
    return `<section id="${id}" class="sec${step ? ` t${step.number}` : ''}">\n${markdownToHtml(part.md)}\n</section>`;
  });
  toc.push('<li class="plain"><a href="#appendix">Sandbox results</a></li>');
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
<header class="cover">
<div class="eyebrow">Model passport</div>
${markdownToHtml(head)}
${question ? `<div class="lead"><span>Question</span><p>${escapeHtml(question).replace(/\s*\r?\n\s*/g, '<br>')}</p></div>` : ''}
<ul class="chips">${chips.join('')}</ul>
</header>
<nav class="toc" aria-label="Contents"><ol>${toc.join('')}</ol></nav>
${body.join('\n')}
<section id="appendix" class="sec">
${resultsHtml(doc)}
</section>
<p class="meta">Standalone report generated by ${APP_NAME}${opts.generatedAt ? ` on ${escapeHtml(opts.generatedAt)}` : ''}. No external resources are loaded. Print with your browser (Print → Save as PDF) if you need a PDF.</p>
</main>
</body>
</html>
`;
}
