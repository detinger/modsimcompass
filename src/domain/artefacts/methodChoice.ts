import { mdCell, mdText } from '../../exports/mdText';
import { FAMILIES, METHODS, METHOD_BY_ID, type MethodFamily, type MethodId } from '../methods/registry';
import { QUESTIONS, RULE_VERSION, answersKey, emptyAnswers, evaluateRules, type MethodAnswers } from '../methods/rules';
import type { ProjectDoc } from '../passport/schema';
import { isObj, items, own, sameData, text, type Warn } from './clean';
import type { KindDef } from './kinds';
import type { MethodChoice } from './types';

const empty = (): MethodChoice => ({
  answers: emptyAnswers(), ruleVersion: RULE_VERSION, shortlist: [], primary: '', alternative: '', justification: '', alternativeJustification: '',
});

const isMethod = (m: unknown): m is MethodId => typeof m === 'string' && Object.hasOwn(METHOD_BY_ID, m);
const methodName = (m: MethodId | '') => (m ? METHOD_BY_ID[m].name : '');

/** Every answer must be one of the options of its question; anything else goes back to “not sure yet”. */
function readAnswers(raw: Record<string, unknown>, warn: Warn): MethodAnswers {
  const out = emptyAnswers() as unknown as Record<string, string>;
  for (const key of Object.keys(out)) {
    const value = own(raw, key);
    const allowed = QUESTIONS.find((q) => q.key === key)?.options.map((o) => o.value) ?? [];
    if (typeof value === 'string' && allowed.includes(value)) out[key] = value;
    else if (value !== undefined) warn(`answers.${key}: answer not recognised; reset.`);
  }
  return out as unknown as MethodAnswers;
}

function sanitize(raw: unknown, warn: Warn): MethodChoice | null {
  if (!isObj(raw)) return null;
  const rawAnswers = own(raw, 'answers'), rawShortlist = items(own(raw, 'shortlist'), 'shortlist', warn, 50);
  if (!isObj(rawAnswers) || !rawShortlist) return null;
  const method = (key: 'primary' | 'alternative'): MethodId | '' => {
    const m = own(raw, key);
    if (m === '' || m === undefined) return '';
    if (isMethod(m)) return m;
    warn(`${key}: unknown method removed.`);
    return '';
  };
  const shortlist = [...new Set(rawShortlist.filter(isMethod))];
  if (shortlist.length !== rawShortlist.length) warn('shortlist: unknown or repeated methods removed.');
  const primary = method('primary');
  let alternative = method('alternative');
  // A method holds one role at a time, as on screen. The written reasons stay.
  if (primary && alternative === primary) { warn('alternative: the same method as the primary; cleared.'); alternative = ''; }
  return {
    answers: readAnswers(rawAnswers, warn),
    ruleVersion: text(own(raw, 'ruleVersion'), 'ruleVersion', warn, 200) || RULE_VERSION,
    shortlist, primary, alternative,
    justification: text(own(raw, 'justification'), 'justification', warn),
    alternativeJustification: text(own(raw, 'alternativeJustification'), 'alternativeJustification', warn),
  };
}

const answered = (d: MethodChoice) => Object.values(d.answers).filter((a) => a !== 'unsure').length;

// ── The shortlist ────────────────────────────────────────────────────────

export interface ShortlistEntry {
  method: MethodId;
  /** Reasons and cautions matched by the answers. Both are empty for a method that was added by hand. */
  reasons: string[];
  cautions: string[];
  /** True when the answers put it on the list; false when it was added by hand or chosen directly. */
  fromAnswers: boolean;
}

/**
 * The shortlist as every screen and export shows it: first the methods the answers point to, in the order of the
 * rule table (most matched reasons first: a reading aid, not a score), then the methods kept by hand, then a chosen
 * method that is on neither list.
 */
export function shortlistEntries(d: MethodChoice): ShortlistEntry[] {
  const out: ShortlistEntry[] = evaluateRules(d.answers).candidates.map((c) => ({ method: c.method, reasons: c.reasons, cautions: c.caveats, fromAnswers: true }));
  const have = new Set(out.map((e) => e.method));
  for (const m of [...d.shortlist, d.primary, d.alternative]) {
    if (!m || have.has(m)) continue;
    have.add(m);
    out.push({ method: m, reasons: [], cautions: [], fromAnswers: false });
  }
  return out;
}

/** The methods kept by hand: on the stored shortlist, but not suggested by the answers. */
export function keptByHand(d: MethodChoice): MethodId[] {
  const suggested = new Set(evaluateRules(d.answers).candidates.map((c) => c.method));
  return d.shortlist.filter((m) => !suggested.has(m));
}

