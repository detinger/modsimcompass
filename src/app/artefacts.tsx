import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createArtefact, parseArtefactJson, storable, type ArtefactImport } from '../domain/artefacts/file';
import { includeArtefact, inclusionOf, refreshCopies, staleSources, undoChange, undoRecord, type UndoRecord } from '../domain/artefacts/include';
import { isArtefactKind, KINDS } from '../domain/artefacts/kinds';
import type { Artefact, ArtefactData, ArtefactKind } from '../domain/artefacts/types';
import { createProject, newId } from '../domain/passport/schema';
import { useRouter } from './router';
import { useStore } from './store';

/**
 * The artefacts of this device (docs/TOOLBOX-SPEC.md §2.5): what the Toolbox tools produce, kept in their own
 * store and independent of any project. `useArtefacts` is the list; `useArtefactEditor` is the editing session
 * of one tool page; `useAddToProject` copies an artefact into the open project.
 */
export interface ArtefactsApi {
  ready: boolean;
  /** Newest first. */
  list: Artefact[];
  ofKind<K extends ArtefactKind>(kind: K): Artefact<K>[];
  get(id: string): Artefact | undefined;
  /** Stores a changed artefact: bumps its revision and its modification time. */
  save(a: Artefact): Promise<void>;
  /** Stores an artefact exactly as given (no revision bump). Used by the editor and to undo a delete. */
  put(a: Artefact): Promise<void>;
  remove(id: string): Promise<void>;
  duplicate(id: string): Promise<Artefact | null>;
  importText(text: string): Promise<ArtefactImport>;
}

