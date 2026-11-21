/**
 * Shared building blocks of the kind sanitizers (docs/TOOLBOX-SPEC.md §2.1).
 * A sanitizer rebuilds its data field by field from these readers: it never copies a raw object,
 * so unknown keys, wrong types and prototype keys cannot travel into an artefact.
 */
export const LIMITS = { text: 20_000, title: 200, list: 2_000, numbers: 10_000 } as const;
export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export type Warn = (m: string) => void;

export const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
export const isId = (x: unknown): x is string => typeof x === 'string' && ID_PATTERN.test(x);
export const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
/** Own properties only: `__proto__`, `constructor` and other inherited members are never read. */
export const own = (o: Record<string, unknown>, k: string): unknown => (Object.hasOwn(o, k) ? o[k] : undefined);

/** Text, cut to the limit. Anything that is not text becomes an empty string. */
export function text(x: unknown, path: string, warn: Warn, max: number = LIMITS.text): string {
  if (typeof x !== 'string') { if (x !== undefined && x !== null) warn(`${path}: expected text; left empty.`); return ''; }
  if (x.length > max) { warn(`${path}: text shortened to ${max} characters.`); return x.slice(0, max); }
  return x;
}

/** One of the allowed values, or the fallback. */
export function oneOf<T extends string>(x: unknown, allowed: readonly T[], fallback: T, path: string, warn: Warn): T {
  const hit = allowed.find((a) => a === x);
  if (hit !== undefined) return hit;
  if (x !== undefined) warn(`${path}: value not recognised; reset.`);
  return fallback;
}

/** A finite number, or null. */
export function numOrNull(x: unknown, path: string, warn: Warn): number | null {
  if (isNum(x)) return x;
  if (x !== undefined && x !== null) warn(`${path}: expected a number; cleared.`);
  return null;
}

/** A list of unknown items, cut to the limit; null when it is not a list. */
export function items(x: unknown, path: string, warn: Warn, max: number = LIMITS.list): unknown[] | null {
  if (!Array.isArray(x)) return null;
  if (x.length > max) warn(`${path}: list shortened to ${max} items.`);
  return x.slice(0, max);
}

/** A list of finite numbers, cut to the limit; null when it is not a list or holds anything else. */
export function numbers(x: unknown, path: string, warn: Warn, max: number = LIMITS.numbers): number[] | null {
  const list = items(x, path, warn, max);
  if (!list || !list.every(isNum)) return null;
  return list as number[];
}

/** True when the data is exactly what `empty()` returns: nothing has been entered yet. */
export const sameData = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
