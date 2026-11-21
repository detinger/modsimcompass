import { useState, type ReactNode } from 'react';
import { ArrowRight, Compass, Wrench } from 'lucide-react';
import { Link } from '../../app/router';
import { FAMILIES, FAMILY_TONE, METHODS, type MethodFamily } from '../../domain/methods/registry';
import { LEARN_PAGES, learnPath, type LearnPage } from '../../content/learn/ideas';
import { GLOSSARY } from '../../content/learn/glossary';
import { FAMILY_ORDER } from '../../content/diagrams/specs';
import { useReducedMotion } from './pictures/motion';
import { PAGE_ICON } from './shared';

/** What each page holds, in a few words. */
const INSIDE: Record<LearnPage['id'], string[]> = {
  process: ['7 stops', 'what goes wrong', 'where each leads'],
  methods: ['11 moving pictures', '4 families', 'one table'],
  ideas: ['4 ideas', '4 diagrams', 'a tool each'],
  glossary: [`${GLOSSARY.length} terms`, 'A–Z', 'search'],
};

/* Small pictures for the four tiles. Decorative: the tile text says what each page holds. */

const ROAD = 'M14,72 C40,72 44,26 74,26 S110,70 140,70 S176,24 206,24';
const ROAD_STOPS: [number, number][] = [[14, 72], [46, 44], [74, 26], [108, 52], [140, 70], [174, 44], [206, 24]];

function ProcessArt() {
  const reduced = useReducedMotion();
  return (
    <svg className="lrn-art" viewBox="0 0 220 96" aria-hidden="true">
      <path className="lrn-art-road" d={ROAD} />
      <path className="lrn-art-loop" d="M140,82 C130,96 82,96 76,40" />
      {ROAD_STOPS.map(([x, y], i) => (
        <g key={i}>
          <circle className="lrn-art-stop" cx={x} cy={y} r={8} />
          <text className="lrn-art-num" x={x} y={y + 3.5} textAnchor="middle">{i + 1}</text>
        </g>
      ))}
      <circle className="lrn-art-traveller" r={12} cx={reduced ? 74 : 0} cy={reduced ? 26 : 0}>
        {!reduced && <animateMotion dur="4.5s" fill="freeze" path={ROAD} keyPoints="0;0.33;0.33;0.66;0.66;1;1" keyTimes="0;0.15;0.3;0.45;0.6;0.8;1" calcMode="linear" />}
      </circle>
    </svg>
  );
}

function MethodsArt() {
  return (
    <svg className="lrn-art lrn-art-fams" viewBox="0 0 220 96" aria-hidden="true">
      {FAMILY_ORDER.map((f, i) => {
        const x = 8 + (i % 2) * 106, y = 4 + Math.floor(i / 2) * 46;
        return (
          <g key={f} className={`lrn-art-fam ${FAMILY_TONE[f]}`} style={{ animationDelay: `${i * 0.6}s` }}>
            <rect x={x} y={y} width={98} height={40} rx={10} />
            <g transform={`translate(${x + 10} ${y + 6})`}>{FAM_GLYPH[f]}</g>
          </g>
        );
      })}
    </svg>
  );
}
const FAM_GLYPH: Record<MethodFamily, ReactNode> = {
  relationships: <><path className="g-line" d="M8,8 L34,14 M8,22 L34,14" /><circle className="g-dot" cx={6} cy={8} r={4} /><circle className="g-dot" cx={6} cy={22} r={4} /><circle className="g-solid" cx={38} cy={14} r={5} /><path className="g-line" d="M50,6 h24 M50,14 h18 M50,22 h22" /></>,
  uncertainty: <><path className="g-area" d="M2,28 C14,28 16,2 30,2 C44,2 46,28 58,28 Z" /><circle className="g-solid" cx={30} cy={22} r={2.5} /><circle className="g-solid" cx={22} cy={24} r={2.5} /><circle className="g-solid" cx={38} cy={24} r={2.5} /><path className="g-line" d="M64,26 V12 M70,26 V6 M76,26 V16" /></>,
  processes: <><circle className="g-solid" cx={6} cy={15} r={4} /><circle className="g-solid" cx={17} cy={15} r={4} /><rect className="g-area" x={26} y={3} width={22} height={24} rx={5} /><circle className="g-solid" cx={37} cy={15} r={4} /><path className="g-line" d="M52,15 H74 M69,10 L74,15 L69,20" /></>,
  emergence: <>{[0, 1, 2].flatMap((r) => [0, 1, 2, 3, 4, 5, 6].map((c) => <rect key={`${r}${c}`} className={(r + c) % 3 === 0 || (r === 1 && c === 3) ? 'g-solid' : 'g-cell'} x={c * 11} y={r * 10} width={8.5} height={8} rx={2} />))}</>,
};

