import { useId, useLayoutEffect, useMemo, useRef, type CSSProperties, type RefObject } from 'react';
import { JOURNEY, JOURNEY_STOPS } from '../../content/diagrams/specs';
import { STEP_LABEL, STEPS } from '../../domain/passport/compass';
import { WalkControls, useWalkthrough, useWidth } from './walkthrough';
import {
  CAPTIONS, CompassLegend, FLAG_WORDS, LAST, PlainStopInner, ProjectStopInner, StopTag, caption, head, trackBuilder, useChoice, useProjectRest, useTravel,
  type CompassJourneyProps, type Pt, type StopLayout, type Track,
} from './compassShared';

/* The project compass as a wheel: the seven stops around a ring, clockwise from the top, with a compass rose in the
   middle whose needle turns to the current stop. Same props and behaviour as CompassJourney (the line); only the
   geometry differs. The road almost closes: it starts just before stop 1 and ends at the final flag after stop 7.

   Three layouts, chosen by the width of the card so nothing ever collides or overflows:
   - full: the full titles and checkpoint pills sit outside the ring, each pushed outward until it is clear of its stop;
   - short: the same with the short step names;
   - dial: on a phone, the short names run along the outside of the ring like the numerals of a dial.
   Text is laid out at 1:1 and never scaled. */

const SHORT = STEPS.map((s) => STEP_LABEL[s.id]);
const STEP_DEG = 360 / LAST;
const theta = (i: number) => -90 + i * STEP_DEG; // stop i (0-based), degrees, clockwise from 3 o'clock
const START = theta(0) - 12;
const END = theta(LAST - 1) + STEP_DEG / 2;
/** The loop back runs counter-clockwise inside the ring, from between Check and Experiment to between Scope and Method. */
const LOOP_FROM = 146, LOOP_TO = -9;
const rad = (d: number) => (d * Math.PI) / 180;
const polar = (cx: number, cy: number, r: number, deg: number): Pt => ({ x: cx + r * Math.cos(rad(deg)), y: cy + r * Math.sin(rad(deg)) });
const f1 = (v: number) => v.toFixed(1);

type Mode = 'full' | 'short' | 'dial';
type Align = 'start' | 'center' | 'end';
interface Box { x: number; y: number; w: number; h: number }
/** `side`: the label sits above its stop (anchored at its bottom), below it (anchored at its top), or beside it (centred). */
interface WheelStop extends Pt { s: number; deg: number; box?: Box; align: Align; side: 'up' | 'down' | 'mid'; union: Box }
interface Geo {
  mode: Mode; W: number; H: number; cx: number; cy: number; R: number; rs: number;
  track: Track; stops: WheelStop[]; flags: (Pt & { after: number })[];
  loop: { d: string; head: string; text: string | null; label: string };
  rose: number;
  dial: { d: string; flip: boolean }[] | null;
}

// ── Measuring text: the labels are placed from their real size ──────────
let canvas: CanvasRenderingContext2D | null | undefined;
function measurer(family: string) {
  if (canvas === undefined) canvas = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  return (text: string, font: string) => {
    if (!canvas) return text.length * (font.startsWith('650') ? 7.7 : 7.2);
    canvas.font = `${font} ${family}`;
    return canvas.measureText(text).width;
  };
}
/** Greedy word wrap: the widths of the lines a title breaks into. */
function wrap(text: string, maxW: number, width: (t: string) => number): number[] {
  const lines: number[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && width(next) > maxW) { lines.push(width(line)); line = word; } else line = next;
  }
  if (line) lines.push(width(line));
  return lines;
}

interface LabelSize { w: number; h: number }
/** `marks[i]`: stop i shows a row of marks (a project's artefacts) under its title. */
function labelSizes(mode: Exclude<Mode, 'dial'>, marks: readonly boolean[], family: string): LabelSize[] {
  const width = measurer(family);
  return JOURNEY_STOPS.map((s, i) => {
    const title = mode === 'full' ? s.title : SHORT[i];
    const lines = wrap(title, mode === 'full' ? 150 : 999, (t) => width(t, '650 14px'));
    let w = Math.max(...lines), h = lines.length * 17.5;
    if (s.checkpoint) { w = Math.max(w, width(s.checkpoint, '600 13px') + 35); h += 5 + 23; }
    if (marks[i]) { w = Math.max(w, 72); h += 5 + 20; }
    return { w: Math.ceil(w) + 4, h: Math.ceil(h) };
  });
}

