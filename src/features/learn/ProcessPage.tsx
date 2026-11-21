import { useRef, useState, type KeyboardEvent } from 'react';
import { ArrowLeft, ArrowRight, Calculator, CircleCheck, Compass, Flag, FlaskConical, PencilLine, Play, Repeat, Scan, Shapes, ShieldCheck, Sigma, SlidersHorizontal, Target, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Link } from '../../app/router';
import { STEP_BY_ID, type StepId } from '../../domain/passport/compass';
import { MODEL_KINDS, PROCESS_LOOP, PROCESS_STOPS, type ModelKind } from '../../content/learn/process';
import { FigureCard } from '../../ui/playful';
import CompassView from '../../ui/diagrams/CompassView';
import { useReducedMotion } from './pictures/motion';
import { LearnHead, LearnPager, ToolLink } from './shared';

/** Colour and icon of each stop; the same pairs as the Project section, so a stop looks alike everywhere. */
const STOP_LOOK: Record<StepId, { tone: string; icon: LucideIcon }> = {
  frame: { tone: 'tone-blue', icon: Target },
  scope: { tone: 'tone-teal', icon: Scan },
  method: { tone: 'tone-purple', icon: Shapes },
  inputs: { tone: 'tone-brown', icon: SlidersHorizontal },
  evaluation: { tone: 'tone-primary', icon: ShieldCheck },
  experiment: { tone: 'tone-orange', icon: FlaskConical },
  conclude: { tone: 'tone-green', icon: Flag },
};

/** A glyph for each kind of model: run it, estimate it, solve it. */
const KIND_ICON: Record<ModelKind, LucideIcon> = { simulation: Play, statistical: Sigma, analytic: Calculator };

