import { mdCell, mdText } from '../../exports/mdText';
import { FAMILIES, describeLaw, isKind, type Kind } from '../distributions/laws';
import { newId, type Availability, type InputRow, type ProjectDoc } from '../passport/schema';
import { isNum, isObj, items, numOrNull, numbers, oneOf, own, sameData, text, type Warn } from './clean';
import type { KindDef } from './kinds';
import type { DataModel } from './types';

/** Families whose single parameter is a list of numbers: probabilities, or the observations themselves. */
export const LIST_FAMILIES: readonly Kind[] = ['categorical', 'empirical'];
export const LIST_FAMILY_MAX = 256;
const ORIGINS = ['fitted', 'described', 'manual'] as const;
const AVAILABILITIES: readonly Availability[] = ['', 'have', 'obtainable', 'assume'];
const ORIGIN_TEXT: Record<DataModel['origin'], string> = { fitted: 'Fitted to data', described: 'Described without data', manual: 'Set by hand' };
const AVAILABILITY_TEXT: Record<Availability, string> = { '': 'Not decided', have: 'Have it', obtainable: 'Can get it', assume: 'Must assume' };

const empty = (): DataModel => ({
  name: '', unit: '', family: 'normal', params: [0, 1], origin: 'manual', provenance: '', uncertainty: '', availability: '', plan: '',
  summary: null, fit: null, generator: { seed: '12345', n: 100 }, keepData: false, data: [],
});

/** True when `params` has the number of values the family takes. */
export const paramsFit = (family: Kind, params: number[]): boolean =>
  (LIST_FAMILIES.includes(family) ? params.length >= 1 && params.length <= LIST_FAMILY_MAX : params.length === FAMILIES[family].params.length);
/** The parameter fields `lawFor` and `describeLaw` expect for a stored model. */
export const lawFields = (family: Kind, params: number[]): (number | string)[] => (LIST_FAMILIES.includes(family) ? [params.join(', ')] : [...params]);
/** The distribution in words, for example “Gamma(shape 2, scale 3)”. */
export function describeModel(d: Pick<DataModel, 'family' | 'params'>): string {
  if (d.family === 'empirical' && d.params.length > 12) return `Empirical(${d.params.length} equally weighted observations)`;
  return describeLaw(d.family, lawFields(d.family, d.params));
}
/** Raw data leaves memory only when the user asked to keep it. */
export const withoutUnkeptData = (d: DataModel): DataModel => (d.keepData || d.data.length === 0 ? d : { ...d, data: [] });

function readSummary(x: unknown, warn: Warn): DataModel['summary'] {
  if (x === null || x === undefined) return null;
  if (isObj(x)) {
    const n = own(x, 'n'), m = own(x, 'mean'), sd = own(x, 'sd'), min = own(x, 'min'), max = own(x, 'max');
    if (isNum(n) && Number.isInteger(n) && n >= 0 && isNum(m) && isNum(sd) && isNum(min) && isNum(max)) return { n, mean: m, sd, min, max };
  }
  warn('summary: not a data summary; removed.');
  return null;
}

function readFit(x: unknown, warn: Warn): DataModel['fit'] {
  if (x === null || x === undefined) return null;
  const bad = () => { warn('fit: not a fit record; removed.'); return null; };
  if (!isObj(x)) return bad();
  const rank = own(x, 'rank'), ksD = own(x, 'ksD'), list = items(own(x, 'candidates'), 'fit.candidates', warn, 50);
  if (!isNum(rank) || !Number.isInteger(rank) || rank < 1 || !list || !(ksD === null || ksD === undefined || isNum(ksD))) return bad();
  const candidates: { family: Kind; aic: number }[] = [];
  for (const c of list) {
    const family = isObj(c) ? own(c, 'family') : undefined, aic = isObj(c) ? own(c, 'aic') : undefined;
    if (typeof family !== 'string' || !isKind(family) || !isNum(aic)) return bad();
    candidates.push({ family, aic });
  }
  return { rank, candidates, ksD: isNum(ksD) ? ksD : null };
}

