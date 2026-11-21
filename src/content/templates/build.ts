import { includeArtefact } from '../../domain/artefacts/include';
import { ARTEFACT_SCHEMA, ARTEFACT_SCHEMA_VERSION, type Artefact, type ArtefactData, type ArtefactKind, type DataModel, type MeasurementData, type MethodChoice } from '../../domain/artefacts/types';
import { applyFit, generate, prepareSample } from '../../domain/distributions/inputModel';
import { buildFromSurvey, refreshStats, renameConstruct, setMode } from '../../domain/measurement/build';
import type { Cell } from '../../domain/measurement/stats';
import { RULE_VERSION, evaluateRules, type MethodAnswers } from '../../domain/methods/rules';
import { createProject, newId, type Passport, type ProjectDoc } from '../../domain/passport/schema';
import { createRng } from '../../domain/sandbox/rng';
import type { DataSpec, ProjectTemplate, SurveySpec } from './types';

/**
 * Turns a template into what the reader starts with: a planning-stage project and the Toolbox artefacts behind it.
 * Everything is computed from the template's specification and its seeds, so it is the same on every device: the
 * synthetic data are drawn and fitted with the Data tool's own functions, and the survey is built with the Measurement
 * data tool's own functions.
 */

/** The project and the artefacts that go to My artefacts. The project's copies point at these artefacts. */
export interface Started { project: ProjectDoc; artefacts: Artefact[] }

export function startFromTemplate(t: ProjectTemplate, opts: { now?: string; title?: string } = {}): Started {
  const now = opts.now ?? new Date().toISOString();
  const project = createProject({ title: opts.title ?? t.title, now, origin: { kind: 'example', ref: `template:${t.id}` } });
  const c = structuredClone(t.content);
  const p = project.passport;
  p.identity.stage = 'planning';
  p.decision = c.decision;
  p.scope = c.scope;
  p.representation = { ...c.representation, nodes: [], relations: [] }; // the conceptual model writes the sketch
  p.inputs = c.inputs;
  p.assumptions = c.assumptions;
  p.outcomes = c.outcomes;
  p.evaluation = c.evaluation;
  p.experiment = c.experiment;
  const artefacts = t.artefacts ? templateArtefacts(t, p, now) : [];
  const specs = t.artefacts ? t.artefacts.data : [];
  for (const a of artefacts) {
    const { inclusionId } = includeArtefact(project, a, now);
    if (a.kind !== 'data-model') continue;
    // The Data tool calls fitted data observed and a described law assumed. These data were drawn by the template, so
    // their row says synthetic; a described law says expert when the template says someone estimated it.
    const spec = specs.find((s) => s.title === a.title);
    const kind = a.data.origin === 'fitted' ? 'synthetic' : spec?.source === 'described' && spec.evidence === 'expert' ? 'expert' : null;
    if (kind) for (const row of p.inputs) if (row.inclusion === inclusionId) row.sourceType = kind;
  }
  return { project, artefacts };
}

/** The artefacts of a template, in step order: conceptual model, method choice, data, survey, check plan. */
export function templateArtefacts(t: ProjectTemplate, p: Passport, now: string): Artefact[] {
  const a = t.artefacts;
  if (!a) return [];
  return [
    artefact('concept-model', a.concept.title, structuredClone(a.concept.data), now),
    artefact('method-choice', a.method.title, methodChoiceFrom(a.method.answers, p), now),
    ...a.data.map((s) => artefact('data-model', s.title, dataModelFrom(s), now)),
    ...(a.survey ? [artefact('measurement-data', a.survey.title, surveyFrom(a.survey), now)] : []),
    artefact('check-plan', a.checks.title, structuredClone(a.checks.data), now),
  ];
}

/**
 * Toolbox originals for a project's copies (the worked example's, whose originals are on no device): one new artefact
 * per copy, and each copy now points at its original. Returns the artefacts to store.
 */
export function originalsFor(project: ProjectDoc, now: string): Artefact[] {
  return (project.artefacts ?? []).map((inc) => {
    const a = artefact(inc.kind, inc.title, structuredClone(inc.data) as never, now);
    inc.sourceId = a.id;
    inc.sourceRevision = a.revision;
    return a;
  });
}

function artefact<K extends ArtefactKind>(kind: K, title: string, data: ArtefactData[K], now: string): Artefact {
  return { schema: ARTEFACT_SCHEMA, schemaVersion: ARTEFACT_SCHEMA_VERSION, id: newId('art'), kind, title, createdAt: now, updatedAt: now, revision: 1, data } as Artefact;
}

// ── Method choice ─────────────────────────────────────────────────────────

/** The method chooser's record: the answers, the shortlist they give, and the project's method with its reasons. */
export function methodChoiceFrom(answers: MethodAnswers, p: Passport): MethodChoice {
  const r = p.representation;
  return {
    answers: { ...answers }, ruleVersion: RULE_VERSION, shortlist: evaluateRules(answers).candidates.map((c) => c.method),
    primary: r.primaryMethod, alternative: r.alternativeMethod, justification: r.justification, alternativeJustification: r.alternativeJustification,
  };
}

// ── Data models ───────────────────────────────────────────────────────────

