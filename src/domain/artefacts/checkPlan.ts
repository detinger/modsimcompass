import { mdCell, mdLine, mdText } from '../../exports/mdText';
import { METHOD_BY_ID, type MethodId } from '../methods/registry';
import type { ProjectDoc } from '../passport/schema';
import { isId, isObj, items, numOrNull, numbers, own, sameData, text, type Warn } from './clean';
import type { KindDef } from './kinds';
import type { CheckPlan, CheckStatus, PlannedCheck } from './types';

export const CHECK_GROUPS: readonly PlannedCheck['group'][] = ['verification', 'validation', 'calibration'];
export const CHECK_GROUP_LABELS: Record<PlannedCheck['group'], string> = { verification: 'Verification', validation: 'Validation', calibration: 'Calibration' };
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

const written = (d: CheckPlan, group?: PlannedCheck['group']) => d.checks.filter((c) => c.text.trim() && (!group || c.group === group));

function summary(d: CheckPlan): string[] {
  const all = written(d);
  if (!all.length && !d.validation.measure.trim()) return ['No checks yet.'];
  const tally = CHECK_STATUSES.map((s) => [s, all.filter((c) => c.status === s).length] as const).filter(([, n]) => n > 0);
  const L = [`${all.length} check${all.length === 1 ? '' : 's'}${tally.length ? `: ${tally.map(([s, n]) => `${n} ${CHECK_STATUS_LABELS[s]}`).join(', ')}` : ''}`];
  L.push(CHECK_GROUPS.map((g) => `${CHECK_GROUP_LABELS[g]} ${written(d, g).length}`).join(' · '));
  if (d.method) L.push(`For ${METHOD_BY_ID[d.method].name}`);
  if (d.validation.measure.trim()) L.push(`Validation measure: ${mdLine(d.validation.measure).slice(0, 80)}`);
  return L;
}

function markdown(d: CheckPlan): string[] {
  const L: string[] = [];
  if (d.method) L.push(`- **Method:** ${METHOD_BY_ID[d.method].name}`, '');
  const all = written(d);
  if (!all.length) L.push('Checks: _Not yet specified_', '');
  else {
    L.push('| Kind | Check | Status | Evidence |', '| --- | --- | --- | --- |');
    for (const g of CHECK_GROUPS) written(d, g).forEach((c) => L.push(`| ${CHECK_GROUP_LABELS[g]} | ${mdCell(c.text)} | ${CHECK_STATUS_LABELS[c.status]} | ${mdCell(c.evidence)} |`));
    L.push('');
  }
  const v = d.validation, c = d.calibration;
  L.push(`- **Validation measure:** ${mdText(v.measure)}`, `- **Tolerance set beforehand:** ${v.tolerancePct === null ? '_Not yet specified_' : `±${v.tolerancePct}%`}`);
  if (v.observed.length || v.simulated.length) L.push(`- **Values compared:** ${v.observed.length} observed, ${v.simulated.length} simulated`);
  L.push(`- **Parameters tuned:** ${mdText(c.parameters)}`, `- **Tuned on:** ${mdText(c.tunedOn)}`, `- **Validated on:** ${mdText(c.validatedOn)}`, '');
  return L;
}

/** The numbered lines written into a project field for one group of checks. */
export function checkLines(d: CheckPlan, group: PlannedCheck['group']): string[] {
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
  empty, sanitize, isEmpty: (d) => sameData(d, empty()), summary, markdown, figure: () => null, applyToProject,
};
