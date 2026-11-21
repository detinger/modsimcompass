import { mdCell, mdLine, mdText, NOT_SPECIFIED } from '../../exports/mdText';
import { CALIBRATION_NOTE, profileFor, type MethodProfile } from '../methods/profiles';
import { METHOD_BY_ID, type MethodId } from '../methods/registry';
import type { ProjectDoc } from '../passport/schema';
import { isId, isObj, items, numOrNull, numbers, oneOf, own, sameData, text, type Warn } from './clean';
import type { KindDef } from './kinds';
import type { CheckPlan, CheckStatus, PlannedCheck } from './types';

export type ToleranceOn = CheckPlan['validation']['toleranceOn'];
export const TOLERANCE_ON: readonly ToleranceOn[] = ['pairs', 'means'];
export const TOLERANCE_ON_LABELS: Record<ToleranceOn, string> = { pairs: 'each pair', means: 'the means' };

export type CheckGroup = PlannedCheck['group'];
export const CHECK_GROUPS: readonly CheckGroup[] = ['verification', 'validation', 'calibration'];
export const CHECK_GROUP_LABELS: Record<CheckGroup, string> = { verification: 'Verification', validation: 'Validation', calibration: 'Calibration' };
export const CHECK_STATUSES: readonly CheckStatus[] = ['planned', 'done', 'passed', 'failed', 'na'];
export const CHECK_STATUS_LABELS: Record<CheckStatus, string> = { planned: 'planned', done: 'done', passed: 'passed', failed: 'failed', na: 'not applicable' };

// ── What the third check means for the method ────────────────────────────

export type CalibrationMode = MethodProfile['calibration'];
export interface CalibrationWords {
  /** Name of the third group: “Calibration”, or “Estimation” for a model estimated from data. */
  tab: string;
  question: string;
  record: string;
  parameters: string;
  /** Short word for a summary line: “Tuned” or “Estimated”. */
  done: string;
  usedOn: string; keptFor: string;
  /** Labels of the two circles of the separation picture. */
  usedShort: string; keptShort: string;
  /** Labels of the record in the project's own text. */
  usedLine: string; keptLine: string;
  caution: string;
  /** One line on what calibration means for the method (src/domain/methods/profiles.ts), or null for tuning. */
  note: string | null;
}
const TUNING_WORDS: Omit<CalibrationWords, 'note'> = {
  tab: 'Calibration', question: 'what did we tune, and on what?', record: 'Calibration record', parameters: 'Parameters tuned', done: 'Tuned',
  usedOn: 'Data used for tuning', keptFor: 'Data kept for validation', usedShort: 'Tuning', keptShort: 'Validation', usedLine: 'Tuned on', keptLine: 'Validated on',
  caution: 'tuning and validation are described with the same data. Validation needs data that was not used for tuning.',
};
export const CALIBRATION_WORDS: Record<CalibrationMode, Omit<CalibrationWords, 'note'>> = {
  tuning: TUNING_WORDS,
  // Values taken from data or the design: the same record, read with the note.
  parameters: TUNING_WORDS,
  // Nothing is tuned: the same stored fields hold what was estimated, on which data, and the cases kept for prediction.
  estimation: {
    tab: 'Estimation', question: 'what did we estimate, and on what?', record: 'Estimation record', parameters: 'Parameters estimated', done: 'Estimated',
    usedOn: 'Data used for estimation', keptFor: 'Cases kept for prediction', usedShort: 'Estimation', keptShort: 'Prediction', usedLine: 'Estimated on', keptLine: 'Predicted on',
    caution: 'estimation and prediction are described with the same data. A prediction check needs cases that were not used for estimation.',
  },
};
export const calibrationModeOf = (method: MethodId | ''): CalibrationMode => profileFor(method)?.calibration ?? 'tuning';
export const calibrationWords = (method: MethodId | ''): CalibrationWords => {
  const mode = calibrationModeOf(method);
  return { ...CALIBRATION_WORDS[mode], note: CALIBRATION_NOTE[mode] };
};
/** The name of a group for the plan's method. */
export const groupLabel = (method: MethodId | '', g: CheckGroup): string => (g === 'calibration' ? calibrationWords(method).tab : CHECK_GROUP_LABELS[g]);

const empty = (): CheckPlan => ({
  method: '', checks: [],
  validation: { measure: '', tolerancePct: null, toleranceOn: 'pairs', observed: [], simulated: [] },
  calibration: { parameters: '', tunedOn: '', validatedOn: '' },
});

