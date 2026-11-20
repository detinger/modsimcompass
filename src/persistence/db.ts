import type { ProjectDoc } from '../domain/passport/schema';

/**
 * Local-first persistence (PLAN §12).
 * - IndexedDB database `modsim101` (identifier kept from the original project name).
 * - Stores: projects, trash (recoverable deletes), backups (last-known-good per project).
 *   (A legacy `progress` store from v1 is kept in the schema but no longer used.)
 * - Saves are atomic per transaction and detect cross-tab revision conflicts.
 * - If IndexedDB is unavailable (private mode, quota, blocked), an in-memory store keeps the
 *   draft for this session and the UI reports that saving failed.
 */
export const DB_NAME = 'modsim101';
export const DB_VERSION = 1;
export const STORES = ['projects', 'trash', 'backups', 'progress'] as const;
type StoreName = (typeof STORES)[number];

export type SaveResult =
  | { ok: true }
  | { ok: false; conflict: ProjectDoc }
  | { ok: false; error: string };

export interface TrashEntry { id: string; deletedAt: string; project: ProjectDoc }
export interface BackupEntry { id: string; savedAt: string; project: ProjectDoc }

export interface Repo {
  readonly kind: 'indexeddb' | 'memory';
  listProjects(): Promise<ProjectDoc[]>;
  getProject(id: string): Promise<ProjectDoc | null>;
  /** Writes `doc` only if the stored revision equals `baseRevision` (or nothing is stored). */
  saveProject(doc: ProjectDoc, baseRevision: number | null): Promise<SaveResult>;
  trashProject(id: string, now: string): Promise<void>;
  listTrash(): Promise<TrashEntry[]>;
  restoreProject(id: string): Promise<ProjectDoc | null>;
  purgeTrash(id: string): Promise<void>;
  getBackup(id: string): Promise<BackupEntry | null>;
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
    r.onsuccess = () => resolve(r.result);
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
  async saveProject(doc: ProjectDoc, baseRevision: number | null): Promise<SaveResult> {
    try {
      const tx = this.db.transaction(['projects', 'backups'], 'readwrite');
      const projects = tx.objectStore('projects');
      const backups = tx.objectStore('backups');
      const existing = (await req(projects.get(doc.id))) as ProjectDoc | undefined;
      if (existing && baseRevision !== null && existing.projectRevision !== baseRevision) {
        tx.abort();
        return { ok: false, conflict: existing };
      }
      if (existing) backups.put({ id: doc.id, savedAt: existing.updatedAt, project: existing } satisfies BackupEntry);
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
    tx.objectStore('projects').put(t.project);
    tx.objectStore('trash').delete(id);
    await done(tx);
    return t.project;
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
}

/** Session-only fallback. Never presented as durable storage. */
export class MemoryRepo implements Repo {
  readonly kind = 'memory' as const;
  private projects = new Map<string, ProjectDoc>();
  private trash = new Map<string, TrashEntry>();
  private backups = new Map<string, BackupEntry>();
  async listProjects() { return [...this.projects.values()].map((p) => structuredClone(p)); }
  async getProject(id: string) { const p = this.projects.get(id); return p ? structuredClone(p) : null; }
  async saveProject(doc: ProjectDoc, baseRevision: number | null): Promise<SaveResult> {
    const existing = this.projects.get(doc.id);
    if (existing && baseRevision !== null && existing.projectRevision !== baseRevision) return { ok: false, conflict: structuredClone(existing) };
    if (existing) this.backups.set(doc.id, { id: doc.id, savedAt: existing.updatedAt, project: existing });
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
    this.projects.set(id, t.project); this.trash.delete(id);
    return structuredClone(t.project);
  }
  async purgeTrash(id: string) { this.trash.delete(id); }
  async getBackup(id: string) { return this.backups.get(id) ?? null; }
}

export async function createRepo(factory?: IDBFactory): Promise<Repo> {
  const db = await openDatabase(factory);
  return db ? new IdbRepo(db) : new MemoryRepo();
}
