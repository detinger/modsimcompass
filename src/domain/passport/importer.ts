import { defaultConfig, MAX_HORIZON, MAX_REPLICATIONS } from '../sandbox/engine';
import type { DailyRow, DailyTrace, PolicyResult, ReplicationSummary, RunRecord, SandboxConfig, TraceMetrics } from '../sandbox/types';
import { METHOD_BY_ID } from '../methods/registry';
import { emptyAnswers } from '../methods/rules';
import { createProject, newId, PASSPORT_SCHEMA, PASSPORT_SCHEMA_VERSION, type ProjectDoc } from './schema';

/**
 * Runtime import validation (PLAN §12). TypeScript types do not validate uploaded JSON.
 * - size, depth, string length and array limits
 * - no prototype pollution (only template keys are copied; __proto__ etc. ignored)
 * - future schema versions rejected with an explanation
 * - unknown top-level fields preserved in `preservedUnknown`
 */
export const IMPORT_LIMITS = { maxBytes: 5_000_000, maxDepth: 24, maxString: 20_000, maxArray: 2_000 };

export type ImportResult =
  | { ok: true; project: ProjectDoc; warnings: string[]; summary: string[] }
  | { ok: false; error: string };

const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

function depthOk(v: unknown, d = 0): boolean {
  if (d > IMPORT_LIMITS.maxDepth) return false;
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) if (!depthOk((v as Record<string, unknown>)[k], d + 1)) return false;
  }
  return true;
}

type Tmpl = unknown;

/** Copy `input` into the shape of `template`, keeping only well-typed template keys. */
function sanitize(input: unknown, template: Tmpl, itemTemplates: Record<string, Tmpl>, path: string, warn: (m: string) => void): unknown {
  if (typeof template === 'string') {
    if (typeof input === 'string') return input.length > IMPORT_LIMITS.maxString ? (warn(`${path}: text truncated to ${IMPORT_LIMITS.maxString} characters.`), input.slice(0, IMPORT_LIMITS.maxString)) : input;
    if (input !== undefined) warn(`${path}: expected text; default kept.`);
    return template;
  }
  if (typeof template === 'number') {
    if (typeof input === 'number' && Number.isFinite(input)) return input;
    if (input !== undefined) warn(`${path}: expected a finite number; default kept.`);
    return template;
  }
  if (typeof template === 'boolean') {
    if (typeof input === 'boolean') return input;
    if (input !== undefined) warn(`${path}: expected true/false; default kept.`);
    return template;
  }
  if (template === null) return input === undefined ? null : input; // nullable passthrough handled by caller
  if (Array.isArray(template)) {
    if (!Array.isArray(input)) { if (input !== undefined) warn(`${path}: expected a list; default kept.`); return template; }
    const list = input.slice(0, IMPORT_LIMITS.maxArray);
    if (input.length > IMPORT_LIMITS.maxArray) warn(`${path}: list truncated to ${IMPORT_LIMITS.maxArray} items.`);
    const item = itemTemplates[path] ?? (template.length ? template[0] : undefined);
    if (item === undefined) return list.filter((x) => typeof x === 'number' || typeof x === 'string' || typeof x === 'boolean');
    return list.map((x, i) => sanitize(x, item, itemTemplates, `${path}[]`, (m) => warn(m.replace(`${path}[]`, `${path}[${i}]`))));
  }
  if (typeof template === 'object') {
    const out: Record<string, unknown> = {};
    const src = (input && typeof input === 'object' && !Array.isArray(input)) ? input as Record<string, unknown> : {};
    if (input !== undefined && src !== input) warn(`${path}: expected an object; defaults kept.`);
    for (const k of Object.keys(template as object)) {
      if (FORBIDDEN.has(k)) continue;
      out[k] = sanitize(Object.prototype.hasOwnProperty.call(src, k) ? src[k] : undefined, (template as Record<string, unknown>)[k], itemTemplates, path ? `${path}.${k}` : k, warn);
    }
    return out;
  }
  return template;
}

