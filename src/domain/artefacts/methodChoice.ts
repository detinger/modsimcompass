import { mdCell, mdText } from '../../exports/mdText';
import { METHOD_BY_ID, type MethodId } from '../methods/registry';
import { QUESTIONS, RULE_VERSION, answersKey, emptyAnswers, type MethodAnswers } from '../methods/rules';
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
  return {
    answers: readAnswers(rawAnswers, warn),
    ruleVersion: text(own(raw, 'ruleVersion'), 'ruleVersion', warn, 200) || RULE_VERSION,
    shortlist, primary: method('primary'), alternative: method('alternative'),
    justification: text(own(raw, 'justification'), 'justification', warn),
    alternativeJustification: text(own(raw, 'alternativeJustification'), 'alternativeJustification', warn),
  };
}

const answered = (d: MethodChoice) => Object.values(d.answers).filter((a) => a !== 'unsure').length;

function summary(d: MethodChoice): string[] {
  const L: string[] = [];
  L.push(d.primary ? `Primary: ${methodName(d.primary)}` : 'No primary method yet');
  if (d.alternative) L.push(`Alternative: ${methodName(d.alternative)}`);
  if (d.shortlist.length) L.push(`Shortlist: ${d.shortlist.map(methodName).join(', ')}`);
  const n = answered(d);
  if (n) L.push(`${n} of ${QUESTIONS.length} questions answered`);
  return L;
}

function markdown(d: MethodChoice): string[] {
  const L = [
    `- **Primary method:** ${mdText(methodName(d.primary))}`, `- **Justification:** ${mdText(d.justification)}`,
    `- **Alternative method:** ${mdText(methodName(d.alternative))}`, `- **Why the alternative is not the primary method:** ${mdText(d.alternativeJustification)}`,
  ];
  if (d.primary) L.push(`- **What the primary method leaves out:** ${METHOD_BY_ID[d.primary].omits.join('; ')}`);
  if (d.shortlist.length) L.push(`- **Shortlist:** ${d.shortlist.map(methodName).join(', ')}`);
  L.push('');
  const rows = QUESTIONS.filter((q) => d.answers[q.key] !== 'unsure');
  if (rows.length) {
    L.push('| Question | Answer |', '| --- | --- |');
    rows.forEach((q) => L.push(`| ${mdCell(q.prompt)} | ${mdCell(q.options.find((o) => o.value === d.answers[q.key])?.label ?? '')} |`));
    L.push('');
  }
  return L;
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
  empty, sanitize, isEmpty: (d) => sameData(d, empty()), summary, markdown, figure: () => null, applyToProject,
};
