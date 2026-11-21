import { mdCell, mdLine, mdText, NOT_SPECIFIED } from '../../exports/mdText';
import { METHOD_BY_ID, type MethodId } from '../methods/registry';
import type { ProjectDoc } from '../passport/schema';
import { isId, isObj, items, numOrNull, numbers, own, sameData, text, type Warn } from './clean';
import type { KindDef } from './kinds';
import type { CheckPlan, CheckStatus, PlannedCheck } from './types';

export type CheckGroup = PlannedCheck['group'];
export const CHECK_GROUPS: readonly CheckGroup[] = ['verification', 'validation', 'calibration'];
export const CHECK_GROUP_LABELS: Record<CheckGroup, string> = { verification: 'Verification', validation: 'Validation', calibration: 'Calibration' };
export const CHECK_STATUSES: readonly CheckStatus[] = ['planned', 'done', 'passed', 'failed'];
export const CHECK_STATUS_LABELS: Record<CheckStatus, string> = { planned: 'planned', done: 'done', passed: 'passed', failed: 'failed' };

const empty = (): CheckPlan => ({
  method: '', checks: [],
  validation: { measure: '', tolerancePct: null, observed: [], simulated: [] },
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
  return {
    method, checks,
    validation: { measure: text(own(validation, 'measure'), 'validation.measure', warn), tolerancePct, observed, simulated },
    calibration: {
      parameters: text(own(calibration, 'parameters'), 'calibration.parameters', warn),
      tunedOn: text(own(calibration, 'tunedOn'), 'calibration.tunedOn', warn),
      validatedOn: text(own(calibration, 'validatedOn'), 'calibration.validatedOn', warn),
    },
  };
}

const written = (d: CheckPlan, group?: CheckGroup) => d.checks.filter((c) => c.text.trim() && (!group || c.group === group));

// ── Counting ─────────────────────────────────────────────────────────────

export interface CheckCounts { total: number; planned: number; done: number; passed: number; failed: number }

/** How many checks with a text there are, by status: of one group, or of the whole plan. */
export function checkCounts(d: CheckPlan, group?: CheckGroup): CheckCounts {
  const n: CheckCounts = { total: 0, planned: 0, done: 0, passed: 0, failed: 0 };
  for (const c of written(d, group)) { n.total++; n[c.status]++; }
  return n;
}

/** The order in which statuses are reported and drawn: settled ones first. */
const REPORT_ORDER: readonly CheckStatus[] = ['passed', 'failed', 'done', 'planned'];

/** “5 passed, 1 failed, 6 planned”; empty when there are no checks. */
export function countsText(n: CheckCounts, separator = ', '): string {
  return REPORT_ORDER.filter((s) => n[s] > 0).map((s) => `${n[s]} ${CHECK_STATUS_LABELS[s]}`).join(separator);
}
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ── Validation: observed against simulated ───────────────────────────────

export type ValidationVerdict =
  /** The mean simulated value lies within the tolerance of the mean observed value. */
  | 'within'
  | 'outside'
  /** No tolerance was set, so there is nothing to judge against. */
  | 'no-tolerance'
  /** The mean observed value is zero: a percentage of it is not defined. */
  | 'undefined';

export type ValidationComparison =
  | { ok: false; /** `empty`: no values at all. `unequal`: the two lists differ in length (one may be empty). */ reason: 'empty' | 'unequal'; nObserved: number; nSimulated: number }
  | {
    ok: true; n: number; meanObserved: number; meanSimulated: number;
    /** Mean error: the average of simulated − observed. Positive when the model runs high. */
    bias: number;
    /** Mean absolute error. */
    mae: number;
    /** Mean absolute percentage error, in percent; null when an observed value is zero. */
    mape: number | null;
    /** How many observed values are zero (the reason the percentage error is undefined). */
    zeroObserved: number;
    /** |mean simulated − mean observed| as a percentage of |mean observed|; null when the mean observed value is zero. */
    gapPct: number | null;
    verdict: ValidationVerdict;
  };

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/**
 * Compares simulated values with observed ones, pair by pair: value i of each list describes the same case.
 * The verdict is only about the two means and the tolerance; a value exactly on the tolerance counts as within.
 * It says nothing about whether the model is valid.
 */
export function compareValidation(observed: readonly number[], simulated: readonly number[], tolerancePct: number | null): ValidationComparison {
  const nObserved = observed.length, nSimulated = simulated.length;
  if (!nObserved && !nSimulated) return { ok: false, reason: 'empty', nObserved, nSimulated };
  if (nObserved !== nSimulated) return { ok: false, reason: 'unequal', nObserved, nSimulated };
  const errors = observed.map((o, i) => simulated[i] - o);
  const meanObserved = mean([...observed]), meanSimulated = mean([...simulated]);
  const zeroObserved = observed.filter((o) => o === 0).length;
  const mape = zeroObserved ? null : mean(errors.map((e, i) => Math.abs(e / observed[i]))) * 100;
  const gapPct = meanObserved === 0 ? null : (Math.abs(meanSimulated - meanObserved) / Math.abs(meanObserved)) * 100;
  const verdict: ValidationVerdict = tolerancePct === null ? 'no-tolerance' : gapPct === null ? 'undefined' : gapPct <= tolerancePct + 1e-9 ? 'within' : 'outside';
  return { ok: true, n: nObserved, meanObserved, meanSimulated, bias: mean(errors), mae: mean(errors.map(Math.abs)), mape, zeroObserved, gapPct, verdict };
}

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

/** One sentence on the two means and the tolerance. Never more than the numbers show. */
export function verdictSentence(c: ValidationComparison & { ok: true }, tolerancePct: number | null): string {
  const side = c.meanSimulated > c.meanObserved ? 'above' : 'below';
  const gap = c.gapPct === null ? '' : c.gapPct === 0 ? 'The mean simulated value equals the mean observed value' : `The mean simulated value is ${pct(c.gapPct)} ${side} the mean observed value`;
  switch (c.verdict) {
    case 'within': return `${gap}: within the ±${formatNumber(tolerancePct ?? 0)}% tolerance.`;
    case 'outside': return `${gap}: outside the ±${formatNumber(tolerancePct ?? 0)}% tolerance.`;
    case 'no-tolerance': return gap ? `${gap}. No tolerance was set, so there is nothing to judge it against.` : 'The mean observed value is zero and no tolerance was set.';
    default: return 'The mean observed value is zero, so a tolerance in percent cannot be applied.';
  }
}

/** The comparison as one line of evidence for a check. */
export function validationEvidence(c: ValidationComparison & { ok: true }, tolerancePct: number | null): string {
  const parts = [
    `n = ${c.n}`, `mean observed ${formatNumber(c.meanObserved)}`, `mean simulated ${formatNumber(c.meanSimulated)}`,
    `mean error ${signed(c.bias)}`, `mean absolute error ${formatNumber(c.mae)}`,
    c.mape === null ? 'mean absolute percentage error undefined (an observed value is zero)' : `mean absolute percentage error ${pct(c.mape)}`,
  ];
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

// ── Card summary ─────────────────────────────────────────────────────────

const clip = (s: string, max: number) => { const t = mdLine(s); return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t; };

function summary(d: CheckPlan): string[] {
  const all = checkCounts(d), v = d.validation;
  const cmp = compareValidation(v.observed, v.simulated, v.tolerancePct);
  const cal = d.calibration;
  const hasRecord = !!(cal.parameters.trim() || cal.tunedOn.trim() || cal.validatedOn.trim());
  if (!all.total && !v.measure.trim() && !cmp.ok && !hasRecord) return ['No checks yet.'];
  const L = [all.total ? `${plural(all.total, 'check')}: ${countsText(all)}` : 'No checks yet'];
  if (all.total) L.push(CHECK_GROUPS.map((g) => `${CHECK_GROUP_LABELS[g]} ${checkCounts(d, g).total}`).join(' · '));
  if (cmp.ok) {
    const tol = v.tolerancePct === null ? '' : `${formatNumber(v.tolerancePct)}% tolerance`;
    L.push(cmp.verdict === 'within' ? `Validation: mean within ${tol}` : cmp.verdict === 'outside' ? `Validation: mean outside ${tol}`
      : cmp.verdict === 'no-tolerance' ? `Validation: ${plural(cmp.n, 'value')} compared, no tolerance set` : 'Validation: mean observed is zero, tolerance not applicable');
  } else if (v.measure.trim()) L.push(`Validation measure: ${clip(v.measure, 80)}`);
  if (sameTuningAndValidationData(d)) L.push('Calibration: tuning and validation use the same data');
  else if (cal.parameters.trim()) L.push(`Tuned: ${clip(cal.parameters, 80)}`);
  if (d.method) L.push(`Method: ${METHOD_BY_ID[d.method].name}`);
  return L.slice(0, 5);
}

// ── Report section ───────────────────────────────────────────────────────

const GROUP_QUESTIONS: Record<CheckGroup, string> = {
  verification: 'did we build the model right?', validation: 'did we build the right model?', calibration: 'what did we tune, and on what?',
};

function markdown(d: CheckPlan): string[] {
  const L: string[] = [];
  const all = checkCounts(d);
  if (d.method) L.push(`- **Method:** ${METHOD_BY_ID[d.method].name}`);
  L.push(`- **Checks:** ${all.total ? `${all.total} (${countsText(all)})` : `_${NOT_SPECIFIED}_`}`, '');

  for (const g of CHECK_GROUPS) {
    const rows = written(d, g);
    if (!rows.length) { L.push(`**${CHECK_GROUP_LABELS[g]}:** no checks recorded.`, ''); continue; }
    L.push(`**${CHECK_GROUP_LABELS[g]}:** ${GROUP_QUESTIONS[g]} ${plural(rows.length, 'check')}: ${countsText(checkCounts(d, g))}.`, '');
    L.push('| Check | Status | Evidence |', '| --- | --- | --- |');
    rows.forEach((c) => L.push(`| ${mdCell(c.text)} | ${CHECK_STATUS_LABELS[c.status]} | ${mdCell(c.evidence)} |`));
    L.push('');
  }

  const v = d.validation, cmp = compareValidation(v.observed, v.simulated, v.tolerancePct);
  if (v.measure.trim() || v.tolerancePct !== null || !(cmp.ok === false && cmp.reason === 'empty')) {
    L.push('**Validation result:** simulated values compared with observed values, pair by pair.', '');
    L.push('| Quantity | Value |', '| --- | --- |');
    L.push(`| Measure | ${mdCell(v.measure, `_${NOT_SPECIFIED}_`)} |`, `| Tolerance | ${v.tolerancePct === null ? `_${NOT_SPECIFIED}_` : `±${formatNumber(v.tolerancePct)}% of the mean observed value`} |`);
    if (cmp.ok) {
      L.push(
        `| Pairs compared | ${cmp.n} |`, `| Mean observed | ${formatNumber(cmp.meanObserved)} |`, `| Mean simulated | ${formatNumber(cmp.meanSimulated)} |`,
        `| Mean error (simulated − observed) | ${signed(cmp.bias)} |`, `| Mean absolute error | ${formatNumber(cmp.mae)} |`,
        `| Mean absolute percentage error | ${cmp.mape === null ? `Undefined: ${plural(cmp.zeroObserved, 'observed value')} of zero` : pct(cmp.mape)} |`,
        `| Result | ${verdictSentence(cmp, v.tolerancePct)} |`,
      );
    } else if (cmp.reason === 'unequal') L.push(`| Values | ${cmp.nObserved} observed and ${cmp.nSimulated} simulated: the lists differ in length, so nothing was compared |`);
    L.push('');
    if (cmp.ok) L.push('Agreement on these data does not show that the model is valid for other uses.', '');
  }

  const c = d.calibration;
  L.push(`- **Parameters tuned:** ${mdText(c.parameters)}`, `- **Data used for tuning:** ${mdText(c.tunedOn)}`, `- **Data kept for validation:** ${mdText(c.validatedOn)}`);
  if (sameTuningAndValidationData(d)) L.push('- **Caution:** tuning and validation are described with the same data. Validation needs data that was not used for tuning.');
  L.push('');
  return L;
}

// ── Picture ──────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** The colours and line patterns of the “Verification, validation, calibration” diagram, with values for where no theme is loaded. */
export const CHECK_GROUP_STYLE: Record<CheckGroup, { color: string; dash: string }> = {
  verification: { color: 'var(--primary, #1f5f8b)', dash: '' },
  validation: { color: 'var(--success, #2f855a)', dash: '10 6' },
  calibration: { color: 'var(--warning, #b7791f)', dash: '1.5 7' },
};
const STATUS_FILL: Record<CheckStatus, string> = {
  passed: 'var(--success, #2f855a)', failed: 'var(--error, #c0392b)', done: 'var(--info, #5a6779)', planned: 'var(--border-strong, #b7c1cf)',
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
    out.push(`<text x="${X0 + 36}" y="${y + 11.5}" font-size="13" font-weight="650" fill="var(--text, #17202c)">${esc(CHECK_GROUP_LABELS[g])}</text>`);
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
          const hollow = s === 'planned';
          out.push(hollow
            ? `<rect x="${(x + 0.75).toFixed(2)}" y="${by + 0.75}" width="${Math.max(0.5, w - 1.5).toFixed(2)}" height="${bh - 1.5}" rx="2" fill="var(--bg-subtle, #eef1f5)" stroke="${STATUS_FILL[s]}" stroke-width="1.5"/>`
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
export function checkLines(d: CheckPlan, group: CheckGroup): string[] {
  const L = written(d, group).map((c, i) => `${i + 1}. ${mdLine(c.text)} — ${CHECK_STATUS_LABELS[c.status]}${c.evidence.trim() ? `. Evidence: ${mdLine(c.evidence)}` : ''}`);
  if (group === 'validation' && d.validation.measure.trim()) {
    L.push(`Measure: ${mdLine(d.validation.measure)}${d.validation.tolerancePct === null ? '' : `; tolerance set beforehand ±${d.validation.tolerancePct}%`}`);
  }
  if (group === 'calibration') {
    const c = d.calibration;
    if (c.parameters.trim()) L.push(`Parameters tuned: ${mdLine(c.parameters)}`);
    if (c.tunedOn.trim()) L.push(`Tuned on: ${mdLine(c.tunedOn)}`);
    if (c.validatedOn.trim()) L.push(`Validated on: ${mdLine(c.validatedOn)}`);
  }
  return L;
}

/** A group with nothing in it leaves the project field as it is, so text written by hand is never wiped. */
function applyToProject(doc: ProjectDoc, d: CheckPlan): void {
  for (const g of CHECK_GROUPS) {
    const lines = checkLines(d, g);
    if (lines.length) doc.passport.evaluation[g] = lines.join('\n');
  }
}

export const checkPlan: KindDef<'check-plan'> = {
  kind: 'check-plan', label: 'Check plan', toolPath: '/toolbox/checks', step: 'evaluation', many: false,
  empty, sanitize, isEmpty: (d) => sameData(d, empty()), summary, markdown, figure, applyToProject,
};