/** Pushes a label box outward along `deg` until it clears a halo of radius `halo` around its stop at (sx, sy). */
function placeLabel(sx: number, sy: number, deg: number, size: LabelSize, halo: number): Box {
  const ux = Math.cos(rad(deg)), uy = Math.sin(rad(deg)), a = size.w / 2, b = size.h / 2;
  let lo = 0, hi = 2000;
  for (let k = 0; k < 36; k++) {
    const t = (lo + hi) / 2;
    if (Math.hypot(Math.max(Math.abs(ux) * t - a, 0), Math.max(Math.abs(uy) * t - b, 0)) >= halo) hi = t; else lo = t;
  }
  return { x: sx + ux * hi - a, y: sy + uy * hi - b, w: size.w, h: size.h };
}
const overlaps = (p: Box, q: Box, gap: number) => p.x < q.x + q.w + gap && q.x < p.x + p.w + gap && p.y < q.y + q.h + gap && q.y < p.y + p.h + gap;
const nearCircle = (b: Box, x: number, y: number, r: number) => Math.hypot(Math.max(b.x - x, 0, x - b.x - b.w), Math.max(b.y - y, 0, y - b.y - b.h)) < r;

/** Label boxes around a ring of radius R centred on (0, 0), or null when they would touch each other or another stop. */
function tryRing(R: number, rs: number, sizes: LabelSize[], halo: number): Box[] | null {
  const pts = sizes.map((_, i) => polar(0, 0, R, theta(i)));
  const boxes = sizes.map((size, i) => placeLabel(pts[i].x, pts[i].y, theta(i), size, halo));
  const flags = [1, 3, 4, 5, 6].map((i) => { const p = polar(0, 0, R, theta(i) + STEP_DEG / 2); return { x: p.x - 6, y: p.y - 27, w: 23, h: 32 }; });
  for (let i = 0; i < boxes.length; i++) {
    for (let j = 0; j < boxes.length; j++) {
      if (i !== j && (overlaps(boxes[i], boxes[j], 8) || nearCircle(boxes[i], pts[j].x, pts[j].y, rs + 6))) return null;
    }
    if (flags.some((fl) => overlaps(boxes[i], fl, 4))) return null;
  }
  return boxes;
}