const ITEM_TEMPLATES: Record<string, Tmpl> = {
  'passport.inputs': { id: '', name: '', value: '', unit: '', sourceType: 'unspecified', provenance: '', uncertainty: '', availability: '', plan: '' },
  'passport.assumptions': { id: '', statement: '', rationale: '', consequenceIfWrong: '', plannedCheck: '', evidenceKind: 'unspecified', sourceNote: '' },
  'passport.outcomes': { id: '', metric: '', definition: '', unit: '', direction: '', aggregation: '', criterion: '' },
  'passport.representation.nodes': { id: '', type: 'entity', label: '', x: 0, y: 0 },
  'passport.representation.relations': { id: '', from: '', to: '', label: '', directed: true },
  lensNotes: { id: '', lensId: '', text: '', createdAt: '' },
  'methods.shortlist': '',
};
const CONFIG_ITEMS = (prefix: string): Record<string, Tmpl> => ({
  [`${prefix}.demand.values`]: 0, [`${prefix}.demand.probs`]: 0, [`${prefix}.demand.list`]: 0, [`${prefix}.capacity.list`]: 0,
  [`${prefix}.schedule.openDays`]: true, [`${prefix}.schedule.paidDays`]: true,
});

const EVIDENCE = new Set(['observed', 'literature', 'expert', 'assumed', 'synthetic', 'unspecified']);
const CLAIMS = new Set(['', 'descriptive', 'explanatory', 'predictive', 'exploratory', 'decision-support']);
const REVIEW = new Set(['draft', 'self-reviewed', 'teacher-reviewed', 'needs-revision']);

