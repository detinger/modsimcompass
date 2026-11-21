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
  it('keeps the recovery backup for ten minutes instead of rolling it forward on every autosave', async () => {
    for (const repo of [await createRepo(), new MemoryRepo()]) {
      const d = createProject({ title: 'v1' });
      const rev = (n: number) => ({ ...d, projectRevision: n, passport: { ...d.passport, identity: { title: `v${n}`, author: '' } } });
      const t0 = 1_000_000;
      await repo.saveProject(d, null, t0);
      await repo.saveProject(rev(2), 1, t0 + 1_000);          // first backup: v1
      await repo.saveProject(rev(3), 2, t0 + 2_000);          // 1 s later: backup stays v1
      await repo.saveProject(rev(4), 3, t0 + 9 * 60_000);     // 9 min later: still v1
      expect((await repo.getBackup(d.id))!.project.passport.identity.title).toBe('v1');
      await repo.saveProject(rev(5), 4, t0 + 11 * 60_000);    // 11 min later: backup moves to v4
      expect((await repo.getBackup(d.id))!.project.passport.identity.title).toBe('v4');
    }
  });
  it('restoring a deleted project never overwrites a live project with the same id', async () => {
    for (const repo of [await createRepo(), new MemoryRepo()]) {
      const d = createProject({ title: 'Old' });
      await repo.saveProject(d, null);
      await repo.trashProject(d.id, 'now');
      // another tab still had it open and saved it again
      await repo.saveProject({ ...d, projectRevision: 2, passport: { ...d.passport, identity: { title: 'Newer', author: '' } } }, 1);
      const restored = await repo.restoreProject(d.id);
      expect(restored!.id).not.toBe(d.id);
      expect(restored!.passport.identity.title).toBe('Old (restored)');
      expect((await repo.getProject(d.id))!.passport.identity.title).toBe('Newer');
      expect((await repo.listProjects()).filter((p) => p.id === d.id || p.id === restored!.id)).toHaveLength(2);
      expect((await repo.listTrash()).some((x) => x.id === d.id)).toBe(false);
    }
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
