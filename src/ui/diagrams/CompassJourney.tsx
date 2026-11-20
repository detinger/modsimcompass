import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Flag } from 'lucide-react';
import { JOURNEY, JOURNEY_STOPS } from '../../content/diagrams/specs';
import { WalkControls, useWalkthrough, useWidth } from './walkthrough';

/* The signature picture: a road through seven stops. Its shape is computed from the card width —
   two rows joined by a U-turn when there is room, a gently winding vertical road when there is not. */

interface Pt { x: number; y: number }
interface Track { d: string; length: number; at: (s: number) => Pt & { angle: number } }

/** Builds an SVG path and samples it, so a marker can travel along it at a known distance. */
function trackBuilder() {
  const pts: (Pt & { s: number })[] = [];
  let d = '';
  const push = (x: number, y: number) => { const l = pts[pts.length - 1]; pts.push({ x, y, s: l ? l.s + Math.hypot(x - l.x, y - l.y) : 0 }); };
  const f = (v: number) => v.toFixed(1);
  return {
    move(x: number, y: number) { d += `M${f(x)},${f(y)}`; push(x, y); },
    line(x: number, y: number) { d += ` L${f(x)},${f(y)}`; push(x, y); },
    /** Circular arc, angles in degrees (0° points right, 90° points down). */
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

interface Stop extends Pt { s: number; /** Where the label sits relative to the stop. */ side: 'above' | 'below' | 'right'; width: number }
interface Geo {
  wide: boolean; W: number; H: number; track: Track; stops: Stop[];
  /** One flag after each checkpoint's last step; `after` is that step's number. */
  flags: (Pt & { after: number })[];
  loop: { d: string; head: string; label?: { left: number; top: number; width: number } };
  rose?: Pt & { r: number };
}

const R_STOP = 20;
const head = (tip: Pt, ux: number, uy: number) => { const bx = tip.x - ux * 10, by = tip.y - uy * 10; return `${tip.x},${tip.y} ${bx - uy * 5.5},${by + ux * 5.5} ${bx + uy * 5.5},${by - ux * 5.5}`; };

function wideGeo(W: number): Geo {
  const R = 76, xr = W - R - 24, c4 = xr - 28, col = (c4 - 6) / 3.5;
  const label = (col - 8 >= 200 ? 18 : 36) + 12 + 29; // title lines, gap to the stop, checkpoint pill
  const y1 = 6 + label + R_STOP, y2 = y1 + 2 * R, H = y2 + R_STOP + label + 6;
  const c = [0, 1, 2, 3].map((i) => c4 - (3 - i) * col);
  const mid = (a: number, b: number) => (a + b) / 2;
  const t = trackBuilder();
  const stops: Stop[] = [], flags: Geo['flags'] = [];
  const stop = (x: number, y: number, side: Stop['side']) => { t.line(x, y); stops.push({ x, y, s: t.here(), side, width: col - 8 }); };
  const flag = (x: number, y: number, after: number) => { t.line(x, y); flags.push({ x, y, after }); };
  t.move(Math.max(8, c[0] - 48), y1);
  stop(c[0], y1, 'above'); stop(c[1], y1, 'above'); flag(mid(c[1], c[2]), y1, 2); stop(c[2], y1, 'above'); stop(c[3], y1, 'above');
  t.line(xr, y1); t.arc(xr, y1 + R, R, -90, 0); flags.push({ x: xr + R, y: y1 + R, after: 4 }); t.arc(xr, y1 + R, R, 0, 90);
  stop(c[3], y2, 'below'); flag(mid(c[3], c[2]), y2, 5); stop(c[2], y2, 'below'); flag(mid(c[2], c[1]), y2, 6); stop(c[1], y2, 'below'); flag(c[0], y2, 7);
  // Loop back: from step 6 up to step 3. With the U-turn it closes a visible loop.
  const lx = c[2] - 13, top = y1 + 36, bottom = y2 - 32, bulge = 46;
  const ux = bulge, uy = -(bottom - top) * 0.36, ul = Math.hypot(ux, uy);
  return {
    wide: true, W, H, track: t.done(), stops, flags,
    loop: {
      d: `M${lx},${bottom} C${lx - bulge},${bottom - (bottom - top) * 0.36} ${lx - bulge},${top + (bottom - top) * 0.36} ${lx - 4},${top + 5}`,
      head: head({ x: lx, y: top }, ux / ul, uy / ul),
      label: { left: c[2] + 14, top: y1 + R - 23, width: Math.min(176, xr + R - 34 - c[2]) },
    },
    rose: { x: mid(c[0], c[1]), y: y1 + R - 4, r: 40 },
  };
}

function narrowGeo(W: number): Geo {
  const x = 58, top = 30, pitch = 76, wiggle = 16;
  const t = trackBuilder();
  const stops: Stop[] = [], flags: Geo['flags'] = [];
  const ys = JOURNEY_STOPS.map((_, i) => top + i * pitch);
  t.move(x, ys[0]);
  ys.forEach((y, i) => {
    const sign = i % 2 === 0 ? 1 : -1, n = JOURNEY_STOPS[i];
    stops.push({ x, y, s: t.here(), side: 'right', width: W - x - 40 });
    if (i < ys.length - 1) t.cubic(x + sign * wiggle, y + pitch / 3, x + sign * wiggle, y + (2 * pitch) / 3, x, ys[i + 1]);
    else { t.cubic(x + sign * wiggle, y + 22, x + sign * 4, y + 44, x, y + 64); flags.push({ x, y: y + 64, after: n.number }); }
  });
  // Loop back: a bracket to the left of the road, from step 6 up to step 3.
  const from = ys[JOURNEY.loopFrom - 1], to = ys[JOURNEY.loopTo - 1], lx = 7, r = 10, tip = x - R_STOP - 9;
  return {
    wide: false, W, H: ys[ys.length - 1] + 64 + 40, track: t.done(), stops, flags,
    loop: { d: `M${tip},${from} H${lx + r} Q${lx},${from} ${lx},${from - r} V${to + r} Q${lx},${to} ${lx + r},${to} H${tip - 7}`, head: head({ x: tip, y: to }, 1, 0) },
  };
}

function Rose({ x, y, r }: Pt & { r: number }) {
  const spike = (len: number, w: number, a: number) => <path key={a} d={`M0,${-len} L${w},0 L0,${len} L${-w},0 Z`} transform={`rotate(${a})`} />;
  return (
    <g className="dgm-j-rose" transform={`translate(${x},${y})`} aria-hidden="true">
      <circle r={r} /><circle r={r - 7} className="is-fine" />
      <g className="is-minor">{[45, 135].map((a) => spike(r - 14, 5, a))}</g>
      <g className="is-major">{[0, 90].map((a) => spike(r - 3, 7, a))}</g>
      <path className="is-north" d={`M0,${-(r - 3)} L7,0 L-7,0 Z`} />
      <circle r={2.5} className="is-pin" />
    </g>
  );
}

const caption = (i: number) => `${JOURNEY_STOPS[i].title}. ${JOURNEY_STOPS[i].question}`;
const CAPTIONS = [...JOURNEY_STOPS.map((_, i) => caption(i)), JOURNEY.loopCaption];
const LAST = JOURNEY_STOPS.length;

export default function CompassJourney() {
  const [ref, W] = useWidth<HTMLDivElement>();
  const walk = useWalkthrough(LAST + 1, { intro: 640, interval: 1900 });
  const [sel, setSel] = useState<number | null>(null);
  const geo = useMemo(() => (W > 0 ? (W >= 600 ? wideGeo(W) : narrowGeo(W)) : null), [W]);
  useEffect(() => { if (walk.walking) setSel(null); }, [walk.walking]);

  /* Position on the road: 0 = start, 1…7 = a stop, 8 = the finish flag. */
  const pos = walk.walking ? Math.min(walk.shown, LAST) : sel ?? LAST + 1;
  const traveller = useRef<SVGGElement>(null), progress = useRef<SVGPathElement>(null);
  const at = useRef<{ geo: Geo | null; s: number }>({ geo: null, s: 0 });
  useLayoutEffect(() => {
    if (!geo) return;
    const { track } = geo;
    const target = pos === 0 ? 0 : pos > LAST ? track.length : geo.stops[pos - 1].s;
    const apply = (s: number) => {
      at.current.s = s;
      const p = track.at(s);
      traveller.current?.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${p.angle.toFixed(1)})`);
      if (progress.current) progress.current.style.strokeDashoffset = String(track.length - s);
    };
    const from = at.current.s;
    if (walk.reduced || at.current.geo !== geo || from === target) { at.current.geo = geo; apply(target); return; }
    const duration = Math.min(1200, 300 + Math.abs(target - from) * 0.9), t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / duration), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      apply(from + (target - from) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [geo, pos, walk.reduced]);

  const off = (n: number) => (walk.has(n) ? '' : ' is-off');
  return (
    <div className="dgm-journey" ref={walk.hostRef} data-walk={walk.walking ? 'walk' : 'rest'}>
      <div className="dgm-j-stage" ref={ref} data-layout={geo?.wide ? 'wide' : 'narrow'} style={{ height: geo?.H ?? 380 }}>
        {geo && (
          <>
            <svg width={geo.W} height={geo.H} viewBox={`0 0 ${geo.W} ${geo.H}`} role="img"
              aria-label="A road through seven numbered steps. Flags mark the five checkpoints, and a dashed arrow loops back from step 6 to step 3.">
              {geo.rose && <Rose {...geo.rose} />}
              <path className="dgm-j-track" d={geo.track.d} />
              <path className="dgm-j-progress" d={geo.track.d} ref={progress} strokeDasharray={`${geo.track.length} ${geo.track.length}`} />
              <g className={`dgm-j-loop${off(LAST + 1)}`}><path d={geo.loop.d} /><polygon points={geo.loop.head} /></g>
              {geo.flags.map((f) => (
                <g key={f.after} className={`dgm-j-flag${off(f.after)}`} transform={`translate(${f.x.toFixed(1)},${f.y.toFixed(1)})`}>
                  <circle r={4.5} /><path className="is-pole" d="M0,0 V-25" /><path className="is-pennant" d="M0,-25 L15,-19.5 L0,-14 Z" />
                </g>
              ))}
              <g className="dgm-j-traveller" ref={traveller}><circle r={R_STOP + 7} /><path d={`M${R_STOP + 11},-6.5 L${R_STOP + 20},0 L${R_STOP + 11},6.5 Z`} /></g>
            </svg>
            {geo.stops.map((p, i) => {
              const s = JOURNEY_STOPS[i];
              const style = p.side === 'right' ? { left: p.x - R_STOP, top: p.y, width: p.width + R_STOP * 2 + 16 }
                : p.side === 'above' ? { left: p.x - p.width / 2, bottom: geo.H - p.y - R_STOP, width: p.width }
                  : { left: p.x - p.width / 2, top: p.y - R_STOP, width: p.width };
              return (
                <button key={s.number} type="button" style={style} aria-pressed={sel === s.number}
                  className={`dgm-j-stop is-${p.side}${s.number <= pos ? ' is-reached' : ''}${off(s.number)}`}
                  aria-label={`Step ${s.number}: ${s.title}.${s.checkpoint ? ` Checkpoint after this step: ${s.checkpoint}.` : ''}`}
                  onClick={() => { walk.reset(); setSel(sel === s.number ? null : s.number); }}>
                  <span className="dgm-j-num">{s.number}</span>
                  <span className="dgm-j-text">
                    <span className="dgm-j-title">{s.title}</span>
                    {s.checkpoint && <span className="dgm-j-pill"><Flag size={13} aria-hidden="true" />{s.checkpoint}</span>}
                  </span>
                </button>
              );
            })}
            {geo.loop.label && (
              <div className={`dgm-j-looplabel${off(LAST + 1)}`} style={geo.loop.label}><strong>{JOURNEY.loopTitle}</strong><span>{JOURNEY.loopText}</span></div>
            )}
          </>
        )}
      </div>
      <ul className="dgm-legend" aria-label="Legend">
        <li><svg width="18" height="20" viewBox="-3 -27 20 30" aria-hidden="true" className="dgm-j-flag"><path className="is-pole" d="M0,0 V-25" /><path className="is-pennant" d="M0,-25 L15,-19.5 L0,-14 Z" /></svg>{JOURNEY.legendCheckpoint}</li>
        <li><svg width="34" height="12" viewBox="0 0 34 12" aria-hidden="true" className="dgm-j-loop"><path d="M33,6 H8" /><polygon points="1,6 10,1.5 10,10.5" /></svg>{JOURNEY.legendLoop}</li>
      </ul>
      <WalkControls walk={walk} captions={CAPTIONS} summary={sel ? caption(sel - 1) : JOURNEY.summary} />
    </div>
  );
}