function sanitize(raw: unknown, warn: Warn): CheckPlan | null {
  if (!isObj(raw)) return null;
  const rawChecks = items(own(raw, 'checks'), 'checks', warn), validation = own(raw, 'validation'), calibration = own(raw, 'calibration');
  if (!rawChecks || !isObj(validation) || !isObj(calibration)) return null;
  const observed = numbers(own(validation, 'observed'), 'validation.observed', warn), simulated = numbers(own(validation, 'simulated'), 'validation.simulated', warn);
  if (!observed || !simulated) return null;
  const checks: PlannedCheck[] = [], ids = new Set<string>();
  rawChecks.forEach((c, i) => {
    const id = isObj(c) ? own(c, 'id') : undefined;
    const group = isObj(c) ? CHECK_GROUPS.find((g) => g === own(c, 'group')) : undefined;
    const status = isObj(c) ? CHECK_STATUSES.find((s) => s === own(c, 'status')) : undefined;
    if (!isObj(c) || !isId(id) || ids.has(id) || !group || !status) { warn(`checks[${i}]: not a valid check; left out.`); return; }
    ids.add(id);
    checks.push({ id, group, text: text(own(c, 'text'), `checks[${i}].text`, warn), status, evidence: text(own(c, 'evidence'), `checks[${i}].evidence`, warn) });
  });
  const rawMethod = own(raw, 'method');
  const method: MethodId | '' = typeof rawMethod === 'string' && Object.hasOwn(METHOD_BY_ID, rawMethod) ? rawMethod as MethodId : '';
  if (rawMethod !== undefined && rawMethod !== '' && !method) warn('method: unknown method removed.');
  let tolerancePct = numOrNull(own(validation, 'tolerancePct'), 'validation.tolerancePct', warn);
  if (tolerancePct !== null && tolerancePct < 0) { warn('validation.tolerancePct: a tolerance cannot be negative; cleared.'); tolerancePct = null; }
  // A plan saved before the choice existed: each pair when the values can be paired, otherwise the means.
  const toleranceOn = own(validation, 'toleranceOn') === undefined
    ? defaultToleranceOn(observed, simulated)
    : oneOf(own(validation, 'toleranceOn'), TOLERANCE_ON, defaultToleranceOn(observed, simulated), 'validation.toleranceOn', warn);
  return {
    method, checks,
    validation: { measure: text(own(validation, 'measure'), 'validation.measure', warn), tolerancePct, toleranceOn, observed, simulated },
    calibration: {
      parameters: text(own(calibration, 'parameters'), 'calibration.parameters', warn),
      tunedOn: text(own(calibration, 'tunedOn'), 'calibration.tunedOn', warn),
      validatedOn: text(own(calibration, 'validatedOn'), 'calibration.validatedOn', warn),
    },
  };
}

const written = (d: CheckPlan, group?: CheckGroup) => d.checks.filter((c) => c.text.trim() && (!group || c.group === group));

// ── Counting ─────────────────────────────────────────────────────────────

/** `na` checks are counted in `total` but are never open (`planned`) or failed. */
export interface CheckCounts { total: number; planned: number; done: number; passed: number; failed: number; na: number }

/** How many checks with a text there are, by status: of one group, or of the whole plan. */
export function checkCounts(d: CheckPlan, group?: CheckGroup): CheckCounts {
  const n: CheckCounts = { total: 0, planned: 0, done: 0, passed: 0, failed: 0, na: 0 };
  for (const c of written(d, group)) { n.total++; n[c.status]++; }
  return n;
}

/** The order in which statuses are reported and drawn: settled ones first. */
const REPORT_ORDER: readonly CheckStatus[] = ['passed', 'failed', 'done', 'planned', 'na'];

/** “5 passed, 1 failed, 6 planned”; empty when there are no checks. */
export function countsText(n: CheckCounts, separator = ', '): string {
  return REPORT_ORDER.filter((s) => n[s] > 0).map((s) => `${n[s]} ${CHECK_STATUS_LABELS[s]}`).join(separator);
}
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ── Validation: observed against simulated ───────────────────────────────

