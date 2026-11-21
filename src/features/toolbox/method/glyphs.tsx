import type { ReactNode } from 'react';
import type { MethodFamily, MethodId } from '../../../domain/methods/registry';
import './glyphs.css';

/**
 * Small pictograms, drawn in the family colour (`currentColor`). Purely decorative: every one sits next to the name
 * it stands for, so each is hidden from assistive technology. Shapes are styled and animated by `method.css`
 * (`.mg-*` classes); nothing moves when the reader prefers reduced motion.
 *
 * The four family pictograms follow the “Four families of methods” diagram (src/ui/diagrams/MethodFamilies.tsx).
 */
const FAMILY: Record<MethodFamily, ReactNode> = {
  // Variables joined by paths.
  relationships: (
    <>
      <path className="mg-line mg-draw" d="M15,13 L31,21" /><path className="mg-line mg-draw" d="M15,35 L31,27" /><path className="mg-line mg-draw" d="M10,19 V29" />
      <circle className="mg-fill" cx="10" cy="12" r="6" /><circle className="mg-fill" cx="10" cy="36" r="6" /><circle className="mg-solid" cx="37" cy="24" r="7" />
    </>
  ),
  // Many possible outcomes around a likely one.
  uncertainty: (
    <>
      <path className="mg-line" d="M4,38 H44" />
      <path className="mg-line mg-fill" d="M5,38 C15,38 16,9 24,9 C32,9 33,38 43,38 Z" />
      <g className="mg-drops"><circle className="mg-solid" cx="24" cy="31" r="3" /><circle className="mg-solid" cx="17" cy="33" r="3" /><circle className="mg-solid" cx="31" cy="33" r="3" /><circle className="mg-solid" cx="24" cy="22" r="3" /></g>
    </>
  ),
  // Items queue, are served and leave.
  processes: (
    <>
      <g className="mg-queue"><circle className="mg-solid" cx="6" cy="24" r="3.5" /><circle className="mg-solid" cx="15" cy="24" r="3.5" /></g>
      <rect className="mg-line mg-fill" x="22" y="14" width="16" height="20" rx="4" /><circle className="mg-solid" cx="30" cy="24" r="3.5" />
      <path className="mg-line" d="M38,24 H46 M43,20.5 L46.5,24 L43,27.5" />
    </>
  ),
  // Simple cells, a pattern nobody programmed.
  emergence: (
    <>
      {[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}-${c}`} className="mg-cell" x={3 + c * 11} y={3 + r * 11} width="9" height="9" rx="2" />))}
      {/* A glider: the solid cells are one generation, the hidden ones the next. */}
      {[[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]].map(([r, c]) => <rect key={`now-${r}-${c}`} className="mg-solid mg-now" x={3 + c * 11} y={3 + r * 11} width="9" height="9" rx="2" />)}
      {[[1, 0], [1, 2], [2, 1], [2, 2], [3, 1]].map(([r, c]) => <rect key={`next-${r}-${c}`} className="mg-solid mg-next" x={3 + c * 11} y={3 + r * 11} width="9" height="9" rx="2" />)}
    </>
  ),
};

/** An arrowhead pointing along (dx, dy) with its tip at (x, y). */
const head = (x: number, y: number, dx: number, dy: number, s = 4.5) => {
  const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  const bx = x - ux * s, by = y - uy * s, px = -uy * s * 0.75, py = ux * s * 0.75;
  return `M${(bx + px).toFixed(1)},${(by + py).toFixed(1)} L${x},${y} L${(bx - px).toFixed(1)},${(by - py).toFixed(1)}`;
};

const METHOD: Record<MethodId, ReactNode> = {
  // Measured variables (squares) joined by directed paths.
  'path-analysis': (
    <>
      <path className="mg-line mg-draw" d={`M16,12 L31,21 ${head(31, 21, 15, 9)}`} />
      <path className="mg-line mg-draw" d={`M16,36 L31,27 ${head(31, 27, 15, -9)}`} />
      <rect className="mg-fill" x="4" y="6" width="12" height="12" rx="2" /><rect className="mg-fill" x="4" y="30" width="12" height="12" rx="2" />
      <rect className="mg-solid" x="32" y="18" width="12" height="12" rx="2" />
    </>
  ),
  // A hidden construct (oval) measured by several indicators (squares).
  'cb-sem': (
    <>
      {[9, 24, 39].map((x) => <path key={x} className="mg-line mg-draw" d={`M24,19 L${x},32 ${head(x, 32, x - 24, 13, 4)}`} />)}
      <ellipse className="mg-solid" cx="24" cy="12" rx="12" ry="8" />
      {[4, 19, 34].map((x) => <rect key={x} className="mg-fill" x={x} y="34" width="10" height="10" rx="2" />)}
    </>
  ),
  // Indicators combine into a composite construct (oval), which predicts an outcome.
  'pls-sem': (
    <>
      {[9, 24, 39].map((y) => {
        const ey = 24 + (y - 24) * 0.3;
        return <path key={y} className="mg-line mg-draw" d={`M13,${y} L25,${ey} ${head(25, ey, 12, ey - y, 3.6)}`} />;
      })}
      {[4, 19, 34].map((y) => <rect key={y} className="mg-fill" x="3" y={y} width="10" height="10" rx="2" />)}
      <ellipse className="mg-solid" cx="33" cy="24" rx="8" ry="7" />
      <path className="mg-line" d={`M40,24 H46 ${head(46, 24, 1, 0, 3.5)}`} />
    </>
  ),
  // A token moves from one place, through a transition, to the next place.
  'petri-nets': (
    <>
      <path className="mg-line" d={`M17,24 H21 M26,24 H31 ${head(31, 24, 1, 0, 4)}`} />
      <circle className="mg-fill" cx="10" cy="24" r="7" /><rect className="mg-solid" x="21" y="12" width="5" height="24" rx="1.5" /><circle className="mg-fill" cx="38" cy="24" r="7" />
      <circle className="mg-solid mg-token" cx="10" cy="24" r="2.8" />
    </>
  ),
  // Many draws pile up into a distribution of outcomes.
  'monte-carlo': (
    <>
      <path className="mg-line" d="M3,43 H45" />
      {[[5, 6], [13, 15], [21, 25], [29, 15], [37, 6]].map(([x, h]) => <rect key={x} className="mg-fill mg-bar" x={x} y={43 - h} width="6" height={h} rx="1.5" />)}
      <g className="mg-drops"><circle className="mg-solid" cx="24" cy="8" r="2.6" /><circle className="mg-solid" cx="16" cy="14" r="2.6" /><circle className="mg-solid" cx="32" cy="12" r="2.6" /><circle className="mg-solid" cx="40" cy="22" r="2.6" /></g>
    </>
  ),
  // A few states with chances of moving between them.
  'markov-chains': (
    <>
      <path className="mg-line mg-thin" d={`M17,11 Q24,6 31,11 ${head(31, 11, 1, 0.7, 3.5)}`} />
      <path className="mg-line mg-thin" d={`M33,19 Q33,29 27,33 ${head(27, 33, -1, 0.7, 3.5)}`} />
      <path className="mg-line mg-thin" d={`M19,33 Q12,29 12,20 ${head(12, 20, -0.1, -1, 3.5)}`} />
      <path className="mg-line mg-thin" d={`M40,9 C47,5 47,17 41,16 ${head(41, 16, -1, -0.2, 3.2)}`} />
      <circle className="mg-fill mg-state mg-s1" cx="11" cy="13" r="6" /><circle className="mg-fill mg-state mg-s2" cx="37" cy="13" r="6" /><circle className="mg-fill mg-state mg-s3" cx="23" cy="36" r="6" />
    </>
  ),
  // A stock filled by an inflow through a valve, drained by an outflow, with a feedback link.
  'system-dynamics': (
    <>
      <path className="mg-line mg-dash" d={`M24,13 C24,4 10,4 10,19 ${head(10, 19, 0, 1, 3.5)}`} />
      <path className="mg-line" d="M2,26 H17 M31,26 H40" /><path className="mg-line" d={head(45, 26, 1, 0, 4.5)} /><path className="mg-line" d="M40,26 H45" />
      <path className="mg-solid" d="M6,21 L14,31 L14,21 L6,31 Z" />
      <rect className="mg-line mg-fill" x="17" y="14" width="14" height="24" rx="2" />
      <rect className="mg-solid mg-level" x="19" y="26" width="10" height="10" rx="1" />
    </>
  ),
  // The classic picture: a waiting line (open box) in front of a server (circle).
  'queueing-theory': (
    <>
      <path className="mg-line" d="M3,15 H26 V33 H3" />
      <g className="mg-queue">{[8, 15, 22].map((x) => <rect key={x} className="mg-solid" x={x - 2.5} y="18" width="5" height="12" rx="1.5" />)}</g>
      <circle className="mg-line mg-fill" cx="36" cy="24" r="8" />
      <path className="mg-line mg-thin" d="M26,24 H28" />
      <circle className="mg-solid" cx="36" cy="24" r="3" />
    </>
  ),
  // Events at irregular moments on a clock line; an item jumps from event to event.
  des: (
    <>
      <path className="mg-line" d="M3,36 H45" />
      {[8, 17, 31, 41].map((x) => <path key={x} className="mg-solid" d={`M${x},31.5 L${x + 4.5},36 L${x},40.5 L${x - 4.5},36 Z`} />)}
      <rect className="mg-line mg-fill" x="15" y="6" width="18" height="14" rx="3" />
      <circle className="mg-solid mg-hop" cx="8" cy="24" r="3.4" />
    </>
  ),
  // A grid where a cell passes its state to its neighbours.
  'cellular-automata': (
    <>
      {[0, 1, 2, 3, 4].flatMap((r) => [0, 1, 2, 3, 4].map((c) => <rect key={`${r}-${c}`} className="mg-cell" x={2 + c * 9} y={2 + r * 9} width="8" height="8" rx="1.5" />))}
      {[[1, 2], [2, 1], [2, 3], [3, 2]].map(([r, c]) => <rect key={`n-${r}-${c}`} className="mg-solid mg-spread" x={2 + c * 9} y={2 + r * 9} width="8" height="8" rx="1.5" />)}
      <rect className="mg-solid" x={2 + 2 * 9} y={2 + 2 * 9} width="8" height="8" rx="1.5" />
    </>
  ),
  // Different individuals who meet and influence each other.
  abm: (
    <>
      <path className="mg-line mg-thin mg-dash" d="M14,17 L32,15 M13,22 L21,32 M35,21 L28,32" />
      {[[10, 12, 'mg-a1'], [37, 10, 'mg-a2'], [24, 33, 'mg-a3']].map(([x, y, k]) => (
        <g key={k as string} className={`mg-agent ${k as string}`}>
          <circle className="mg-solid" cx={x as number} cy={(y as number) - 3} r="3.6" />
          <path className="mg-fill" d={`M${(x as number) - 6},${(y as number) + 9} Q${x as number},${(y as number) - 2} ${(x as number) + 6},${(y as number) + 9} Z`} />
        </g>
      ))}
    </>
  ),
};

export function FamilyGlyph({ family, size = 48 }: { family: MethodFamily; size?: number }) {
  return <svg className={`mg mg-fam-${family}`} viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">{FAMILY[family]}</svg>;
}

export function MethodGlyph({ method, size = 40 }: { method: MethodId; size?: number }) {
  return <svg className={`mg mg-m-${method}`} viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">{METHOD[method]}</svg>;
}
