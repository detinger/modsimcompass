import { APP_NAME, APP_VERSION } from '../../exports/projectFile';
import { newId } from '../passport/schema';
import { isObj, LIMITS, own, text } from './clean';
import { withoutUnkeptData } from './dataModel';
import { isArtefactKind, kindDef, KINDS } from './kinds';
import { ARTEFACT_SCHEMA, ARTEFACT_SCHEMA_VERSION, type Artefact, type ArtefactKind } from './types';

/**
 * Artefact files (docs/TOOLBOX-SPEC.md §2.3): one artefact as a versioned JSON file that can be imported again.
 * Uploaded JSON is never trusted: the kind's sanitizer rebuilds the data field by field.
 */
export const ARTEFACT_FILE_MAX_BYTES = 5_000_000;
export const ARTEFACT_FILE_SUFFIX = '.artefact.json';

export type ArtefactImport = { ok: true; artefact: Artefact; warnings: string[] } | { ok: false; error: string };

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;
export const isIsoTime = (s: unknown): s is string => typeof s === 'string' && ISO_TIME.test(s) && !Number.isNaN(Date.parse(s));

export const defaultTitle = (kind: ArtefactKind): string => `Untitled ${KINDS[kind].label.toLowerCase()}`;

/** A blank artefact. It has revision 0 until it is first saved. */
export function createArtefact<K extends ArtefactKind>(kind: K, opts: { title?: string; now?: string } = {}): Artefact<K> {
  const now = opts.now ?? new Date().toISOString();
  return {
    schema: ARTEFACT_SCHEMA, schemaVersion: ARTEFACT_SCHEMA_VERSION, id: newId('art'), kind,
    title: opts.title ?? defaultTitle(kind), createdAt: now, updatedAt: now, revision: 0, data: KINDS[kind].empty(),
  } as Artefact<K>;
}

/** What is written to a file or to the device: raw data of a data model only when the user asked to keep it. */
export function storable<A extends Artefact>(a: A): A {
  if (a.kind !== 'data-model') return a;
  const data = withoutUnkeptData(a.data);
  return data === a.data ? a : { ...a, data };
}

/** The downloadable file, named `<slug>.artefact.json`. */
export function artefactJson(a: Artefact): string {
  const s = storable(a);
  return JSON.stringify({
    schema: ARTEFACT_SCHEMA, schemaVersion: ARTEFACT_SCHEMA_VERSION, id: s.id, kind: s.kind, title: s.title,
    createdAt: s.createdAt, updatedAt: s.updatedAt, revision: s.revision, data: s.data,
    exportedBy: { app: APP_NAME, version: APP_VERSION },
  }, null, 2);
}

/** Reads an artefact file. The result is a new artefact: it gets its own id, so importing never overwrites anything. */
export function parseArtefactJson(source: string, opts: { now?: string } = {}): ArtefactImport {
  if (typeof source !== 'string' || source.length > ARTEFACT_FILE_MAX_BYTES) return { ok: false, error: `File is larger than ${ARTEFACT_FILE_MAX_BYTES / 1_000_000} MB.` };
  let raw: unknown;
  try { raw = JSON.parse(source); } catch { return { ok: false, error: 'The file is not valid JSON. It may be damaged or not a ModSim Essentials artefact file.' }; }
  if (!isObj(raw)) return { ok: false, error: 'The file does not contain an artefact.' };
  const schema = own(raw, 'schema');
  if (schema === 'modsim-essentials/project' || schema === 'modsim101/project') return { ok: false, error: 'This is a project file, not an artefact file. Import it on Home.' };
  if (schema !== ARTEFACT_SCHEMA) return { ok: false, error: 'This is not a ModSim Essentials artefact file (missing schema identifier).' };
  const v = own(raw, 'schemaVersion');
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return { ok: false, error: 'The artefact file has an invalid schema version.' };
  if (v > ARTEFACT_SCHEMA_VERSION) {
    return { ok: false, error: `This artefact was saved with a newer schema (version ${v}); this app supports version ${ARTEFACT_SCHEMA_VERSION}. Open it in a newer version of ModSim Essentials. Nothing was changed.` };
  }
  const kind = own(raw, 'kind');
  if (!isArtefactKind(kind)) return { ok: false, error: 'The file holds a kind of artefact this app does not know.' };
  const warnings: string[] = [];
  const warn = (m: string) => { if (warnings.length < 200) warnings.push(m); };
  const def = kindDef(kind);
  const data = def.sanitize(own(raw, 'data'), warn);
  if (!data) return { ok: false, error: `The ${def.label.toLowerCase()} in this file is not in a recognised format. Nothing was imported.` };
  const now = opts.now ?? new Date().toISOString();
  const created = own(raw, 'createdAt');
  const artefact = {
    schema: ARTEFACT_SCHEMA, schemaVersion: ARTEFACT_SCHEMA_VERSION, id: newId('art'), kind,
    title: text(own(raw, 'title'), 'title', warn, LIMITS.title).trim() || defaultTitle(kind),
    createdAt: isIsoTime(created) ? created : now, updatedAt: now, revision: 1, data,
  } as Artefact;
  return { ok: true, artefact, warnings };
}
