import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(QUERY);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};

/** True when the system asks for less motion. Pictures then show one still frame. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}

const PlayingCtx = createContext(true);

/** Lets a page pause every picture inside it. */
export function MotionProvider({ playing, children }: { playing: boolean; children: ReactNode }) {
  return <PlayingCtx.Provider value={playing}>{children}</PlayingCtx.Provider>;
}

/**
 * Frame counter for one picture. It runs only while the picture is on screen, the page is not paused
 * and motion is allowed. With reduced motion the frame is fixed at `still`.
 */
export function useFrames<E extends Element>(ms: number, still: number): { ref: RefObject<E | null>; frame: number; moving: boolean } {
  const ref = useRef<E>(null);
  const reduced = useReducedMotion();
  const playing = useContext(PlayingCtx);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => setSeen(entries[entries.length - 1].isIntersecting), { rootMargin: '60px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const moving = seen && playing && !reduced;
  useEffect(() => {
    if (!moving) return;
    const t = window.setInterval(() => setTick((n) => n + 1), ms);
    return () => window.clearInterval(t);
  }, [moving, ms]);
  return { ref, frame: reduced ? still : tick, moving };
}
