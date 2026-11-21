import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, Flag } from 'lucide-react';
import { Link } from '../../app/router';
import { JOURNEY, JOURNEY_STOPS, type JourneyStop } from '../../content/diagrams/specs';
import { STEPS, type StepId } from '../../domain/passport/compass';
import type { Walk } from './walkthrough';

/* What the two shapes of the project compass share: the line (CompassJourney) and the circle (CompassWheel).
   Same props, same stops, same walkthrough, same legend; only the geometry differs. */

/** One stop of a project, in step order. */
export interface JourneyStopState {
  started: boolean;
  /** Open items (missing or to check) at this stop. */
  open: number;
  /** Small pictures under the title, for example the artefacts included here. Decorative: say it in `describe` too. */
  marks?: ReactNode;
  /** Words added to the stop's accessible name, for example “1 artefact”. */
  describe?: string;
}
export type JourneyFlag = 'draft' | 'done' | 'revise';
export interface JourneyProject {
  /** Seven entries, one per step. */
  stops: JourneyStopState[];
  /** Address of step n (1–7). */
  href: (n: number) => string;
  /** Review status of the checkpoint that follows step n, keyed by n; and its words for the accessible name. */
  flags?: Partial<Record<number, { status: JourneyFlag; label: string }>>;
  /** Where the traveller stands: a step number, or 8 for the finish. */
  here: number;
}
export interface CompassJourneyProps {
  /** The map of one project. */
  project?: JourneyProject;
  /** A stop was chosen. When given, stops call this instead of navigating or toggling on their own. */
  onSelect?: (step: StepId) => void;
  /** The stop shown as chosen when `onSelect` is given. */
  selected?: StepId;
}

export const LAST = JOURNEY_STOPS.length;
export const caption = (i: number) => `${JOURNEY_STOPS[i].title}. ${JOURNEY_STOPS[i].question}`;
export const CAPTIONS = [...JOURNEY_STOPS.map((_, i) => caption(i)), JOURNEY.loopCaption];
export const FLAG_WORDS: Record<JourneyFlag, string> = { draft: '', done: ' is-done', revise: ' is-revise' };
/** Radius of a stop circle. */
export const R_STOP = 20;

export interface Pt { x: number; y: number }
export interface Track { d: string; length: number; at: (s: number) => Pt & { angle: number } }