function wheelGeo(W: number, marks: readonly boolean[], family: string): Geo {
  // Choose the layout: full titles when the ring stays generous, then short names, then the dial.
  let mode: Mode = 'dial', R = 0, rs = 17, boxes: Box[] | null = null;
  for (const [m, rsM, rMax, rMin, halo] of [['full', 20, 205, 150, 33], ['short', 18, 190, 112, 29]] as const) {
    const sizes = labelSizes(m, marks, family);
    for (let r = rMax; r >= rMin && !boxes; r -= 2) {
      const b = tryRing(r, rsM, sizes, halo);
      if (b) {
        const minX = Math.min(...b.map((x) => x.x), -r - 14), maxX = Math.max(...b.map((x) => x.x + x.w), r + 14);
        if (maxX - minX <= W - 4) { boxes = b; R = r; rs = rsM; mode = m; }
      }
    }
    if (boxes) break;
  }
  const dialMargin = 25; // the curved names outside the stop circles
  if (!boxes) { rs = 16; R = Math.max(60, Math.min(170, W / 2 - rs - dialMargin)); }

  // The drawing's extent around the centre, then the centre itself.
  const ext = { x0: -R - rs - 8, x1: R + rs + 8, y0: -R - rs - 8, y1: R + rs + 8 };
  if (mode === 'dial') { ext.x0 = ext.y0 = -R - rs - dialMargin; ext.x1 = ext.y1 = R + rs + dialMargin; }
  for (const b of boxes ?? []) { ext.x0 = Math.min(ext.x0, b.x); ext.x1 = Math.max(ext.x1, b.x + b.w); ext.y0 = Math.min(ext.y0, b.y); ext.y1 = Math.max(ext.y1, b.y + b.h); }
  const cx = Math.round((W - (ext.x1 - ext.x0)) / 2 - ext.x0), cy = Math.round(8 - ext.y0);
  const H = Math.ceil(ext.y1 - ext.y0 + 16);

  // The road: an arc from just before stop 1, clockwise through the stops, to the final flag.
  const t = trackBuilder();
  const p0 = polar(cx, cy, R, START);
  t.move(p0.x, p0.y);
  t.arc(cx, cy, R, START, theta(0));
  const stops: WheelStop[] = [];
  for (let i = 0; i < LAST; i++) {
    if (i > 0) t.arc(cx, cy, R, theta(i - 1), theta(i));
    const p = polar(cx, cy, R, theta(i)), deg = theta(i);
    const ux = Math.cos(rad(deg)), uy = Math.sin(rad(deg));
    const box = boxes ? { ...boxes[i], x: boxes[i].x + cx, y: boxes[i].y + cy } : undefined;
    const circle = { x: p.x - rs, y: p.y - rs, w: 2 * rs, h: 2 * rs };
    const union = box ? { x: Math.min(circle.x, box.x), y: Math.min(circle.y, box.y), w: 0, h: 0 } : circle;
    if (box) { union.w = Math.max(circle.x + circle.w, box.x + box.w) - union.x; union.h = Math.max(circle.y + circle.h, box.y + box.h) - union.y; }
    stops.push({ ...p, s: t.here(), deg, box, union, align: ux > 0.35 ? 'start' : ux < -0.35 ? 'end' : 'center', side: uy < -0.3 ? 'up' : uy > 0.3 ? 'down' : 'mid' });
  }
  t.arc(cx, cy, R, theta(LAST - 1), END);
  const flags = JOURNEY_STOPS.flatMap((s, i) => (s.checkpoint ? [{ ...polar(cx, cy, R, theta(i) + STEP_DEG / 2), after: s.number }] : []));

  // The loop back, inside the ring and around the rose: counter-clockwise, ending in an arrowhead.
  const Rl = R - rs - (mode === 'dial' ? 10 : 15);
  const tipDeg = LOOP_TO, tip = polar(cx, cy, Rl, tipDeg);
  const ccw = (r: number, a0: number, a1: number) => { const s0 = polar(cx, cy, r, a0), s1 = polar(cx, cy, r, a1); return `M${f1(s0.x)},${f1(s0.y)} A${f1(r)},${f1(r)} 0 0 0 ${f1(s1.x)},${f1(s1.y)}`; };
  const tangent = { x: Math.sin(rad(tipDeg)), y: -Math.cos(rad(tipDeg)) };
  const label = `${JOURNEY.loopTitle} ${JOURNEY.loopText}`;
  const textR = Rl - 9;
  const fits = rad(150) * textR >= measurer(family)(label, '600 13.5px') + 40;
  // The words sit centred under the compass, along the inside of the arc.
  const loop = { d: ccw(Rl, LOOP_FROM, tipDeg + 3), head: head(tip, tangent.x, tangent.y), text: fits ? ccw(textR, 90 + 75, 90 - 75) : null, label };
  const rose = Math.max(26, (fits ? textR - 32 : Rl - 20));

  // On the dial the names follow the ring: on the outside, upright at the top and sides, read left to right at the bottom.
  const dial = mode !== 'dial' ? null : JOURNEY_STOPS.map((_, i) => {
    const deg = theta(i), flip = Math.sin(rad(deg)) > 0.5;
    if (!flip) { const r = R + rs + 10, a = polar(cx, cy, r, deg - 40), b = polar(cx, cy, r, deg + 40); return { d: `M${f1(a.x)},${f1(a.y)} A${f1(r)},${f1(r)} 0 0 1 ${f1(b.x)},${f1(b.y)}`, flip }; }
    return { d: ccw(R + rs + 21, deg + 40, deg - 40), flip };
  });
  return { mode, W, H, cx, cy, R, rs, track: t.done(), stops, flags, loop, rose, dial };
}