export type ValidationVerdict =
  /** Within the tolerance, judged on the chosen criterion. */
  | 'within'
  | 'outside'
  /** No tolerance was set, so there is nothing to judge against. */
  | 'no-tolerance'
  /** A percentage is not defined: an observed value is zero (each pair), or the mean observed value is zero (the means). */
  | 'undefined'
  /** The tolerance applies to each pair, but the lists differ in length: there are no pairs to judge. */
  | 'unpaired';

export type ValidationComparison =
  | { ok: false; /** `empty`: no values at all. `missing`: one of the two lists is empty. */ reason: 'empty' | 'missing'; nObserved: number; nSimulated: number }
  | {
    ok: true;
    /** The criterion the verdict uses. */
    toleranceOn: ToleranceOn;
    /** True when the lists have equal length, so value i of each is a pair. */
    paired: boolean;
    /** Pairs compared; zero when the lists cannot be paired. */
    n: number;
    nObserved: number; nSimulated: number;
    meanObserved: number; meanSimulated: number;
    /** |mean simulated − mean observed| as a percentage of |mean observed|; null when the mean observed value is zero. */
    gapPct: number | null;
    /** Mean error: the average of simulated − observed. Positive when the model runs high. Null without pairs. */
    bias: number | null;
    /** Mean absolute error. Null without pairs. */
    mae: number | null;
    /** Mean absolute percentage error over the pairs, in percent; null without pairs or when an observed value is zero. */
    mape: number | null;
    /** How many observed values are zero (the reason the percentage error is undefined). */
    zeroObserved: number;
    verdict: ValidationVerdict;
  };

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** For data without a stated criterion: each pair when the lists can be paired, otherwise the means. */
export const defaultToleranceOn = (observed: readonly number[], simulated: readonly number[]): ToleranceOn => (observed.length === simulated.length ? 'pairs' : 'means');
/** The criterion of a validation record, also for one stored before the choice existed. */
export const toleranceOnOf = (v: { toleranceOn?: unknown; observed: readonly number[]; simulated: readonly number[] }): ToleranceOn =>
  (v.toleranceOn === 'pairs' || v.toleranceOn === 'means' ? v.toleranceOn : defaultToleranceOn(v.observed, v.simulated));

/**
 * Compares simulated with observed values. With `pairs`, value i of each list describes the same case, and the
 * tolerance applies to the mean absolute percentage error over the pairs, so errors of opposite sign cannot cancel.
 * With `means`, only the two means are compared, and the lists may differ in length.
 * A value exactly on the tolerance counts as within. The verdict says nothing about whether the model is valid.
 */
export function compareValidation(observed: readonly number[], simulated: readonly number[], tolerancePct: number | null, toleranceOn: ToleranceOn = 'pairs'): ValidationComparison {
  const nObserved = observed.length, nSimulated = simulated.length;
  if (!nObserved && !nSimulated) return { ok: false, reason: 'empty', nObserved, nSimulated };
  if (!nObserved || !nSimulated) return { ok: false, reason: 'missing', nObserved, nSimulated };
  const paired = nObserved === nSimulated;
  const meanObserved = mean([...observed]), meanSimulated = mean([...simulated]);
  const gapPct = meanObserved === 0 ? null : (Math.abs(meanSimulated - meanObserved) / Math.abs(meanObserved)) * 100;
  const zeroObserved = observed.filter((o) => o === 0).length;
  const errors = paired ? observed.map((o, i) => simulated[i] - o) : null;
  const mape = errors && !zeroObserved ? mean(errors.map((e, i) => Math.abs(e / observed[i]))) * 100 : null;
  const judged = toleranceOn === 'pairs' ? mape : gapPct;
  const verdict: ValidationVerdict = tolerancePct === null ? 'no-tolerance'
    : toleranceOn === 'pairs' && !paired ? 'unpaired'
    : judged === null ? 'undefined'
    : judged <= tolerancePct + 1e-9 ? 'within' : 'outside';
  return {
    ok: true, toleranceOn, paired, n: paired ? nObserved : 0, nObserved, nSimulated, meanObserved, meanSimulated, gapPct,
    bias: errors ? mean(errors) : null, mae: errors ? mean(errors.map(Math.abs)) : null, mape, zeroObserved, verdict,
  };
}

/** The comparison of a validation record, with its own criterion. */
export const compareRecord = (v: CheckPlan['validation']): ValidationComparison => compareValidation(v.observed, v.simulated, v.tolerancePct, toleranceOnOf(v));