function IdeasArt() {
  const cols = [1, 3, 5, 6, 4, 2, 1];
  return (
    <svg className="lrn-art" viewBox="0 0 220 96" aria-hidden="true">
      <path className="lrn-art-curve" d="M30,86 C70,86 76,26 110,26 C144,26 150,86 190,86" />
      <line className="lrn-art-axis" x1={22} y1={86} x2={198} y2={86} />
      {cols.flatMap((h, c) => Array.from({ length: h }, (_, k) => (
        <circle key={`${c}-${k}`} className="lrn-art-drop" cx={56 + c * 18} cy={80 - k * 10} r={4} style={{ animationDelay: `${(c * 3 + k) * 0.12}s` }} />
      )))}
    </svg>
  );
}

function GlossaryArt() {
  const tiles = ['A', 'B', 'C', 'D', 'E', 'F', 'L', 'M', 'P', 'R', 'S', 'V'];
  return (
    <svg className="lrn-art" viewBox="0 0 220 96" aria-hidden="true">
      {tiles.map((t, i) => {
        const x = 14 + (i % 6) * 33, y = 10 + Math.floor(i / 6) * 42;
        return (
          <g key={t} className="lrn-art-tile" style={{ animationDelay: `${i * 0.12}s` }}>
            <rect x={x} y={y} width={27} height={32} rx={7} />
            <text x={x + 13.5} y={y + 21.5} textAnchor="middle">{t}</text>
          </g>
        );
      })}
    </svg>
  );
}

const ART: Record<LearnPage['id'], () => ReactNode> = { process: ProcessArt, methods: MethodsArt, ideas: IdeasArt, glossary: GlossaryArt };

/**
 * `/learn`: four doors, the eleven methods as quick links, and where Learn leads.
 * Each door's picture plays once, in under five seconds, and plays again when the door is pointed at or focused:
 * nothing keeps moving on its own (and nothing moves at all when the reader asks for less motion).
 */
export default function Landing() {
  const [plays, setPlays] = useState<Partial<Record<LearnPage['id'], number>>>({});
  const replay = (id: LearnPage['id']) => setPlays((n) => ({ ...n, [id]: (n[id] ?? 0) + 1 }));
  return (
    <div className="page lrn-page lrn-landing">
      <header className="lrn-hero">
        <h1>Learn</h1>
        <p>A short tour in pictures. About {LEARN_PAGES.reduce((s, p) => s + p.minutes, 0)} minutes in all.</p>
      </header>

      <ul className="lrn-doors">
        {LEARN_PAGES.map((p, i) => {
          const Icon = PAGE_ICON[p.id], Art = ART[p.id];
          return (
            <li key={p.id}>
              <Link to={learnPath(p.id)} className={`lrn-door ${p.tone}`} onMouseEnter={() => replay(p.id)} onFocus={() => replay(p.id)}>
                <span className="lrn-door-art"><Art key={plays[p.id] ?? 0} /></span>
                <span className="lrn-door-body">
                  <span className="lrn-door-top">
                    <span className="lrn-door-icon" aria-hidden="true"><Icon size={20} /></span>
                    <span className="lrn-door-num">{i + 1}</span>
                  </span>
                  <span className="lrn-door-title">{p.title}</span>
                  <span className="lrn-door-text">{p.line}</span>
                  <span className="lrn-door-inside">{INSIDE[p.id].map((t) => <span key={t}>{t}</span>)}</span>
                  <span className="lrn-door-foot"><span>{p.minutes} min</span><ArrowRight size={18} aria-hidden="true" className="lrn-door-go" /></span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <section className="lrn-quick" aria-labelledby="lrn-quick-h">
        <h2 id="lrn-quick-h">Jump to a method</h2>
        <div className="lrn-quick-fams">
          {FAMILY_ORDER.map((f) => (
            <div key={f} className={`lrn-quick-fam ${FAMILY_TONE[f]}`}>
              <span className="lrn-quick-label">{FAMILIES[f].label}</span>
              <ul>
                {METHODS.filter((m) => m.family === f).map((m) => (
                  <li key={m.id}><Link to={`/learn/methods/${m.id}`} className="lrn-chip">{m.name}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <nav className="lrn-onward" aria-label="Beyond Learn">
        <Link to="/toolbox" className="lrn-onward-link tone-teal"><Wrench size={18} aria-hidden="true" /><span><strong>Toolbox</strong> Put an idea to work</span></Link>
        <Link to="/project" className="lrn-onward-link tone-primary"><Compass size={18} aria-hidden="true" /><span><strong>Project</strong> Seven steps, your own question</span></Link>
      </nav>
    </div>
  );
}