/** A data model as the Data tool leaves it: synthetic records fitted (best AIC kept, data kept), or a described law. */
export function dataModelFrom(s: DataSpec): DataModel {
  const d: DataModel = {
    name: s.name, unit: s.unit, family: 'normal', params: [0, 1], origin: 'described',
    provenance: s.provenance, uncertainty: s.uncertainty, availability: s.availability, plan: s.plan,
    summary: null, fit: null, generator: { seed: 'described', n: 100 }, keepData: false, data: [],
  };
  if (s.source === 'described') { d.family = s.family; d.params = [...s.params]; return d; }
  const drawn = generate({ family: s.truth.family, params: s.truth.params, generator: { seed: s.seed, n: s.n } });
  if (!drawn) throw new Error(`Data “${s.name}”: the law ${s.truth.family}(${s.truth.params.join(', ')}) is not valid.`);
  const k = 10 ** s.decimals;
  const values = drawn.map((v) => Math.round(v * k) / k);
  const sample = prepareSample(values);
  const best = sample?.fits[0];
  if (!sample || !best) throw new Error(`Data “${s.name}”: no law could be fitted to the synthetic data.`);
  applyFit(d, sample, best);
  d.generator = { seed: s.seed, n: values.length };
  d.keepData = true;
  d.data = values;
  return d;
}

// ── Survey ────────────────────────────────────────────────────────────────

/**
 * A synthetic survey from a known structure. Each case: the constructs no path points to are correlated standard
 * normal scores; every other construct is its paths' weighted sum plus noise, so its variance stays near one; each item
 * is its construct's score times its loading plus noise, put on the 1–7 scale. Reverse-worded items are stored as
 * answered and recoded by the tool. A few straight-lining respondents and blank answers make the screen worth running.
 */
export function surveyFrom(s: SurveySpec): MeasurementData {
  const u = createRng(s.seed);
  let spare: number | null = null;
  const normal = () => {
    if (spare !== null) { const z = spare; spare = null; return z; }
    let a = 0;
    while (a <= Number.EPSILON) a = u();
    const b = u(), r = Math.sqrt(-2 * Math.log(a));
    spare = r * Math.sin(2 * Math.PI * b);
    return r * Math.cos(2 * Math.PI * b);
  };
  const names = s.constructs.map((c) => c.name);
  for (const x of s.paths) if (!names.includes(x.from) || !names.includes(x.to)) throw new Error(`Survey “${s.title}”: a path names an unknown construct (${x.from} → ${x.to}).`);
  const exogenous = names.filter((n) => !s.paths.some((x) => x.to === n));
  // Endogenous constructs in an order where every source comes first.
  const order: string[] = [];
  const pending = names.filter((n) => !exogenous.includes(n));
  while (pending.length) {
    const i = pending.findIndex((n) => s.paths.filter((x) => x.to === n).every((x) => exogenous.includes(x.from) || order.includes(x.from)));
    if (i < 0) throw new Error(`Survey “${s.title}”: the paths form a loop.`);
    order.push(pending.splice(i, 1)[0]);
  }
  const r = Math.min(0.9, Math.max(0, s.exogenousCorrelation));
  const items = s.constructs.flatMap((c) => c.items.map((it) => ({ ...it, construct: c.name })));
  const toScale = (z: number) => Math.min(7, Math.max(1, Math.round(4 + 1.35 * z)));
  const rows: Cell[][] = [];
  for (let i = 0; i < s.cases; i++) {
    const score = new Map<string, number>();
    const common = normal();
    for (const n of exogenous) score.set(n, Math.sqrt(r) * common + Math.sqrt(1 - r) * normal());
    for (const n of order) {
      const into = s.paths.filter((x) => x.to === n);
      const explained = into.reduce((v, x) => v + x.beta * x.beta, 0);
      score.set(n, into.reduce((v, x) => v + x.beta * score.get(x.from)!, 0) + Math.sqrt(Math.max(0.1, 1 - explained)) * normal());
    }
    rows.push(items.map((it) => {
      const answer = toScale(it.loading * score.get(it.construct)! + Math.sqrt(Math.max(0, 1 - it.loading * it.loading)) * normal());
      return it.reverse ? 8 - answer : answer;
    }));
  }
  // Straight-liners, spread through the file, and blank answers.
  const step = Math.max(1, Math.floor(s.cases / Math.max(1, s.straightLiners)));
  for (let k = 0; k < s.straightLiners && k * step < rows.length; k++) { const v = 1 + Math.floor(u() * 7); rows[k * step] = rows[k * step].map(() => v); }
  for (const row of rows) for (let j = 0; j < row.length; j++) if (u() < s.missingRate) row[j] = null;

  const { data, rows: kept } = buildFromSurvey({ columns: items.map((it) => it.column), labels: items.map((it) => it.label), rows }, {
    source: s.source, origin: 'example', reverse: items.filter((it) => it.reverse).map((it) => it.column),
  });
  for (const sc of s.constructs) {
    const want = sc.items.map((it) => it.column).join('|');
    const c = data.constructs.find((x) => x.items.map((id) => data.items.find((it) => it.id === id)?.column).join('|') === want);
    if (!c) throw new Error(`Survey “${s.title}”: the columns of “${sc.name}” do not form one construct; give them one prefix ending in a number.`);
    if (!renameConstruct(data, c.id, sc.name)) throw new Error(`Survey “${s.title}”: the construct name “${sc.name}” is used twice.`);
    setMode(data, c.id, sc.mode, kept);
  }
  data.maxArrows = Math.max(0, ...names.map((n) => s.paths.filter((x) => x.to === n).length));
  data.note = s.note;
  data.missing = s.missing;
  data.keepData = true;
  data.data = kept.map((row) => row.map((v) => (typeof v === 'number' ? v : null)));
  refreshStats(data, kept);
  return data;
}