function sanitize(raw: unknown, warn: Warn): DataModel | null {
  if (!isObj(raw)) return null;
  const family = own(raw, 'family'), generator = own(raw, 'generator');
  const params = numbers(own(raw, 'params'), 'params', warn, LIST_FAMILY_MAX), data = numbers(own(raw, 'data'), 'data', warn);
  if (typeof family !== 'string' || !isKind(family) || !params || !paramsFit(family, params) || !isObj(generator) || !data) return null;
  const keepData = own(raw, 'keepData') === true;
  if (!keepData && data.length) warn('data: raw data was not marked to be kept; left out.');
  const n = own(generator, 'n');
  const validN = isNum(n) && Number.isInteger(n) && n >= 1 && n <= 100_000;
  if (!validN && n !== undefined) warn('generator.n: reset to 100.');
  return {
    name: text(own(raw, 'name'), 'name', warn, 200), unit: text(own(raw, 'unit'), 'unit', warn, 200),
    family, params,
    origin: oneOf(own(raw, 'origin'), ORIGINS, 'manual', 'origin', warn),
    provenance: text(own(raw, 'provenance'), 'provenance', warn), uncertainty: text(own(raw, 'uncertainty'), 'uncertainty', warn),
    availability: oneOf(own(raw, 'availability'), AVAILABILITIES, '', 'availability', warn), plan: text(own(raw, 'plan'), 'plan', warn),
    summary: readSummary(own(raw, 'summary'), warn), fit: readFit(own(raw, 'fit'), warn),
    generator: { seed: text(own(generator, 'seed'), 'generator.seed', warn, 200), n: validN ? (n as number) : 100 },
    keepData, data: keepData ? data : [],
  };
}

const num = (x: number) => String(Number(x.toPrecision(4)));

function summary(d: DataModel): string[] {
  const L = [`${d.name.trim() || 'Unnamed input'}${d.unit.trim() ? ` (${d.unit.trim()})` : ''}`, describeModel(d), ORIGIN_TEXT[d.origin]];
  if (d.summary) L.push(`${d.summary.n} values, mean ${num(d.summary.mean)}, SD ${num(d.summary.sd)}`);
  if (d.provenance.trim()) L.push(`Source: ${d.provenance.trim().split(/\r?\n/)[0].slice(0, 80)}`);
  return L;
}

function markdown(d: DataModel): string[] {
  const L = [
    `- **Input:** ${mdText(d.name)}`, `- **Unit:** ${mdText(d.unit)}`, `- **Model:** ${describeModel(d)}`, `- **How it was chosen:** ${ORIGIN_TEXT[d.origin]}`,
    `- **Source:** ${mdText(d.provenance)}`, `- **Uncertainty:** ${mdText(d.uncertainty)}`, `- **Data status:** ${AVAILABILITY_TEXT[d.availability]}`,
  ];
  if (d.plan.trim()) L.push(`- **Plan to get the data:** ${mdText(d.plan)}`);
  if (d.summary) L.push(`- **Data summary:** ${d.summary.n} values; mean ${num(d.summary.mean)}; standard deviation ${num(d.summary.sd)}; range ${num(d.summary.min)} to ${num(d.summary.max)}`);
  if (d.keepData && d.data.length) L.push(`- **Data kept with the artefact:** ${d.data.length} values`);
  L.push('');
  if (d.fit && d.fit.candidates.length) {
    L.push('| Candidate | AIC (lower fits better) |', '| --- | --- |');
    d.fit.candidates.forEach((c) => L.push(`| ${mdCell(FAMILIES[c.family].title)} | ${num(c.aic)} |`));
    L.push('', `The chosen model ranked ${d.fit.rank} of ${d.fit.candidates.length}.${d.fit.ksD === null ? '' : ` Largest gap between the data and the fitted curve: ${num(d.fit.ksD)}.`}`, '');
  }
  return L;
}

function applyToProject(doc: ProjectDoc, d: DataModel, inclusionId: string): void {
  const inputs = doc.passport.inputs;
  let row = inputs.find((r) => r.inclusion === inclusionId);
  if (!row) { row = { id: newId('in'), name: '', value: '', unit: '', sourceType: 'assumed', provenance: '', uncertainty: '', inclusion: inclusionId } satisfies InputRow; inputs.push(row); }
  row.name = d.name; row.value = describeModel(d); row.unit = d.unit;
  row.sourceType = d.origin === 'fitted' ? 'observed' : 'assumed';
  row.provenance = d.provenance; row.uncertainty = d.uncertainty;
  // Optional fields are absent when empty, as everywhere else in a project.
  if (d.availability) row.availability = d.availability; else delete row.availability;
  if (d.plan.trim()) row.plan = d.plan; else delete row.plan;
}

export const dataModel: KindDef<'data-model'> = {
  kind: 'data-model', label: 'Data model', toolPath: '/toolbox/data', step: 'inputs', many: true,
  empty, sanitize, isEmpty: (d) => sameData(d, empty()), summary, markdown, figure: () => null, applyToProject,
};
