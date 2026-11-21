import { useMemo } from 'react';
import { JOURNEY, JOURNEY_STOPS } from '../../content/diagrams/specs';
import { WalkControls, useWalkthrough, useWidth } from './walkthrough';
import {
  CAPTIONS, CompassLegend, FLAG_WORDS, LAST, PlainStopInner, ProjectStopInner, R_STOP, StopTag, caption, head, trackBuilder, useChoice, useProjectRest, useTravel,
  type CompassJourneyProps, type Pt, type Track,
} from './compassShared';

export type { CompassJourneyProps, JourneyFlag, JourneyProject, JourneyStopState } from './compassShared';

/* The signature picture: a road through seven stops. Its shape is computed from the card width —
   two rows joined by a U-turn when there is room, a gently winding vertical road when there is not.

   Without props it is the teaching picture (Home, Learn): a walkthrough with Play, Step and Reset.
   With `project` it is the map of one project: each stop is a link to its step and shows whether it is started,
   how many items are open and what is included there; the flags show the checkpoints' review status, and the
   traveller drives to the stop to look at next.

   With `onSelect`, a stop is a button in either mode: a click calls `onSelect(step)` (no navigation, no built-in
   toggle) and `selected` is the stop shown as chosen. Without it the behaviour above is unchanged.
   The circular twin is CompassWheel; both take the same props and share ./compassShared. */

interface Stop extends Pt { s: number; /** Where the label sits relative to the stop. */ side: 'above' | 'below' | 'right'; width: number }
interface Geo {
  wide: boolean; W: number; H: number; track: Track; stops: Stop[];
  /** One flag after each checkpoint's last step; `after` is that step's number. */
  flags: (Pt & { after: number })[];
  loop: { d: string; head: string; label?: { left: number; top: number; width: number } };
  rose?: Pt & { r: number };
}

/** `extra`: room for one more line under each title (the project's marks). */
function wideGeo(W: number, extra = 0): Geo {
  const R = 76, xr = W - R - 24, c4 = xr - 28, col = (c4 - 6) / 3.5;
  const label = (col - 8 >= 200 ? 18 : 36) + 12 + 29 + extra; // title lines, gap to the stop, checkpoint pill
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

function narrowGeo(W: number, extra = 0): Geo {
  const x = 58, top = 30, pitch = 76 + extra, wiggle = 16;
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

export default function CompassJourney({ project, onSelect, selected }: CompassJourneyProps = {}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const walk = useWalkthrough(LAST + 1, { intro: 640, interval: 1900 });
  const { sel, choose } = useChoice(walk, onSelect, selected);
  const extra = project ? 26 : 0;
  const geo = useMemo(() => (W > 0 ? (W >= 600 ? wideGeo(W, extra) : narrowGeo(W, extra)) : null), [W, extra]);
  useProjectRest(walk, project);
  const walking = !project && walk.walking;

  /* Position on the road: 0 = start, 1…7 = a stop, 8 = the finish flag. */
  const pos = project ? Math.max(1, Math.min(LAST + 1, project.here)) : walking ? Math.min(walk.shown, LAST) : sel ?? LAST + 1;
  const stopS = useMemo(() => geo?.stops.map((x) => x.s) ?? [], [geo]);
  const { traveller, progress } = useTravel(geo?.track ?? null, stopS, pos, walk.reduced, !!project);

  const off = (n: number) => (project || walk.has(n) ? '' : ' is-off');
  const flagOf = (after: number) => project?.flags?.[after];
  return (
    <div className={`dgm-journey${project ? ' is-project' : ''}`} ref={walk.hostRef} data-walk={walking ? 'walk' : 'rest'}>
      <div className="dgm-j-stage" ref={ref} data-layout={geo?.wide ? 'wide' : 'narrow'} style={{ height: geo?.H ?? 380 }}>
        {geo && (
          <>
            <svg width={geo.W} height={geo.H} viewBox={`0 0 ${geo.W} ${geo.H}`} role="img"
              aria-label={project
                ? `A road through the seven steps of this project. The marker stands at ${pos > LAST ? 'the finish' : `step ${pos}`}. Flags mark the five checkpoints.`
                : 'A road through seven numbered steps. Flags mark the five checkpoints, and a dashed arrow loops back from step 6 to step 3.'}>
              {geo.rose && <Rose {...geo.rose} />}
              <path className="dgm-j-track" d={geo.track.d} />
              <path className="dgm-j-progress" d={geo.track.d} ref={progress} strokeDasharray={`${geo.track.length} ${geo.track.length}`} />
              <g className={`dgm-j-loop${off(LAST + 1)}`}><path d={geo.loop.d} /><polygon points={geo.loop.head} /></g>
              {geo.flags.map((f) => {
                const flag = flagOf(f.after);
                return (
                  <g key={f.after} className={`dgm-j-flag${off(f.after)}${flag ? FLAG_WORDS[flag.status] : ''}`} transform={`translate(${f.x.toFixed(1)},${f.y.toFixed(1)})`}>
                    <circle r={4.5} /><path className="is-pole" d="M0,0 V-25" /><path className="is-pennant" d="M0,-25 L15,-19.5 L0,-14 Z" />
                  </g>
                );
              })}
              <g className="dgm-j-traveller" ref={traveller}><circle r={R_STOP + 7} /><path d={`M${R_STOP + 11},-6.5 L${R_STOP + 20},0 L${R_STOP + 11},6.5 Z`} /></g>
            </svg>
            {geo.stops.map((p, i) => {
              const s = JOURNEY_STOPS[i];
              const style = p.side === 'right' ? { left: p.x - R_STOP, top: p.y, width: p.width + R_STOP * 2 + 16 }
                : p.side === 'above' ? { left: p.x - p.width / 2, bottom: geo.H - p.y - R_STOP, width: p.width }
                  : { left: p.x - p.width / 2, top: p.y - R_STOP, width: p.width };
              if (project) {
                const st = project.stops[i] ?? { started: false, open: 0 };
                return (
                  <StopTag key={s.number} to={onSelect ? undefined : project.href(s.number)} onClick={onSelect ? () => choose(s.number) : undefined} pressed={onSelect ? sel === s.number : undefined} style={style}
                    className={`dgm-j-stop is-${p.side}${st.started ? ' is-reached' : ''}${pos === s.number ? ' is-here' : ''}`}>
                    <ProjectStopInner s={s} st={st} flag={flagOf(s.number)} here={pos === s.number} />
                  </StopTag>
                );
              }
              return (
                <button key={s.number} type="button" style={style} aria-pressed={sel === s.number}
                  className={`dgm-j-stop is-${p.side}${s.number <= pos ? ' is-reached' : ''}${off(s.number)}`}
                  onClick={() => choose(s.number)}>
                  <PlainStopInner s={s} />
                </button>
              );
            })}
            {geo.loop.label && (
              <div className={`dgm-j-looplabel${off(LAST + 1)}`} style={geo.loop.label}><strong>{JOURNEY.loopTitle}</strong><span>{JOURNEY.loopText}</span></div>
            )}
          </>
        )}
      </div>
      <CompassLegend project={!!project} loopIcon={<svg width="34" height="12" viewBox="0 0 34 12" aria-hidden="true" className="dgm-j-loop"><path d="M33,6 H8" /><polygon points="1,6 10,1.5 10,10.5" /></svg>} />
      {!project && <WalkControls walk={walk} captions={CAPTIONS} summary={sel ? caption(sel - 1) : JOURNEY.summary} />}
    </div>
  );
}
