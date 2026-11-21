import { kindDef } from '../domain/artefacts/kinds';
import type { Inclusion, ProjectDoc } from '../domain/passport/schema';
import { METHOD_BY_ID } from '../domain/methods/registry';
import { STEPS, compassWarnings, stepsStarted } from '../domain/passport/compass';
import { isSafeSvg } from '../features/toolbox/SvgFigure';
import { APP_NAME, reportOutline, reportableCopies } from './markdown';

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
      // A wide table scrolls inside its frame; the frame takes focus so the keyboard can scroll it too.
      out.push('<div class="table-wrap" tabindex="0"><table><thead><tr>' + header.map((h) => `<th scope="col">${inline(escapeHtml(h))}</th>`).join('') + '</tr></thead><tbody>'
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

/**
 * The picture of an included copy, drawn by its kind. It is placed in the report only when it is plainly a
 * self-contained SVG picture (`isSafeSvg`): no scripts, no event attributes, nothing loaded from outside.
 */
export function artefactFigure(inc: Inclusion): string | null {
  let svg: string | null;
  try { svg = kindDef(inc.kind).figure(inc.data); } catch { svg = null; }
  return isSafeSvg(svg) ? svg.trim() : null;
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
h2{font-size:20px;font-weight:670;line-height:1.25;margin:0 0 10px;color:var(--text)}
.sec h2{display:flex;align-items:center;gap:10px}.sec h2::before{content:'';flex:none;width:10px;height:10px;border-radius:50%;background:var(--tone,var(--border))}
.table-wrap:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
h3{font-size:15px;font-weight:650;margin:20px 0 6px}p{margin:8px 0}ul,ol{margin:8px 0;padding-left:22px}li{margin:5px 0}li ul{margin:4px 0}
code{font-family:'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace;font-size:12.5px;background:var(--subtle);padding:1px 4px;border-radius:4px}
.table-wrap{overflow-x:auto;margin:12px 0;border:1px solid var(--border);border-radius:10px}table{border-collapse:collapse;width:100%;font-size:13px}
caption{text-align:left;color:var(--muted);font-size:12px;padding:8px 10px;border-bottom:1px solid var(--border)}
th,td{border-bottom:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}tbody tr:last-child>*{border-bottom:0}
thead th{background:var(--subtle);font-size:12px}tbody th{font-weight:600}td.num{text-align:right;font-variant-numeric:tabular-nums}
.note{background:var(--subtle);border-left:3px solid var(--primary);border-radius:0 8px 8px 0;padding:8px 12px}
.artefact{margin:18px 0 6px;padding:2px 16px 10px;border:1px solid var(--border);border-top:4px solid var(--tone,var(--border));border-radius:12px;background:var(--bg)}
.artefact h3{margin-top:12px}.artefact .table-wrap{background:var(--paper)}
.fig{color-scheme:light;--text:#17202c;--muted:#4b5867;--border:#d6dce5;--bg:#f4f6f9;--paper:#ffffff;--subtle:#eef1f5;--primary:#1f5f8b;--primary-soft:#e3eef7;
margin:12px 0 4px;padding:10px;border:1px solid #d6dce5;border-radius:10px;background:#ffffff;color:#17202c;overflow-x:auto}
.fig svg{display:block;max-width:100%;height:auto;margin:0 auto}
.meta{color:var(--muted);font-size:12px;text-align:center;margin-top:20px}
@page{margin:16mm 14mm}
@media print{:root{color-scheme:light}body{background:#fff;font-size:11.5pt}main{max-width:none;padding:0}.toc{display:none}
.cover,.sec{border-radius:0;border-width:0 0 0 0;padding:0;margin:0 0 18pt}.cover{border-top:4pt solid var(--primary);padding-top:10pt}
.sec{border-left:0}.sec h2{border-bottom:1.5pt solid var(--tone,var(--border));padding-bottom:3pt}
thead{display:table-header-group}h2,h3{break-after:avoid}tr,li,.fig{break-inside:avoid}.artefact{background:none;border-radius:0;border-width:1pt 0 0;padding:0}.fig{border:0;padding:0}.table-wrap{overflow:visible;border:0;border-radius:0}th,td{border:1px solid var(--border)}tbody tr:last-child>*{border-bottom:1px solid var(--border)}.lead{background:none;border:1pt solid var(--border)}}
`;

const SECTION_IDS: Record<string, string> = { 'Additional notes': 'notes', 'Open items at export time': 'open-items', Checkpoints: 'checkpoints' };

export function passportHtml(doc: ProjectDoc, opts: { includeAuthor?: boolean; generatedAt?: string } = {}): string {
  const title = doc.passport.identity.title || 'Untitled project';
  const { head, sections, foot } = reportOutline(doc, opts);
  const copies = reportableCopies(doc);
  const question = doc.passport.decision.question.trim();
  const rep = doc.passport.representation;
  const method = rep.primaryMethod && Object.hasOwn(METHOD_BY_ID, rep.primaryMethod) ? METHOD_BY_ID[rep.primaryMethod as keyof typeof METHOD_BY_ID].name : '';
  const open = compassWarnings(doc);
  const count = (sev: string) => open.filter((w) => w.severity === sev).length;
  const chips = [
    `<li><b>${stepsStarted(doc.passport, copies).length} of ${STEPS.length}</b> steps started</li>`,
    ...(method ? [`<li>Method: <b>${escapeHtml(method)}</b></li>`] : []),
    `<li>Open items: <b>${count('gap')}</b> missing · <b>${count('check')}</b> to check</li>`,
    `<li>Artefacts: <b>${copies.length}</b></li>`,
    ...(doc.passport.identity.stage === 'planning' ? ['<li>Stage: <b>planning</b></li>'] : []),
  ];
  const toc: string[] = [];
  const body = sections.map((part) => {
    const step = part.step;
    const id = step ? `step-${step.number}` : SECTION_IDS[part.heading] ?? 'section';
    toc.push(step ? `<li class="t${step.number}"><a href="#${id}"><i>${step.number}</i>${escapeHtml(step.title)}</a></li>` : `<li class="plain"><a href="#${id}">${escapeHtml(part.heading)}</a></li>`);
    // Each included copy: its report block, then its picture when the kind draws one.
    const artefacts = part.artefacts.map(({ inclusion, md }) => {
      const svg = artefactFigure(inclusion);
      const name = escapeHtml((inclusion.title ?? '').trim() || 'Untitled');
      return `<div class="artefact">\n${markdownToHtml(md)}${svg ? `\n<div class="fig" role="img" aria-label="Picture of ${name}">${svg}</div>` : ''}\n</div>`;
    });
    return `<section id="${id}" class="sec${step ? ` t${step.number}` : ''}">\n${markdownToHtml(part.md)}${artefacts.length ? `\n${artefacts.join('\n')}` : ''}\n</section>`;
  });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="${APP_NAME}">
<title>${escapeHtml(title)} — project report</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<main>
<header class="cover">
<div class="eyebrow">Project report</div>
${markdownToHtml(head)}
${question ? `<div class="lead"><span>Question</span><p>${escapeHtml(question).replace(/\s*\r?\n\s*/g, '<br>')}</p></div>` : ''}
<ul class="chips">${chips.join('')}</ul>
</header>
<nav class="toc" aria-label="Contents"><ol>${toc.join('')}</ol></nav>
${body.join('\n')}
${markdownToHtml(foot).replace('<p>', '<p class="meta">')}
<p class="meta">Standalone report generated by ${APP_NAME}${opts.generatedAt ? ` on ${escapeHtml(opts.generatedAt)}` : ''}. No external resources are loaded. Print with your browser (Print → Save as PDF) if you need a PDF.</p>
</main>
</body>
</html>
`;
}
