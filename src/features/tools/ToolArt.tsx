import type { ReactNode } from 'react';
import type { ToolId } from './registry';

/** Small decorative drawings for the hub tiles. Colours come from the tile’s tone; purely decorative. */
export function ToolArt({ id }: { id: ToolId }) {
  return (
    <svg className={`tool-art art-${id}`} viewBox="0 0 200 84" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      {ART[id]}
    </svg>
  );
}

const dots = (pts: [number, number][], r = 3.2) => pts.map(([x, y], i) => <circle key={i} className="a-dot" cx={x} cy={y} r={r} />);

const ART: Record<ToolId, ReactNode> = {
  sandbox: (
    <>
      <path className="a-line" d="M14 42 H64" />
      <path className="a-fill-strong" d="M58 35 L70 42 L58 49 Z" />
      <rect className="a-box" x="74" y="12" width="52" height="60" rx="8" />
      <rect className="a-level" x="77" y="40" width="46" height="29" rx="5" />
      <path className="a-line" d="M130 42 H180" />
      <path className="a-fill-strong" d="M174 35 L186 42 L174 49 Z" />
      <circle className="a-dot a-flow f1" cx="22" cy="42" r="4" />
      <circle className="a-dot a-flow f2" cx="38" cy="42" r="4" />
      <circle className="a-dot a-flow f3" cx="142" cy="42" r="4" />
    </>
  ),
  distributions: (
    <>
      <path className="a-area" d="M10 72 C50 72 62 12 100 12 C138 12 150 72 190 72 Z" />
      <path className="a-line" d="M10 72 C50 72 62 12 100 12 C138 12 150 72 190 72" />
      <path className="a-thin" d="M100 12 V72" />
    </>
  ),
  choose: (
    <>
      <path className="a-thin" d="M100 20 L56 46 M100 20 L144 46 M56 46 L34 68 M56 46 L78 68 M144 46 L122 68 M144 46 L166 68" />
      <circle className="a-node" cx="100" cy="18" r="9" />
      <circle className="a-node" cx="56" cy="46" r="7" />
      <circle className="a-node hot" cx="144" cy="46" r="7" />
      {dots([[34, 68], [78, 68], [122, 68]], 5)}
      <circle className="a-node hot" cx="166" cy="68" r="6" />
    </>
  ),
  fitting: (
    <>
      {[[22, 58], [42, 40], [62, 22], [82, 30], [102, 44], [122, 54], [142, 62], [162, 66]].map(([x, y], i) => <rect key={i} className="a-bar" x={x} y={y} width="16" height={72 - y} rx="3" />)}
      <path className="a-line" d="M14 70 C40 60 52 14 72 14 C96 14 120 58 186 68" />
    </>
  ),
  sampling: (
    <>
      {['H', 'T', 'T', 'H', 'T'].map((c, i) => (
        <g key={i} className={`a-coin c${i}`}>
          <circle className={c === 'H' ? 'a-node hot' : 'a-node'} cx={28 + i * 36} cy={42} r="15" />
          <text className="a-text" x={28 + i * 36} y={47} textAnchor="middle">{c}</text>
        </g>
      ))}
    </>
  ),
  regression: (
    <>
      {dots([[20, 62], [36, 66], [48, 50], [62, 56], [76, 40], [92, 48], [104, 34], [120, 38], [134, 22], [150, 30], [164, 14], [180, 20]])}
      <path className="a-line" d="M12 68 L188 12" />
    </>
  ),
  apps: (
    <>
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} className={i === 2 ? 'a-tile hot' : 'a-tile'} x={12 + i * 36} y={i % 2 ? 30 : 22} width="30" height="30" rx="8" />)}
      <path className="a-arrow" d="M79 43 L89 33 M82 33 H89 V40" />
    </>
  ),
};
