import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle, BookOpen, CheckCircle2, ChevronsLeft, ChevronsRight, Compass, House, Loader2, Menu, Monitor, Moon, Sun, Wrench, X,
} from 'lucide-react';
import { Link, useRouter } from './router';
import { useStore } from './store';
import { Dialog } from '../ui/controls';
import { KINDS, TOOL_ORDER } from '../domain/artefacts/kinds';
import { STEP_LABEL, STEPS } from '../domain/passport/compass';
import type { ThemePref } from '../persistence/prefs';
import { TOOL_META } from '../features/toolbox/toolMeta';

/**
 * The app's mark: a compass with a blue ring, a four-point star and an orange needle pointing north-east, in the
 * family of the Home dial and the compass wheel. `public/favicon.svg` is the same drawing with fixed colours.
 */
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg className="brand-compass" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle className="bc-disc" cx="16" cy="16" r="14" strokeWidth="2.6" />
      <path className="bc-star" d="M16,4.4 L18,16 L16,27.6 L14,16 Z M4.4,16 L16,14 L27.6,16 L16,18 Z" />
      <path className="bc-tail" d="M9.92,22.08 L19.04,19.04 L12.96,12.96 Z" />
      <path className="bc-north" d="M24.70,7.30 L19.04,19.04 L16.00,16.00 Z" />
      <path className="bc-north-lit" d="M24.70,7.30 L12.96,12.96 L16.00,16.00 Z" />
      <circle className="bc-hub" cx="16" cy="16" r="1.5" strokeWidth="1.1" />
    </svg>
  );
}

/** The menu (docs/TOOLBOX-SPEC.md §1, §4.3): four sections, each with its pages always in view on a desktop. */
interface SubLink { to: string; label: string; /** Step number, shown before the label. */ num?: number; /** Current only on exactly this address. */ exact?: boolean }
interface Section { to: string; label: string; icon: typeof Compass; links: SubLink[]; /** Other address prefixes that belong to the section. */ also?: string[] }

const SECTIONS: Section[] = [
  { to: '/', label: 'Home', icon: House, links: [] },
  { to: '/learn', label: 'Learn', icon: BookOpen, links: [
    { to: '/learn/process', label: 'Process' }, { to: '/learn/methods', label: 'Methods' }, { to: '/learn/ideas', label: 'Key ideas' }, { to: '/learn/glossary', label: 'Glossary' },
  ] },
  { to: '/toolbox', label: 'Toolbox', icon: Wrench, links: [
    ...TOOL_ORDER.map((k) => ({ to: KINDS[k].toolPath, label: TOOL_META[k].short })),
    { to: '/toolbox/artefacts', label: 'My artefacts' },
  ] },
  { to: '/project', label: 'Project', icon: Compass, also: ['/example'], links: [
    { to: '/project', label: 'Overview', exact: true },
    ...STEPS.map((s) => ({ to: `/project/${s.id}`, label: STEP_LABEL[s.id], num: s.number })),
    { to: '/project/checkpoints', label: 'Checkpoints' },
  ] },
];
const THEMES: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun }, { value: 'dark', label: 'Dark', icon: Moon }, { value: 'system', label: 'System', icon: Monitor },
];

/** The only setting: light, dark, or follow the system. A narrow (collapsed) sidebar shows one button that cycles. */
function ThemeSwitch() {
  const { prefs, setPrefs } = useStore();
  const i = Math.max(0, THEMES.findIndex((t) => t.value === prefs.theme));
  const cur = THEMES[i], next = THEMES[(i + 1) % THEMES.length], CurIcon = cur.icon;
  return (
    <>
      <div className="theme-switch" role="group" aria-label="Theme">
        {THEMES.map((t) => (
          <button key={t.value} type="button" aria-pressed={prefs.theme === t.value} aria-label={t.label} title={t.label} onClick={() => setPrefs({ theme: t.value })}>
            <t.icon size={15} aria-hidden="true" />
          </button>
        ))}
      </div>
      <button type="button" className="nav-item theme-cycle" data-label={`Theme: ${cur.label}`} aria-label={`Theme: ${cur.label}. Switch to ${next.label}`} onClick={() => setPrefs({ theme: next.value })}>
        <CurIcon size={18} aria-hidden="true" />
      </button>
    </>
  );
}

const clean = (path: string) => path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
const under = (p: string, to: string) => (to === '/' ? p === '/' : p === to || p.startsWith(`${to}/`));
const onLink = (p: string, l: SubLink) => (l.exact ? p === l.to : under(p, l.to));

/** A section and its pages. The section itself is the current page only when none of its pages is. */
function NavSection({ section, onNav }: { section: Section; onNav: () => void }) {
  const { path } = useRouter();
  const p = clean(path);
  const Icon = section.icon;
  const inside = under(p, section.to) || (section.also ?? []).some((a) => under(p, a));
  const onPage = section.links.some((l) => onLink(p, l));
  return (
    <li className="nav-section">
      <Link to={section.to} className={`nav-item${inside ? ' within' : ''}`} aria-current={inside && !onPage && p === section.to ? 'page' : undefined} data-label={section.label} onClick={onNav}>
        <Icon size={18} aria-hidden="true" />
        <span className="nav-text">{section.label}</span>
      </Link>
      {section.links.length > 0 && (
        <ul className="nav-sub" aria-label={`${section.label} pages`}>
          {section.links.map((l) => (
            <li key={`${l.to}-${l.label}`}>
              <Link to={l.to} className="nav-sub-item" aria-current={onLink(p, l) ? 'page' : undefined} onClick={onNav}>
                {l.num !== undefined && <span className="nav-sub-num" aria-hidden="true">{l.num}</span>}
                <span>{l.num !== undefined && <span className="sr-only">Step {l.num}: </span>}{l.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function SaveIndicator() {
  const { saveStatus, saveError, repoKind } = useStore();
  if (saveStatus === 'failed') {
    return <span className="save-state failed" role="status"><AlertTriangle size={14} aria-hidden="true" />{repoKind === 'memory' ? 'Not saved on this device' : 'Save failed'}<span className="sr-only">{saveError}</span></span>;
  }
  if (saveStatus === 'saving') return <span className="save-state" role="status"><Loader2 size={14} aria-hidden="true" /><span className="save-text">Saving…</span></span>;
  if (saveStatus === 'saved') return <span className="save-state" role="status"><CheckCircle2 size={14} aria-hidden="true" /><span className="save-text">Saved on this device</span></span>;
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
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden="true"><BrandMark /></span>
            <span className="brand-text"><span className="brand-name">ModSimCompass</span><br /><span className="brand-sub">Modelling and Simulation</span></span>
            <span className="sr-only">, Home</span>
          </Link>
          <button className="btn ghost small mobile-only" onClick={closeDrawer} aria-label="Close navigation"><X size={16} /></button>
        </div>
        <ul className="nav-sections">{SECTIONS.map((sec) => <NavSection key={sec.to} section={sec} onNav={closeDrawer} />)}</ul>
        <div className="nav-group sidebar-bottom">
          <ThemeSwitch />
          <button type="button" className="nav-item nav-collapse desktop-only" data-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? undefined : 'Collapse sidebar'} onClick={() => setPrefs({ sidebarCollapsed: !collapsed })}>
            {collapsed ? <ChevronsRight size={18} aria-hidden="true" /> : <ChevronsLeft size={18} aria-hidden="true" />}
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