/** A number for text output: four significant digits, no thousands separators, the same in every locale. */
export function formatNumber(x: number): string {
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e9 || a < 1e-4) return x.toExponential(2).replace('e+', 'e');
  return String(Number(x.toPrecision(a >= 1000 ? Math.max(4, Math.floor(Math.log10(a)) + 1) : 4))).replace(/^-/, '−');
}
const signed = (x: number) => (x > 0 ? `+${formatNumber(x)}` : formatNumber(x));
const pct = (x: number) => `${formatNumber(Number(x.toFixed(x < 10 ? 2 : 1)))}%`;

/** One sentence on the result and the tolerance, under the chosen criterion. Never more than the numbers show. */
export function verdictSentence(c: ValidationComparison & { ok: true }, tolerancePct: number | null): string {
  const tol = `±${formatNumber(tolerancePct ?? 0)}%`;
  const side = c.meanSimulated > c.meanObserved ? 'above' : 'below';
  const means = c.gapPct === null ? '' : c.gapPct === 0 ? 'The mean simulated value equals the mean observed value' : `The mean simulated value is ${pct(c.gapPct)} ${side} the mean observed value`;
  const pairs = c.mape === null ? '' : `The mean absolute percentage error over the ${plural(c.n, 'pair')} is ${pct(c.mape)}`;
  const lead = c.toleranceOn === 'pairs' ? pairs : means;
  const on = c.toleranceOn === 'pairs' ? 'on each pair' : 'on the means';
  switch (c.verdict) {
    case 'within': return `${lead}: within the ${tol} tolerance ${on}.`;
    case 'outside': return `${lead}: outside the ${tol} tolerance ${on}.`;
    case 'unpaired': return `The tolerance applies to each pair, but there are ${c.nObserved} observed and ${c.nSimulated} simulated values: no pairs, so no verdict.`;
    case 'no-tolerance': return lead ? `${lead}. No tolerance was set, so there is nothing to judge it against.` : 'No tolerance was set, so there is nothing to judge against.';
    default: return c.toleranceOn === 'pairs'
      ? 'An observed value is zero, so a percentage error per pair is not defined: no verdict.'
      : 'The mean observed value is zero, so a tolerance in percent cannot be applied.';
  }
}

/** The comparison as one line of evidence for a check. */
export function validationEvidence(c: ValidationComparison & { ok: true }, tolerancePct: number | null): string {
  const parts = c.paired
    ? [
      `n = ${c.n}`, `mean observed ${formatNumber(c.meanObserved)}`, `mean simulated ${formatNumber(c.meanSimulated)}`,
      `mean error ${signed(c.bias ?? 0)}`, `mean absolute error ${formatNumber(c.mae ?? 0)}`,
      c.mape === null ? 'mean absolute percentage error undefined (an observed value is zero)' : `mean absolute percentage error ${pct(c.mape)}`,
    ]
    : [`${c.nObserved} observed and ${c.nSimulated} simulated values, not paired`, `mean observed ${formatNumber(c.meanObserved)}`, `mean simulated ${formatNumber(c.meanSimulated)}`];
  parts.push(`difference of the means ${c.gapPct === null ? 'undefined (the mean observed value is zero)' : pct(c.gapPct)}`);
  return `${parts.join('; ')}. ${verdictSentence(c, tolerancePct)}`;
}

/** The status a check gets when it is made from the comparison: the user's own record from then on. */
export const verdictStatus = (v: ValidationVerdict): CheckStatus => (v === 'within' ? 'passed' : v === 'outside' ? 'failed' : 'done');

const same = (a: string, b: string) => a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();
/** True when both data descriptions are filled in and say the same thing: validation would reuse the tuning data. */
export function sameTuningAndValidationData(d: CheckPlan): boolean {
  const { tunedOn, validatedOn } = d.calibration;
  return !!tunedOn.trim() && !!validatedOn.trim() && same(tunedOn, validatedOn);
}

// ── Editing (pure; the tool calls these inside `setData`) ───────────────

/** A check as the library offers it. Structurally the same as `StandardCheck` in src/content/checks.ts. */
export interface LibraryCheck { id: string; group: CheckGroup; text: string }

/** The id a plan gives to a check taken from the library, so the library can show it as added. */
export const libraryPlanId = (libraryId: string): string => `std-${libraryId}`;
/** The id of the check made from the validation calculator: one per plan, refreshed when recorded again. */
export const CALCULATOR_CHECK_ID = 'calc-validation';

