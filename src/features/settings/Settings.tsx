import { AlertTriangle, FileDown, HardDrive, Palette, ShieldCheck } from 'lucide-react';
import { useStore } from '../../app/store';
import { Segmented } from '../../ui/controls';
import type { ThemePref } from '../../persistence/prefs';
import '../../styles/tools.css';

export default function Settings() {
  const { prefs, setPrefs, repoKind } = useStore();
  const stored = repoKind === 'indexeddb';
  return (
    <div className="page settings">
      <div className="page-head">
        <h1>Settings</h1>
        <p className="lede">Saved in this browser.</p>
      </div>
      <div className="settings-cards">
        <section className="setting-card tone-purple" aria-labelledby="set-look">
          <header><span className="tile-icon" aria-hidden="true"><Palette size={20} /></span><h2 id="set-look">Appearance</h2></header>
          <Segmented<ThemePref> label="Theme" value={prefs.theme} onChange={(v) => setPrefs({ theme: v })}
            options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
          <label className="check"><input type="checkbox" checked={prefs.sidebarCollapsed} onChange={(e) => setPrefs({ sidebarCollapsed: e.target.checked })} /> Collapse the sidebar on wide screens</label>
          <p className="subtle-text">Motion follows your system’s reduced-motion setting.</p>
        </section>

        <section className="setting-card tone-orange" aria-labelledby="set-export">
          <header><span className="tile-icon" aria-hidden="true"><FileDown size={20} /></span><h2 id="set-export">Exports</h2></header>
          <label className="check"><input type="checkbox" checked={prefs.includeAuthor} onChange={(e) => setPrefs({ includeAuthor: e.target.checked })} /> Include my author name in exports by default</label>
          <p className="subtle-text">You can still change this each time you export.</p>
        </section>

        <section className="setting-card tone-teal" aria-labelledby="set-data">
          <header><span className="tile-icon" aria-hidden="true"><HardDrive size={20} /></span><h2 id="set-data">Storage</h2></header>
          <p className={`storage-state${stored ? '' : ' off'}`} role="status">
            {stored ? <ShieldCheck size={18} aria-hidden="true" /> : <AlertTriangle size={18} aria-hidden="true" />}
            {stored ? 'Saved in this browser' : 'Not saved: storage is unavailable'}
          </p>
          <p className="subtle-text">{stored
            ? 'Projects are kept in this browser’s local database. They do not appear in other browsers or devices.'
            : 'Work is kept only while this tab is open. Download a project file on Home to keep it.'}</p>
          <p className="subtle-text">No server, no accounts, no analytics.</p>
        </section>
      </div>
    </div>
  );
}
