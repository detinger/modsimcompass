import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpenCheck, Compass, FileUp, HardDrive, Plus, RotateCcw, Trash2, Wrench } from 'lucide-react';
import { useStore } from '../../app/store';
import { Link, useRouter } from '../../app/router';
import { newId, type ProjectDoc } from '../../domain/passport/schema';
import { IMPORT_LIMITS, parseProjectJson } from '../../domain/passport/importer';
import { projectJson, slugify } from '../../exports/projectFile';
import type { TrashEntry } from '../../persistence/db';
import { Callout, Dialog, downloadFile, readFileText } from '../../ui/controls';
import { FigureCard } from '../../ui/playful';
import { CompassArt } from './CompassArt';
import { ProjectCard, ago, titleOf } from './ProjectCard';
import { Quiet } from './Quiet';
import '../../styles/tools.css';

interface PendingImport { project: ProjectDoc; warnings: string[]; summary: string[] }

const DOORS = [
  { to: '/project', title: 'Project', text: 'Seven steps, five checkpoints.', icon: Compass, tone: 'tone-primary' },
  { to: '/toolbox', title: 'Toolbox', text: 'Five tools. Each makes an artefact.', icon: Wrench, tone: 'tone-teal' },
  { to: '/example', title: 'Worked example', text: 'A finished project to learn from.', icon: BookOpenCheck, tone: 'tone-orange' },
];

