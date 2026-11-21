import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookA, Lightbulb, Route, Shapes, Wrench, type LucideIcon } from 'lucide-react';
import { Link } from '../../app/router';
import { KINDS } from '../../domain/artefacts/kinds';
import type { ArtefactKind } from '../../domain/artefacts/types';
import { LEARN_PAGES, learnPath, type LearnPage } from '../../content/learn/ideas';
import { TOOL_META } from '../toolbox/toolMeta';

export const PAGE_ICON: Record<LearnPage['id'], LucideIcon> = { process: Route, methods: Shapes, ideas: Lightbulb, glossary: BookA };

/** Heading of a Learn page: back link, icon, title, one line, and optional controls on the right. */
export function LearnHead({ page, children }: { page: LearnPage['id']; children?: ReactNode }) {
  const i = LEARN_PAGES.findIndex((p) => p.id === page);
  const p = LEARN_PAGES[i];
  const Icon = PAGE_ICON[page];
  return (
    <header className={`lrn-head ${p.tone}`}>
      <Link to="/learn" className="lrn-back"><ArrowLeft size={14} aria-hidden="true" /> Learn</Link>
      <div className="lrn-head-main">
        <span className="lrn-head-icon" aria-hidden="true"><Icon size={28} /></span>
        <div className="lrn-head-text">
          <p className="lrn-eyebrow">{i + 1} of {LEARN_PAGES.length} · about {p.minutes} minutes</p>
          <h1>{p.title}</h1>
          <p>{p.line}</p>
        </div>
        {children && <div className="lrn-head-aside">{children}</div>}
      </div>
    </header>
  );
}

/** Previous and next Learn page; the last page leads on to the Toolbox. */
export function LearnPager({ page }: { page: LearnPage['id'] }) {
  const i = LEARN_PAGES.findIndex((p) => p.id === page);
  const prev = LEARN_PAGES[i - 1], next = LEARN_PAGES[i + 1];
  const NextIcon = next ? PAGE_ICON[next.id] : Wrench;
  return (
    <nav className="lrn-pager" aria-label="Learn pages">
      {prev ? (
        <Link to={learnPath(prev.id)} className={`lrn-pager-link is-prev ${prev.tone}`}>
          <ArrowLeft size={18} aria-hidden="true" />
          <span><small>Previous</small>{prev.title}</span>
        </Link>
      ) : (
        <Link to="/learn" className="lrn-pager-link is-prev"><ArrowLeft size={18} aria-hidden="true" /><span><small>Back to</small>Learn</span></Link>
      )}
      <Link to={next ? learnPath(next.id) : '/toolbox'} className={`lrn-pager-link is-next ${next ? next.tone : 'tone-teal'}`}>
        <span><small>Next</small>{next ? next.title : 'The Toolbox'}</span>
        <span className="lrn-pager-icon" aria-hidden="true"><NextIcon size={20} /></span>
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </nav>
  );
}

/** The button from a Learn idea or stop into its Toolbox tool. */
export function ToolLink({ kind, label }: { kind: ArtefactKind; label?: string }) {
  const meta = TOOL_META[kind];
  const Icon = meta.icon;
  return (
    <Link to={KINDS[kind].toolPath} className={`lrn-tool ${meta.tone}`}>
      <span className="lrn-tool-icon" aria-hidden="true"><Icon size={18} /></span>
      <span>{label ?? 'Open the tool'}<strong>{meta.name}</strong></span>
      <ArrowRight size={16} aria-hidden="true" className="lrn-tool-go" />
    </Link>
  );
}
