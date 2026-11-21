/**
 * The idea of measurement data in one picture: survey answers in columns become items, and items that belong together
 * form a construct. A genuine SVG drawing; the items join their construct one by one unless reduced motion is asked for.
 */
export function MeasureArt() {
  const cols = ['PU1', 'PU2', 'PU3', 'PU4'];
  return (
    <figure className="dm-intro">
      <svg viewBox="0 0 560 140" role="img" aria-label="Three panels. Answers: a table with one column per item. Items: four squares named PU1 to PU4. Construct: an oval named PU with arrows to its four items.">
        <g transform="translate(14 8)">
          <rect className="dm-intro-card" x="0" y="0" width="146" height="104" rx="14" />
          {cols.map((c, i) => <text key={c} className="ms-art-head" x={22 + i * 32} y="22" textAnchor="middle">{c}</text>)}
          {[0, 1, 2, 3, 4].map((r) => cols.map((_, i) => <rect key={`${r}-${i}`} className="dm-intro-bar is-faint" x={10 + i * 32} y={30 + r * 13} width="24" height="9" rx="2" />))}
          <text className="dm-intro-label" x="73" y="122" textAnchor="middle">Answers</text>
        </g>
        <path className="dm-intro-arrow" d="M170,60 h34 m-8,-7 l8,7 l-8,7" />
        <g transform="translate(207 8)">
          <rect className="dm-intro-card" x="0" y="0" width="146" height="104" rx="14" />
          {cols.map((c, i) => <g key={c}><rect className="ms-art-item" x={14 + (i % 2) * 64} y={18 + Math.floor(i / 2) * 40} width="54" height="28" rx="4" /><text className="ms-art-text" x={41 + (i % 2) * 64} y={36 + Math.floor(i / 2) * 40} textAnchor="middle">{c}</text></g>)}
          <text className="dm-intro-label" x="73" y="122" textAnchor="middle">Items</text>
        </g>
        <path className="dm-intro-arrow" d="M363,60 h34 m-8,-7 l8,7 l-8,7" />
        <g transform="translate(400 8)">
          <rect className="dm-intro-card" x="0" y="0" width="146" height="104" rx="14" />
          <ellipse className="ms-art-construct" cx="40" cy="52" rx="28" ry="17" />
          <text className="ms-art-text is-bold" x="40" y="56" textAnchor="middle">PU</text>
          {cols.map((c, i) => <g key={c} className="ms-art-join" style={{ animationDelay: `${i * 160}ms` }}><line className="ms-art-arrow" x1="68" y1="52" x2="98" y2={18 + i * 22} /><rect className="ms-art-item" x="100" y={10 + i * 22} width="36" height="16" rx="3" /><text className="ms-art-text is-small" x="118" y={22 + i * 22} textAnchor="middle">{c}</text></g>)}
          <text className="dm-intro-label" x="73" y="122" textAnchor="middle">Construct</text>
        </g>
      </svg>
    </figure>
  );
}
