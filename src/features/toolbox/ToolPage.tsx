import { useEffect, useId, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CircleCheck, Copy, Download, FileJson, FolderOpen, Info, LayoutGrid, Plus, TriangleAlert } from 'lucide-react';
import { useAddToProject, useArtefacts, type ArtefactEditor } from '../../app/artefacts';
import { Link, useRouter } from '../../app/router';
import { useStore } from '../../app/store';
import { ARTEFACT_FILE_SUFFIX, artefactJson } from '../../domain/artefacts/file';
import { kindDef, KINDS } from '../../domain/artefacts/kinds';
import type { Artefact, ArtefactKind } from '../../domain/artefacts/types';
import { isStepId, STEP_BY_ID, STEP_LABEL, type StepId } from '../../domain/passport/compass';
import { newId } from '../../domain/passport/schema';
import { slugify } from '../../exports/projectFile';
import { downloadFile } from '../../ui/controls';
import { shortDate } from './ArtefactCard';
import { MenuButton, type MenuItem } from './Menu';
import { TOOL_META } from './toolMeta';
import '../../styles/toolbox.css';

export interface ToolExport { id: string; label: string; run: () => void }

/** The short step names of the menu, for “Back to …”. */

/** `?from=scope`: the tool was opened from that project step, which gets a way back. */
export function fromStep(path: string): StepId | null {
  const from = new URLSearchParams(path.split('?')[1] ?? '').get('from') ?? '';
  return isStepId(from) ? from : null;
}

const INTRO_SEEN = 'modsim-essentials.toolbox.intro-seen';
function introSeen(kind: ArtefactKind): boolean {
  try { return window.localStorage.getItem(`${INTRO_SEEN}.${kind}`) === '1'; } catch { return false; }
}

/** Saves the artefact as its own file, which My artefacts can import again. */
export function downloadArtefact(a: Artefact): void {
  // A name with no letters or digits falls back to the kind, for example “conceptual-model.artefact.json”.
  const name = /[a-z0-9]/i.test(a.title.normalize('NFKD')) ? slugify(a.title) : slugify(KINDS[a.kind].label);
  downloadFile(`${name}${ARTEFACT_FILE_SUFFIX}`, artefactJson(a), 'application/json');
}

/**
 * The frame every tool shares (docs/TOOLBOX-SPEC.md §4.1), kept slim so the tool gets the height: one line with the tool
 * name, purpose and an About button; one line for the artefact; the introduction (open on the first visit); the tool.
 */