/** True when the plan already holds this library check. */
export const hasLibraryCheck = (d: CheckPlan, libraryId: string): boolean => d.checks.some((c) => c.id === libraryPlanId(libraryId));

/** Adds checks from the library, as planned, skipping the ones already in the plan. Returns how many were added. */
export function addLibraryChecks(d: CheckPlan, list: readonly LibraryCheck[]): number {
  let added = 0;
  for (const k of list) {
    if (hasLibraryCheck(d, k.id) || d.checks.length >= 2000) continue;
    d.checks.push({ id: libraryPlanId(k.id), group: k.group, text: k.text, status: 'planned', evidence: '' });
    added++;
  }
  return added;
}

/**
 * Adds a check written by the user. `id` must be new and valid (letters, digits, `-`, `_`); text is trimmed and
 * nothing is added when it is empty. Returns true when a check was added.
 */
export function addOwnCheck(d: CheckPlan, group: CheckGroup, text: string, id: string): boolean {
  const t = text.trim();
  if (!t || !isId(id) || d.checks.some((c) => c.id === id) || d.checks.length >= 2000) return false;
  d.checks.push({ id, group, text: t.slice(0, 20_000), status: 'planned', evidence: '' });
  return true;
}

/** Changes one check. Unknown ids are ignored. */
export function editCheck(d: CheckPlan, id: string, change: Partial<Pick<PlannedCheck, 'text' | 'status' | 'evidence'>>): void {
  const c = d.checks.find((x) => x.id === id);
  if (c) Object.assign(c, change);
}

/** Removes one check and returns it with its position, so it can be put back. */
export function removeCheck(d: CheckPlan, id: string): { check: PlannedCheck; index: number } | null {
  const index = d.checks.findIndex((c) => c.id === id);
  if (index < 0) return null;
  const [check] = d.checks.splice(index, 1);
  return { check, index };
}

/** Puts a removed check back where it was (or at the end), unless a check with its id exists again. */
export function restoreCheck(d: CheckPlan, removed: { check: PlannedCheck; index: number }): void {
  if (d.checks.some((c) => c.id === removed.check.id)) return;
  d.checks.splice(Math.min(removed.index, d.checks.length), 0, removed.check);
}

/** Moves a check one place up or down within its own group. */
export function moveCheck(d: CheckPlan, id: string, dir: -1 | 1): void {
  const i = d.checks.findIndex((c) => c.id === id);
  if (i < 0) return;
  const group = d.checks[i].group;
  let j = i + dir;
  while (j >= 0 && j < d.checks.length && d.checks[j].group !== group) j += dir;
  if (j < 0 || j >= d.checks.length) return;
  [d.checks[i], d.checks[j]] = [d.checks[j], d.checks[i]];
}

/**
 * Records the calculator's comparison as a validation check, or refreshes the one recorded before. Its status follows
 * the verdict (within → passed, outside → failed, otherwise done) and stays the user's to change. Returns false when
 * there is nothing to compare.
 */
export function recordValidationCheck(d: CheckPlan): boolean {
  const v = d.validation, cmp = compareRecord(v);
  if (!cmp.ok) return false;
  const text = `Compare simulated with observed values${v.measure.trim() ? `: ${mdLine(v.measure)}` : ''}`;
  const evidence = validationEvidence(cmp, v.tolerancePct), status = verdictStatus(cmp.verdict);
  const existing = d.checks.find((c) => c.id === CALCULATOR_CHECK_ID);
  if (existing) Object.assign(existing, { group: 'validation', text, evidence, status });
  else d.checks.push({ id: CALCULATOR_CHECK_ID, group: 'validation', text, status, evidence });
  return true;
}

/** How the calibration record stands: both data sets named and described differently, described the same, or not yet both named. Only the descriptions are compared. */
export type DataSeparation = 'separate' | 'same' | 'incomplete';
export function dataSeparation(d: CheckPlan): DataSeparation {
  if (sameTuningAndValidationData(d)) return 'same';
  return d.calibration.tunedOn.trim() && d.calibration.validatedOn.trim() ? 'separate' : 'incomplete';
}

// ── Card summary ─────────────────────────────────────────────────────────

const clip = (s: string, max: number) => { const t = mdLine(s); return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t; };