const Ctx = createContext<ArtefactsApi | null>(null);
const now = () => new Date().toISOString();
const newestFirst = (list: Artefact[]) => [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
const SAVE_DELAY = 500;
const SAVE_MAX_WAIT = 2000; // never postpone a pending save longer than this
/** The revision an artefact is saved with: its own, or one more than a stored revision that is not behind it. */
export const savedRevision = (draft: number, stored: number | null | undefined): number => (typeof stored === 'number' && stored >= draft ? stored + 1 : draft);

/** A page of the open project: only a tab showing the project writes refreshed copies into it. */
export const showsProject = (path: string) => /^\/project(\/|$)/.test(path.split(/[?#]/)[0]);

export function ArtefactsProvider({ children }: { children: ReactNode }) {
  const { repo, active, update } = useStore();
  const { path } = useRouter();
  const showing = showsProject(path);
  const [ready, setReady] = useState(false);
  const [list, setList] = useState<Artefact[]>([]);
  const listRef = useRef<Artefact[]>([]);
  const writing = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; });
  const commit = useCallback((next: Artefact[]) => { listRef.current = next; setList(next); }, []);

  const reload = useCallback(async () => {
    if (!repo) return;
    let all: Artefact[] = [];
    try { all = await repo.listArtefacts(); } catch { /* storage unreadable: start with none; nothing is deleted */ }
    // An artefact of a kind this version does not know stays stored but is not shown.
    commit(newestFirst(all.filter((a) => a && typeof a.id === 'string' && isArtefactKind(a.kind) && !!a.data && typeof a.data === 'object')));
  }, [repo, commit]);

  useEffect(() => {
    if (!repo) return;
    let cancelled = false;
    void reload().then(() => { if (!cancelled) setReady(true); });
    // Another tab may have changed the store while this one was in the background.
    const onVisible = () => { if (document.visibilityState === 'visible' && writing.current === 0) void reload(); };
    document.addEventListener('visibilitychange', onVisible);
    // Another tab saved an artefact: a copy of it in the open project may need refreshing, so read the list again.
    const ch = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('modsim101-artefacts');
    channel.current = ch;
    if (ch) ch.onmessage = (ev: MessageEvent) => {
      const m = ev.data as { type?: string; id?: string };
      if (m?.type === 'artefact' && typeof m.id === 'string' && (activeRef.current?.artefacts ?? []).some((i) => i.sourceId === m.id)) void reload();
    };
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible); ch?.close(); channel.current = null; };
  }, [repo, reload]);

  /**
   * A saved revision is always newer than any stored before it, also when another tab saved the same artefact meanwhile:
   * it becomes one more than the stored one whenever the draft is not already ahead, so no copy's `sourceRevision`
   * can be ahead of its original.
   */
  const put = useCallback(async (a: Artefact) => {
    let stored = storable(a);
    const known = listRef.current.find((x) => x.id === stored.id);
    if (known && known !== a) stored = { ...stored, revision: savedRevision(stored.revision, known.revision) };
    commit(newestFirst([stored, ...listRef.current.filter((x) => x.id !== stored.id)]));
    if (!repo) throw new Error('Storage is not ready.');
    writing.current++;
    try {
      let onDisk: Artefact | null = null;
      try { onDisk = await repo.getArtefact(stored.id); } catch { onDisk = null; }
      if (onDisk && savedRevision(stored.revision, onDisk.revision) !== stored.revision) {
        stored = { ...stored, revision: savedRevision(stored.revision, onDisk.revision) };
        const s = stored;
        commit(newestFirst([s, ...listRef.current.filter((x) => x.id !== s.id)]));
      }
      await repo.saveArtefact(stored);
      channel.current?.postMessage({ type: 'artefact', id: stored.id, revision: stored.revision });
    } finally { writing.current--; }
  }, [repo, commit]);

  const save = useCallback((a: Artefact) => put({ ...a, revision: a.revision + 1, updatedAt: now() }), [put]);

  const remove = useCallback(async (id: string) => {
    commit(listRef.current.filter((x) => x.id !== id));
    if (!repo) return;
    writing.current++;
    try { await repo.deleteArtefact(id); channel.current?.postMessage({ type: 'artefact', id }); } finally { writing.current--; }
  }, [repo, commit]);

  const duplicate = useCallback(async (id: string) => {
    const src = listRef.current.find((x) => x.id === id);
    if (!src) return null;
    const t = now();
    const copy: Artefact = { ...structuredClone(src), id: newId('art'), title: `${src.title} (copy)`.slice(0, 200), createdAt: t, updatedAt: t, revision: 1 };
    try { await put(copy); } catch { return null; }
    return copy;
  }, [put]);

  const importText = useCallback(async (text: string): Promise<ArtefactImport> => {
    const res = parseArtefactJson(text);
    if (!res.ok) return res;
    try { await put(res.artefact); } catch { return { ok: false, error: 'The artefact could not be saved on this device.' }; }
    return res;
  }, [put]);

  // Live projects (docs/TOOLBOX-SPEC.md §10): a copy in the open project follows its original on this device. Only a
  // tab showing the project writes the refresh into it: when the project is opened there, and when an included artefact
  // is saved, in this tab or (heard by broadcast) another. Tabs elsewhere never write the project, so a Toolbox tab
  // cannot collide with one where the project is being edited. A copy whose original is not on this device stays as it
  // is. The refresh is a silent edit of the project: saved with it, taken in by other tabs without a notice.
  useEffect(() => {
    if (!ready || !active || !showing) return;
    const find = (id: string) => listRef.current.find((a) => a.id === id);
    if (staleSources(active, find).length === 0) return;
    const t = now();
    update((d) => { refreshCopies(d, find, t); }, { silent: true });
  }, [ready, active, list, update, showing]);

  const value = useMemo<ArtefactsApi>(() => ({
    ready, list,
    ofKind: <K extends ArtefactKind>(kind: K) => list.filter((a) => a.kind === kind) as Artefact<K>[],
    get: (id: string) => list.find((a) => a.id === id),
    save, put, remove, duplicate, importText,
  }), [ready, list, save, put, remove, duplicate, importText]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useArtefacts(): ArtefactsApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useArtefacts outside ArtefactsProvider');
  return v;
}

// ── The editing session of one tool page ─────────────────────────────────

export type ArtefactSaveState = 'idle' | 'saving' | 'saved' | 'failed';
export interface ArtefactEditor<K extends ArtefactKind> {
  /** A blank draft until the first change. */
  artefact: Artefact<K>;
  /** False while it is still the blank draft. */
  persisted: boolean;
  /** Edits a copy of the data. Saved after 500 ms without further changes, 2 s at the latest. */
  setData(fn: (draft: ArtefactData[K]) => void): void;
  rename(title: string): void;
  /** A fresh blank draft. */
  startNew(): void;
  open(id: string): void;
  saveState: ArtefactSaveState;
}

interface Session<K extends ArtefactKind> { artefact: Artefact<K>; persisted: boolean }

/**
 * Opening a tool with no id shows the most recently edited artefact of that kind, or a blank draft.
 * The first change saves the draft and puts its id into the address. Every change gets a new revision at once,
 * so what is on screen and what is saved always carry the same revision number.
 */
export function useArtefactEditor<K extends ArtefactKind>(kind: K, routeId: string | undefined): ArtefactEditor<K> {
  const { ready, list, put } = useArtefacts();
  const { navigate } = useRouter();
  const { toast } = useStore();
  const toolPath = KINDS[kind].toolPath;

  // The latest list and router, read inside callbacks that must keep their identity between renders.
  const listRef = useRef(list);
  const go = useRef(navigate);
  useEffect(() => { listRef.current = list; go.current = navigate; });

  const [session, setSession] = useState<Session<K>>(() => {
    const ofKind = list.filter((a) => a.kind === kind) as Artefact<K>[];
    const wanted = routeId ? ofKind.find((a) => a.id === routeId) : ofKind[0];
    return wanted ? { artefact: wanted, persisted: true } : { artefact: createArtefact(kind), persisted: false };
  });
  const [saveState, setSaveState] = useState<ArtefactSaveState>('idle');
  const cur = useRef(session);
  const dirty = useRef(false);
  const writes = useRef(0);
  const timer = useRef<number | null>(null);
  const firstDirty = useRef<number | null>(null);
  /** The blank draft was asked for (New, or an address that led nowhere): do not open the latest artefact instead. */
  const wantBlank = useRef(false);
  const reportedMissing = useRef<string | null>(null);

  const flush = useCallback((): Promise<void> => {
    if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }
    firstDirty.current = null;
    if (!dirty.current) return Promise.resolve();
    dirty.current = false;
    const a = cur.current.artefact;
    setSaveState('saving');
    writes.current++;
    return put(a as Artefact).then(
      () => { writes.current--; if (!dirty.current && writes.current === 0) setSaveState('saved'); },
      () => { writes.current--; if (cur.current.artefact.id === a.id) dirty.current = true; setSaveState('failed'); },
    );
  }, [put]);

  const schedule = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    const t = Date.now();
    if (firstDirty.current === null) firstDirty.current = t;
    const wait = Math.max(0, Math.min(SAVE_DELAY, firstDirty.current + SAVE_MAX_WAIT - t));
    timer.current = window.setTimeout(() => { void flush(); }, wait);
  }, [flush]);

  const show = useCallback((next: Session<K>) => {
    void flush(); // what was being edited is stored before anything else is shown
    cur.current = next;
    setSession(next);
    setSaveState('idle');
  }, [flush]);

  // Follow the address.
  useEffect(() => {
    if (!ready) return;
    const here = cur.current;
    const ofKind = listRef.current.filter((a) => a.kind === kind) as Artefact<K>[];
    if (routeId) {
      if (here.persisted && here.artefact.id === routeId) return;
      const found = listRef.current.find((a) => a.id === routeId);
      if (found && found.kind === kind) { wantBlank.current = false; show({ artefact: found as Artefact<K>, persisted: true }); return; }
      // An artefact of another kind opens in its own tool.
      if (found) { go.current(`${KINDS[found.kind].toolPath}/${found.id}`, { replace: true }); return; }
      if (reportedMissing.current !== routeId) {
        reportedMissing.current = routeId;
        toast('That artefact was not found on this device. A new one is ready instead.', 'warning');
      }
      wantBlank.current = true;
      show({ artefact: createArtefact(kind), persisted: false });
      go.current(toolPath, { replace: true });
      return;
    }
    if (!here.persisted && wantBlank.current) return;
    const latest = here.persisted ? (ofKind[0] ?? here.artefact) : ofKind[0];
    if (latest) go.current(`${toolPath}/${latest.id}`, { replace: true });
  }, [ready, routeId, kind, toolPath, toast, show]);

  // Store pending edits when the page is hidden or closed, and when the tool is left.
  // Closing or reloading within the half second before a save asks first, as it does for a project.
  useEffect(() => {
    const onHide = () => { void flush(); };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty.current || writes.current > 0) { void flush(); e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onLeave);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide); window.removeEventListener('beforeunload', onLeave); document.removeEventListener('visibilitychange', onHide);
      void flush();
    };
  }, [flush]);

  const apply = useCallback((change: (a: Artefact<K>) => Partial<Artefact<K>>) => {
    const before = cur.current;
    const artefact = { ...before.artefact, ...change(before.artefact), revision: before.artefact.revision + 1, updatedAt: now() } as Artefact<K>;
    const next = { artefact, persisted: true };
    cur.current = next;
    setSession(next);
    wantBlank.current = false;
    dirty.current = true;
    setSaveState('saving'); // a change that waits for its save is not “saved” yet
    if (before.persisted) { schedule(); return; }
    // First change of a blank draft: store it now and give it an address that survives a reload.
    void flush();
    go.current(`${toolPath}/${artefact.id}`, { replace: true, scroll: false });
  }, [schedule, flush, toolPath]);

  const setData = useCallback((fn: (draft: ArtefactData[K]) => void) => {
    apply((a) => { const data = structuredClone(a.data) as ArtefactData[K]; fn(data); return { data } as Partial<Artefact<K>>; });
  }, [apply]);
  const rename = useCallback((title: string) => { apply(() => ({ title: title.slice(0, 200) }) as Partial<Artefact<K>>); }, [apply]);
  const startNew = useCallback(() => {
    wantBlank.current = true;
    show({ artefact: createArtefact(kind), persisted: false });
    go.current(toolPath);
  }, [show, toolPath, kind]);
  const open = useCallback((id: string) => { void flush(); go.current(`${toolPath}/${id}`); }, [flush, toolPath]);

  return { artefact: session.artefact, persisted: session.persisted, setData, rename, startNew, open, saveState };
}