export default function Home() {
  const { projects, active, activate, createAndActivate, duplicate, trash, listTrash, restore, purge, addProject, replaceProject, getBackup, toast, repoKind } = useStore();
  const { navigate } = useRouter();
  const [trashList, setTrashList] = useState<TrashEntry[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<ProjectDoc | null>(null);
  const [purging, setPurging] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [replaceTarget, setReplaceTarget] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { let on = true; void listTrash().then((t) => { if (on) setTrashList(t); }); return () => { on = false; }; }, [listTrash, projects]);

  const current = active ?? projects[0] ?? null;
  const open = async (id: string) => { await activate(id); navigate('/project'); };
  const startNew = () => { createAndActivate({ title: 'Untitled project' }); navigate('/project'); };

  const onFile = async (f: File | undefined) => {
    setImportError(null);
    if (!f) return;
    try {
      const text = await readFileText(f, IMPORT_LIMITS.maxBytes);
      const res = parseProjectJson(text);
      if (!res.ok) { setImportError(res.error); return; }
      setPending({ project: res.project, warnings: res.warnings, summary: res.summary });
      setReplaceTarget('');
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const download = (p: ProjectDoc) => {
    downloadFile(`${slugify(titleOf(p))}.modsim.json`, projectJson(p), 'application/json');
    toast('Project file generated. Use your browser download to save it.', 'success');
  };
  const recovery = async (p: ProjectDoc) => {
    const b = await getBackup(p.id);
    if (!b) { toast('No earlier revision stored for this project yet.', 'info'); return; }
    downloadFile(`${slugify(titleOf(p))}-last-known-good.modsim.json`, projectJson(b.project), 'application/json');
    toast('Earlier version downloaded as a recovery file.', 'success');
  };

  const figure = <Quiet><div className="home-figure"><FigureCard id="compass-journey" /></div></Quiet>;
  const doors = (
    <nav aria-label="Areas">
      <ul className="tiles three doors">
        {DOORS.map((d) => (
          <li key={d.to}>
            <Link to={d.to} className={`tile door ${d.tone}`}>
              <span className="tile-icon"><d.icon size={24} aria-hidden="true" /></span>
              <span className="tile-title">{d.title}</span>
              <span className="tile-text">{d.text}</span>
              <span className="tile-meta">Open <ArrowRight size={13} aria-hidden="true" /></span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <div className="page home">
      <section className="hero home-hero">
        <div className="home-hero-text">
          <p className="eyebrow">ModSim Essentials</p>
          <h1>Your project compass</h1>
          <p className="lede">Plan, check and defend your modelling project, one step at a time.</p>
          <div className="btn-row">
            {current ? (
              <>
                <button className="btn primary cta" onClick={() => open(current.id)}><span className="clip">Continue {titleOf(current)}</span> <ArrowRight size={18} aria-hidden="true" /></button>
                <button className="btn cta" onClick={startNew}><Plus size={18} aria-hidden="true" /> New project</button>
              </>
            ) : (
              <>
                <button className="btn primary cta" onClick={startNew}><Plus size={18} aria-hidden="true" /> Start a new project</button>
                <Link className="btn cta" to="/example"><BookOpenCheck size={18} aria-hidden="true" /> See the worked example</Link>
              </>
            )}
          </div>
        </div>
        <CompassArt />
      </section>

      {projects.length === 0 && <>{figure}{doors}</>}

      <section aria-labelledby="home-projects">
        <div className="section-title">
          <h2 id="home-projects">Your projects</h2>
          <div className="btn-row">
            {projects.length > 0 && <button className="btn" onClick={startNew}><Plus size={16} aria-hidden="true" /> New</button>}
            <button className="btn" onClick={() => fileRef.current?.click()}><FileUp size={16} aria-hidden="true" /> Import project file</button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden tabIndex={-1} aria-label="Import project file" onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        </div>
        {importError && <Callout tone="error" role="alert" title="The file could not be imported">{importError}</Callout>}
        {projects.length === 0 ? (
          <div className="home-empty">
            <p><strong>No projects yet.</strong> Start one above, or import a project file.</p>
          </div>
        ) : (
          <ul className="project-cards">
            {projects.map((p) => (
              <li key={p.id}>
                <ProjectCard doc={p} active={active?.id === p.id} onOpen={() => open(p.id)} onDuplicate={() => duplicate(p.id)} onDownload={() => download(p)}
                  onRecovery={() => recovery(p)} onDelete={() => setConfirmDelete(p)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {trashList.length > 0 && (
        <section className="home-trash" aria-labelledby="home-trash">
          <h2 id="home-trash"><Trash2 size={16} aria-hidden="true" /> Recently deleted</h2>
          <ul className="list-reset">
            {trashList.map((t) => (
              <li key={t.id}>
                <span className="trash-name"><strong>{titleOf(t.project)}</strong><span className="subtle-text" title={new Date(t.deletedAt).toLocaleString('en-GB')}>deleted {ago(t.deletedAt)}</span></span>
                <span className="btn-row">
                  <button className="btn small" onClick={async () => { await restore(t.id); toast('Project restored.', 'success'); }}><RotateCcw size={14} aria-hidden="true" /> Restore<span className="sr-only"> {titleOf(t.project)}</span></button>
                  {purging === t.id ? (
                    <>
                      <button className="btn small danger" onClick={async () => { await purge(t.id); setPurging(null); setTrashList(await listTrash()); toast('Project deleted permanently.', 'info'); }}>Yes, delete forever</button>
                      <button className="btn small ghost" onClick={() => setPurging(null)}>Keep</button>
                    </>
                  ) : (
                    <button className="btn small ghost danger" onClick={() => setPurging(t.id)}>Delete permanently<span className="sr-only"> {titleOf(t.project)}</span></button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {projects.length > 0 && <>{doors}{figure}</>}

      <p className="home-note">
        <HardDrive size={16} aria-hidden="true" />
        <span>{repoKind === 'memory'
          ? 'Storage is blocked in this browser, so projects last only while this tab is open. Download a project file to keep your work.'
          : 'Your projects live in this browser only. Download a project file to back up or move your work.'}</span>
      </p>

      {confirmDelete && (
        <Dialog title="Delete project?" narrow onClose={() => setConfirmDelete(null)}
          actions={<>
            <button className="btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button className="btn danger" onClick={async () => { await trash(confirmDelete.id); setConfirmDelete(null); toast('Project moved to Recently deleted.', 'info'); }}>Move to Recently deleted</button>
          </>}>
          <p><strong>{titleOf(confirmDelete)}</strong> moves to Recently deleted. You can restore it from there.</p>
        </Dialog>
      )}

      {pending && (
        <Dialog title="Import project file" onClose={() => setPending(null)}
          actions={<>
            <button className="btn" onClick={() => setPending(null)}>Cancel</button>
            {replaceTarget && <button className="btn danger" onClick={async () => { const ok = await replaceProject(replaceTarget, pending.project); setPending(null); if (ok) toast('Project replaced by the imported file. The earlier version is in Recently deleted.', 'success'); }}>Replace selected project</button>}
            <button className="btn primary" onClick={async () => {
              const now = new Date().toISOString();
              const doc: ProjectDoc = { ...pending.project, id: newId('prj'), createdAt: pending.project.createdAt || now, updatedAt: now, projectRevision: 1, origin: { kind: 'import', ref: pending.project.id } };
              // A copy of a project that is already here gets a name that tells the two apart.
              if (projects.some((x) => titleOf(x) === titleOf(doc))) doc.passport = { ...doc.passport, identity: { ...doc.passport.identity, title: `${titleOf(doc)} (imported)` } };
              await addProject(doc, true);
              setPending(null);
              toast('Imported as a new draft project.', 'success');
              navigate('/project');
            }}>Import as new draft</button>
          </>}>
          <ul>{pending.summary.map((s) => <li key={s}>{s}</li>)}</ul>
          {pending.warnings.length > 0 && (
            <details><summary>{pending.warnings.length} note{pending.warnings.length === 1 ? '' : 's'} from validation</summary><ul>{pending.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>
          )}
          <p className="muted">By default the file becomes a new draft; nothing existing is changed.</p>
          {projects.length > 0 && (
            <div className="field">
              <label htmlFor="replace-sel">Or explicitly replace an existing project</label>
              <select id="replace-sel" value={replaceTarget} onChange={(e) => setReplaceTarget(e.target.value)}>
                <option value="">Do not replace anything</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{titleOf(p)}</option>)}
              </select>
              <span className="hint">The version you replace is moved to Recently deleted, so you can restore it.</span>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