/** Cautions about the decision itself. Whether the method can answer the project's question is checked in the project. */
export function decisionCautions(d: MethodChoice): string[] {
  const out: string[] = [];
  if (d.primary && d.primary === d.alternative) out.push('The primary and the alternative are the same method. Name a different alternative, or leave it open.');
  return out;
}

// ── Editing (pure; the tool calls these inside `setData`) ───────────────

const suggestedBy = (answers: MethodAnswers): MethodId[] => evaluateRules(answers).candidates.map((c) => c.method);

/**
 * Sets one answer. The stored shortlist follows: the methods the new answers suggest, then the ones kept by hand.
 * A method that only an earlier answer suggested leaves the list, as it would on screen.
 */
export function setAnswer<Q extends keyof MethodAnswers>(d: MethodChoice, key: Q, value: MethodAnswers[Q]): void {
  const kept = keptByHand(d);
  d.answers = { ...d.answers, [key]: value };
  d.ruleVersion = RULE_VERSION;
  d.shortlist = [...new Set([...suggestedBy(d.answers), ...kept])];
}

/** All answers back to “not sure yet”. Methods kept by hand stay on the list. */
export function clearAnswers(d: MethodChoice): void {
  d.shortlist = keptByHand(d);
  d.answers = emptyAnswers();
  d.ruleVersion = RULE_VERSION;
}

/** Puts a method on the shortlist by hand (for example from a family). */
export function keepMethod(d: MethodChoice, m: MethodId): void {
  if (!d.shortlist.includes(m)) d.shortlist.push(m);
}

/** Takes a method that was kept by hand off the list. A method the answers suggest cannot be dropped: it follows the answers. */
export function dropMethod(d: MethodChoice, m: MethodId): void {
  if (suggestedBy(d.answers).includes(m)) return;
  d.shortlist = d.shortlist.filter((x) => x !== m);
}

export type MethodRole = 'primary' | 'alternative';

/** Gives a method a role. A method holds one role at a time, so it leaves the other role if it had it. */
export function chooseMethod(d: MethodChoice, role: MethodRole, m: MethodId): void {
  const other: MethodRole = role === 'primary' ? 'alternative' : 'primary';
  if (d[other] === m) d[other] = '';
  d[role] = m;
  keepMethod(d, m);
}

/** Clears a role. The written reasons stay, so nothing typed is lost. */
export function clearRole(d: MethodChoice, role: MethodRole): void {
  d[role] = '';
}

/** Swaps primary and alternative, with their reasons. */
export function swapRoles(d: MethodChoice): void {
  [d.primary, d.alternative] = [d.alternative, d.primary];
  [d.justification, d.alternativeJustification] = [d.alternativeJustification, d.justification];
}

// ── Side by side ─────────────────────────────────────────────────────────

/** The rows of the side-by-side comparison, in reading order. All text comes from the method registry. */
export const COMPARE_ROWS: readonly { key: string; label: string; cell: (m: MethodId) => string[] }[] = [
  { key: 'family', label: 'Family', cell: (m) => [FAMILIES[METHOD_BY_ID[m].family].label] },
  { key: 'purpose', label: 'For', cell: (m) => [METHOD_BY_ID[m].purpose] },
  { key: 'representation', label: 'Shows', cell: (m) => [METHOD_BY_ID[m].representation] },
  { key: 'time', label: 'Time', cell: (m) => [METHOD_BY_ID[m].time] },
  { key: 'randomness', label: 'Chance', cell: (m) => [METHOD_BY_ID[m].randomness] },
  { key: 'aggregation', label: 'Level', cell: (m) => [METHOD_BY_ID[m].aggregation] },
  { key: 'needs', label: 'Needs', cell: (m) => METHOD_BY_ID[m].dataNeeds },
  { key: 'assumes', label: 'Assumes', cell: (m) => METHOD_BY_ID[m].assumptions },
  { key: 'omits', label: 'Leaves out', cell: (m) => METHOD_BY_ID[m].omits },
  { key: 'fails', label: 'Fails when', cell: (m) => METHOD_BY_ID[m].failureConditions },
];

/** At most three methods side by side; repeats and unknown ids are dropped. */
export const MAX_COMPARED = 3;
export function compareSet(list: readonly string[]): MethodId[] {
  return [...new Set(list.filter(isMethod))].slice(0, MAX_COMPARED);
}

/** The methods a comparison starts with: primary, alternative, then the shortlist in order. */
export function defaultCompared(d: MethodChoice): MethodId[] {
  return compareSet([d.primary, d.alternative, ...shortlistEntries(d).map((e) => e.method)]);
}

