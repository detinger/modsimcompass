import { decisionCautions, methodChoice, recordedAnswers, shortlistEntries, type MethodRole } from '../../../domain/artefacts/methodChoice';
import type { MethodChoice } from '../../../domain/artefacts/types';
import { FAMILIES, METHOD_BY_ID, type MethodFamily, type MethodId } from '../../../domain/methods/registry';
import { QUESTIONS } from '../../../domain/methods/rules';
import { mdCell, mdLine, mdText, NOT_SPECIFIED } from '../../../exports/mdText';
import { isSafeSvg } from '../SvgFigure';

/**
 * The one-page method decision (docs/LEARN-TOOLBOX-PLAN.md §5.2): primary, alternative, the reasons, and what each
 * leaves out. Pure functions; the page hands the result to `downloadFile`. Both files are written from one sheet,
 * so the Markdown and the HTML cannot disagree. The written reasons are the author's own and are never judged.
 */

export interface RoleBlock {
  role: MethodRole;
  method: MethodId | '';
  /** The author's own reasons, as written. */
  why: string;
  /** Reasons and cautions matched by the answers (empty for a method picked by hand). */
  reasons: string[];
  cautions: string[];
  leavesOut: string[];
}

export interface DecisionSheet {
  primary: RoleBlock;
  alternative: RoleBlock;
  checks: string[];
  shortlist: { method: MethodId; role: MethodRole | null; fromAnswers: boolean }[];
  answers: { prompt: string; answer: string }[];
  ruleVersion: string;
}

export function decisionSheet(d: MethodChoice): DecisionSheet {
  const list = shortlistEntries(d);
  const block = (role: MethodRole): RoleBlock => {
    const method = role === 'alternative' && d.alternative === d.primary ? '' : d[role];
    const entry = method ? list.find((e) => e.method === method) : undefined;
    return {
      role, method, why: role === 'primary' ? d.justification : d.alternativeJustification,
      reasons: entry?.reasons ?? [], cautions: entry?.cautions ?? [], leavesOut: method ? METHOD_BY_ID[method].omits : [],
    };
  };
  return {
    primary: block('primary'), alternative: block('alternative'), checks: decisionCautions(d),
    shortlist: list.map((e) => ({ method: e.method, role: e.method === d.primary ? 'primary' : e.method === d.alternative ? 'alternative' : null, fromAnswers: e.fromAnswers })),
    answers: recordedAnswers(d).map((a) => ({ prompt: a.prompt, answer: a.answer })),
    ruleVersion: d.ruleVersion,
  };
}

const ROLE_LABEL: Record<MethodRole, string> = { primary: 'Primary method', alternative: 'Alternative method' };
const WHY_LABEL: Record<MethodRole, string> = { primary: 'Why it fits', alternative: 'Why it is the alternative' };
const name = (m: MethodId | '') => (m ? METHOD_BY_ID[m].name : 'Not chosen yet');
const familyOf = (m: MethodId) => FAMILIES[METHOD_BY_ID[m].family].label;
const day = (iso: string) => iso.slice(0, 10);

// ── Markdown ─────────────────────────────────────────────────────────────