function summary(d: CheckPlan): string[] {
  const all = checkCounts(d), v = d.validation;
  const cmp = compareRecord(v);
  const cal = d.calibration;
  const hasRecord = !!(cal.parameters.trim() || cal.tunedOn.trim() || cal.validatedOn.trim());
  if (!all.total && !v.measure.trim() && !cmp.ok && !hasRecord) return ['No checks yet.'];
  const L = [all.total ? `${plural(all.total, 'check')}: ${countsText(all)}` : 'No checks yet'];
  if (all.total) L.push(CHECK_GROUPS.map((g) => `${groupLabel(d.method, g)} ${checkCounts(d, g).total}`).join(' · '));
  if (cmp.ok) {
    const tol = v.tolerancePct === null ? '' : `${formatNumber(v.tolerancePct)}% tolerance on ${TOLERANCE_ON_LABELS[cmp.toleranceOn]}`;
    L.push(cmp.verdict === 'within' ? `Validation: within ${tol}` : cmp.verdict === 'outside' ? `Validation: outside ${tol}`
      : cmp.verdict === 'no-tolerance' ? `Validation: ${cmp.paired ? plural(cmp.n, 'pair') : 'values'} compared, no tolerance set`
      : cmp.verdict === 'unpaired' ? 'Validation: tolerance on each pair, but the lists differ in length'
      : 'Validation: a percentage is not defined (an observed value is zero)');
  } else if (v.measure.trim()) L.push(`Validation measure: ${clip(v.measure, 80)}`);
  const words = calibrationWords(d.method);
  if (sameTuningAndValidationData(d)) L.push(`${words.tab}: ${words.usedShort.toLowerCase()} and ${words.keptShort.toLowerCase()} use the same data`);
  else if (cal.parameters.trim()) L.push(`${words.done}: ${clip(cal.parameters, 80)}`);
  if (d.method) L.push(`Method: ${METHOD_BY_ID[d.method].name}`);
  return L.slice(0, 5);
}

// ── Report section ───────────────────────────────────────────────────────

const GROUP_QUESTIONS: Record<Exclude<CheckGroup, 'calibration'>, string> = {
  verification: 'did we build the model right?', validation: 'did we build the right model?',
};
const groupQuestion = (method: MethodId | '', g: CheckGroup) => (g === 'calibration' ? calibrationWords(method).question : GROUP_QUESTIONS[g]);

/**
 * The method whose words a plan is read in: its own, or, for a plan with no method, the primary method of the project it
 * is in. The plan's own record (`d.method`) never changes; only the words of the third area and its record follow.
 */
export function wordsMethod(d: Pick<CheckPlan, 'method'>, doc?: Pick<ProjectDoc, 'passport'>): MethodId | '' {
  if (d.method) return d.method;
  const m = doc?.passport?.representation?.primaryMethod;
  return typeof m === 'string' && Object.hasOwn(METHOD_BY_ID, m) ? (m as MethodId) : '';
}

