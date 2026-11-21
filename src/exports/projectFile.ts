import { PASSPORT_SCHEMA, type ProjectDoc } from '../domain/passport/schema';

/**
 * The re-importable project file and file-name slugs. Kept apart from the report writers so that screens
 * which only download a project file do not load the Markdown, HTML, CSV and ZIP code with it.
 */
export const APP_NAME = 'ModSimCompass';
export const APP_VERSION = '3.0.0';

export function slugify(title: string): string {
  const s = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return s || 'project';
}

export function projectJson(doc: ProjectDoc): string {
  // A project saved under an earlier name of the app is written under the current one.
  return JSON.stringify({ ...doc, schema: PASSPORT_SCHEMA, exportedBy: { app: APP_NAME, version: APP_VERSION } }, null, 2);
}