export function methodDecisionMarkdown(title: string, d: MethodChoice, exportedAt: string): string {
  const s = decisionSheet(d);
  const heading = mdLine(title).replace(/^#+\s*/, '') || 'Method decision';
  const L: string[] = [`# ${heading}`, '', `Method decision. Exported ${day(exportedAt)}.`, ''];
  for (const b of [s.primary, s.alternative]) {
    L.push(`## ${ROLE_LABEL[b.role]}: ${b.method ? `${name(b.method)} (${familyOf(b.method)})` : `_${NOT_SPECIFIED}_`}`, '');
    if (b.method) L.push(`${METHOD_BY_ID[b.method].purpose}`, '');
    L.push(`- **${WHY_LABEL[b.role]}:** ${mdText(b.why)}`);
    if (b.reasons.length) L.push(`- **Suggested by the answers because:** ${b.reasons.join(' ')}`);
    if (b.cautions.length) L.push(`- **Cautions:** ${b.cautions.join(' ')}`);
    if (b.method) L.push(`- **What it leaves out:** ${b.leavesOut.join('; ')}.`);
    L.push('');
  }
  if (s.checks.length) { L.push(...s.checks.map((c) => `> ${c}`), ''); }
  if (s.shortlist.length) {
    L.push('## Shortlist', '', 'Ordered by matched reasons: a reading aid, not a score.', '');
    for (const e of s.shortlist) {
      L.push(`- **${name(e.method)}** (${familyOf(e.method)}${e.role ? `, ${e.role}` : ''}): ${e.fromAnswers ? 'suggested by the answers' : 'picked by hand'}. Leaves out: ${METHOD_BY_ID[e.method].omits.join('; ')}.`);
    }
    L.push('');
  }
  if (s.answers.length) {
    L.push('## Answers given', '', `${s.answers.length} of ${QUESTIONS.length} questions answered; rule table ${mdCell(s.ruleVersion)}.`, '');
    L.push('| Question | Answer |', '| --- | --- |', ...s.answers.map((a) => `| ${mdCell(a.prompt)} | ${mdCell(a.answer)} |`), '');
  }
  L.push('The reasons above are the author’s own. The app suggests methods from the answers; it does not judge the reasons.');
  return `${L.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

// ── HTML ─────────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const para = (s: string) => esc(s.trim()).replace(/\s*\r?\n\s*/g, '<br>');

/** Family colours for the file: light and dark, literal values so the page needs nothing from the app. */
const FAMILY_HEX: Record<MethodFamily, [string, string, string, string]> = {
  relationships: ['#3b6fe0', '#e7eefc', '#7ea2f0', '#18264a'],
  uncertainty: ['#2e8f7a', '#e2f3ef', '#5cc4ab', '#12302a'],
  processes: ['#a65a2e', '#f7ebe3', '#e09a6d', '#3a2518'],
  emergence: ['#7c4ddb', '#efe8fb', '#ae8cf0', '#2a1f45'],
};
const FAMS = Object.keys(FAMILY_HEX) as MethodFamily[];

const CSS = `:root{color-scheme:light dark;--text:#17202c;--muted:#4b5867;--border:#d6dce5;--bg:#f4f6f9;--paper:#fff;--subtle:#eef1f5;--warn:#b7791f;--warn-soft:#fdf3dc;${FAMS.map((f) => `--${f}:${FAMILY_HEX[f][0]};--${f}-soft:${FAMILY_HEX[f][1]}`).join(';')}}
@media screen and (prefers-color-scheme:dark){:root{--text:#e6ebf1;--muted:#b2bdcb;--border:#2b3645;--bg:#0f141b;--paper:#171e27;--subtle:#1c2430;--warn:#e8b45a;--warn-soft:#3a2d14;${FAMS.map((f) => `--${f}:${FAMILY_HEX[f][2]};--${f}-soft:${FAMILY_HEX[f][3]}`).join(';')}}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.55 Inter,'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:28px 16px 48px}
header{margin-bottom:18px}.eyebrow{margin:0;font-size:12px;font-weight:650;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
h1{font-size:28px;line-height:1.2;letter-spacing:-.015em;margin:4px 0 4px}.date{margin:0;color:var(--muted);font-size:13px}
.roles{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:14px;margin:0 0 14px}
.role{background:var(--paper);border:1px solid var(--border);border-top:6px solid var(--fam,var(--border));border-radius:14px;padding:16px 18px}
.role.alt{border-top-style:dashed}
.role .tag{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.role h2{margin:2px 0 2px;font-size:21px;line-height:1.25}.role .fam{display:inline-block;margin:0 0 8px;padding:1px 10px;border-radius:999px;background:var(--fam-soft,var(--subtle));font-size:12px;font-weight:600}
.role .purpose{margin:0 0 10px;color:var(--muted)}
h3{font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin:12px 0 4px}
.why{margin:0;padding:10px 12px;border-radius:10px;background:var(--subtle);white-space:normal}.empty{color:var(--muted);font-style:italic}
ul{margin:4px 0;padding-left:20px}li{margin:3px 0}
.out li::marker{content:'⊘  ';color:var(--fam,var(--muted))}
.caution{margin:0 0 14px;padding:10px 14px;border-left:4px solid var(--warn);border-radius:0 10px 10px 0;background:var(--warn-soft)}
section.card{background:var(--paper);border:1px solid var(--border);border-radius:14px;padding:14px 18px;margin:0 0 14px}
section.card h2{font-size:16px;margin:0 0 6px}
.chips{list-style:none;padding:0;margin:6px 0 0;display:flex;flex-wrap:wrap;gap:8px}
.chips li{margin:0;padding:3px 12px;border-radius:999px;border:1.5px solid var(--fam,var(--border));background:var(--fam-soft,var(--subtle));font-size:13px}
.chips li.primary,.chips li.alternative{font-weight:650;border-width:3px}.chips li.alternative{border-style:dashed}
.note{color:var(--muted);font-size:12.5px}
.fig{margin:0 0 14px;padding:10px;border:1px solid #d6dce5;border-radius:14px;background:#fff;overflow-x:auto;color-scheme:light}
.fig svg{display:block;max-width:100%;height:auto;margin:0 auto}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid var(--border);padding:6px 8px;text-align:left;vertical-align:top}thead th{font-size:12px;color:var(--muted)}
${FAMS.map((f) => `.f-${f}{--fam:var(--${f});--fam-soft:var(--${f}-soft)}`).join('\n')}
@media print{:root{color-scheme:light}body{background:#fff}main{padding:0}.role,section.card{break-inside:avoid}}`;

/** The decision as a standalone page: no scripts, nothing loaded from outside. `figure` is the artefact's picture. */
export function methodDecisionHtml(title: string, d: MethodChoice, exportedAt: string): string {
  const s = decisionSheet(d);
  const heading = title.trim() || 'Method decision';
  const fam = (m: MethodId | '') => (m ? ` f-${METHOD_BY_ID[m].family}` : '');
  const list = (xs: string[], cls = '') => (xs.length ? `<ul${cls ? ` class="${cls}"` : ''}>${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  const role = (b: RoleBlock) => {
    const m = b.method;
    return `<article class="role${b.role === 'alternative' ? ' alt' : ''}${fam(m)}">
<span class="tag">${ROLE_LABEL[b.role]}</span>
<h2>${esc(name(m))}</h2>
${m ? `<span class="fam">${esc(familyOf(m))}</span><p class="purpose">${esc(METHOD_BY_ID[m].purpose)}</p>` : ''}
<h3>${WHY_LABEL[b.role]}</h3>
${b.why.trim() ? `<p class="why">${para(b.why)}</p>` : `<p class="why empty">${NOT_SPECIFIED}</p>`}
${b.reasons.length ? `<h3>Suggested by the answers because</h3>${list(b.reasons)}` : ''}
${b.cautions.length ? `<h3>Cautions</h3>${list(b.cautions)}` : ''}
${m ? `<h3>What it leaves out</h3>${list(b.leavesOut, 'out')}` : ''}
</article>`;
  };
  let svg: string | null = null;
  try { svg = methodChoice.figure(d); } catch { svg = null; }
  const picture = isSafeSvg(svg) ? `<div class="fig" role="img" aria-label="${esc(`The four method families. Primary: ${name(s.primary.method)}. Alternative: ${name(s.alternative.method)}.`)}">${svg}</div>` : '';
  const shortlist = s.shortlist.length ? `<section class="card"><h2>Shortlist</h2><p class="note">Ordered by matched reasons: a reading aid, not a score.</p>
<ul class="chips">${s.shortlist.map((e) => `<li class="${e.role ?? ''}${fam(e.method)}">${esc(name(e.method))}${e.role ? ` · ${e.role}` : ''}${e.fromAnswers ? '' : ' · picked by hand'}</li>`).join('')}</ul></section>` : '';
  const answers = s.answers.length ? `<section class="card"><h2>Answers given</h2><p class="note">${s.answers.length} of ${QUESTIONS.length} questions answered · rule table ${esc(s.ruleVersion)}</p>
<table><thead><tr><th scope="col">Question</th><th scope="col">Answer</th></tr></thead><tbody>${s.answers.map((a) => `<tr><td>${esc(a.prompt)}</td><td>${esc(a.answer)}</td></tr>`).join('')}</tbody></table></section>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(heading)} — method decision</title>
<style>${CSS}</style>
</head>
<body>
<main>
<header><p class="eyebrow">Method decision</p><h1>${esc(heading)}</h1><p class="date">Exported ${esc(day(exportedAt))}</p></header>
<div class="roles">${role(s.primary)}${role(s.alternative)}</div>
${s.checks.map((c) => `<p class="caution">${esc(c)}</p>`).join('\n')}
${picture}
${shortlist}
${answers}
<p class="note">The reasons are the author’s own. The app suggests methods from the answers; it does not judge the reasons.</p>
</main>
</body>
</html>
`;
}
