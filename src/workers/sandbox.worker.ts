/// <reference lib="webworker" />
import { runChunk } from '../domain/sandbox/experiment';
import type { SandboxConfig } from '../domain/sandbox/types';

/**
 * Bounded batch computation (PLAN §11). Results depend only on (config, replication index);
 * chunk size affects progress granularity, never values. Progress messages are bounded
 * (one per chunk), not one per day or replication.
 */
export interface RunRequest { type: 'run'; requestId: string; base: SandboxConfig; alt: SandboxConfig | null; total: number }
export interface CancelRequest { type: 'cancel'; requestId: string }
export type WorkerOut =
  | { type: 'chunk'; requestId: string; chunk: ReturnType<typeof runChunk> }
  | { type: 'done'; requestId: string }
  | { type: 'cancelled'; requestId: string }
  | { type: 'error'; requestId: string; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const cancelled = new Set<string>();

ctx.onmessage = async (ev: MessageEvent<RunRequest | CancelRequest>) => {
  const msg = ev.data;
  if (msg.type === 'cancel') { cancelled.add(msg.requestId); return; }
  const { requestId, base, alt, total } = msg;
  try {
    const perChunk = Math.max(1, Math.floor(40000 / Math.max(1, base.horizon * (alt ? 2 : 1))));
    for (let from = 0; from < total; from += perChunk) {
      if (cancelled.has(requestId)) { cancelled.delete(requestId); ctx.postMessage({ type: 'cancelled', requestId } satisfies WorkerOut); return; }
      const to = Math.min(total, from + perChunk);
      ctx.postMessage({ type: 'chunk', requestId, chunk: runChunk(base, alt, from, to) } satisfies WorkerOut);
      await new Promise((r) => setTimeout(r, 0)); // yield so cancel messages are processed
    }
    ctx.postMessage({ type: 'done', requestId } satisfies WorkerOut);
  } catch (e) {
    ctx.postMessage({ type: 'error', requestId, message: e instanceof Error ? e.message : String(e) } satisfies WorkerOut);
  }
};
