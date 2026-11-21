/**
 * The escaping helpers of the Markdown exports. They live apart from the report writers so that the artefact
 * kinds (src/domain/artefacts) can use them without loading the reports, and without an import cycle once the
 * reports include artefacts. `src/exports/markdown.ts` exports the same helpers as `mdText`, `mdCell`, `mdLine`.
 *
 * Rule for callers: never start a line with user text. Put it after a label (`- **Label:** …`) or in a table cell.
 */
export const NOT_SPECIFIED = 'Not yet specified';

export const filled = (s: string | undefined | null): s is string => typeof s === 'string' && s.trim().length > 0;

/** User text on a single line. */
export const mdLine = (s: string): string => s.replace(/\s*\r?\n\s*/g, ' ').trim();

/** User text for a list item. Further lines are indented so they stay inside the item. */
export function mdText(s: string | undefined | null, indent = '  '): string {
  if (!filled(s)) return `_${NOT_SPECIFIED}_`;
  return s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(`\n${indent}`);
}

/** Escape characters that would otherwise create Markdown structure from user text in tables. */
export function mdCell(s: string, empty = '—'): string {
  return filled(s) ? s.trim().replace(/\|/g, '\\|').replace(/\s*\r?\n\s*/g, ' ') : empty;
}