/** Builds an SVG path and samples it, so a marker can travel along it at a known distance. */
export function trackBuilder() {
  const pts: (Pt & { s: number })[] = [];
  let d = '';
  const push = (x: number, y: number) => { const l = pts[pts.length - 1]; pts.push({ x, y, s: l ? l.s + Math.hypot(x - l.x, y - l.y) : 0 }); };
  const f = (v: number) => v.toFixed(1);
  return {
    move(x: number, y: number) { d += `M${f(x)},${f(y)}`; push(x, y); },
    line(x: number, y: number) { d += ` L${f(x)},${f(y)}`; push(x, y); },
    /** Circular arc, angles in degrees (0° points right, 90° points down). Keep each call under 180°. */
    arc(cx: number, cy: number, r: number, a0: number, a1: number) {
      for (let i = 1; i <= 16; i++) { const a = ((a0 + ((a1 - a0) * i) / 16) * Math.PI) / 180; push(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
      const e = pts[pts.length - 1];
      d += ` A${r},${r} 0 0 ${a1 > a0 ? 1 : 0} ${f(e.x)},${f(e.y)}`;
    },
    /** Cubic curve; `onMid` receives the midpoint and its distance along the track. */
    cubic(x1: number, y1: number, x2: number, y2: number, x: number, y: number, onMid?: (p: Pt, s: number) => void) {
      const p0 = pts[pts.length - 1];
      for (let i = 1; i <= 20; i++) {
        const t = i / 20, u = 1 - t;
        push(u * u * u * p0.x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x, u * u * u * p0.y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y);
        if (i === 10) { const m = pts[pts.length - 1]; onMid?.(m, m.s); }
      }
      d += ` C${f(x1)},${f(y1)} ${f(x2)},${f(y2)} ${f(x)},${f(y)}`;
    },
    here: () => pts[pts.length - 1].s,
    done(): Track {
      const length = pts[pts.length - 1].s;
      return {
        d, length,
        at(s) {
          const v = Math.max(0, Math.min(length, s));
          let i = 1;
          while (i < pts.length - 1 && pts[i].s < v) i++;
          const a = pts[i - 1], b = pts[i], k = b.s > a.s ? (v - a.s) / (b.s - a.s) : 0;
          return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
        },
      };
    },
  };
}

/** Points of an arrowhead whose tip is at `tip`, pointing along the unit vector (ux, uy). */
export const head = (tip: Pt, ux: number, uy: number) => { const bx = tip.x - ux * 10, by = tip.y - uy * 10; return `${tip.x},${tip.y} ${bx - uy * 5.5},${by + ux * 5.5} ${bx + uy * 5.5},${by - ux * 5.5}`; };

/**
 * The chosen stop (1–7, or null) and how to choose one. With `onSelect` the caller holds the choice; otherwise the
 * diagram keeps its own, which a walkthrough clears.
 */
export function useChoice(walk: Walk, onSelect?: (step: StepId) => void, selected?: StepId) {
  const [own, setOwn] = useState<number | null>(null);
  const sel = onSelect ? (selected ? STEPS.findIndex((x) => x.id === selected) + 1 || null : null) : own;
  const choose = (n: number) => { walk.reset(); if (onSelect) onSelect(STEPS[n - 1].id); else setOwn(own === n ? null : n); };
  useEffect(() => { if (walk.walking) setOwn(null); }, [walk.walking]);
  return { sel, choose };
}

/** A project's map is not a lesson: no intro, no walkthrough. Every part is on show at once. */
export function useProjectRest(walk: Walk, project: JourneyProject | undefined) {
  const { reset } = walk;
  useLayoutEffect(() => { if (project) reset(); }, [project ? 1 : 0, reset]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * The traveller and the filled part of the road. Position 0 is the start, 1…7 a stop, 8 the finish. The traveller
 * drives to a new position; with `arrive`, it drives in from the start the first time a track is drawn.
 */
export function useTravel(track: Track | null, stopS: readonly number[], pos: number, reduced: boolean, arrive: boolean) {
  const traveller = useRef<SVGGElement>(null), progress = useRef<SVGPathElement>(null);
  const at = useRef<{ track: Track | null; s: number }>({ track: null, s: 0 });
  useLayoutEffect(() => {
    if (!track) return;
    const target = pos === 0 ? 0 : pos > LAST ? track.length : stopS[pos - 1];
    const apply = (s: number) => {
      at.current.s = s;
      const p = track.at(s);
      traveller.current?.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${p.angle.toFixed(1)})`);
      if (progress.current) progress.current.style.strokeDashoffset = String(track.length - s);
    };
    const arriving = arrive && at.current.track === null && !reduced;
    if (arriving) { at.current.track = track; apply(0); }
    const from = at.current.s;
    if (reduced || at.current.track !== track || from === target) { at.current.track = track; apply(target); return; }
    const duration = Math.min(arriving ? 1600 : 1200, 300 + Math.abs(target - from) * 0.9), t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / duration), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      apply(from + (target - from) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [track, pos, reduced, arrive]); // eslint-disable-line react-hooks/exhaustive-deps
  return { traveller, progress };
}

/** A project's stop: a link to its step, or a button when the caller handles the choice. */
export function StopTag({ to, onClick, pressed, className, style, children }: { to?: string; onClick?: () => void; pressed?: boolean; className: string; style: CSSProperties; children: ReactNode }) {
  return to !== undefined
    ? <Link to={to} className={className} style={style}>{children}</Link>
    : <button type="button" className={className} style={style} aria-pressed={pressed} onClick={onClick}>{children}</button>;
}

export const stateText = (st: JourneyStopState) => (!st.started ? 'not started' : st.open === 0 ? 'started, nothing open' : `started, ${st.open} open ${st.open === 1 ? 'item' : 'items'}`);

/** Where the label of a stop sits, for the shapes that place it themselves. */
export interface StopLayout { numStyle?: CSSProperties; textStyle?: CSSProperties; textClass?: string; title?: string; hidePill?: boolean }

/**
 * Inside a project's stop. It is named by what it shows (number, title, checkpoint); its state is added as text for
 * assistive technology.
 */
export function ProjectStopInner({ s, st, flag, here, layout = {} }: { s: JourneyStop; st: JourneyStopState; flag?: { status: JourneyFlag; label: string }; here: boolean; layout?: StopLayout }) {
  return (
    <>
      <span className="sr-only">Step </span>
      <span className="dgm-j-num" style={layout.numStyle}>
        {s.number}
        {st.started && (st.open > 0 ? <span className="dgm-j-badge" aria-hidden="true">{st.open}</span> : <span className="dgm-j-badge is-calm" aria-hidden="true"><Check size={11} /></span>)}
      </span>
      <span className={`dgm-j-text${layout.textClass ? ` ${layout.textClass}` : ''}`} style={layout.textStyle}>
        <span className="dgm-j-title">{layout.title ?? s.title}<span className="sr-only">{layout.title ? ` (${s.title})` : ''}: {stateText(st)}.{st.describe ? ` ${st.describe}.` : ''}{here ? ' Next stop.' : ''}</span></span>
        <span className="dgm-j-marks" aria-hidden="true">{st.marks}</span>
        {s.checkpoint && (layout.hidePill
          ? <span className="sr-only">Checkpoint after this step: {s.checkpoint}{flag ? `, ${flag.label}` : ''}.</span>
          : <span className={`dgm-j-pill${flag ? FLAG_WORDS[flag.status] : ''}`}><Flag size={13} aria-hidden="true" /><span className="sr-only">Checkpoint after this step: </span>{s.checkpoint}{flag && <span className="sr-only">, {flag.label}</span>}</span>)}
      </span>
    </>
  );
}

/** Inside a teaching stop: named by its visible text (number, title, checkpoint), with the words around it for assistive technology. */
export function PlainStopInner({ s, layout = {} }: { s: JourneyStop; layout?: StopLayout }) {
  return (
    <>
      <span className="sr-only">Step </span><span className="dgm-j-num" style={layout.numStyle}>{s.number}</span>
      <span className={`dgm-j-text${layout.textClass ? ` ${layout.textClass}` : ''}`} style={layout.textStyle}>
        <span className="dgm-j-title">{layout.title ?? s.title}{layout.title && <span className="sr-only"> ({s.title})</span>}</span>
        {s.checkpoint && (layout.hidePill
          ? <span className="sr-only">Checkpoint after this step: {s.checkpoint}.</span>
          : <span className="dgm-j-pill"><Flag size={13} aria-hidden="true" /><span className="sr-only">Checkpoint after this step: </span>{s.checkpoint}</span>)}
      </span>
    </>
  );
}

const FLAG_ICON = <svg width="18" height="20" viewBox="-3 -27 20 30" aria-hidden="true" className="dgm-j-flag"><path className="is-pole" d="M0,0 V-25" /><path className="is-pennant" d="M0,-25 L15,-19.5 L0,-14 Z" /></svg>;

/** The legend under either shape. `loopIcon` draws the loop the way the shape draws it; null leaves the loop out. */
export function CompassLegend({ project, loopIcon }: { project: boolean; loopIcon: ReactNode }) {
  return (
    <ul className="dgm-legend" aria-label="Legend">
      {project && <>
        <li><span className="dgm-j-key is-started" aria-hidden="true" />Started</li>
        <li><span className="dgm-j-key is-open" aria-hidden="true">2</span>Open items</li>
        <li><svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true" className="dgm-j-key-here"><circle r={9} /></svg>Next stop</li>
      </>}
      <li>{FLAG_ICON}{project ? 'Checkpoint (filled when reviewed)' : JOURNEY.legendCheckpoint}</li>
      {!project && loopIcon && <li>{loopIcon}{JOURNEY.legendLoop}</li>}
    </ul>
  );
}
