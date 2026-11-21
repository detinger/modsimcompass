import { ARTEFACT_FILE_SUFFIX, artefactJson, isIsoTime } from '../domain/artefacts/file';
import { kindDef } from '../domain/artefacts/kinds';
import { ARTEFACT_SCHEMA, ARTEFACT_SCHEMA_VERSION, type Artefact, type ArtefactKind } from '../domain/artefacts/types';
import { COMPASS_RULES_VERSION, STEPS, compassWarnings, stepsStarted } from '../domain/passport/compass';
import type { Inclusion, ProjectDoc } from '../domain/passport/schema';
import { RULE_VERSION } from '../domain/methods/rules';
import { artefactFigure, passportHtml } from './html';
import { APP_NAME, briefMarkdown, passportMarkdown, reportableCopies } from './markdown';
import { buildZip, type ZipEntry } from './zip';
import { APP_VERSION, projectJson, slugify } from './projectFile';

export { APP_VERSION, projectJson, slugify } from './projectFile';

export type ExportPart = 'brief-md' | 'passport-md' | 'project-json' | 'report-html';
export const EXPORT_PARTS: { id: ExportPart; label: string; file: (slug: string) => string; mime: string }[] = [
  { id: 'brief-md', label: 'Problem brief (Markdown)', file: (s) => `${s}-brief.md`, mime: 'text/markdown' },
  { id: 'passport-md', label: 'Full report (Markdown)', file: (s) => `${s}-report.md`, mime: 'text/markdown' },
  { id: 'project-json', label: 'Project file (JSON, re-importable)', file: (s) => `${s}.modsim.json`, mime: 'application/json' },
  { id: 'report-html', label: 'Full report (HTML, printable)', file: (s) => `${s}-report.html`, mime: 'text/html' },
];

export interface ExportOptions {
  includeAuthor: boolean; generatedAt: string;
  /** false leaves the separate artefact files and pictures out of the ZIP (the reports and the project file always hold the artefacts). Default: included. */
  includeArtefacts?: boolean;
}

export function renderPart(doc: ProjectDoc, part: ExportPart, opts: ExportOptions): string | null {
  switch (part) {
    case 'brief-md': return briefMarkdown(doc);
    case 'passport-md': return passportMarkdown(doc, opts);
    case 'project-json': return projectJson(opts.includeAuthor ? doc : { ...doc, passport: { ...doc.passport, identity: { ...doc.passport.identity, author: '' } } });
    case 'report-html': return passportHtml(doc, opts);
  }
}

// ── Included artefacts as files of their own ─────────────────────────────

export interface ArtefactFile {
  /** The copy this file was written from. */
  inclusionId: string; kind: ArtefactKind; title: string; addedAt: string; sourceId: string;
  /** `artefacts/<slug>.artefact.json`: the copy as an artefact file that My artefacts can import. */
  file: string; json: string;
  /** `figures/<slug>.svg` and its markup, when the kind draws a picture. */
  figure: string | null; svg: string | null;
}

/** The copy as an artefact of its own. Importing the file gives it a new id, so nothing is ever overwritten. */
function asArtefact(inc: Inclusion, generatedAt: string): Artefact {
  const when = isIsoTime(inc.addedAt) ? inc.addedAt : generatedAt;
  return {
    schema: ARTEFACT_SCHEMA, schemaVersion: ARTEFACT_SCHEMA_VERSION, id: inc.sourceId, kind: inc.kind, title: inc.title,
    createdAt: when, updatedAt: when, revision: Math.max(1, Number.isInteger(inc.sourceRevision) ? inc.sourceRevision : 1), data: inc.data,
  } as Artefact;
}

/** One artefact file per included copy, each with a distinct name, plus its picture as a standalone SVG file. */
export function artefactFiles(doc: ProjectDoc, generatedAt: string): ArtefactFile[] {
  const used = new Set<string>();
  return reportableCopies(doc).map((inc) => {
    const def = kindDef(inc.kind);
    const title = String(inc.title ?? '');
    // A name with no letters or digits falls back to the kind, as the Toolbox does for its own files.
    const base = /[a-z0-9]/i.test(title.normalize('NFKD')) ? slugify(title) : slugify(def.label);
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    const svg = artefactFigure(inc);
    return {
      inclusionId: inc.id, kind: inc.kind, title, addedAt: inc.addedAt, sourceId: inc.sourceId,
      file: `artefacts/${slug}${ARTEFACT_FILE_SUFFIX}`, json: artefactJson(asArtefact(inc, generatedAt)),
      figure: svg ? `figures/${slug}.svg` : null,
      // A file on its own needs the XML declaration and the namespace; the report embeds the same picture inline.
      svg: svg ? `<?xml version="1.0" encoding="UTF-8"?>\n${/^<svg[^>]*\sxmlns=/.test(svg) ? svg : svg.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')}\n` : null,
    };
  });
}

export function buildManifest(doc: ProjectDoc, files: { path: string; part: ExportPart }[], generatedAt: string, artefacts: ArtefactFile[] = []) {
  const warnings = compassWarnings(doc);
  const count = (severity: string) => warnings.filter((w) => w.severity === severity).length;
  return {
    app: APP_NAME,
    appVersion: APP_VERSION,
    generatedAt,
    projectId: doc.id,
    schemaVersion: doc.schemaVersion,
    projectRevision: doc.projectRevision,
    methodRuleVersion: doc.methods.ruleVersion ?? RULE_VERSION,
    compassRulesVersion: COMPASS_RULES_VERSION,
    /** Completeness only: started steps and open rule findings are not validity or review status. */
    stepsStarted: { started: stepsStarted(doc.passport, reportableCopies(doc)).length, total: STEPS.length },
    openItems: { missing: count('gap'), check: count('check'), suggestion: count('tip') },
    /** How many copies the project includes, whether or not their separate files are part of this export. */
    artefactsIncluded: reportableCopies(doc).length,
    /** The separate artefact files and pictures in this archive, one entry per included copy. */
    artefacts: artefacts.map((a) => ({ inclusionId: a.inclusionId, kind: a.kind, title: a.title, addedAt: a.addedAt, sourceId: a.sourceId, step: kindDef(a.kind).step, file: a.file, figure: a.figure })),
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
  const artefacts = opts.includeArtefacts === false ? [] : artefactFiles(doc, opts.generatedAt);
  for (const a of artefacts) {
    entries.push({ name: a.file, content: a.json });
    if (a.figure && a.svg) entries.push({ name: a.figure, content: a.svg });
  }
  entries.push({ name: 'manifest.json', content: JSON.stringify(buildManifest(doc, files, opts.generatedAt, artefacts), null, 2) });
  return buildZip(entries, new Date(opts.generatedAt));
}