function sanitizeConfig(input: unknown, prefix: string, warn: (m: string) => void): SandboxConfig {
  const c = sanitize(input, defaultConfig(), CONFIG_ITEMS(prefix), prefix, warn) as SandboxConfig;
  if (!['constant', 'random', 'list'].includes(c.demand.mode)) { warn(`${prefix}.demand.mode invalid; reset to constant.`); c.demand.mode = 'constant'; }
  if (!['direct', 'staff', 'list'].includes(c.capacity.mode)) { warn(`${prefix}.capacity.mode invalid; reset to direct.`); c.capacity.mode = 'direct'; }
  return c;
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isInt = (x: unknown): x is number => isNum(x) && Number.isInteger(x) && x >= 0;
const isNumOrNull = (x: unknown): x is number | null => x === null || isNum(x);
const isStr = (x: unknown, max = 200): x is string => typeof x === 'string' && x.length <= max;
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

const METRIC_NUM = ['totalArrivals', 'totalServed', 'totalAbandoned', 'terminalBacklog', 'averageEndBacklog', 'totalEffectiveCapacity', 'maxAbsResidual'] as const;
const METRIC_NULLABLE = ['utilisation', 'totalStaffCost', 'totalHoldingCost', 'totalCost'] as const;
const ROW_NUM = ['startBacklog', 'arrivals', 'nominalCapacity', 'effectiveCapacity', 'available', 'served', 'remaining', 'abandoned', 'endBacklog', 'residual'] as const;

/** Each reader returns a clean copy with only the known, well-typed fields, or null. */
function readMetrics(x: unknown): TraceMetrics | null {
  if (!isObj(x)) return null;
  const out: Record<string, number | null> = {};
  for (const k of METRIC_NUM) { if (!isNum(x[k])) return null; out[k] = x[k] as number; }
  for (const k of METRIC_NULLABLE) { if (!isNumOrNull(x[k])) return null; out[k] = x[k] as number | null; }
  return out as unknown as TraceMetrics;
}
function readSummary(x: unknown): ReplicationSummary | null {
  const m = readMetrics(x);
  return m && isObj(x) && isInt(x.replication) ? { ...m, replication: x.replication } : null;
}
function readRow(x: unknown): DailyRow | null {
  if (!isObj(x) || !isInt(x.day) || typeof x.open !== 'boolean' || typeof x.paid !== 'boolean' || !isNumOrNull(x.staffCost) || !isNumOrNull(x.holdingCost)) return null;
  const out: Record<string, unknown> = { day: x.day, open: x.open, paid: x.paid, staffCost: x.staffCost, holdingCost: x.holdingCost };
  for (const k of ROW_NUM) { if (!isNum(x[k])) return null; out[k] = x[k]; }
  return out as unknown as DailyRow;
}
function readTrace(x: unknown): DailyTrace | null {
  if (!isObj(x) || !isInt(x.replication) || !Array.isArray(x.rows) || x.rows.length > MAX_HORIZON) return null;
  const rows = x.rows.map(readRow), metrics = readMetrics(x.metrics);
  return metrics && rows.every((r): r is DailyRow => r !== null) ? { replication: x.replication, rows, metrics } : null;
}
function readPolicy(x: unknown): PolicyResult | null {
  if (!isObj(x) || !isStr(x.label) || !isStr(x.configHash) || !Array.isArray(x.summaries) || x.summaries.length > MAX_REPLICATIONS) return null;
  const summaries = x.summaries.map(readSummary);
  if (!summaries.every((r): r is ReplicationSummary => r !== null)) return null;
  const retainedTrace = x.retainedTrace == null ? null : readTrace(x.retainedTrace);
  if (x.retainedTrace != null && !retainedTrace) return null;
  return { label: x.label, configHash: x.configHash, summaries, retainedTrace };
}

/**
 * Saved sandbox results are rebuilt field by field. Anything that is not exactly the expected shape and type
 * is dropped as a whole, because the results screens and the exports rely on every field.
 */
function sanitizeRun(input: unknown, warn: (m: string) => void): RunRecord | null {
  if (input === null || input === undefined) return null;
  const reject = () => { warn('Saved sandbox results were not in a recognised format and were not imported. Re-run the model to regenerate them.'); return null; };
  const r = input;
  if (!isObj(r)) return reject();
  const status = ['running', 'partial', 'complete', 'failed'].find((v) => v === r.status) as RunRecord['status'] | undefined;
  const comparisonKind = ['none', 'paired-policy', 'scenario'].find((v) => v === r.comparisonKind) as RunRecord['comparisonKind'] | undefined;
  const baseline = readPolicy(r.baseline);
  const alternative = r.alternative == null ? null : readPolicy(r.alternative);
  const preview = r.arrivalPreview;
  if (!status || !comparisonKind || !baseline || (r.alternative != null && !alternative)
    || !isStr(r.id) || !isStr(r.projectId) || !isStr(r.modelHash) || !isStr(r.engineVersion) || !isStr(r.rngVersion) || !isStr(r.seed) || !isStr(r.createdAt)
    || !isInt(r.modelRevision) || !isInt(r.requestedReplications) || !isInt(r.completedReplications)
    || !Array.isArray(preview) || preview.length > 50 || !preview.every((a) => Array.isArray(a) && a.length <= MAX_HORIZON && a.every(isNum))
    || (r.error !== undefined && !isStr(r.error, 2000))) return reject();
  return {
    id: r.id, projectId: r.projectId, modelRevision: r.modelRevision, modelHash: r.modelHash, engineVersion: r.engineVersion, rngVersion: r.rngVersion,
    seed: r.seed, requestedReplications: r.requestedReplications, completedReplications: r.completedReplications,
    status: status === 'running' ? 'partial' : status, createdAt: r.createdAt,
    baselineSnapshot: sanitizeConfig(r.baselineSnapshot, 'sandbox.lastRun.baselineSnapshot', warn),
    alternativeSnapshot: r.alternativeSnapshot ? sanitizeConfig(r.alternativeSnapshot, 'sandbox.lastRun.alternativeSnapshot', warn) : null,
    comparisonKind, baseline, alternative,
    arrivalPreview: (preview as number[][]).map((a) => [...a]),
    ...(typeof r.error === 'string' ? { error: r.error } : {}),
  };
}

/** A calendar date that exists, written YYYY-MM-DD. */
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function parseProjectJson(text: string, opts: { now?: string } = {}): ImportResult {
  if (text.length > IMPORT_LIMITS.maxBytes) return { ok: false, error: `File is larger than ${IMPORT_LIMITS.maxBytes / 1_000_000} MB.` };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'The file is not valid JSON. It may be damaged or not a ModSim Essentials project file.' }; }
  return importProjectObject(raw, opts);
}

