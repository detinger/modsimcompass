import { useEffect, useId, useMemo, useState } from 'react';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { Link } from '../../app/router';
import { GLOSSARY, termId, type GlossaryTerm } from '../../content/learn/glossary';
import { LEARN_PAGES } from '../../content/learn/ideas';
import { useReducedMotion } from './pictures/motion';
import { destination } from './links';
import { LearnHead, LearnPager } from './shared';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const TONE = LEARN_PAGES.find((p) => p.id === 'glossary')!.tone;
const letterId = (l: string) => `letter-${l.toLowerCase()}`;

/** The term named in the address (`#term-…`), kept in step with the address as it changes. */
function useTargetTerm(): string {
  const read = () => (typeof window === 'undefined' ? '' : decodeURIComponent(window.location.hash.slice(1)));
  const [hash, setHash] = useState(read);
  useEffect(() => {
    const on = () => setHash(read());
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => { window.removeEventListener('hashchange', on); window.removeEventListener('popstate', on); };
  }, []);
  return hash.startsWith('term-') ? hash : '';
}

/** `/learn/glossary`: every term in plain words, with a search box and an A–Z row. `#term-…` opens on one term. */
export default function GlossaryPage() {
  const [q, setQ] = useState('');
  const inputId = useId();
  const target = useTargetTerm();
  const reduced = useReducedMotion();
  const terms = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? GLOSSARY.filter((t) => t.term.toLowerCase().includes(s) || t.text.toLowerCase().includes(s)) : GLOSSARY;
  }, [q]);
  const groups = useMemo(() => {
    const m = new Map<string, GlossaryTerm[]>();
    for (const t of terms) { const k = t.term[0].toUpperCase(); m.set(k, [...(m.get(k) ?? []), t]); }
    return [...m.entries()];
  }, [terms]);
  const present = new Set(groups.map(([l]) => l));

  // A term named in the address is brought into view (and highlighted below), also when it arrives with the page.
  useEffect(() => {
    if (!target) return;
    const t = window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }), 40);
    return () => window.clearTimeout(t);
  }, [target, reduced]);

  return (
    <div className={`page lrn-page ${TONE}`}>
      <LearnHead page="glossary" />

      <div className="lrn-gloss-tools">
        <div className="lrn-search">
          <label htmlFor={inputId} className="sr-only">Find a term</label>
          <Search size={15} aria-hidden="true" />
          <input id={inputId} type="search" placeholder="Find a term" value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} />
        </div>
        <p className="lrn-glossary-count" aria-live="polite">
          {terms.length === GLOSSARY.length ? `${terms.length} terms` : terms.length ? `${terms.length} of ${GLOSSARY.length} terms` : 'No term matches.'}
          {q && <button type="button" className="btn small ghost" onClick={() => setQ('')}><X size={14} aria-hidden="true" /> Clear</button>}
        </p>
      </div>
      <nav className="lrn-az" aria-label="Terms by first letter">
        {LETTERS.map((l) => (present.has(l)
          ? <a key={l} href={`#${letterId(l)}`} aria-label={`Terms starting with ${l}`}>{l}</a>
          : <span key={l} aria-hidden="true">{l}</span>))}
      </nav>

      <div className="lrn-gloss">
        {groups.map(([letter, list]) => (
          <section key={letter} id={letterId(letter)} className="lrn-gloss-letter" aria-label={`Terms starting with ${letter}`}>
            <span className="lrn-letter-mark" aria-hidden="true">{letter}</span>
            <dl className="lrn-gloss-cards">
              {list.map((t) => {
                const id = termId(t.term);
                return (
                  <div key={t.term} id={id} className={`lrn-gloss-card${target === id ? ' is-target' : ''}`}>
                    <dt>
                      {t.term}
                      {t.to && <Link to={t.to} className="lrn-term-go" aria-label={`${t.term}: go to ${destination(t.to)}`} title={destination(t.to)}><ArrowUpRight size={14} aria-hidden="true" /></Link>}
                    </dt>
                    <dd>{t.text}</dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>

      <LearnPager page="glossary" />
    </div>
  );
}
