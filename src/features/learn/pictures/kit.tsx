import type { CSSProperties, ReactNode, Ref } from 'react';

/** Every method picture is drawn on the same canvas, so cards line up. */
export const PIC_W = 280;
export const PIC_H = 150;

/** Small seeded generator: the pictures are illustrations and must look the same on every visit. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const at = (x: number, y: number): CSSProperties => ({ transform: `translate(${x}px, ${y}px)` });
export const n1 = (v: number) => v.toFixed(1);
export const n2 = (v: number) => v.toFixed(2);

/** The frame of every picture: an image with a text equivalent. `reset` switches transitions off for the jump back to the first frame. */
export function Pic({ svgRef, label, reset, moving, ms, children }: { svgRef: Ref<SVGSVGElement>; label: string; reset?: boolean; moving?: boolean; ms?: number; children: ReactNode }) {
  return (
    <svg ref={svgRef} className="lp-pic" viewBox={`0 0 ${PIC_W} ${PIC_H}`} role="img" aria-label={label}
      data-reset={reset ? 'true' : undefined} data-moving={moving ? 'true' : undefined} style={ms ? ({ '--lp-ms': `${ms}ms` } as CSSProperties) : undefined}>
      {children}
    </svg>
  );
}

function head(x: number, y: number, angle: number, size: number): { points: string; bx: number; by: number } {
  const bx = x - size * Math.cos(angle), by = y - size * Math.sin(angle);
  const px = -Math.sin(angle) * size * 0.5, py = Math.cos(angle) * size * 0.5;
  return { points: `${x},${y} ${bx + px},${by + py} ${bx - px},${by - py}`, bx, by };
}

/** Straight arrow. `hot` lights it up in the card colour. */
export function Arrow({ x1, y1, x2, y2, hot, dashed, w = 1.5, size = 7, className = '' }: { x1: number; y1: number; x2: number; y2: number; hot?: boolean; dashed?: boolean; w?: number; size?: number; className?: string }) {
  const h = head(x2, y2, Math.atan2(y2 - y1, x2 - x1), size);
  return (
    <g className={`lp-arrow${hot ? ' is-hot' : ''} ${className}`}>
      <line x1={x1} y1={y1} x2={h.bx} y2={h.by} strokeWidth={w} strokeDasharray={dashed ? '4 3' : undefined} />
      <polygon points={h.points} />
    </g>
  );
}

/** Curved arrow: a path, with the head drawn at its end pointing along `angle` (degrees, 0 = right, 90 = down). */
export function CurveArrow({ d, x, y, angle, hot, dashed, w = 1.5, size = 7, className = '' }: { d: string; x: number; y: number; angle: number; hot?: boolean; dashed?: boolean; w?: number; size?: number; className?: string }) {
  const h = head(x, y, (angle * Math.PI) / 180, size);
  return (
    <g className={`lp-arrow${hot ? ' is-hot' : ''} ${className}`}>
      <path d={d} strokeWidth={w} strokeDasharray={dashed ? '4 3' : undefined} />
      <polygon points={h.points} />
    </g>
  );
}
