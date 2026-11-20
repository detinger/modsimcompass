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

export const APP_VERSION = '3.0.0';

export type ExportPart = 'brief-md' | 'passport-md' | 'project-json' | 'report-html' | 'results-csv';
export const EXPORT_PARTS: { id: ExportPart; label: string; file: (slug: string) => string; mime: string }[] = [
  { id: 'brief-md', label: 'Problem brief (Markdown)', file: (s) => `${s}-brief.md`, mime: 'text/markdown' },
  { id: 'passport-md', label: 'Full passport (Markdown)', file: (s) => `${s}-passport.md`, mime: 'text/markdown' },
  { id: 'project-json', label: 'Project file (JSON, re-importable)', file: (s) => `${s}.modsim.json`, mime: 'application/json' },
  { id: 'report-html', label: 'Standalone report (HTML)', file: (s) => `${s}-report.html`, mime: 'text/html' },
  { id: 'results-csv', label: 'Sandbox results (CSV)', file: (s) => `${s}-sandbox-results.csv`, mime: 'text/csv' },
];

export function slugify(title: string): string {
  const s = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return s || 'project';
}

export function projectJson(doc: ProjectDoc): string {
  return JSON.stringify({ ...doc, exportedBy: { app: APP_NAME, version: APP_VERSION } }, null, 2);
}

export function renderPart(doc: ProjectDoc, part: ExportPart, opts: { includeAuthor: boolean; generatedAt: string }): string | null {
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

export function buildExportZip(doc: ProjectDoc, parts: ExportPart[], opts: { includeAuthor: boolean; generatedAt: string }): Uint8Array {
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
