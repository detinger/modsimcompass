import { useEffect } from 'react';
import { BookA } from 'lucide-react';
import { Link } from '../../app/router';
import { KINDS } from '../../domain/artefacts/kinds';
import { STEP_BY_ID } from '../../domain/passport/compass';
import { KEY_IDEAS, type KeyIdea } from '../../content/learn/ideas';
import { glossaryHref } from '../../content/learn/glossary';
import { FigureCard } from '../../ui/playful';
import { TOOL_META } from '../toolbox/toolMeta';
import { UncertaintyFigure } from './pictures/uncertainty';
import { LearnHead, LearnPager, ToolLink } from './shared';

const ideaId = (i: KeyIdea) => `idea-${i.id}`;

function Idea({ idea, n }: { idea: KeyIdea; n: number }) {
  const step = STEP_BY_ID[KINDS[idea.tool].step];
  return (
    <section id={ideaId(idea)} className={`lrn-idea ${TOOL_META[idea.tool].tone}`} aria-labelledby={`${ideaId(idea)}-h`}>
      <div className="lrn-idea-text">
        <span className="lrn-idea-num" aria-hidden="true">{n}</span>
        <h2 id={`${ideaId(idea)}-h`}>{idea.title}</h2>
        <ul className="lrn-idea-lines">{idea.lines.map((l) => <li key={l}>{l}</li>)}</ul>
        <ToolLink kind={idea.tool} />
        <p className="lrn-idea-step">Project step {step.number}: <Link to={`/project/${step.id}`}>{step.title}</Link></p>
        <p className="lrn-idea-words">
          <BookA size={14} aria-hidden="true" /><span className="sr-only">In the glossary:</span>
          {idea.terms.map((t) => <Link key={t} to={glossaryHref(t)} className="lrn-word">{t}</Link>)}
        </p>
      </div>
      <div className="lrn-idea-figure">
        {idea.figure === 'uncertainty' ? <UncertaintyFigure /> : <FigureCard id={idea.figure} />}
      </div>
    </section>
  );
}

/** `/learn/ideas`: four key ideas, each with its picture, a few lines, its tool and its words in the glossary. */
export default function IdeasPage() {
  // An address with #idea-… arrives before the section exists; scroll once it does.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const t = window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'auto', block: 'start' }), 30);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="page lrn-page">
      <LearnHead page="ideas" />
      <nav className="lrn-jump" aria-label="On this page">
        {KEY_IDEAS.map((i, k) => <a key={i.id} href={`#${ideaId(i)}`} className={`lrn-chip ${TOOL_META[i.tool].tone}`}><span className="lrn-chip-num">{k + 1}</span>{i.title}</a>)}
      </nav>
      {KEY_IDEAS.map((idea, i) => <Idea key={idea.id} idea={idea} n={i + 1} />)}
      <LearnPager page="ideas" />
    </div>
  );
}
