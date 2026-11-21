import { dataModel, describeModel, lawFields } from '../../../domain/artefacts/dataModel';
import type { DataModel } from '../../../domain/artefacts/types';
import { fitPythonCode, fitRCode, pythonCode, rCode } from '../../../domain/distributions/code';
import { deltaAicLabel } from '../../../domain/distributions/fitting';
import { generate, generatedCsv, type PreparedSample } from '../../../domain/distributions/inputModel';
import { FAMILIES } from '../../../domain/distributions/laws';
import { sig } from '../../../domain/distributions/sample';
import { mdCell } from '../../../exports/mdText';
import { headingText, htmlReport } from './report';

/**
 * The exports of Data and inputs (docs/LEARN-TOOLBOX-PLAN.md §5.3) as text. Pure: the page hands the result to
 * `downloadFile`. The artefact file itself comes from the tool frame.
 *
 * `sample` is the data on screen, which is only in memory unless the user keeps it with the artefact. With it the
 * report adds every candidate's parameters and quantiles; without it the report uses what the artefact stores.
 */

const ORIGIN_WORDS: Record<DataModel['origin'], string> = { fitted: 'fitted to data', described: 'described without data', manual: 'set by hand' };

/** Fit details only the data on screen can give: every candidate with its parameters, and quantiles. */
function sampleDetails(sample: PreparedSample): string[] {
  const s = sample.summary;
  const L = ['## The data', ''];
  L.push(`${s.n} values${sample.fitted.length < s.n ? `; the fits used ${sample.fitted.length} of them, taken at even steps through the list` : ''}.`, '');
  L.push('| Minimum | 5% | 25% | Median | 75% | 95% | Maximum |', '| --- | --- | --- | --- | --- | --- | --- |');
  L.push(`| ${[s.min, s.q05, s.q25, s.median, s.q75, s.q95, s.max].map((x) => sig(x)).join(' | ')} |`, '');
  if (sample.fits.length) {
    const best = sample.fits[0].aic;
    L.push('## Every candidate', '', 'Each family fitted by maximum likelihood. AIC = 2k − 2 log-likelihood; lower fits better. Akaike weights compare these candidates only.', '');
    if (sample.countData) L.push('The data are whole numbers: each continuous family is scored by the probability it gives each value, P(x − ½ < X ≤ x + ½), so its AIC compares fairly with the count families.', '');
    L.push('| Family | Parameters | Log-likelihood | AIC | Difference | Akaike weight | KS distance |', '| --- | --- | --- | --- | --- | --- | --- |');
    sample.fits.forEach((f, i) => {
      const params = f.paramLabels.length ? f.paramLabels.map((l, k) => `${l} ${sig(f.params[k])}`).join('; ') : f.params.map((p) => sig(p)).join('; ');
      L.push(`| ${mdCell(FAMILIES[f.kind].title)} | ${mdCell(params)} | ${sig(f.logLik)} | ${sig(f.aic)} | ${sig(f.aic - best)} (${deltaAicLabel(f.aic - best)}) | ${sig(sample.weights[i], 3)} | ${f.ksD === null ? '—' : sig(f.ksD, 3)} |`);
    });
    L.push('');
    if (sample.failures.length) L.push(`Not fitted: ${sample.failures.map((f) => `${FAMILIES[f.kind].title} (${f.reason.replace(/\.$/, '').toLowerCase()})`).join('; ')}.`, '');
  }
  return L;
}

const NOTES = [
  '## Reading it', '',
  '- No p-values are given for the fits: with parameters estimated from the same data the usual p-value is not valid.',
  '- The lowest AIC is the best of these candidates, not proof that any of them is right. Prefer a family whose story matches how the values arise.',
  '- Synthetic data drawn from the model are an assumption made concrete. They are not observations.',
  '',
];

/** The fit report as Markdown: the artefact's report section, then details from the data on screen. */
export function fitReportMarkdown(title: string, d: DataModel, sample: PreparedSample | null, exportedAt: string): string {
  const name = headingText(title, 'Data model');
  const L = [`# ${name}`, '', `Input model, ${ORIGIN_WORDS[d.origin]}. Exported ${exportedAt.slice(0, 10)}.`, '', ...dataModel.markdown(d)];
  if (sample) L.push(...sampleDetails(sample));
  L.push(...NOTES);
  return `${L.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

export function fitReportHtml(title: string, d: DataModel, sample: PreparedSample | null, exportedAt: string): string {
  const name = headingText(title, 'Data model');
  return htmlReport({
    title: `${name} — fit report`, kicker: 'Data model', generatedAt: exportedAt,
    md: fitReportMarkdown(title, d, sample, exportedAt),
    figures: [{ svg: dataModel.figure(d), label: `${describeModel(d)}${d.keepData && d.data.length ? ', with the data kept' : ''}` }],
  });
}

/** User text inside a script comment: one line, so it cannot end the comment. */
const comment = (s: string) => s.replace(/[\r\n\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim();

function header(prefix: string, title: string, d: DataModel): string[] {
  const L = [`${prefix} ${comment(headingText(title, d.name || 'Data model'))}`];
  if (d.name.trim() || d.unit.trim()) L.push(`${prefix} Input: ${comment(d.name) || 'unnamed'}${d.unit.trim() ? ` (${comment(d.unit)})` : ''}`);
  L.push(`${prefix} Model: ${comment(describeModel(d))}, ${ORIGIN_WORDS[d.origin]}`);
  if (d.provenance.trim()) L.push(`${prefix} Source: ${comment(d.provenance)}`);
  L.push(`${prefix} The script draws its own random numbers: the same model, not the same values as the app.`, '');
  return L;
}

/**
 * The values a script may carry: only data the user chose to keep with the artefact. Data that was not kept stays in
 * memory, so the script reads it from the user's own file instead.
 */
const scriptValues = (d: DataModel, sample: PreparedSample | null): number[] => (d.keepData && sample ? sample.values : []);

/** R: draws from the model; with data on screen, also refits the candidates. */
export function rScript(title: string, d: DataModel, sample: PreparedSample | null): string {
  const L = [...header('#', title, d), rCode(d.family, lawFields(d.family, d.params), d.generator.n, d.generator.seed)];
  if (sample) L.push('', '# Refit the candidates to the data', fitRCode(scriptValues(d, sample)));
  return `${L.join('\n')}\n`;
}

export function pythonScript(title: string, d: DataModel, sample: PreparedSample | null): string {
  const L = [...header('#', title, d), pythonCode(d.family, lawFields(d.family, d.params), d.generator.n, d.generator.seed)];
  if (sample) L.push('', '# Refit the candidates to the data', fitPythonCode(scriptValues(d, sample)));
  return `${L.join('\n')}\n`;
}

/** Synthetic data as CSV, or null when the model is not valid. */
export function syntheticCsv(d: DataModel): string | null {
  const draws = generate(d);
  return draws ? generatedCsv(draws) : null;
}
