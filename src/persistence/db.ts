import { newId, type ProjectDoc } from '../domain/passport/schema';
import type { Artefact } from '../domain/artefacts/types';

/**
 * Local-first persistence (PLAN §12).
 * - IndexedDB database `modsim101` (identifier kept from the original project name).
 * - Stores: projects, trash (recoverable deletes), backups (last-known-good per project), and, from database
 *   version 2, artefacts (what the Toolbox tools produce; independent of any project).
 *   (A legacy `progress` store from v1 is kept in the schema but no longer used.)
 * - Opening a version 1 database adds the missing store and leaves every existing record as it is.
 * - Saves are atomic per transaction and detect cross-tab revision conflicts.
 * - If IndexedDB is unavailable (private mode, quota, blocked), an in-memory store keeps the
 *   draft for this session and the UI reports that saving failed.
 */
export const DB_NAME = 'modsim101';
export const DB_VERSION = 2;
export const STORES = ['projects', 'trash', 'backups', 'progress', 'artefacts'] as const;
type StoreName = (typeof STORES)[number];

export type SaveResult =
  | { ok: true }
  | { ok: false; conflict: ProjectDoc }
  | { ok: false; error: string };

export interface TrashEntry { id: string; deletedAt: string; project: ProjectDoc }
export interface BackupEntry { id: string; savedAt: string; project: ProjectDoc; /** When this backup was written (ms since epoch). */ keptAt?: number }

/**
 * The backup is a recovery point, not the previous keystroke: once written it is kept for this long,
 * so an autosave every half second cannot roll it forward to a state that is only moments old.
 */
export const BACKUP_INTERVAL_MS = 10 * 60 * 1000;
const backupIsDue = (b: BackupEntry | undefined, nowMs: number) => !b || typeof b.keptAt !== 'number' || nowMs - b.keptAt >= BACKUP_INTERVAL_MS || nowMs < b.keptAt;
/** A restored project never overwrites a live one with the same id; it comes back as a separate project. */
const restoredCopy = (p: ProjectDoc): ProjectDoc => ({ ...p, id: newId('prj'), projectRevision: 1, passport: { ...p.passport, identity: { ...p.passport.identity, title: `${p.passport.identity.title || 'Untitled project'} (restored)` } } });