/** The compass rose: a refined, larger version of the one beside the line, with a needle that turns. */
function Rose({ cx, cy, r, stops, here, needle }: { cx: number; cy: number; r: number; stops: WheelStop[]; here: number; needle: RefObject<SVGGElement | null> }) {
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  const spike = (deg: number, len: number, w: number) => (
    <g key={deg} transform={`rotate(${deg})`}>
      <path className="is-shade" d={`M0,${-len} L${-w},0 L0,0 Z`} /><path className="is-lit" d={`M0,${-len} L${w},0 L0,0 Z`} />
    </g>
  );
  const L = r - 18, w = Math.max(6, r * 0.075), tail = L * 0.62;
  return (
    <g className="dgm-w-rose" transform={`translate(${cx},${cy})`} aria-hidden="true">
      <circle r={r} className="dgm-w-face" />
      {ticks.map((a) => {
        const major = a % 45 === 0, len = major ? 9 : a % 15 === 0 ? 6 : 3.5;
        const p = polar(0, 0, r - 3, a - 90), q = polar(0, 0, r - 3 - len, a - 90);
        return <line key={a} className={`dgm-w-tick${major ? ' is-major' : ''}`} x1={f1(p.x)} y1={f1(p.y)} x2={f1(q.x)} y2={f1(q.y)} />;
      })}
      <circle r={r - 17} className="dgm-w-fine" />
      {/* One mark on the rim for each stop, so the needle visibly points at one. */}
      {stops.map((s, i) => {
        const a = polar(0, 0, r + 1, s.deg), b = polar(0, 0, r + 9, s.deg - 4.5), c = polar(0, 0, r + 9, s.deg + 4.5);
        return <path key={i} className={`dgm-w-mark${here === i + 1 ? ' is-on' : ''}`} d={`M${f1(a.x)},${f1(a.y)} L${f1(b.x)},${f1(b.y)} L${f1(c.x)},${f1(c.y)} Z`} />;
      })}
      <g className="dgm-w-star">
        {[45, 135, 225, 315].map((a) => spike(a, (r - 22) * 0.6, Math.max(4, r * 0.06)))}
        {[0, 90, 180, 270].map((a) => spike(a, r - 22, Math.max(5, r * 0.1)))}
      </g>
      <g className="dgm-w-needle" ref={needle}>
        <g className="is-shadow" transform="translate(1.5 2.5)"><path d={`M0,${-L} L${w},0 L0,${tail} L${-w},0 Z`} /></g>
        <path className="is-north-a" d={`M0,${-L} L${w},0 L0,0 Z`} /><path className="is-north-b" d={`M0,${-L} L${-w},0 L0,0 Z`} />
        <path className="is-south-a" d={`M0,${tail} L${-w},0 L0,0 Z`} /><path className="is-south-b" d={`M0,${tail} L${w},0 L0,0 Z`} />
      </g>
      <circle r={Math.max(6, r * 0.065)} className="dgm-w-hub" /><circle r={Math.max(2.5, r * 0.025)} className="dgm-w-hub-dot" />
    </g>
  );
}

/**
 * Turns the needle to `deg` by the shortest way round, with a slight settle at the end. Under reduced motion it jumps.
 * The angle is kept unwrapped, so a turn past north never spins the long way.
 */
function useNeedle(deg: number, reduced: boolean, ready: boolean, arrive: boolean) {
  const needle = useRef<SVGGElement>(null);
  const angle = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!ready) return;
    const set = (a: number) => { angle.current = a; needle.current?.setAttribute('transform', `rotate(${(a + 90).toFixed(2)})`); };
    if (angle.current === null) {
      if (!arrive || reduced) { set(deg); return; }
      set(-90); // a project's needle swings round from north when the map first appears
    }
    const from = angle.current!;
    const delta = ((((deg - from) % 360) + 540) % 360) - 180;
    if (reduced || Math.abs(delta) < 0.01) { set(from + delta); return; }
    const to = from + delta, duration = 520 + Math.abs(delta) * 2.2, t0 = performance.now();
    const back = 1.25; // overshoot of the settle
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / duration), e = 1 + (back + 1) * (k - 1) ** 3 + back * (k - 1) ** 2;
      set(from + delta * e);
      if (k < 1) raf = requestAnimationFrame(tick); else set(to);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deg, reduced, ready, arrive]);
  return needle;
}

const LOOP_ICON = (
  <svg width="34" height="20" viewBox="0 0 34 20" aria-hidden="true" className="dgm-w-loop">
    <path className="is-line" d="M31,5 C26,18 9,18 6,8" /><polygon points="4,2 9.5,8 2.5,9.5" />
  </svg>
);