export function ToolPage<K extends ArtefactKind>({ kind, editor, exports = [], intro, children }: {
  kind: K; editor: ArtefactEditor<K>; /** The tool's own exports; “Artefact file” is added after them. */ exports?: ToolExport[];
  intro?: ReactNode; children: ReactNode;
}) {
  const meta = TOOL_META[kind], def = kindDef(kind);
  const Icon = meta.icon;
  const { artefact, persisted, saveState } = editor;
  const anyArtefact = artefact as Artefact;
  const { ofKind, put } = useArtefacts();
  const { active, toast } = useStore();
  const { state, add } = useAddToProject();
  const { navigate, path } = useRouter();
  const from = fromStep(path);
  const titleId = useId(), hintId = useId(), aboutId = useId();

  // The introduction is open the first time a tool is visited and folded away after that.
  const [introOpen, setIntroOpen] = useState(() => !introSeen(kind));
  useEffect(() => { try { window.localStorage.setItem(`${INTRO_SEEN}.${kind}`, '1'); } catch { /* storage unavailable: it simply stays open */ } }, [kind]);

  const saved = ofKind(kind);
  const openItems: MenuItem[] = [
    ...saved.slice(0, 20).map((a) => ({
      id: a.id, label: a.title.trim() || 'Untitled', detail: shortDate(a.updatedAt), current: persisted && a.id === artefact.id, run: () => editor.open(a.id),
    })),
    { id: 'all', label: 'My artefacts', detail: 'Everything you made', icon: LayoutGrid, divider: true, run: () => navigate('/toolbox/artefacts') },
  ];
  const exportItems: MenuItem[] = [
    ...exports.map((x) => ({ id: x.id, label: x.label, icon: Download, run: x.run })),
    { id: 'artefact-file', label: 'Artefact file', detail: 'Can be imported again', icon: FileJson, run: () => downloadArtefact(anyArtefact) },
  ];

  const duplicate = async () => {
    const t = new Date().toISOString();
    const copy = { ...structuredClone(anyArtefact), id: newId('art'), title: `${artefact.title} (copy)`.slice(0, 200), createdAt: t, updatedAt: t, revision: 1 } as Artefact;
    try { await put(copy); } catch { toast('The copy could not be saved on this device.', 'error'); return; }
    editor.open(copy.id);
    toast(`Now editing “${copy.title}”.`, 'success');
  };

  const empty = def.isEmpty(artefact.data);
  const where = state(anyArtefact);
  const step = STEP_BY_ID[KINDS[kind].step];
  const projectName = active ? active.passport.identity.title.trim() || 'Untitled project' : '';
  const stateText = !persisted ? 'New. Not saved yet' : saveState === 'saving' ? 'Saving…' : saveState === 'failed' ? 'Could not be saved' : 'Saved on this device';

  return (
    <div className={`page wide tbx-page ${meta.tone}`}>
      <header className="tbx-head">
        <span className="tbx-crumbs">
          {from && <Link to={`/project/${from}`} className="tbx-back tbx-back-step"><ArrowLeft size={14} aria-hidden="true" /> Back to {STEP_LABEL[from]}</Link>}
          <Link to="/toolbox" className="tbx-back">{!from && <ArrowLeft size={14} aria-hidden="true" />} Toolbox</Link>
        </span>
        <span className="tbx-head-icon" aria-hidden="true"><Icon size={18} /></span>
        <h1>{meta.name}</h1>
        <p className="tbx-head-tag">{meta.tagline}</p>
        {intro && (
          <button type="button" className="btn small ghost tbx-about" aria-expanded={introOpen} aria-controls={introOpen ? aboutId : undefined}
            onClick={() => setIntroOpen((o) => !o)}>
            <Info size={15} aria-hidden="true" /> <span className="tbx-about-text">About this tool</span>
          </button>
        )}
      </header>

      {/* One line: the name (the header already names the kind, so its label is for screen readers), save state, actions. */}
      <section className="artefact-bar" aria-label="This artefact">
        <div className="ab-name">
          <label htmlFor={titleId} className="sr-only">{def.label} name</label>
          <input id={titleId} className="ab-title" type="text" value={artefact.title} maxLength={200} placeholder="Name this artefact" autoComplete="off"
            onChange={(e) => editor.rename(e.target.value)} />
          <span className={`ab-state${saveState === 'failed' ? ' failed' : ''}`} role="status">
            {saveState === 'failed' && <TriangleAlert size={13} aria-hidden="true" />}{stateText}
          </span>
        </div>
        <div className="ab-actions">
          <button type="button" className="btn small" onClick={editor.startNew}><Plus size={15} aria-hidden="true" /> New</button>
          <MenuButton label="Open" icon={FolderOpen} items={openItems} className="btn small" empty={saved.length === 0 ? `No saved ${def.label.toLowerCase()} yet.` : undefined} />
          <button type="button" className="btn small" disabled={!persisted} onClick={() => { void duplicate(); }}><Copy size={15} aria-hidden="true" /> Duplicate</button>
          <MenuButton label="Export" icon={Download} items={exportItems} className="btn small" disabled={!persisted} align="end" />
          <span className="ab-project">
            {/* A project is live: once added, the copy follows every change, so there is nothing to update by hand. */}
            {where === 'current' || where === 'outdated' ? (
              <>
                <span className="ab-in"><CircleCheck size={15} aria-hidden="true" /> In <strong className="ab-clip">{projectName}</strong></span>
                <Link className="btn small" to={`/project/${step.id}`}>Step {step.number} <ArrowRight size={14} aria-hidden="true" /><span className="sr-only">: {step.title}, in the project</span></Link>
              </>
            ) : (
              <button type="button" className="btn small primary" disabled={empty} aria-describedby={empty ? hintId : undefined} onClick={() => add(anyArtefact)}>
                <Plus size={15} aria-hidden="true" />
                {where === 'no-project' ? 'Add to a new project' : <>Add to <span className="ab-clip">{projectName}</span></>}
              </button>
            )}
            {empty && where !== 'current' && where !== 'outdated' && <span id={hintId} className="ab-hint">Nothing to add yet</span>}
          </span>
        </div>
      </section>

      {intro && introOpen && (
        <section id={aboutId} className="tbx-intro" aria-label="About this tool">
          <div className="tbx-intro-body">{intro}</div>
        </section>
      )}

      {children}
    </div>
  );
}