export function importProjectObject(raw: unknown, opts: { now?: string } = {}): ImportResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'The file does not contain a project object.' };
  if (!depthOk(raw)) return { ok: false, error: 'The file is nested too deeply to be a project file.' };
  const o = raw as Record<string, unknown>;
  const schemaName = o.schema;
  const legacyName = schemaName === 'modsim101/project';
  if (schemaName !== PASSPORT_SCHEMA && !legacyName) return { ok: false, error: 'This is not a ModSim Essentials project file (missing schema identifier).' };
  const v = o.schemaVersion;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return { ok: false, error: 'The project file has an invalid schema version.' };
  if (v > PASSPORT_SCHEMA_VERSION) {
    return { ok: false, error: `This project was saved with a newer schema (version ${v}); this app supports version ${PASSPORT_SCHEMA_VERSION}. Open it in a newer version of ModSim Essentials. Nothing was changed.` };
  }
  const warnings: string[] = [];
  const warn = (m: string) => { if (warnings.length < 200) warnings.push(m); };
  const base = createProject({ now: opts.now });
  const template = { ...base, sandbox: undefined, preservedUnknown: undefined } as Record<string, unknown>;
  delete template.sandbox; delete template.preservedUnknown;
  const doc = sanitize(o, template, ITEM_TEMPLATES, '', warn) as ProjectDoc;
  const sb = (o.sandbox && typeof o.sandbox === 'object') ? o.sandbox as Record<string, unknown> : {};
  doc.sandbox = {
    baseline: sanitizeConfig(sb.baseline, 'sandbox.baseline', warn),
    alternative: sb.alternative ? sanitizeConfig(sb.alternative, 'sandbox.alternative', warn) : null,
    lastRun: sanitizeRun(sb.lastRun, warn),
  };
  doc.schema = PASSPORT_SCHEMA;
  doc.schemaVersion = PASSPORT_SCHEMA_VERSION;
  // Origin: validated kind, optional string reference (not in the default template).
  const rawOrigin = (o.origin && typeof o.origin === 'object') ? o.origin as Record<string, unknown> : {};
  const kinds = ['blank', 'first-problem', 'example', 'import', 'copy'] as const;
  const kind = kinds.find((k) => k === rawOrigin.kind) ?? 'blank';
  doc.origin = typeof rawOrigin.ref === 'string' && rawOrigin.ref ? { kind, ref: rawOrigin.ref.slice(0, 200) } : { kind };
  // Enumerations
  const p = doc.passport;
  // Row ids must be present and unique: the editor finds rows by id.
  const uniqueIds = (rows: { id: string }[], prefix: string) => {
    const seen = new Set<string>();
    for (const r of rows) { if (!r.id || seen.has(r.id)) r.id = newId(prefix); while (seen.has(r.id)) r.id = `${newId(prefix)}-${seen.size}`; seen.add(r.id); }
  };
  uniqueIds(p.inputs, 'in'); uniqueIds(p.assumptions, 'as'); uniqueIds(p.outcomes, 'out'); uniqueIds(p.representation.nodes, 'n'); uniqueIds(p.representation.relations, 'r'); uniqueIds(doc.lensNotes, 'note');
  p.inputs.forEach((r) => { if (!EVIDENCE.has(r.sourceType)) r.sourceType = 'unspecified'; if (!['have', 'obtainable', 'assume'].includes(r.availability ?? '')) delete r.availability; if (!r.plan) delete r.plan; }); // optional fields: absent when empty
  if (p.identity.stage !== 'planning') p.identity.stage = '';
  p.assumptions.forEach((a) => { if (!EVIDENCE.has(a.evidenceKind)) a.evidenceKind = 'unspecified'; });
  p.outcomes.forEach((r) => { if (!['', 'lower', 'higher', 'target'].includes(r.direction)) r.direction = ''; });
  p.representation.nodes.forEach((n) => { if (!['entity', 'variable', 'stakeholder'].includes(n.type)) n.type = 'entity'; });
  if (!CLAIMS.has(p.decision.claimType)) p.decision.claimType = '';
  for (const k of Object.keys(p.review) as (keyof typeof p.review)[]) {
    if (!REVIEW.has(p.review[k].status)) p.review[k].status = 'draft';
    if (!['', 'self', 'teacher'].includes(p.review[k].feedbackSource)) p.review[k].feedbackSource = '';
    if (!isIsoDate(p.review[k].due)) p.review[k].due = '';
  }
  // Dynamic-key maps (schema v2): copy only safe keys and bounded values.
  const rawP = (o.passport && typeof o.passport === 'object') ? o.passport as Record<string, unknown> : {};
  const KEY = /^[a-z0-9][a-z0-9-]{0,47}$/;
  p.selfChecks = {};
  const rawSC = rawP.selfChecks;
  if (rawSC && typeof rawSC === 'object' && !Array.isArray(rawSC)) {
    for (const [k, val] of Object.entries(rawSC as Record<string, unknown>).slice(0, 200)) if (KEY.test(k) && !FORBIDDEN.has(k) && typeof val === 'string') p.selfChecks[k] = val.slice(0, IMPORT_LIMITS.maxString);
  }
  const rawReview = (rawP.review && typeof rawP.review === 'object') ? rawP.review as Record<string, Record<string, unknown>> : {};
  for (const k of Object.keys(p.review) as (keyof typeof p.review)[]) {
    const rr = rawReview[k]?.rubric;
    p.review[k].rubric = {};
    if (rr && typeof rr === 'object' && !Array.isArray(rr)) {
      for (const [ck, lv] of Object.entries(rr as Record<string, unknown>).slice(0, 20)) if (KEY.test(ck) && !FORBIDDEN.has(ck) && typeof lv === 'number' && Number.isInteger(lv) && lv >= 0 && lv <= 3) p.review[k].rubric[ck] = lv;
    }
  }
  if (v === 1) warn('Project file from schema version 1 upgraded to version 2 (self-checks and rubrics start empty).');
  const validMethod = (m: string) => m === '' || Object.hasOwn(METHOD_BY_ID, m);
  if (!validMethod(p.representation.primaryMethod)) { warn('Unknown primary method removed.'); p.representation.primaryMethod = ''; }
  if (!validMethod(p.representation.alternativeMethod)) { warn('Unknown alternative method removed.'); p.representation.alternativeMethod = ''; }
  doc.methods.shortlist = doc.methods.shortlist.filter((m) => Object.hasOwn(METHOD_BY_ID, m));
  // Nullable text fields: text or nothing.
  for (const k of ['ruleVersion', 'answersKey', 'decidedAt'] as const) { const val: unknown = doc.methods[k]; doc.methods[k] = typeof val === 'string' ? val.slice(0, 500) : null; }
  if (doc.methods.answers !== null && typeof doc.methods.answers === 'object' && !Array.isArray(doc.methods.answers)) {
    doc.methods.answers = sanitize(doc.methods.answers, emptyAnswers(), {}, 'methods.answers', warn) as ProjectDoc['methods']['answers'];
  } else doc.methods.answers = null;
  const nodeIds = new Set(p.representation.nodes.map((n) => n.id));
  p.representation.relations = p.representation.relations.filter((r) => nodeIds.has(r.from) && nodeIds.has(r.to));
  // Preserve unknown top-level fields
  const known = new Set([...Object.keys(base), 'preservedUnknown', 'exportedBy']);
  const unknown: Record<string, unknown> = {};
  // Fields preserved by an earlier import are carried over as they are, not wrapped once more.
  const earlier = isObj(o.preservedUnknown) ? o.preservedUnknown : {};
  for (const src of [earlier, o]) for (const k of Object.keys(src)) if (!known.has(k) && !FORBIDDEN.has(k)) unknown[k] = src[k];
  if (Object.keys(unknown).length) {
    doc.preservedUnknown = JSON.parse(JSON.stringify(unknown));
    warn(`Unrecognised fields preserved without use: ${Object.keys(unknown).map((k) => k.slice(0, 40)).slice(0, 20).join(', ')}.`);
  }
  const n = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`;
  const summary = [
    `Title: ${p.identity.title || 'Untitled project'}`,
    `${n(p.inputs.length, 'input')}, ${n(p.assumptions.length, 'assumption')}, ${n(p.outcomes.length, 'outcome')}`,
    doc.sandbox.lastRun ? `Sandbox results: ${doc.sandbox.lastRun.completedReplications} replication(s), status ${doc.sandbox.lastRun.status}` : 'No sandbox results',
  ];
  return { ok: true, project: doc, warnings, summary };
}