// ── Adding an artefact to the open project ───────────────────────────────

export type AddState = 'no-project' | 'absent' | 'current' | 'outdated';

/**
 * `state(artefact)`: whether the open project holds a copy and whether that copy is up to date.
 * `add(artefact)`: adds it, or refreshes the copy. With no project open, a new project is started with the artefact
 * in it. Adding to an open project can be undone from the notification.
 */
export function useAddToProject(): { state(artefact: Artefact): AddState; add(artefact: Artefact): void } {
  const { active, update, addProject, toast } = useStore();
  const lastStart = useRef(0);

  const state = useCallback((a: Artefact): AddState => {
    if (!active) return 'no-project';
    const copy = inclusionOf(active, a.id);
    if (!copy) return 'absent';
    return copy.sourceRevision === a.revision ? 'current' : 'outdated';
  }, [active]);

  const add = useCallback((a: Artefact) => {
    const t = now();
    const what = KINDS[a.kind].label.toLowerCase();
    if (!active) {
      if (Date.now() - lastStart.current < 800) return; // a double click must not start two projects
      lastStart.current = Date.now();
      const doc = createProject({ now: t });
      includeArtefact(doc, a, t);
      void addProject(doc, true);
      toast(`Started “${doc.passport.identity.title}” with this ${what}.`, 'success');
      return;
    }
    const name = active.passport.identity.title || 'Untitled project';
    const refreshed = !!inclusionOf(active, a.id);
    const displaced = !refreshed && !KINDS[a.kind].many ? (active.artefacts ?? []).find((i) => i.kind === a.kind) : undefined;
    // An explicit add: the copy takes over the fields its kind writes. Text of the author's own that it replaces is named, never silent.
    let overwritten: string[] = [];
    let record: UndoRecord | null = null;
    update((d) => {
      const before = structuredClone(d);
      const r = includeArtefact(d, a, t);
      overwritten = r.overwritten;
      record = undoRecord(before, d, [r.inclusionId, ...(r.replaced ? [r.replaced.id] : [])]);
    });
    const base = refreshed ? `Updated the ${what} in “${name}”.` : displaced ? `Added to “${name}”. It replaced “${displaced.title}”.` : `Added to “${name}”.`;
    const text = overwritten.length ? `${base} Replaced your text in: ${overwritten.join(', ')}.` : base;
    // Undo takes back only what the add did; edits made after it stay.
    toast(text, 'success', { label: 'Undo', run: () => { const rec = record; if (rec) update((d) => { undoChange(d, rec); }); } });
  }, [active, update, addProject, toast]);

  return { state, add };
}
