/**
 * Undo and redo for the conceptual model: two stacks of whole snapshots. Pure, so it is tested on its own.
 * Changes that carry the same key within a short time (typing in one field, a burst of arrow-key moves)
 * become one step, so undo takes back the whole word or the whole move rather than one letter or one nudge.
 */
export interface History<T> {
  past: T[];
  future: T[];
  /** Key and time of the last recorded change, for coalescing. */
  key: string | null;
  at: number;
}

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 1200;

export const emptyHistory = <T>(): History<T> => ({ past: [], future: [], key: null, at: 0 });

/** Records the state before a change. A change with the same key soon after the last one joins its step. */
export function record<T>(h: History<T>, before: T, key: string | null, now: number): History<T> {
  if (key !== null && h.key === key && now - h.at < COALESCE_MS && h.past.length > 0) return { ...h, future: [], at: now };
  return { past: [...h.past, before].slice(-HISTORY_LIMIT), future: [], key, at: now };
}

export function undo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null {
  if (!h.past.length) return null;
  return { history: { past: h.past.slice(0, -1), future: [current, ...h.future].slice(0, HISTORY_LIMIT), key: null, at: 0 }, state: h.past[h.past.length - 1] };
}

export function redo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null {
  if (!h.future.length) return null;
  const [state, ...rest] = h.future;
  return { history: { past: [...h.past, current].slice(-HISTORY_LIMIT), future: rest, key: null, at: 0 }, state };
}

/**
 * After a change that joined the last step (same key) took the state back to where that step began, for example
 * typing a name and then pressing Escape, the step changes nothing and is dropped.
 */
export function settle<T>(h: History<T>, current: T, same: (a: T, b: T) => boolean): History<T> {
  if (h.key === null || !h.past.length || !same(h.past[h.past.length - 1], current)) return h;
  return { ...h, past: h.past.slice(0, -1), key: null, at: 0 };
}

/** What an Undo offered in a message refers to: one artefact, in the state right after the change it would take back. */
export interface UndoToken { owner: string; version: number }

/** An offered Undo still applies only to the same artefact, with nothing changed since it was offered. */
export const tokenHolds = (t: UndoToken, owner: string, version: number): boolean => t.owner === owner && t.version === version;