/** The report section of a plan, read in the words of `words` (the plan's method unless the project gives one). */
export function checkPlanMarkdown(d: CheckPlan, words: MethodId | '' = d.method): string[] {
  const L: string[] = [];
  const all = checkCounts(d);
  if (d.method) L.push(`- **Method:** ${METHOD_BY_ID[d.method].name}`);
  L.push(`- **Checks:** ${all.total ? `${all.total} (${countsText(all)})` : `_${NOT_SPECIFIED}_`}`, '');

  for (const g of CHECK_GROUPS) {
    const rows = written(d, g);
    if (!rows.length) { L.push(`**${groupLabel(words, g)}:** no checks recorded.`, ''); continue; }
    L.push(`**${groupLabel(words, g)}:** ${groupQuestion(words, g)} ${plural(rows.length, 'check')}: ${countsText(checkCounts(d, g))}.`, '');
    L.push('| Check | Status | Evidence |', '| --- | --- | --- |');
    rows.forEach((c) => L.push(`| ${mdCell(c.text)} | ${CHECK_STATUS_LABELS[c.status]} | ${mdCell(c.evidence)} |`));
    L.push('');
  }

  const v = d.validation, on = toleranceOnOf(v), cmp = compareRecord(v);
  if (v.measure.trim() || v.tolerancePct !== null || !(cmp.ok === false && cmp.reason === 'empty')) {
    L.push(`**Validation result:** simulated values compared with observed values; the tolerance applies to ${TOLERANCE_ON_LABELS[on]}.`, '');
    L.push('| Quantity | Value |', '| --- | --- |');
    const tolerance = v.tolerancePct === null ? `_${NOT_SPECIFIED}_`
      : on === 'pairs' ? `±${formatNumber(v.tolerancePct)}%, on each pair (mean absolute percentage error)` : `±${formatNumber(v.tolerancePct)}%, on the means (difference of the means, as a share of the mean observed value)`;
    L.push(`| Measure | ${mdCell(v.measure, `_${NOT_SPECIFIED}_`)} |`, `| Tolerance | ${tolerance} |`);
    if (cmp.ok) {
      L.push(cmp.paired ? `| Pairs compared | ${cmp.n} |` : `| Values | ${cmp.nObserved} observed and ${cmp.nSimulated} simulated, not paired |`);
      L.push(`| Mean observed | ${formatNumber(cmp.meanObserved)} |`, `| Mean simulated | ${formatNumber(cmp.meanSimulated)} |`,
        `| Difference of the means | ${cmp.gapPct === null ? 'Undefined: the mean observed value is zero' : pct(cmp.gapPct)} |`);
      if (cmp.paired) {
        L.push(`| Mean error (simulated − observed) | ${signed(cmp.bias ?? 0)} |`, `| Mean absolute error | ${formatNumber(cmp.mae ?? 0)} |`,
          `| Mean absolute percentage error | ${cmp.mape === null ? `Undefined: ${plural(cmp.zeroObserved, 'observed value')} of zero` : pct(cmp.mape)} |`);
      }
      L.push(`| Result | ${verdictSentence(cmp, v.tolerancePct)} |`);
    } else if (cmp.reason === 'missing') L.push(`| Values | ${cmp.nObserved} observed and ${cmp.nSimulated} simulated: one list is empty, so nothing was compared |`);
    L.push('');
    if (cmp.ok) L.push('Agreement on these data does not show that the model is valid for other uses.', '');
  }

  const c = d.calibration, w = calibrationWords(words);
  if (w.note) L.push(`- **${w.tab}:** ${w.note}`);
  L.push(`- **${w.parameters}:** ${mdText(c.parameters)}`, `- **${w.usedOn}:** ${mdText(c.tunedOn)}`, `- **${w.keptFor}:** ${mdText(c.validatedOn)}`);
  if (sameTuningAndValidationData(d)) L.push(`- **Caution:** ${w.caution}`);
  L.push('');
  return L;
}
const markdown = (d: CheckPlan): string[] => checkPlanMarkdown(d);

// ── Picture ──────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** The colours and line patterns of the “Verification, validation, calibration” diagram, with values for where no theme is loaded. */
export const CHECK_GROUP_STYLE: Record<CheckGroup, { color: string; dash: string }> = {
  verification: { color: 'var(--primary, #1f5f8b)', dash: '' },
  validation: { color: 'var(--success, #2f855a)', dash: '10 6' },
  calibration: { color: 'var(--warning, #b7791f)', dash: '1.5 7' },
};
const STATUS_FILL: Record<CheckStatus, string> = {
  passed: 'var(--success, #2f855a)', failed: 'var(--error, #c0392b)', done: 'var(--info, #5a6779)', planned: 'var(--border-strong, #b7c1cf)', na: 'var(--text-subtle, #6b7787)',
};

/**
 * The three links of the diagram, one row each: its line in the diagram's colour and pattern, a bar with one
 * block per check coloured by status, and the counts in words. No user text is drawn.
 */
