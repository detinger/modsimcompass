import { useCallback, useEffect, useRef, useState } from 'react';
import { applyChunk, newRunRecord, requiredReplications, runChunk } from '../../../domain/sandbox/experiment';
import type { RunRecord, SandboxConfig } from '../../../domain/sandbox/types';
import { newId } from '../../../domain/passport/schema';
import type { WorkerOut } from '../../../workers/sandbox.worker';

export type RunPhase = 'ready' | 'running' | 'cancelling' | 'partial' | 'complete' | 'failed';

/**
 * Runs replications in a Web Worker (falls back to chunked main-thread execution).
 * Each request carries requestId + projectId + modelRevision; late results for a replaced
 * request or a different project are ignored. Cancelling keeps completed replications as a
 * labelled partial result; the initial release restarts rather than resuming.
 */
export function useSandboxRun(onFinished: (run: RunRecord) => void) {
  const [phase, setPhase] = useState<RunPhase>('ready');
  const [live, setLive] = useState<RunRecord | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const reqRef = useRef<string | null>(null);
  const runRef = useRef<RunRecord | null>(null);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  useEffect(() => () => { workerRef.current?.terminate(); workerRef.current = null; }, []);

  const finish = useCallback((status: RunRecord['status'], error?: string) => {
    const r = runRef.current;
    reqRef.current = null;
    if (!r) return;
    const final: RunRecord = { ...r, status, error };
    runRef.current = final;
    setLive(final);
    setPhase(status === 'complete' ? 'complete' : status === 'partial' ? 'partial' : 'failed');
    finishedRef.current(final);
  }, []);

  const getWorker = useCallback((): Worker | null => {
    if (workerRef.current) return workerRef.current;
    if (typeof Worker === 'undefined') return null;
    try {
      const w = new Worker(new URL('../../../workers/sandbox.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (ev: MessageEvent<WorkerOut>) => {
        const m = ev.data;
        if (m.requestId !== reqRef.current) return; // late result for a replaced request
        if (m.type === 'chunk') {
          runRef.current = applyChunk(runRef.current!, m.chunk);
          setLive(runRef.current);
        } else if (m.type === 'done') finish('complete');
        else if (m.type === 'cancelled') finish(runRef.current && runRef.current.completedReplications > 0 ? 'partial' : 'failed', runRef.current?.completedReplications ? undefined : 'Cancelled before any replication completed.');
        else if (m.type === 'error') finish('failed', m.message);
      };
      w.onerror = () => { if (reqRef.current) finish('failed', 'The computation worker stopped unexpectedly.'); };
      workerRef.current = w;
      return w;
    } catch { return null; }
  }, [finish]);

  const start = useCallback((opts: { projectId: string; modelRevision: number; base: SandboxConfig; alt: SandboxConfig | null }) => {
    const requestId = newId('run');
    const alt = opts.alt ? { ...opts.alt, seed: opts.base.seed, replications: opts.base.replications } : null;
    const run = newRunRecord({ id: requestId, projectId: opts.projectId, modelRevision: opts.modelRevision, createdAt: new Date().toISOString(), base: opts.base, alt });
    const total = requiredReplications(opts.base, alt);
    run.requestedReplications = total;
    runRef.current = run;
    reqRef.current = requestId;
    setLive(run);
    setPhase('running');
    const w = getWorker();
    if (w) {
      w.postMessage({ type: 'run', requestId, base: opts.base, alt, total });
    } else {
      // Fallback: chunked on the main thread, yielding between chunks.
      (async () => {
        const per = Math.max(1, Math.floor(20000 / opts.base.horizon));
        for (let from = 0; from < total; from += per) {
          if (reqRef.current !== requestId) return;
          runRef.current = applyChunk(runRef.current!, runChunk(opts.base, alt, from, Math.min(total, from + per)));
          setLive(runRef.current);
          await new Promise((r) => setTimeout(r, 0));
        }
        if (reqRef.current === requestId) finish('complete');
      })().catch((e) => finish('failed', String(e)));
    }
  }, [getWorker, finish]);

  const cancel = useCallback(() => {
    const id = reqRef.current;
    if (!id) return;
    setPhase('cancelling');
    if (workerRef.current) workerRef.current.postMessage({ type: 'cancel', requestId: id });
    else finish(runRef.current && runRef.current.completedReplications > 0 ? 'partial' : 'failed');
  }, [finish]);

  /** Abandon any in-flight request (e.g. active project changed). Results will be ignored. */
  const detach = useCallback(() => {
    if (reqRef.current && workerRef.current) workerRef.current.postMessage({ type: 'cancel', requestId: reqRef.current });
    reqRef.current = null;
    runRef.current = null;
    setLive(null);
    setPhase('ready');
  }, []);

  return { phase, live, start, cancel, detach };
}