/** The questions that were answered, with the prompt and the label of the chosen option. */
export function recordedAnswers(d: MethodChoice): { key: keyof MethodAnswers; prompt: string; answer: string }[] {
  return QUESTIONS.filter((q) => d.answers[q.key] !== 'unsure')
    .map((q) => ({ key: q.key, prompt: q.prompt, answer: q.options.find((o) => o.value === d.answers[q.key])?.label ?? '' }));
}

function summary(d: MethodChoice): string[] {
  const L: string[] = [];
  L.push(d.primary ? `Primary: ${methodName(d.primary)}` : 'No primary method yet');
  if (d.alternative) L.push(`Alternative: ${methodName(d.alternative)}`);
  const list = shortlistEntries(d).map((e) => methodName(e.method));
  if (list.length) L.push(`Shortlist: ${list.join(', ')}`);
  const n = answered(d);
  if (n) L.push(`${n} of ${QUESTIONS.length} questions answered`);
  return L;
}

const withFamily = (m: MethodId | '') => (m ? `${methodName(m)} (${FAMILIES[METHOD_BY_ID[m].family].label})` : mdText(''));

function markdown(d: MethodChoice): string[] {
  const L = [
    `- **Primary method:** ${withFamily(d.primary)}`, `- **Why the primary fits:** ${mdText(d.justification)}`,
    `- **Alternative method:** ${withFamily(d.alternative)}`, `- **Why the alternative is less suitable (or complementary):** ${mdText(d.alternativeJustification)}`,
  ];
  if (d.primary) L.push(`- **What the primary method leaves out:** ${METHOD_BY_ID[d.primary].omits.join('; ')}`);
  for (const c of decisionCautions(d)) L.push(`- **Check:** ${c}`);
  L.push('');
  const list = shortlistEntries(d);
  if (list.length) {
    L.push('**Shortlist.** Ordered by matched reasons: a reading aid, not a score.', '');
    for (const e of list) {
      const m = METHOD_BY_ID[e.method];
      const role = e.method === d.primary ? ', primary' : e.method === d.alternative ? ', alternative' : '';
      L.push(`- **${m.name}** (${FAMILIES[m.family].label}${role})${e.fromAnswers ? '' : ': kept by hand, not suggested by the answers'}`);
      if (e.reasons.length) L.push(`  Why it may fit: ${e.reasons.join(' ')}`);
      if (e.cautions.length) L.push(`  Cautions: ${e.cautions.join(' ')}`);
      L.push(`  Leaves out: ${m.omits.join('; ')}.`);
    }
    L.push('');
  }
  const rows = recordedAnswers(d);
  if (rows.length) {
    L.push(`Answers given (${rows.length} of ${QUESTIONS.length}; rule table ${mdCell(d.ruleVersion)}):`, '');
    L.push('| Question | Answer |', '| --- | --- |');
    rows.forEach((r) => L.push(`| ${mdCell(r.prompt)} | ${mdCell(r.answer)} |`));
    L.push('');
  }
  return L;
}

// ── Picture ──────────────────────────────────────────────────────────────

