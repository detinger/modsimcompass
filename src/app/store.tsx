import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createProject, newId, type ProjectDoc } from '../domain/passport/schema';
import { configHash } from '../domain/sandbox/engine';
import { createRepo, type Repo, type TrashEntry } from '../persistence/db';
import { applyTheme, loadActiveId, loadPrefs, saveActiveId, savePrefs, type Prefs } from '../persistence/prefs';

export type SaveStatus = 'loading' | 'idle' | 'saving' | 'saved' | 'failed';
export interface Conflict { mine: ProjectDoc; theirs: ProjectDoc }
export interface Toast { id: string; text: string; tone?: 'info' | 'success' | 'warning' | 'error'; action?: { label: string; run: () => void } }

interface Store {
  ready: boolean;
  repoKind: Repo['kind'] | null;
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  projects: ProjectDoc[];
  active: ProjectDoc | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  conflict: Conflict | null;
  toasts: Toast[];
  toast: (text: string, tone?: Toast['tone'], action?: Toast['action']) => void;
  dismissToast: (id: string) => void;
  /** Command: apply an edit to the active project (autosaved). */
  update: (fn: (d: ProjectDoc) => void) => void;
  createAndActivate: (opts?: Parameters<typeof createProject>[0]) => ProjectDoc;
  activate: (id: string) => Promise<void>;
  addProject: (doc: ProjectDoc, activate: boolean) => Promise<void>;
  replaceProject: (targetId: string, doc: ProjectDoc) => Promise<void>;
  duplicate: (id: string) => Promise<void>;
  trash: (id: string) => Promise<void>;
  listTrash: () => Promise<TrashEntry[]>;
  restore: (id: string) => Promise<void>;
  purge: (id: string) => Promise<void>;
  resolveConflict: (choice: 'keep-both' | 'use-theirs' | 'keep-mine') => Promise<void>;
  saveNow: () => Promise<void>;
  getBackup: (id: string) => ReturnType<Repo['getBackup']>;
}

const Ctx = createContext<Store | null>(null);
const now = () => new Date().toISOString();
const SAVE_DELAY = 500;
const SAVE_MAX_WAIT = 2000; // never postpone a pending save longer than this