function figure(d: CheckPlan): string | null {
  if (!checkCounts(d).total) return null;
  const W = 320, ROW = 50, X0 = 12, BAR = W - 2 * X0, H = 8 + ROW * CHECK_GROUPS.length;
  const font = 'font-family="Inter, system-ui, -apple-system, Segoe UI, sans-serif"';
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" ${font}>`];
  CHECK_GROUPS.forEach((g, gi) => {
    const y = 8 + gi * ROW, n = checkCounts(d, g), style = CHECK_GROUP_STYLE[g];
    out.push(`<path d="M${X0 + 1.5},${y + 7} H${X0 + 28}" fill="none" stroke="${style.color}" stroke-width="3" stroke-linecap="round"${style.dash ? ` stroke-dasharray="${style.dash}"` : ''}/>`);
    out.push(`<text x="${X0 + 36}" y="${y + 11.5}" font-size="13" font-weight="650" fill="var(--text, #17202c)">${esc(groupLabel(d.method, g))}</text>`);
    out.push(`<text x="${W - X0}" y="${y + 11.5}" font-size="11" text-anchor="end" fill="var(--text-muted, #4b5867)">${esc(n.total ? plural(n.total, 'check') : 'no checks')}</text>`);
    const by = y + 19, bh = 9;
    if (!n.total) out.push(`<rect x="${X0}" y="${by}" width="${BAR}" height="${bh}" rx="3" fill="none" stroke="var(--border-strong, #b7c1cf)" stroke-dasharray="3 3"/>`);
    else {
      // One block per check while they stay readable; proportional blocks per status beyond that.
      const units = n.total <= 40;
      const gap = 2, parts = units ? n.total : REPORT_ORDER.filter((s) => n[s] > 0).length;
      const room = BAR - gap * (parts - 1);
      let x = X0;
      for (const s of REPORT_ORDER) {
        if (!n[s]) continue;
        const blocks = units ? n[s] : 1, w = units ? room / n.total : (room * n[s]) / n.total;
        for (let i = 0; i < blocks; i++) {
          // Planned checks are hollow; checks that do not apply are hollow with a dashed, neutral outline.
          const hollow = s === 'planned' || s === 'na';
          out.push(hollow
            ? `<rect x="${(x + 0.75).toFixed(2)}" y="${by + 0.75}" width="${Math.max(0.5, w - 1.5).toFixed(2)}" height="${bh - 1.5}" rx="2" fill="var(--bg-subtle, #eef1f5)" stroke="${STATUS_FILL[s]}" stroke-width="1.5"${s === 'na' ? ' stroke-dasharray="2 2"' : ''}/>`
            : `<rect x="${x.toFixed(2)}" y="${by}" width="${w.toFixed(2)}" height="${bh}" rx="2" fill="${STATUS_FILL[s]}"/>`);
          x += w + gap;
        }
      }
      out.push(`<text x="${X0}" y="${by + bh + 13}" font-size="11" fill="var(--text-muted, #4b5867)">${esc(countsText(n, ' · '))}</text>`);
    }
  });
  out.push('</svg>');
  return out.join('');
}

/** The numbered lines written into a project field for one group of checks. */
export function checkLines(d: CheckPlan, group: CheckGroup, words: MethodId | '' = d.method): string[] {
  const L = written(d, group).map((c, i) => `${i + 1}. ${mdLine(c.text)} — ${c.status === 'na'
    ? `Not applicable${c.evidence.trim() ? `: ${mdLine(c.evidence)}` : ''}`
    : `${CHECK_STATUS_LABELS[c.status]}${c.evidence.trim() ? `. Evidence: ${mdLine(c.evidence)}` : ''}`}`);
  if (group === 'validation' && d.validation.measure.trim()) {
    L.push(`Measure: ${mdLine(d.validation.measure)}${d.validation.tolerancePct === null ? '' : `; tolerance set beforehand ±${formatNumber(d.validation.tolerancePct)}% on ${TOLERANCE_ON_LABELS[toleranceOnOf(d.validation)]}`}`);
  }
  if (group === 'calibration') {
    const c = d.calibration, w = calibrationWords(words);
    if (c.parameters.trim()) L.push(`${w.parameters}: ${mdLine(c.parameters)}`);
    if (c.tunedOn.trim()) L.push(`${w.usedLine}: ${mdLine(c.tunedOn)}`);
    if (c.validatedOn.trim()) L.push(`${w.keptLine}: ${mdLine(c.validatedOn)}`);
  }
  return L;
}

/**
 * A group with nothing in it leaves the project field as it is, so text written by hand is never wiped. A plan with no
 * method is written in the words of the project's primary method, as step 5 and the report read it.
 */
function applyToProject(doc: ProjectDoc, d: CheckPlan): void {
  const words = wordsMethod(d, doc);
  for (const g of CHECK_GROUPS) {
    const lines = checkLines(d, g, words);
    if (lines.length) doc.passport.evaluation[g] = lines.join('\n');
  }
}

export const checkPlan: KindDef<'check-plan'> = {
  kind: 'check-plan', label: 'Check plan', toolPath: '/toolbox/checks', step: 'evaluation', many: false,
  empty, sanitize, isEmpty: (d) => sameData(d, empty()), summary, markdown, figure, applyToProject,
};