export default function CompassWheel({ project, onSelect, selected }: CompassJourneyProps = {}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const walk = useWalkthrough(LAST + 1, { intro: 640, interval: 1900 });
  const { sel, choose } = useChoice(walk, onSelect, selected);
  const family = useMemo(() => (W > 0 && ref.current ? getComputedStyle(ref.current).fontFamily : 'system-ui'), [W, ref]);
  // A stop has a row of marks when the project says what they show (`describe`).
  const marksKey = JOURNEY_STOPS.map((_, i) => (project?.stops[i]?.describe ? '1' : '0')).join('');
  const geo = useMemo(() => (W > 0 ? wheelGeo(W, marksKey.split('').map((c) => c === '1'), family) : null), [W, marksKey, family]);
  useProjectRest(walk, project);
  const walking = !project && walk.walking;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  /* Position on the road: 0 = start, 1…7 = a stop, 8 = the finish flag. The needle points there too. */
  const pos = project ? Math.max(1, Math.min(LAST + 1, project.here)) : walking ? Math.min(walk.shown, LAST) : sel ?? LAST + 1;
  const stopS = useMemo(() => geo?.stops.map((x) => x.s) ?? [], [geo]);
  const { traveller, progress } = useTravel(geo?.track ?? null, stopS, pos, walk.reduced, !!project);
  const needle = useNeedle(pos === 0 ? START : pos > LAST ? END : theta(pos - 1), walk.reduced, !!geo, !!project);

  const off = (n: number) => (project || walk.has(n) ? '' : ' is-off');
  const flagOf = (after: number) => project?.flags?.[after];
  const layoutOf = (p: WheelStop, i: number): StopLayout => {
    const u = p.union;
    if (!geo || geo.mode === 'dial' || !p.box) {
      // On the dial the names are outside the ring, so a badge sits on the inner side of its circle.
      const ux = Math.cos(rad(p.deg)), uy = Math.sin(rad(p.deg)), rs = geo?.rs ?? 16;
      const badge = { '--bx': `${(rs - ux * (rs + 5) - 8).toFixed(1)}px`, '--by': `${(rs - uy * (rs + 5) - 8).toFixed(1)}px` } as CSSProperties;
      return { numStyle: { left: 0, top: 0, ...badge }, textClass: 'sr-only', title: SHORT[i] };
    }
    const b = p.box;
    // Above a stop the label grows upward from the stop; beside it, it is centred on the stop's height.
    const vertical: CSSProperties = p.side === 'up' ? { bottom: u.y + u.h - (b.y + b.h) } : p.side === 'mid' ? { top: p.y - u.y, transform: 'translateY(-50%)' } : { top: b.y - u.y };
    return {
      numStyle: { left: p.x - geo.rs - u.x, top: p.y - geo.rs - u.y },
      textStyle: { left: b.x - u.x, width: b.w, ...vertical },
      textClass: `is-${p.align} is-${p.side}`,
      title: geo.mode === 'short' ? SHORT[i] : undefined,
    };
  };
  return (
    <div className={`dgm-journey dgm-wheel${project ? ' is-project' : ''}`} ref={walk.hostRef} data-walk={walking ? 'walk' : 'rest'}>
      <div className="dgm-w-stage" ref={ref} data-layout={geo?.mode ?? 'full'} style={{ height: geo?.H ?? 420, '--rs': `${geo?.rs ?? 20}px` } as CSSProperties}>
        {geo && (
          <>
            <svg width={geo.W} height={geo.H} viewBox={`0 0 ${geo.W} ${geo.H}`} role="img"
              aria-label={project
                ? `A ring through the seven steps of this project, with a compass in the middle. The needle points at ${pos > LAST ? 'the finish' : `step ${pos}`}. Flags mark the five checkpoints.`
                : 'A ring through seven numbered steps, clockwise from the top, with a compass in the middle whose needle points at the current step. Flags mark the five checkpoints, and a dashed arrow inside the ring loops back from steps 5 and 6 to steps 2 and 3.'}>
              <defs>
                <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" className="dgm-w-stop0" /><stop offset="0.55" className="dgm-w-stop1" /><stop offset="1" className="dgm-w-stop2" />
                </linearGradient>
                {geo.loop.text && <path id={`${uid}-loop`} d={geo.loop.text} />}
                {geo.dial?.map((d, i) => <path key={i} id={`${uid}-dial-${i}`} d={d.d} />)}
              </defs>
              <Rose cx={geo.cx} cy={geo.cy} r={geo.rose} stops={geo.stops} here={pos} needle={needle} />
              <path className="dgm-j-track" d={geo.track.d} />
              <path className="dgm-j-progress" d={geo.track.d} ref={progress} strokeDasharray={`${geo.track.length} ${geo.track.length}`} />
              <g className={`dgm-w-loop${off(LAST + 1)}`}>
                <path className="is-line" d={geo.loop.d} stroke={`url(#${uid}-fade)`} />
                <polygon points={geo.loop.head} />
                {geo.loop.text && (
                  <text><textPath href={`#${uid}-loop`} startOffset="50%" textAnchor="middle"><tspan className="is-strong">{JOURNEY.loopTitle}</tspan> {JOURNEY.loopText}</textPath></text>
                )}
              </g>
              {geo.flags.map((fl) => {
                const flag = flagOf(fl.after);
                return (
                  <g key={fl.after} className={`dgm-j-flag${off(fl.after)}${flag ? FLAG_WORDS[flag.status] : ''}`} transform={`translate(${fl.x.toFixed(1)},${fl.y.toFixed(1)})${geo.mode === 'dial' ? ' scale(0.78)' : ''}`}>
                    <circle r={4.5} /><path className="is-pole" d="M0,0 V-25" /><path className="is-pennant" d="M0,-25 L15,-19.5 L0,-14 Z" />
                  </g>
                );
              })}
              <g className="dgm-j-traveller" ref={traveller}><circle r={geo.rs + 7} /><path d={`M${geo.rs + 11},-6.5 L${geo.rs + 20},0 L${geo.rs + 11},6.5 Z`} /></g>
              {geo.dial && (
                <g className="dgm-w-dial" aria-hidden="true">
                  {geo.dial.map((_, i) => (
                    <text key={i} className={`${off(i + 1)}${sel === i + 1 ? ' is-selected' : ''}`}><textPath href={`#${uid}-dial-${i}`} startOffset="50%" textAnchor="middle">{SHORT[i]}</textPath></text>
                  ))}
                </g>
              )}
            </svg>
            {geo.stops.map((p, i) => {
              const s = JOURNEY_STOPS[i];
              const style = { left: p.union.x, top: p.union.y, width: p.union.w, height: p.union.h };
              const layout = layoutOf(p, i);
              if (project) {
                const st = project.stops[i] ?? { started: false, open: 0 };
                return (
                  <StopTag key={s.number} to={onSelect ? undefined : project.href(s.number)} onClick={onSelect ? () => choose(s.number) : undefined} pressed={onSelect ? sel === s.number : undefined} style={style}
                    className={`dgm-j-stop dgm-w-stop${st.started ? ' is-reached' : ''}${pos === s.number ? ' is-here' : ''}`}>
                    <ProjectStopInner s={s} st={st} flag={flagOf(s.number)} here={pos === s.number} layout={layout} />
                  </StopTag>
                );
              }
              return (
                <button key={s.number} type="button" style={style} aria-pressed={sel === s.number}
                  className={`dgm-j-stop dgm-w-stop${s.number <= pos ? ' is-reached' : ''}${off(s.number)}`}
                  onClick={() => choose(s.number)}>
                  <PlainStopInner s={s} layout={layout} />
                </button>
              );
            })}
          </>
        )}
      </div>
      {/* When the ring is too small to carry the words, they sit under it, and the legend does not repeat them. */}
      {geo && !geo.loop.text && <p className={`dgm-w-loopnote${off(LAST + 1)}`}>{LOOP_ICON} <strong>{JOURNEY.loopTitle}</strong> {JOURNEY.loopText}</p>}
      <CompassLegend project={!!project} loopIcon={geo && !geo.loop.text ? null : LOOP_ICON} />
      {!project && <WalkControls walk={walk} captions={CAPTIONS} summary={sel ? caption(sel - 1) : JOURNEY.summary} />}
    </div>
  );
}
