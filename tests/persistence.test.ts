import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createRepo, MemoryRepo } from '../src/persistence/db';
import { createProject } from '../src/domain/passport/schema';

describe('IndexedDB repository (fake-indexeddb)', () => {
  it('saves, reads, detects revision conflicts and keeps a last-known-good backup', async () => {
    const repo = await createRepo();
    expect(repo.kind).toBe('indexeddb');
    const d = createProject({ title: 'A' });
    expect(await repo.saveProject(d, null)).toEqual({ ok: true });
    const r2 = { ...d, projectRevision: 2, passport: { ...d.passport, identity: { title: 'A2', author: '' } } };
    expect(await repo.saveProject(r2, 1)).toEqual({ ok: true });
    expect((await repo.getBackup(d.id))!.project.passport.identity.title).toBe('A');
    // Another tab still based on revision 1 tries to save → conflict, nothing overwritten
    const stale = { ...d, projectRevision: 2, passport: { ...d.passport, identity: { title: 'stale', author: '' } } };
    const res = await repo.saveProject(stale, 1);
    expect('conflict' in res && res.conflict.passport.identity.title).toBe('A2');
    expect((await repo.getProject(d.id))!.passport.identity.title).toBe('A2');
  });
  it('delete is recoverable via trash', async () => {
    const repo = await createRepo();
    const d = createProject({ title: 'B' });
    await repo.saveProject(d, null);
    await repo.trashProject(d.id, 'now');
    expect(await repo.getProject(d.id)).toBeNull();
    expect((await repo.listTrash()).some((t) => t.id === d.id)).toBe(true);
    await repo.restoreProject(d.id);
    expect((await repo.getProject(d.id))!.passport.identity.title).toBe('B');
  });
  it('memory fallback behaves identically for conflicts', async () => {
    const repo = new MemoryRepo();
    const d = createProject();
    await repo.saveProject(d, null);
    await repo.saveProject({ ...d, projectRevision: 2 }, 1);
    expect('conflict' in (await repo.saveProject({ ...d, projectRevision: 2 }, 1))).toBe(true);
  });
});
