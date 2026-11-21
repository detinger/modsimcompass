import { COMPASS_RULES_VERSION, STEPS, compassWarnings, stepsStarted } from '../domain/passport/compass';
import type { ProjectDoc } from '../domain/passport/schema';
import { RULE_VERSION } from '../domain/methods/rules';
import { ENGINE_VERSION } from '../domain/sandbox/engine';
import { RNG_VERSION } from '../domain/sandbox/rng';
import { runToCsv } from './csv';
import { passportHtml } from './html';
import { APP_NAME, briefMarkdown, passportMarkdown } from './markdown';
import { runIsStale } from './runInfo';
import { buildZip, type ZipEntry } from './zip';
import { APP_VERSION, projectJson, slugify } from './projectFile';

export { APP_VERSION, projectJson, slugify } from './projectFile';

export type ExportPart = 'brief-md' | 'passport-md' | 'project-json' | 'report-html' | 'results-csv';
export const EXPORT_PARTS: { id: ExportPart; label: string; file: (slug: string) => string; mime: string }[] = [
  { id: 'brief-md', label: 'Problem brief (Markdown)', file: (s) => `${s}-brief.md`, mime: 'text/markdown' },
  { id: 'passport-md', label: 'Full report (Markdown)', file: (s) => `${s}-report.md`, mime: 'text/markdown' },
  { id: 'project-json', label: 'Project file (JSON, re-importable)', file: (s) => `${s}.modsim.json`, mime: 'application/json' },
  { id: 'report-html', label: 'Full report (HTML, printable)', file: (s) => `${s}-report.html`, mime: 'text/html' },
  { id: 'results-csv', label: 'Sandbox results (CSV)', file: (s) => `${s}-sandbox-results.csv`, mime: 'text/csv' },
];

export interface ExportOptions { includeAuthor: boolean; generatedAt: string; /** false leaves the sandbox run out of the reports (the project file always keeps it). Default: included. */ includeSandbox?: boolean }

export function renderPart(full: ProjectDoc, part: ExportPart, opts: ExportOptions): string | null {
  const doc = opts.includeSandbox === false && part !== 'project-json' ? { ...full, sandbox: { ...full.sandbox, lastRun: null } } : full;
  switch (part) {
    case 'brief-md': return briefMarkdown(doc);
    case 'passport-md': return passportMarkdown(doc, opts);
    case 'project-json': return projectJson(opts.includeAuthor ? doc : { ...doc, passport: { ...doc.passport, identity: { ...doc.passport.identity, author: '' } } });
    case 'report-html': return passportHtml(doc, opts);
    case 'results-csv': return doc.sandbox.lastRun ? runToCsv(doc, doc.sandbox.lastRun) : null;
  }
}

export function buildManifest(doc: ProjectDoc, files: { path: string; part: ExportPart }[], generatedAt: string) {
  const run = doc.sandbox.lastRun;
  const warnings = compassWarnings(doc);
  const count = (severity: string) => warnings.filter((w) => w.severity === severity).length;
  return {
    app: APP_NAME,
    appVersion: APP_VERSION,
    generatedAt,
    projectId: doc.id,
    schemaVersion: doc.schemaVersion,
    projectRevision: doc.projectRevision,
    modelRevision: doc.modelRevision,
    engineVersion: ENGINE_VERSION,
    rngVersion: RNG_VERSION,
    methodRuleVersion: doc.methods.ruleVersion ?? RULE_VERSION,
    compassRulesVersion: COMPASS_RULES_VERSION,
    /** Completeness only: started steps and open rule findings are not validity or review status. */
    stepsStarted: { started: stepsStarted(doc.passport).length, total: STEPS.length },
    openItems: { missing: count('gap'), check: count('check'), suggestion: count('tip') },
    sandboxRun: run ? {
      id: run.id, status: run.status, stale: runIsStale(doc), seed: run.seed,
      requestedReplications: run.requestedReplications, completedReplications: run.completedReplications,
      retainedSubset: 'Daily rows for the first trajectory of each policy; replication summaries for all completed replications.',
    } : null,
    files,
  };
}

export function buildExportZip(doc: ProjectDoc, parts: ExportPart[], opts: ExportOptions): Uint8Array {
  const slug = slugify(doc.passport.identity.title);
  const entries: ZipEntry[] = [];
  const files: { path: string; part: ExportPart }[] = [];
  for (const id of parts) {
    const content = renderPart(doc, id, opts);
    if (content === null) continue;
    const def = EXPORT_PARTS.find((p) => p.id === id)!;
    const path = def.file(slug);
    entries.push({ name: path, content });
    files.push({ path, part: id });
  }
  entries.push({ name: 'manifest.json', content: JSON.stringify(buildManifest(doc, files, opts.generatedAt), null, 2) });
  return buildZip(entries, new Date(opts.generatedAt));
}