export interface Repo {
  readonly kind: 'indexeddb' | 'memory';
  listProjects(): Promise<ProjectDoc[]>;
  getProject(id: string): Promise<ProjectDoc | null>;
  /** Writes `doc` only if the stored revision equals `baseRevision` (or nothing is stored). `nowMs` is for tests. */
  saveProject(doc: ProjectDoc, baseRevision: number | null, nowMs?: number): Promise<SaveResult>;
  trashProject(id: string, now: string): Promise<void>;
  listTrash(): Promise<TrashEntry[]>;
  restoreProject(id: string): Promise<ProjectDoc | null>;
  purgeTrash(id: string): Promise<void>;
  getBackup(id: string): Promise<BackupEntry | null>;
  /** Toolbox artefacts (key `id`). Saving replaces the stored artefact with the same id. */
  listArtefacts(): Promise<Artefact[]>;
  getArtefact(id: string): Promise<Artefact | null>;
  saveArtefact(a: Artefact): Promise<void>;
  deleteArtefact(id: string): Promise<void>;
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

export function openDatabase(factory: IDBFactory | undefined = globalThis.indexedDB): Promise<IDBDatabase | null> {
  if (!factory) return Promise.resolve(null);
  return new Promise((resolve) => {
    let r: IDBOpenDBRequest;
    try { r = factory.open(DB_NAME, DB_VERSION); } catch { resolve(null); return; }
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    r.onsuccess = () => {
      // Let a later version of the app upgrade the database while this tab is still open.
      r.result.onversionchange = () => r.result.close();
      resolve(r.result);
    };
    r.onerror = () => resolve(null);
    r.onblocked = () => resolve(null);
  });
}

export class IdbRepo implements Repo {
  readonly kind = 'indexeddb' as const;
  private db: IDBDatabase;
  constructor(db: IDBDatabase) { this.db = db; }
  private store(name: StoreName, mode: IDBTransactionMode = 'readonly') {
    const tx = this.db.transaction(name, mode);
    return { tx, s: tx.objectStore(name) };
  }
  async listProjects() {
    const { s } = this.store('projects');
    return (await req(s.getAll())) as ProjectDoc[];
  }
  async getProject(id: string) {
    const { s } = this.store('projects');
    return ((await req(s.get(id))) as ProjectDoc | undefined) ?? null;
  }
  async saveProject(doc: ProjectDoc, baseRevision: number | null, nowMs = Date.now()): Promise<SaveResult> {
    try {
      const tx = this.db.transaction(['projects', 'backups'], 'readwrite');
      const projects = tx.objectStore('projects');
      const backups = tx.objectStore('backups');
      const existing = (await req(projects.get(doc.id))) as ProjectDoc | undefined;
      if (existing && baseRevision !== null && existing.projectRevision !== baseRevision) {
        tx.abort();
        return { ok: false, conflict: existing };
      }
      if (existing) {
        const backup = (await req(backups.get(doc.id))) as BackupEntry | undefined;
        if (backupIsDue(backup, nowMs)) backups.put({ id: doc.id, savedAt: existing.updatedAt, project: existing, keptAt: nowMs } satisfies BackupEntry);
      }
      projects.put(doc);
      await done(tx);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  async trashProject(id: string, now: string) {
    const tx = this.db.transaction(['projects', 'trash'], 'readwrite');
    const p = (await req(tx.objectStore('projects').get(id))) as ProjectDoc | undefined;
    if (p) {
      tx.objectStore('trash').put({ id, deletedAt: now, project: p } satisfies TrashEntry);
      tx.objectStore('projects').delete(id);
    }
    await done(tx);
  }
  async listTrash() {
    const { s } = this.store('trash');
    return (await req(s.getAll())) as TrashEntry[];
  }
  async restoreProject(id: string) {
    const tx = this.db.transaction(['projects', 'trash'], 'readwrite');
    const t = (await req(tx.objectStore('trash').get(id))) as TrashEntry | undefined;
    if (!t) { tx.abort(); return null; }
    const live = (await req(tx.objectStore('projects').get(id))) as ProjectDoc | undefined;
    const project = live ? restoredCopy(t.project) : t.project;
    tx.objectStore('projects').put(project);
    tx.objectStore('trash').delete(id);
    await done(tx);
    return project;
  }
  async purgeTrash(id: string) {
    const { tx, s } = this.store('trash', 'readwrite');
    s.delete(id);
    await done(tx);
  }
  async getBackup(id: string) {
    const { s } = this.store('backups');
    return ((await req(s.get(id))) as BackupEntry | undefined) ?? null;
  }
  async listArtefacts() {
    const { s } = this.store('artefacts');
    return (await req(s.getAll())) as Artefact[];
  }
  async getArtefact(id: string) {
    const { s } = this.store('artefacts');
    return ((await req(s.get(id))) as Artefact | undefined) ?? null;
  }
  async saveArtefact(a: Artefact) {
    const { tx, s } = this.store('artefacts', 'readwrite');
    s.put(a);
    // Commit at once instead of when the request reports back: a save started while the page is closing still lands.
    try { tx.commit?.(); } catch { /* already finishing */ }
    await done(tx);
  }
  async deleteArtefact(id: string) {
    const { tx, s } = this.store('artefacts', 'readwrite');
    s.delete(id);
    await done(tx);
  }
}

/** Session-only fallback. Never presented as durable storage. */
export class MemoryRepo implements Repo {
  readonly kind = 'memory' as const;
  private projects = new Map<string, ProjectDoc>();
  private trash = new Map<string, TrashEntry>();
  private backups = new Map<string, BackupEntry>();
  private artefacts = new Map<string, Artefact>();
  async listProjects() { return [...this.projects.values()].map((p) => structuredClone(p)); }
  async getProject(id: string) { const p = this.projects.get(id); return p ? structuredClone(p) : null; }
  async saveProject(doc: ProjectDoc, baseRevision: number | null, nowMs = Date.now()): Promise<SaveResult> {
    const existing = this.projects.get(doc.id);
    if (existing && baseRevision !== null && existing.projectRevision !== baseRevision) return { ok: false, conflict: structuredClone(existing) };
    if (existing && backupIsDue(this.backups.get(doc.id), nowMs)) this.backups.set(doc.id, { id: doc.id, savedAt: existing.updatedAt, project: existing, keptAt: nowMs });
    this.projects.set(doc.id, structuredClone(doc));
    return { ok: true };
  }
  async trashProject(id: string, now: string) {
    const p = this.projects.get(id);
    if (p) { this.trash.set(id, { id, deletedAt: now, project: p }); this.projects.delete(id); }
  }
  async listTrash() { return [...this.trash.values()]; }
  async restoreProject(id: string) {
    const t = this.trash.get(id);
    if (!t) return null;
    const project = this.projects.has(id) ? restoredCopy(t.project) : t.project;
    this.projects.set(project.id, project); this.trash.delete(id);
    return structuredClone(project);
  }
  async purgeTrash(id: string) { this.trash.delete(id); }
  async getBackup(id: string) { return this.backups.get(id) ?? null; }
  async listArtefacts() { return [...this.artefacts.values()].map((a) => structuredClone(a)); }
  async getArtefact(id: string) { const a = this.artefacts.get(id); return a ? structuredClone(a) : null; }
  async saveArtefact(a: Artefact) { this.artefacts.set(a.id, structuredClone(a)); }
  async deleteArtefact(id: string) { this.artefacts.delete(id); }
}

export async function createRepo(factory?: IDBFactory): Promise<Repo> {
  const db = await openDatabase(factory);
  return db ? new IdbRepo(db) : new MemoryRepo();
}
