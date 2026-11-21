import { useEffect, useRef, useState } from 'react';
import { ChevronDown, CircleSlash, ExternalLink, Pause, Play, Puzzle, TriangleAlert } from 'lucide-react';
import { useRouter } from '../../app/router';
import { FAMILIES, FAMILY_TONE, METHODS, appForMethod, type MethodId, type MethodRecord } from '../../domain/methods/registry';
import { FAMILY_ORDER } from '../../content/diagrams/specs';
import { METHOD_PICTURE_TEXT } from '../../content/learn/pictures';
import { FigureCard } from '../../ui/playful';
import { MethodPicture } from './pictures';
import { MotionProvider, useReducedMotion } from './pictures/motion';
import { LearnHead, LearnPager, ToolLink } from './shared';

const famId = (f: string) => `fam-${f}`;
const cardId = (id: string) => `method-${id}`;
/** Brings a card into view. `focus` moves the keyboard to its button, after a choice in the table. */
const scrollToCard = (id: string, smooth: boolean, focus: boolean) => {
  const el = document.getElementById(cardId(id));
  el?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  if (focus) el?.querySelector<HTMLElement>('.lrn-more')?.focus({ preventScroll: true });
};

function AppLink({ m }: { m: MethodRecord }) {
  const app = appForMethod(m.id);
  if (!app.url) return <span className="lrn-noapp">App link not configured</span>;
  return (
    <a className="btn small lrn-app" href={app.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${app.name} (opens in a new tab)`}>
      Open {app.name} <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}

function MethodCard({ m, open, onToggle }: { m: MethodRecord; open: boolean; onToggle: () => void }) {
  const more = `${cardId(m.id)}-more`;
  return (
    <article id={cardId(m.id)} className={`lrn-method ${FAMILY_TONE[m.family]}${open ? ' is-open' : ''}`} aria-labelledby={`${cardId(m.id)}-h`}>
      <div className="lrn-method-pic"><MethodPicture id={m.id} /></div>
      <div className="lrn-method-body">
        <h3 id={`${cardId(m.id)}-h`}>{m.name}</h3>
        <p className="lrn-method-purpose">{m.purpose}</p>
        <p className="lrn-method-example"><span className="sr-only">Example question: </span>“{m.exampleQuestion}”</p>
        <div className="lrn-method-actions">
          <button type="button" className="btn small lrn-more" aria-expanded={open} aria-controls={more} onClick={onToggle}>
            <ChevronDown size={15} aria-hidden="true" className="lrn-more-caret" /> {open ? 'Less' : 'Needs, limits, pitfalls'}
          </button>
          <AppLink m={m} />
        </div>
        <div id={more} className="lrn-method-more" hidden={!open}>
          <dl className="lrn-facts">
            <div className="is-needs"><dt><Puzzle size={15} aria-hidden="true" /> Needs</dt>{m.dataNeeds.map((t) => <dd key={t}>{t}</dd>)}</div>
            <div className="is-omits"><dt><CircleSlash size={15} aria-hidden="true" /> Leaves out</dt>{m.omits.map((t) => <dd key={t}>{t}</dd>)}</div>
            <div className="is-fails"><dt><TriangleAlert size={15} aria-hidden="true" /> Fails when</dt>{m.failureConditions.map((t) => <dd key={t}>{t}</dd>)}</div>
          </dl>
          <p className="lrn-method-shape"><span>Time: {m.time}</span><span>Randomness: {m.randomness}</span><span>Level: {m.aggregation}</span></p>
          <details className="lrn-astext"><summary>The picture as text</summary><p>{METHOD_PICTURE_TEXT[m.id]}</p></details>
        </div>
      </div>
    </article>
  );
}

/** `/learn/methods[/:id]`: the four families, one card per method, and all eleven side by side. */
export default function MethodsPage({ open }: { open?: string }) {
  const { navigate } = useRouter();
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(true);
  /** Set when a card is opened from outside its own button (the address or the table): it is then scrolled into view. */
  const reveal = useRef<string | undefined>(open);

  const first = useRef(true);
  useEffect(() => {
    const id = reveal.current;
    if (!id || id !== open) return;
    // On arrival the jump is instant; scroll anchoring then keeps the card in place while the diagram above loads.
    // The refs are cleared only once the jump has happened, so a repeated effect (development mode) still makes it.
    const arrival = first.current;
    const t = window.setTimeout(() => {
      reveal.current = undefined;
      first.current = false;
      scrollToCard(id, !arrival && !reduced, !arrival);
    }, 40);
    return () => window.clearTimeout(t);
  }, [open, reduced]);

  const setOpen = (id: MethodId | null, scroll = false) => {
    first.current = false;
    if (scroll && id && id === open) { scrollToCard(id, !reduced, true); return; }
    reveal.current = scroll && id ? id : undefined;
    navigate(id ? `/learn/methods/${id}` : '/learn/methods', { replace: true, scroll: false });
  };

  return (
    <div className="page lrn-page">
      <LearnHead page="methods">
        {!reduced && (
          <button type="button" className="btn small lrn-pause" aria-pressed={!playing} onClick={() => setPlaying((p) => !p)}>
            {/* One fixed name; the pressed state says whether the pictures are paused. The icon shows what a press does next. */}
            {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />} Pause pictures
          </button>
        )}
      </LearnHead>

      <FigureCard id="method-families" />
      <nav className="lrn-jump" aria-label="Families on this page">
        {FAMILY_ORDER.map((f) => <a key={f} href={`#${famId(f)}`} className={`lrn-chip ${FAMILY_TONE[f]}`}>{FAMILIES[f].label}</a>)}
        <a href="#methods-table" className="lrn-chip">All eleven side by side</a>
      </nav>

      <MotionProvider playing={playing}>
        {FAMILY_ORDER.map((f) => (
          <section key={f} id={famId(f)} className={`lrn-family ${FAMILY_TONE[f]}`} aria-labelledby={`${famId(f)}-h`}>
            <div className="lrn-family-head">
              <h2 id={`${famId(f)}-h`}>{FAMILIES[f].label}</h2>
              <p>{FAMILIES[f].question}</p>
            </div>
            <div className="lrn-methods">
              {METHODS.filter((m) => m.family === f).map((m) => (
                <MethodCard key={m.id} m={m} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} />
              ))}
            </div>
          </section>
        ))}
      </MotionProvider>

      <section className="lrn-table-section" aria-labelledby="methods-table">
        <h2 id="methods-table">All eleven side by side</h2>
        <div className="table-wrap lrn-table-wrap" tabIndex={0} role="region" aria-label="All eleven methods side by side (scrolls sideways)">
          <table className="data lrn-table">
            <thead>
              <tr><th scope="col">Method</th><th scope="col">For</th><th scope="col">Time</th><th scope="col">Randomness</th><th scope="col">Level</th><th scope="col">Leaves out</th></tr>
            </thead>
            <tbody>
              {METHODS.map((m) => (
                <tr key={m.id} className={FAMILY_TONE[m.family]}>
                  <th scope="row">
                    <button type="button" className="lrn-rowbtn" onClick={() => setOpen(m.id, true)}>{m.name}</button>
                    <span className="lrn-rowfam">{FAMILIES[m.family].label}</span>
                  </th>
                  <td>{m.purpose}</td>
                  <td>{m.time}</td>
                  <td>{m.randomness}</td>
                  <td>{m.aggregation}</td>
                  <td>{m.omits.join('; ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="lrn-after-table">
          <p>Not sure which fits your question?</p>
          <ToolLink kind="method-choice" label="Find out with the" />
        </div>
      </section>

      <LearnPager page="methods" />
    </div>
  );
}
