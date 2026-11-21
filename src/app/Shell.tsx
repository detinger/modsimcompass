import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronsLeft, ChevronsRight, CircleHelp, Compass, House, Loader2, Menu, Settings as SettingsIcon, Wrench, X,
} from 'lucide-react';
import { Link, useRouter } from './router';
import { useStore } from './store';
import { Dialog } from '../ui/controls';

export function BrandMark({ size = 20 }: { size?: number }) {
  // A frame holding two alternative representations: a small node graph and a stock bar.
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="17" height="17" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6" cy="7" r="1.8" fill="currentColor" />
      <circle cx="6" cy="13.5" r="1.8" fill="currentColor" />
      <path d="M6 8.8v2.9" stroke="currentColor" strokeWidth="1.3" />
      <line x1="10" y1="3.5" x2="10" y2="16.5" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <rect x="12.5" y="9" width="4" height="6" rx="0.8" fill="currentColor" />
      <rect x="12.5" y="5" width="4" height="3" rx="0.8" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

const CORE = [
  { to: '/', label: 'Home', icon: House },
  { to: '/project', label: 'Project', icon: Compass },
  { to: '/tools', label: 'Tools', icon: Wrench },
];
const UTILITY = [
  { to: '/help', label: 'Help', icon: CircleHelp },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function isCurrent(path: string, to: string) {
  const p = path.split(/[?#]/)[0];
  if (to === '/') return p === '/';
  if (to === '/project') return p.startsWith('/project') || p.startsWith('/example');
  return p === to || p.startsWith(`${to}/`);
}

function NavItem({ to, label, icon: Icon, count, onNav }: { to: string; label: string; icon: typeof Compass; count?: number; onNav: () => void }) {
  const { path } = useRouter();
  const cur = isCurrent(path, to);
  return (
    <Link to={to} className="nav-item" aria-current={cur ? 'page' : undefined} data-label={label} onClick={onNav}>
      <Icon size={18} aria-hidden="true" />
      <span className="nav-text">{label}</span>
      {count !== undefined && <span className="nav-num" aria-label={`${count} items`}>{count}</span>}
    </Link>
  );
}

function SaveIndicator() {
  const { saveStatus, saveError, repoKind } = useStore();
  if (saveStatus === 'failed') {
    return <span className="save-state failed" role="status"><AlertTriangle size={14} aria-hidden="true" />{repoKind === 'memory' ? 'Not saved on this device' : 'Save failed'}<span className="sr-only">{saveError}</span></span>;
  }
  if (saveStatus === 'saving') return <span className="save-state" role="status"><Loader2 size={14} aria-hidden="true" />Saving…</span>;
  if (saveStatus === 'saved') return <span className="save-state" role="status"><CheckCircle2 size={14} aria-hidden="true" />Saved on this device</span>;
  return <span className="save-state" role="status" />;
}

function ProjectSwitcher() {
  const { active, projects, activate } = useStore();
  const { navigate } = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="project-chip">
      <span className="subtle-text desktop-only">Project</span>
      <span className="title" title={active?.passport.identity.title}>{active ? active.passport.identity.title || 'Untitled project' : 'No active project'}</span>
      <button type="button" className="btn small" onClick={() => setOpen(true)} aria-haspopup="dialog">Switch</button>
      {open && (
        <Dialog title="Switch project" onClose={() => setOpen(false)} narrow
          actions={<><button className="btn" onClick={() => { setOpen(false); navigate('/'); }}>All projects</button></>}>
          {projects.length === 0 ? <p className="muted">No saved projects yet. Start with a question you want the model to answer.</p> : (
            <ul className="list-reset" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {projects.map((p) => (
                <li key={p.id}>
                  <button className={`option${active?.id === p.id ? ' chosen' : ''}`} style={{ width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit' }}
                    aria-current={active?.id === p.id ? 'true' : undefined}
                    onClick={async () => { await activate(p.id); setOpen(false); }}>
                    <span><strong>{p.passport.identity.title || 'Untitled project'}</strong><br /><span className="subtle-text">Modified {new Date(p.updatedAt).toLocaleString('en-GB')}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Dialog>
      )}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { prefs, setPrefs, saveError, saveStatus, conflict, resolveConflict, toasts, dismissToast } = useStore();
  const { path } = useRouter();
  const [drawer, setDrawer] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const closeDrawer = () => { if (drawer) { setDrawer(false); menuBtn.current?.focus(); } };
  useEffect(() => { setDrawer(false); }, [path]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDrawer(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
  const collapsed = prefs.sidebarCollapsed;
  return (
    <div className={`shell${collapsed ? ' collapsed' : ''}${drawer ? ' drawer-open' : ''}${prefs.readingMode ? ' reading-mode' : ''}`}>
      <a className="skip-link" href="#main">Skip to main content</a>
      <div className="drawer-backdrop" onClick={closeDrawer} aria-hidden="true" />
      <nav className="sidebar" aria-label="Primary">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" className="brand" aria-label="ModSim Essentials — Home">
            <span className="brand-mark"><BrandMark /></span>
            <span className="brand-text"><span className="brand-name">ModSim Essentials</span><br /><span className="brand-sub">Modelling and Simulation</span></span>
          </Link>
          <button className="btn ghost small mobile-only" onClick={closeDrawer} aria-label="Close navigation"><X size={16} /></button>
        </div>
        <div className="nav-group">{CORE.map((n) => <NavItem key={n.to} {...n} onNav={closeDrawer} />)}</div>
        <div className="nav-group sidebar-bottom">
          {UTILITY.map((n) => <NavItem key={n.to} {...n} onNav={closeDrawer} />)}
          <button type="button" className="nav-item desktop-only" data-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setPrefs({ sidebarCollapsed: !collapsed })}>
            {collapsed ? <ChevronsRight size={18} aria-hidden="true" /> : <ChevronsLeft size={18} aria-hidden="true" />}
            <span className="nav-text">Collapse</span>
          </button>
        </div>
      </nav>
      <div className="main-col">
        <header className="toolbar">
          <button ref={menuBtn} className="btn small mobile-only" onClick={() => setDrawer(true)} aria-expanded={drawer} aria-label="Open navigation"><Menu size={16} /> Menu</button>
          <ProjectSwitcher />
          <span className="spacer" />
          <SaveIndicator />
        </header>
        {saveStatus === 'failed' && saveError && !conflict && (
          <div className="no-print" style={{ padding: '8px 24px 0' }}>
            <div className="callout warning" role="alert"><AlertTriangle size={18} aria-hidden="true" /><div>{saveError} <Link to="/project/conclude?export=1">Download a project file</Link></div></div>
          </div>
        )}
        <main id="main" className="content" tabIndex={-1}>{children}</main>
      </div>
      {conflict && (
        <Dialog title="Another tab saved a newer revision" onClose={() => { /* must choose */ }} narrow mustChoose
          actions={<>
            <button className="btn" onClick={() => resolveConflict('use-theirs')}>Discard this tab’s edits and load the newer revision</button>
            <button className="btn" onClick={() => resolveConflict('keep-mine')}>Overwrite with this tab’s version</button>
            <button className="btn primary" onClick={() => resolveConflict('keep-both')}>Keep both versions</button>
          </>}>
          <p>The project was saved from another tab while you were editing here. Nothing has been overwritten.</p>
          <div className="side-by-side">
            <div className="card subtle"><h3>This tab</h3><p className="subtle-text">Based on revision {conflict.mine.projectRevision}</p><p>{conflict.mine.passport.identity.title}</p><p className="subtle-text">Question: {conflict.mine.passport.decision.question || 'Not yet specified'}</p></div>
            <div className="card subtle"><h3>Other tab</h3><p className="subtle-text">Revision {conflict.theirs.projectRevision}, saved {new Date(conflict.theirs.updatedAt).toLocaleString('en-GB')}</p><p>{conflict.theirs.passport.identity.title}</p><p className="subtle-text">Question: {conflict.theirs.passport.decision.question || 'Not yet specified'}</p></div>
          </div>
        </Dialog>
      )}
      <div className="toast-region" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast" role="status">
            {t.tone === 'error' || t.tone === 'warning' ? <AlertTriangle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
            <span style={{ flex: 1 }}>{t.text}</span>
            {t.action && <button className="btn small" onClick={() => { t.action!.run(); dismissToast(t.id); }}>{t.action.label}</button>}
            <button className="btn ghost small" onClick={() => dismissToast(t.id)} aria-label="Dismiss notification"><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
