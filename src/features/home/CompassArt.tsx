import { STEPS } from '../../domain/passport/compass';

const TONES = ['tone-blue', 'tone-teal', 'tone-orange', 'tone-purple', 'tone-brown', 'tone-blue', 'tone-teal'];

/** Decorative compass: seven numbered stops around a dial and a gently swaying needle. */
export function CompassArt() {
  const R = 84;
  return (
    <svg className="compass-art" viewBox="0 0 240 240" aria-hidden="true" focusable="false">
      <circle className="ca-halo" cx="120" cy="120" r="112" />
      <circle className="ca-dial" cx="120" cy="120" r={R} />
      <circle className="ca-ring" cx="120" cy="120" r={R} />
      {Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2;
        return <line key={i} className="ca-tick" x1={120 + Math.cos(a) * (R - 12)} y1={120 + Math.sin(a) * (R - 12)} x2={120 + Math.cos(a) * (R - 7)} y2={120 + Math.sin(a) * (R - 7)} />;
      })}
      <g className="ca-needle">
        <path className="ca-north" d="M120 58 L134 120 L106 120 Z" />
        <path className="ca-south" d="M120 182 L134 120 L106 120 Z" />
      </g>
      <circle className="ca-pin" cx="120" cy="120" r="7" />
      {STEPS.map((s, i) => {
        const a = (i / STEPS.length) * Math.PI * 2 - Math.PI / 2;
        const x = 120 + Math.cos(a) * R, y = 120 + Math.sin(a) * R;
        return (
          <g key={s.id} className={`ca-stop ${TONES[i % TONES.length]}`} style={{ animationDelay: `${i * 90}ms` }}>
            <circle cx={x} cy={y} r="15" />
            <text x={x} y={y + 5} textAnchor="middle">{s.number}</text>
          </g>
        );
      })}
    </svg>
  );
}