const FAMILY_STRIP: MethodFamily[] = ['relationships', 'uncertainty', 'processes', 'emergence'];
/* A literal colour first, then the app's token: a viewer that knows no CSS variables keeps the literal, so a saved picture prints well. */
const FAMILY_INK: Record<MethodFamily, [string, string]> = {
  relationships: ['#3b6fe0', '#e7eefc'], uncertainty: ['#2e8f7a', '#e2f3ef'], processes: ['#a65a2e', '#f7ebe3'], emergence: ['#7c4ddb', '#efe8fb'],
};
const xml = (s: string) => s.replace(/[&<>"'=:@()]/g, (c) => `&#${c.charCodeAt(0)};`);
const FIGURE_STYLE = '<style>'
  + ".mcf text{font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:12px;fill:#17202c;fill:var(--text,#17202c)}"
  + '.mcf .q{fill:#4b5867;fill:var(--text-muted,#4b5867)}.mcf .h{font-size:12.5px;font-weight:700}.mcf .s{font-weight:700}'
  + '.mcf .pill{fill:#ffffff;fill:var(--bg-elevated,#ffffff);stroke-width:1;stroke-opacity:.45}.mcf .alt{stroke-width:3;stroke-opacity:1}.mcf .on{stroke-opacity:1}'
  + '.mcf .on text,.mcf text.on{fill:#ffffff;fill:var(--bg-elevated,#ffffff);font-weight:700}'
  + FAMILY_STRIP.map((f, i) => {
    const [ink, soft] = FAMILY_INK[f];
    return `.mcf .f${i} .col{fill:${soft};fill:var(--fam-${f}-soft,${soft})}.mcf .f${i} .pill,.mcf .f${i} .mark{stroke:${ink};stroke:var(--fam-${f},${ink})}`
      + `.mcf .f${i} .on,.mcf .f${i} .mark,.mcf .f${i} .dot{fill:${ink};fill:var(--fam-${f},${ink})}.mcf .f${i} .mark.open{fill:#ffffff;fill:var(--bg-elevated,#ffffff);stroke-width:3}`;
  }).join('')
  + '</style>';

/**
 * A compact decision card: the four families as a strip, the primary method filled, the alternative outlined,
 * and a dot on every other method of the shortlist. Null while nothing is chosen or shortlisted.
 */
function figure(d: MethodChoice): string | null {
  const list = new Set(shortlistEntries(d).map((e) => e.method));
  if (!d.primary && !d.alternative && list.size === 0) return null;
  const W = 840, pad = 12, gap = 8, colW = (W - 2 * pad - 3 * gap) / 4, pillH = 24, step = 29, top = 10, head = 34;
  const colH = head + 4 * step + 5, H = top + colH + 44;
  const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" class="mcf" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${FIGURE_STYLE}`];
  FAMILY_STRIP.forEach((f, i) => {
    const x = pad + i * (colW + gap);
    parts.push(`<g class="f${i}"><rect class="col" x="${x}" y="${top}" width="${colW}" height="${colH}" rx="12"/>`);
    parts.push(`<text class="h" x="${x + 12}" y="${top + 22}">${xml(FAMILIES[f].label)}</text>`);
    METHODS.filter((m) => m.family === f).forEach((m, k) => {
      const y = top + head + k * step;
      const primary = m.id === d.primary, alternative = !primary && m.id === d.alternative;
      parts.push(`<g${primary ? ' class="on"' : ''}><rect class="pill${primary ? ' on' : alternative ? ' alt' : ''}" x="${x + 8}" y="${y}" width="${colW - 16}" height="${pillH}" rx="12"/>`);
      if (!primary && !alternative && list.has(m.id)) parts.push(`<circle class="dot" cx="${x + 20}" cy="${y + pillH / 2}" r="3.5"/>`);
      const inset = !primary && !alternative && list.has(m.id) ? 30 : 20;
      // A long name in bold would run past its pill: squeeze it to the room there is, never beyond.
      const room = colW - 14 - inset, wide = (primary || alternative ? 6.8 : 6.3) * m.name.length;
      const fit = wide > room ? ` textLength="${room.toFixed(1)}" lengthAdjust="spacingAndGlyphs"` : '';
      parts.push(`<text${alternative ? ' class="s"' : ''} x="${x + inset}" y="${y + 16}"${fit}>${xml(m.name)}</text></g>`);
    });
    parts.push('</g>');
  });
  const y = top + colH + 26, half = (W - 2 * pad) / 2;
  const legend = (x: number, role: 'primary' | 'alternative', m: MethodId | '') => {
    const i = m ? FAMILY_STRIP.indexOf(METHOD_BY_ID[m].family) : -1;
    const mark = m ? `<g class="f${i}"><rect class="mark${role === 'alternative' ? ' open' : ''}" x="${x}" y="${y - 12}" width="22" height="14" rx="7"/></g>` : '';
    return `${mark}<text x="${x + (m ? 30 : 0)}" y="${y}"><tspan class="q">${role === 'primary' ? 'Primary' : 'Alternative'}  </tspan><tspan class="s">${xml(m ? METHOD_BY_ID[m].name : 'not chosen yet')}</tspan></text>`;
  };
  parts.push(legend(pad + 4, 'primary', d.primary), legend(pad + half + 4, 'alternative', d.alternative === d.primary ? '' : d.alternative), '</svg>');
  return parts.join('');
}

function applyToProject(doc: ProjectDoc, d: MethodChoice, inclusionId: string): void {
  const rep = doc.passport.representation;
  rep.primaryMethod = d.primary; rep.alternativeMethod = d.alternative;
  rep.justification = d.justification; rep.alternativeJustification = d.alternativeJustification;
  const copy = (doc.artefacts ?? []).find((i) => i.id === inclusionId);
  doc.methods = {
    ruleVersion: d.ruleVersion, answers: { ...d.answers }, answersKey: answersKey(d.answers),
    shortlist: [...d.shortlist], decidedAt: copy?.addedAt ?? null,
  };
}

export const methodChoice: KindDef<'method-choice'> = {
  kind: 'method-choice', label: 'Method choice', toolPath: '/toolbox/method', step: 'method', many: false,
  empty, sanitize, isEmpty: (d) => sameData(d, empty()), summary, markdown, figure, applyToProject,
};
