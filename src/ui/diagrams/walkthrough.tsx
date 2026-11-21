import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';

const REDUCE = '(prefers-reduced-motion: reduce)';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(REDUCE).matches);
  useEffect(() => {
    const m = window.matchMedia?.(REDUCE);
    if (!m) return;
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Width of an element in CSS pixels. Diagrams lay themselves out for this width at 1:1, so text is never scaled down. */
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** True once the element has scrolled into view (and stays true). */
export function useSeen<T extends HTMLElement>(ref: RefObject<T | null>, threshold = 0.3): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setSeen(true); }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen, threshold]);
  return seen;
}

export interface Walk {
  /** Number of steps. */
  count: number;
  /** How many steps are revealed (0…count). */
  shown: number;
  /** False at rest, when the complete diagram is on show. */
  walking: boolean;
  playing: boolean;
  reduced: boolean;
  /** True once the user has pressed a control (the automatic intro is not announced to screen readers). */
  user: boolean;
  /** Attach to the diagram root: the intro starts when it scrolls into view. */
  hostRef: RefObject<HTMLDivElement | null>;
  play: () => void;
  pause: () => void;
  step: () => void;
  reset: () => void;
  /** Whether walkthrough step n (1-based) is revealed. */
  has: (n: number) => boolean;
}

interface WalkState { shown: number; walking: boolean; playing: boolean; user: boolean }

/**
 * Build-up walkthrough. The diagram rests complete. An intro builds it once when it first scrolls into view;
 * Play rebuilds it, Step reveals one part at a time, Reset returns to the complete diagram.
 * Under prefers-reduced-motion there is no intro and no Play: the diagram starts complete and Step still works.
 */
export function useWalkthrough(count: number, opts: { interval?: number; intro?: number; hold?: (step: number) => number | undefined } = {}): Walk {
  const { interval = 1700, intro = 800, hold } = opts;
  const reduced = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const rest: WalkState = useMemo(() => ({ shown: count, walking: false, playing: false, user: false }), [count]);
  const [st, setSt] = useState<WalkState>(() => (reduced ? rest : { shown: 0, walking: true, playing: false, user: false }));
  const seen = useSeen(hostRef);
  const introDone = useRef(reduced);

  useEffect(() => {
    if (reduced) { introDone.current = true; setSt((s) => (s.user ? { ...s, playing: false } : rest)); return; }
    if (seen && !introDone.current) { introDone.current = true; setSt((s) => (s.user ? s : { ...s, playing: true })); }
  }, [reduced, seen, rest]);

  useEffect(() => {
    if (!st.playing) return;
    const delay = st.shown === 0 ? 350 : hold?.(st.shown) ?? (st.user ? interval : intro);
    const t = window.setTimeout(() => setSt((s) => (s.shown >= count ? { ...s, walking: false, playing: false } : { ...s, shown: s.shown + 1 })), delay);
    return () => window.clearTimeout(t);
  }, [st, count, interval, intro, hold]);

  const play = useCallback(() => setSt((s) => ({ shown: !s.walking || s.shown >= count ? 0 : s.shown, walking: true, playing: true, user: true })), [count]);
  const pause = useCallback(() => setSt((s) => ({ ...s, playing: false, user: true })), []);
  const step = useCallback(() => setSt((s) => ({ shown: !s.walking || s.shown >= count ? 1 : s.shown + 1, walking: true, playing: false, user: true })), [count]);
  const reset = useCallback(() => setSt({ shown: count, walking: false, playing: false, user: true }), [count]);
  const has = useCallback((n: number) => !st.walking || st.shown >= n, [st.walking, st.shown]);

  return { count, shown: st.shown, walking: st.walking, playing: st.playing, user: st.user, reduced, hostRef, play, pause, step, reset, has };
}

/** Play / Step / Reset plus the sentence for the current step (or the summary at rest). */
export function WalkControls({ walk, captions, summary }: { walk: Walk; captions: readonly string[]; summary: string }) {
  const stepping = walk.walking && walk.shown > 0;
  return (
    <div className="dgm-walk">
      <div className="dgm-walk-btns" role="group" aria-label="Walkthrough">
        {!walk.reduced && (
          <button type="button" className="btn small" onClick={walk.playing ? walk.pause : walk.play}>
            {walk.playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}{walk.playing ? 'Pause' : 'Play'}
          </button>
        )}
        <button type="button" className="btn small" onClick={walk.step} aria-label="Step: reveal the next part"><SkipForward size={14} aria-hidden="true" />Step</button>
        <button type="button" className="btn small ghost" onClick={walk.reset} disabled={!walk.walking} aria-label="Reset: show the whole diagram"><RotateCcw size={14} aria-hidden="true" />Reset</button>
      </div>
      <p className="dgm-walk-caption" aria-live={walk.user ? 'polite' : 'off'}>
        {stepping && <span className="dgm-walk-count">{walk.shown} / {walk.count}</span>}
        <span>{stepping ? captions[walk.shown - 1] : walk.walking ? ' ' : summary}</span>
      </p>
    </div>
  );
}
