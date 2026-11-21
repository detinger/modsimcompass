/**
 * The idea of the tool in one picture: data become a model, and the model gives synthetic values.
 * A genuine SVG drawing; the dots appear one by one unless reduced motion is asked for.
 */
const BARS = [6, 14, 24, 30, 26, 19, 12, 8, 5, 3];
const CURVE = 'M14,92 C30,92 34,40 52,34 C66,30 74,52 90,70 C102,82 114,90 132,91';
const DOTS: [number, number][] = [[24, 70], [38, 58], [44, 76], [52, 64], [58, 80], [66, 70], [72, 54], [80, 78], [88, 66], [96, 82], [108, 74], [120, 84]];

export function IntroArt() {
  return (
    <figure className="dm-intro">
      <svg viewBox="0 0 560 140" role="img" aria-label="Three panels. Data: a histogram. Model: a smooth curve drawn through it. Synthetic data: new dots drawn from the curve.">
        <g transform="translate(14 8)">
          <rect className="dm-intro-card" x="0" y="0" width="146" height="104" rx="14" />
          {BARS.map((h, i) => <rect key={i} className="dm-intro-bar" x={14 + i * 12} y={92 - h * 2.2} width="9" height={h * 2.2} rx="2" />)}
          <text className="dm-intro-label" x="73" y="122" textAnchor="middle">Data</text>
        </g>
        <path className="dm-intro-arrow" d="M170,60 h34 m-8,-7 l8,7 l-8,7" />
        <g transform="translate(207 8)">
          <rect className="dm-intro-card" x="0" y="0" width="146" height="104" rx="14" />
          {BARS.map((h, i) => <rect key={i} className="dm-intro-bar is-faint" x={14 + i * 12} y={92 - h * 2.2} width="9" height={h * 2.2} rx="2" />)}
          <path className="dm-intro-curve" d={CURVE} />
          <text className="dm-intro-label" x="73" y="122" textAnchor="middle">Model</text>
        </g>
        <path className="dm-intro-arrow" d="M363,60 h34 m-8,-7 l8,7 l-8,7" />
        <g transform="translate(400 8)">
          <rect className="dm-intro-card" x="0" y="0" width="146" height="104" rx="14" />
          <path className="dm-intro-curve is-faint" d={CURVE} />
          {DOTS.map(([cx, cy], i) => <circle key={i} className="dm-intro-dot" style={{ animationDelay: `${i * 110}ms` }} cx={cx} cy={cy} r="4.5" />)}
          <text className="dm-intro-label" x="73" y="122" textAnchor="middle">Synthetic data</text>
        </g>
      </svg>
    </figure>
  );
}