function bumpModelRevision(before: ProjectDoc, after: ProjectDoc) {
  const h = (d: ProjectDoc) => `${configHash(d.sandbox.baseline)}|${d.sandbox.alternative ? configHash(d.sandbox.alternative) : ''}`;
  if (h(before) !== h(after)) after.modelRevision = before.modelRevision + 1;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [repo, setRepo] = useState<Repo | null>(null);
  const [prefs, setPrefsState] = useState<Prefs>(() => loadPrefs());
  const [projects, setProjects] = useState<ProjectDoc[]>([]);
  const [active, setActive] = useState<ProjectDoc | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('loading');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const activeRef = useRef<ProjectDoc | null>(null);
  const savedRevRef = useRef<number | null>(null); // revision stored in the DB for the active project
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => { applyTheme(prefs.theme); }, [prefs.theme]);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info', action?: Toast['action']) => {
    const id = newId('t');
    setToasts((t) => [...t.slice(-2), { id, text, tone, action }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 12000 : 6000);
  }, []);
  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState((cur) => { const next = { ...cur, ...p }; savePrefs(next); return next; });
  }, []);

  const refreshList = useCallback(async (r: Repo) => {
    const list = await r.listProjects();
    list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    setProjects(list);
    return list;
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await createRepo();
      if (cancelled) return;
      setRepo(r);
      const list = await refreshList(r);
      const id = loadActiveId();
      const doc = list.find((p) => p.id === id) ?? null;
      activeRef.current = doc;
      savedRevRef.current = doc ? doc.projectRevision : null;
      setActive(doc);
      setSaveStatus(r.kind === 'memory' ? 'failed' : 'idle');
      if (r.kind === 'memory') setSaveError('This browser is not allowing local storage (for example, private mode or storage blocked). Your work is kept only while this tab is open.');
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [refreshList]);

  const persist = useCallback(async () => {
    const r = repo;
    const doc = activeRef.current;
    if (!r || !doc || !dirtyRef.current || savingRef.current) return;
    if (r.kind === 'memory') {
      await r.saveProject(doc, null);
      dirtyRef.current = false;
      setSaveStatus('failed');
      return;
    }
    savingRef.current = true;
    setSaveStatus('saving');
    const base = savedRevRef.current;
    const candidate: ProjectDoc = { ...doc, projectRevision: (base ?? 0) + 1, updatedAt: now() };
    dirtyRef.current = false;
    const res = await r.saveProject(candidate, base);
    savingRef.current = false;
    if (res.ok) {
      savedRevRef.current = candidate.projectRevision;
      // Merge the revision into the in-memory doc without discarding edits made during the save.
      const cur = activeRef.current;
      if (cur && cur.id === candidate.id) {
        const merged = { ...cur, projectRevision: candidate.projectRevision, updatedAt: candidate.updatedAt };
        activeRef.current = merged;
        setActive(merged);
      }
      setProjects((list) => [candidate, ...list.filter((p) => p.id !== candidate.id)]);
      setSaveStatus('saved');
      setSaveError(null);
      channelRef.current?.postMessage({ type: 'saved', id: candidate.id, revision: candidate.projectRevision });
      if (dirtyRef.current) timerRef.current = window.setTimeout(() => { void persist(); }, SAVE_DELAY);
    } else if ('conflict' in res) {
      dirtyRef.current = true;
      setConflict({ mine: doc, theirs: res.conflict });
      setSaveStatus('failed');
      setSaveError('Another tab saved a newer revision. Keep both versions or review the changes.');
    } else {
      dirtyRef.current = true;
      setSaveStatus('failed');
      setSaveError('Your latest changes could not be saved on this device. Download a project file to keep them.');
    }
  }, [repo]);

  const firstDirtyRef = useRef<number | null>(null);
  const schedule = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const now = Date.now();
    if (firstDirtyRef.current === null) firstDirtyRef.current = now;
    const wait = Math.max(0, Math.min(SAVE_DELAY, firstDirtyRef.current + SAVE_MAX_WAIT - now));
    timerRef.current = window.setTimeout(() => { firstDirtyRef.current = null; void persist(); }, wait);
  }, [persist]);

  // Cross-tab notifications
  useEffect(() => {
    if (!repo || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('modsim101');
    channelRef.current = ch;
    ch.onmessage = async (ev: MessageEvent) => {
      const m = ev.data as { type: string; id: string; revision: number };
      if (m?.type !== 'saved') return;
      await refreshList(repo);
      const cur = activeRef.current;
      if (cur && cur.id === m.id && savedRevRef.current !== null && m.revision > savedRevRef.current) {
        if (!dirtyRef.current) {
          const fresh = await repo.getProject(m.id);
          if (fresh) {
            activeRef.current = fresh; savedRevRef.current = fresh.projectRevision; setActive(fresh);
            toast('This project was updated in another tab; showing the newer revision.', 'info');
          }
        }
        // If dirty, the next save detects the conflict and offers a choice.
      }
    };
    return () => { ch.close(); channelRef.current = null; };
  }, [repo, refreshList, toast]);

  // Flush on page hide; warn before unloading while changes are not yet stored.
  useEffect(() => {
    const flush = () => { if (dirtyRef.current) void persist(); };
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current || savingRef.current) { void persist(); e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', warn);
    document.addEventListener('visibilitychange', flush);
    return () => { window.removeEventListener('pagehide', flush); window.removeEventListener('beforeunload', warn); document.removeEventListener('visibilitychange', flush); };
  }, [persist]);

  const update = useCallback((fn: (d: ProjectDoc) => void) => {
    const cur = activeRef.current;
    if (!cur) return;
    const next = structuredClone(cur);
    fn(next);
    bumpModelRevision(cur, next);
    activeRef.current = next;
    setActive(next);
    dirtyRef.current = true;
    schedule();
  }, [schedule]);

  const flushBeforeSwitch = useCallback(async () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (dirtyRef.current) await persist();
  }, [persist]);

  const setActiveDoc = useCallback((doc: ProjectDoc | null, savedRev: number | null) => {
    activeRef.current = doc;
    savedRevRef.current = savedRev;
    dirtyRef.current = false;
    setActive(doc);
    saveActiveId(doc ? doc.id : null);
  }, []);

  const addProject = useCallback(async (doc: ProjectDoc, activate: boolean) => {
    if (!repo) return;
    await flushBeforeSwitch();
    const res = await repo.saveProject(doc, null);
    await refreshList(repo);
    if (!res.ok) {
      setSaveStatus('failed');
      setSaveError('The new project could not be saved on this device. Download a project file to keep it.');
    }
    if (activate) {
      setActiveDoc(doc, res.ok ? doc.projectRevision : null);
      if (!res.ok) dirtyRef.current = true;
    }
  }, [repo, refreshList, flushBeforeSwitch, setActiveDoc]);

  const createAndActivate = useCallback((opts?: Parameters<typeof createProject>[0]) => {
    const doc = createProject(opts);
    void addProject(doc, true);
    return doc;
  }, [addProject]);

  const activate = useCallback(async (id: string) => {
    if (!repo) return;
    await flushBeforeSwitch();
    const doc = await repo.getProject(id);
    if (doc) setActiveDoc(doc, doc.projectRevision);
  }, [repo, flushBeforeSwitch, setActiveDoc]);

  const replaceProject = useCallback(async (targetId: string, doc: ProjectDoc) => {
    if (!repo) return;
    await flushBeforeSwitch();
    const existing = await repo.getProject(targetId);
    const replacement: ProjectDoc = { ...doc, id: targetId, projectRevision: (existing?.projectRevision ?? 0) + 1, updatedAt: now() };
    const res = await repo.saveProject(replacement, existing?.projectRevision ?? null);
    await refreshList(repo);
    if (res.ok && activeRef.current?.id === targetId) setActiveDoc(replacement, replacement.projectRevision);
    if (!res.ok) toast('The project could not be replaced. Nothing was overwritten.', 'error');
  }, [repo, refreshList, flushBeforeSwitch, setActiveDoc, toast]);

  const duplicate = useCallback(async (id: string) => {
    if (!repo) return;
    await flushBeforeSwitch();
    const src = await repo.getProject(id);
    if (!src) return;
    const t = now();
    const copy: ProjectDoc = { ...structuredClone(src), id: newId('prj'), createdAt: t, updatedAt: t, projectRevision: 1, origin: { kind: 'copy', ref: src.id } };
    copy.passport.identity.title = `${src.passport.identity.title} (copy)`;
    await repo.saveProject(copy, null);
    await refreshList(repo);
    toast(`Created “${copy.passport.identity.title}”.`, 'success');
  }, [repo, refreshList, flushBeforeSwitch, toast]);

  const trash = useCallback(async (id: string) => {
    if (!repo) return;
    if (activeRef.current?.id === id) { await flushBeforeSwitch(); setActiveDoc(null, null); }
    await repo.trashProject(id, now());
    await refreshList(repo);
  }, [repo, refreshList, flushBeforeSwitch, setActiveDoc]);

  const listTrash = useCallback(async () => (repo ? repo.listTrash() : []), [repo]);
  const restore = useCallback(async (id: string) => { if (repo) { await repo.restoreProject(id); await refreshList(repo); } }, [repo, refreshList]);
  const purge = useCallback(async (id: string) => { if (repo) await repo.purgeTrash(id); }, [repo]);
  const getBackup = useCallback((id: string) => (repo ? repo.getBackup(id) : Promise.resolve(null)), [repo]);

  const resolveConflict = useCallback(async (choice: 'keep-both' | 'use-theirs' | 'keep-mine') => {
    if (!repo || !conflict) return;
    const { mine, theirs } = conflict;
    setConflict(null);
    if (choice === 'use-theirs') {
      setActiveDoc(theirs, theirs.projectRevision);
      setSaveStatus('saved'); setSaveError(null);
    } else if (choice === 'keep-both') {
      const t = now();
      const copy: ProjectDoc = { ...structuredClone(mine), id: newId('prj'), createdAt: t, updatedAt: t, projectRevision: 1, origin: { kind: 'copy', ref: mine.id } };
      copy.passport.identity.title = `${mine.passport.identity.title} (this tab’s version)`;
      await repo.saveProject(copy, null);
      setActiveDoc(copy, 1);
      await refreshList(repo);
      setSaveStatus('saved'); setSaveError(null);
      toast('Both versions kept. You are now editing this tab’s version as a separate project.', 'success');
    } else {
      // Explicit, user-chosen overwrite of the other tab's revision.
      savedRevRef.current = theirs.projectRevision;
      activeRef.current = mine;
      dirtyRef.current = true;
      await persist();
    }
  }, [repo, conflict, setActiveDoc, refreshList, toast, persist]);

  const saveNow = useCallback(async () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    dirtyRef.current = true;
    await persist();
  }, [persist]);

  const value = useMemo<Store>(() => ({
    ready, repoKind: repo?.kind ?? null, prefs, setPrefs, projects, active, saveStatus, saveError, conflict, toasts, toast, dismissToast,
    update, createAndActivate, activate, addProject, replaceProject, duplicate, trash, listTrash, restore, purge, resolveConflict, saveNow, getBackup,
  }), [ready, repo, prefs, setPrefs, projects, active, saveStatus, saveError, conflict, toasts, toast, dismissToast, update, createAndActivate,
    activate, addProject, replaceProject, duplicate, trash, listTrash, restore, purge, resolveConflict, saveNow, getBackup]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