/** `/learn/process`: the project compass is the map; each of its seven stops opens a short card. */
export default function ProcessPage() {
  const [sel, setSel] = useState(0);
  /** The kind of model whose line is shown on every card; it stays chosen from stop to stop. */
  const [kind, setKind] = useState<ModelKind>('simulation');
  const [said, setSaid] = useState('');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const card = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const stop = PROCESS_STOPS[sel];
  const step = STEP_BY_ID[stop.step];
  const look = STOP_LOOK[stop.step];
  const Icon = look.icon;
  const prev = PROCESS_STOPS[sel - 1], next = PROCESS_STOPS[sel + 1];

  const choose = (i: number, focus = false) => {
    setSel(i);
    if (focus) tabs.current[i]?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = PROCESS_STOPS.length - 1;
    const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? Math.min(last, sel + 1)
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? Math.max(0, sel - 1)
        : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (to === null) return;
    e.preventDefault();
    choose(to, true);
  };
  /** A stop chosen on the compass diagram opens its card below. */
  const onMap = (id: StepId) => {
    const i = PROCESS_STOPS.findIndex((s) => s.step === id);
    if (i < 0) return;
    setSel(i);
    setSaid(`Stop ${i + 1}, ${STEP_BY_ID[id].title}, opened below.`);
    const el = card.current;
    if (el && el.getBoundingClientRect().top > window.innerHeight - 160) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
  };

  return (
    <div className="page lrn-page">
      <LearnHead page="process" />

      <div className="lrn-map">
        <FigureCard id="compass-journey" caption="Select a stop to open its card." stage={<CompassView onSelect={onMap} selected={stop.step} />} />
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>

      <section className="lrn-stops" aria-labelledby="lrn-stops-h">
        <h2 id="lrn-stops-h" className="sr-only">The seven stops</h2>
        <div className="lrn-stop-tabs" role="tablist" aria-label="Stops" onKeyDown={onKey}>
          {PROCESS_STOPS.map((s, i) => {
            const st = STEP_BY_ID[s.step], L = STOP_LOOK[s.step];
            return (
              <button key={s.step} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab" id={`lrn-stop-tab-${s.step}`}
                aria-selected={i === sel} aria-controls="lrn-stop-card" tabIndex={i === sel ? 0 : -1}
                className={`lrn-stop-tab ${L.tone}`} onClick={() => choose(i)}>
                <span className="lrn-stop-dot">{st.number}</span>
                <span className="lrn-stop-name">{st.title}</span>
              </button>
            );
          })}
        </div>

        <div ref={card} id="lrn-stop-card" role="tabpanel" aria-labelledby={`lrn-stop-tab-${stop.step}`} className={`lrn-stop-card ${look.tone}`}>
          <div className="lrn-stop-side" aria-hidden="true">
            <span className="lrn-stop-big">{step.number}</span>
            <Icon size={30} />
          </div>
          <div className="lrn-stop-body">
            <h3>{step.title}</h3>
            <p className="lrn-stop-q">{step.short}</p>
            <div className="lrn-stop-pair">
              <div className="lrn-stop-do">
                <span className="lrn-stop-label"><CircleCheck size={16} aria-hidden="true" /> What you do</span>
                <p>{stop.does}</p>
              </div>
              <div className="lrn-stop-wrong">
                <span className="lrn-stop-label"><TriangleAlert size={16} aria-hidden="true" /> What often goes wrong</span>
                <p>{stop.wrong}</p>
              </div>
            </div>
            <div className="lrn-kinds">
              <span className="lrn-kinds-label" id="lrn-kinds-label">By kind of model</span>
              <span className="lrn-kinds-chips" role="group" aria-labelledby="lrn-kinds-label">
                {MODEL_KINDS.map((k) => {
                  const KIcon = KIND_ICON[k.id];
                  return (
                    <button key={k.id} type="button" className={`lrn-kind is-${k.id}`} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                      <KIcon size={14} aria-hidden="true" /> {k.label}
                    </button>
                  );
                })}
              </span>
              <p className="lrn-kinds-line" aria-live="polite">{stop.byKind[kind]}</p>
            </div>
            <div className="lrn-stop-links">
              {stop.tool
                ? <ToolLink kind={stop.tool} />
                : <span className="lrn-stop-notool"><PencilLine size={16} aria-hidden="true" /> No tool here: you write this stop in the project.</span>}
              <Link to={`/project/${stop.step}`} className="lrn-step-link">
                <Compass size={16} aria-hidden="true" /> Project step {step.number}<ArrowRight size={14} aria-hidden="true" />
              </Link>
              <span className="lrn-stop-nav">
                <button type="button" className="btn small ghost" disabled={!prev} onClick={() => choose(sel - 1, sel - 1 === 0)}
                  aria-label={prev ? `Previous stop ${STEP_BY_ID[prev.step].number}: ${STEP_BY_ID[prev.step].title}` : 'No previous stop'}>
                  <ArrowLeft size={14} aria-hidden="true" /> {prev ? STEP_BY_ID[prev.step].number : ''}
                </button>
                <button type="button" className="btn small ghost" disabled={!next} onClick={() => choose(sel + 1, sel + 1 === PROCESS_STOPS.length - 1)}
                  aria-label={next ? `Next stop ${STEP_BY_ID[next.step].number}: ${STEP_BY_ID[next.step].title}` : 'No next stop'}>
                  {next ? STEP_BY_ID[next.step].number : ''} <ArrowRight size={14} aria-hidden="true" />
                </button>
              </span>
            </div>
          </div>
        </div>
      </section>

      <aside className="lrn-loop" aria-labelledby="lrn-loop-h">
        <span className="lrn-loop-icon" aria-hidden="true"><Repeat size={24} /></span>
        <div>
          <h2 id="lrn-loop-h">{PROCESS_LOOP.title}</h2>
          <p>{PROCESS_LOOP.text}</p>
        </div>
        <div className="lrn-loop-jump">
          <button type="button" className="btn small" onClick={() => { choose(PROCESS_STOPS.findIndex((s) => s.step === PROCESS_LOOP.to)); card.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' }); }}>
            Back to stop {STEP_BY_ID[PROCESS_LOOP.to].number}
          </button>
        </div>
      </aside>

      <LearnPager page="process" />
    </div>
  );
}
