import type { ReactNode } from 'react';
import { ArrowLeft, Plus, Send } from 'lucide-react';
import { Link } from '../../app/router';
import { useStore } from '../../app/store';
import { TOOLS, toolById, type ToolId } from './registry';
import '../../styles/tools.css';

/** The one frame every tool shares: back link, icon, title, tagline, then the tool, then the other tools. */
export function ToolFrame({ id, wide = true, aside, children }: { id: ToolId; wide?: boolean; aside?: ReactNode; children: ReactNode }) {
  const tool = toolById(id)!;
  const Icon = tool.icon;
  return (
    <div className={`page tool-page${wide ? ' wide' : ''}`}>
      <header className={`tool-head ${tool.tone}`}>
        <Link to="/tools" className="tool-back"><ArrowLeft size={14} aria-hidden="true" /> All tools</Link>
        <div className="tool-title">
          <span className="tool-icon" aria-hidden="true"><Icon size={26} /></span>
          <div className="tool-name">
            <h1>{tool.title}</h1>
            <p>{tool.tagline}</p>
          </div>
          {aside && <div className="tool-aside">{aside}</div>}
        </div>
      </header>
      {children}
      <nav className="more-tools" aria-label="More tools">
        {TOOLS.filter((t) => t.id !== id).map((t) => {
          const I = t.icon;
          return <Link key={t.id} to={`/tools/${t.id}`} className={`more-tool ${t.tone}`}><I size={15} aria-hidden="true" /> {t.short}</Link>;
        })}
      </nav>
    </div>
  );
}

/**
 * The consistent “Send to project” area. With no open project it offers to start one,
 * so nothing is ever sent to a project the student did not choose.
 */
export function SendArea({ what, children }: { what?: ReactNode; children: ReactNode }) {
  const { active, createAndActivate } = useStore();
  return (
    <section className="send-area" aria-label="Send to project">
      <div className="send-head">
        <span className="send-icon" aria-hidden="true"><Send size={18} /></span>
        <div>
          <h2>Send to project</h2>
          <p>{active ? <>To <strong>{active.passport.identity.title || 'Untitled project'}</strong></> : 'No project is open yet.'}</p>
        </div>
      </div>
      {active ? (
        <>
          {what && <div className="send-what">{what}</div>}
          {children}
        </>
      ) : (
        <div className="btn-row">
          <button type="button" className="btn primary" onClick={() => createAndActivate({ title: 'Untitled project' })}><Plus size={16} aria-hidden="true" /> Start a project</button>
          <Link to="/">or open one on Home</Link>
        </div>
      )}
    </section>
  );
}
