import type { ReactNode } from 'react';
import { Link } from '../../app/router';
import { KINDS } from '../../domain/artefacts/kinds';
import type { ArtefactKind } from '../../domain/artefacts/types';
import { SvgFigure } from './SvgFigure';
import { TOOL_META } from './toolMeta';
import '../../styles/toolbox.css';

/** “21 Nov 2026”, or nothing when the text is not a date. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * One artefact as a card: what kind it is, its name and date, a picture or a few summary lines, and its actions.
 * Used by My artefacts, the Toolbox hub and the project steps. `figure` is the SVG string of `KINDS[kind].figure`.
 */
export function ArtefactCard({ kind, title, updatedAt, summary, figure, actions, to, status, dateLabel = 'Edited', headingLevel = 3 }: {
  kind: ArtefactKind; title: string; updatedAt: string; summary: string[]; figure?: string | null; actions?: ReactNode;
  /** Where the title leads, for example the tool with this artefact open. */
  to?: string;
  /** A badge beside the kind, for example “In this project” or “Changed since”. */
  status?: ReactNode;
  /** Word before the date: “Edited” for a Toolbox artefact, “Added” for a copy in a project. */
  dateLabel?: string;
  /** Level of the title heading: one below the heading the cards sit under. */
  headingLevel?: 2 | 3 | 4;
}) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  const meta = TOOL_META[kind];
  const Icon = meta.icon;
  const name = title.trim() || 'Untitled';
  const date = shortDate(updatedAt);
  const text = summary.filter((l) => l.trim()).slice(0, 5);
  return (
    <article className={`artefact-card ${meta.tone}`}>
      <header className="ac-head">
        <span className="ac-icon" aria-hidden="true"><Icon size={20} /></span>
        <div className="ac-title">
          <p className="ac-kind">{KINDS[kind].label}{status && <span className="ac-status">{status}</span>}</p>
          <Heading className="ac-name">{to ? <Link to={to}>{name}</Link> : name}</Heading>
          {date && <p className="ac-date">{dateLabel} {date}</p>}
        </div>
      </header>
      <SvgFigure svg={figure} label={`Picture of ${name}`} className="ac-figure" />
      {text.length > 0 && <ul className="ac-summary">{text.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      {actions && <div className="ac-actions">{actions}</div>}
    </article>
  );
}
