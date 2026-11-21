import { useRef, useState } from 'react';
import { ArrowRight, CircleCheck, Copy, FileJson, FileUp, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useAddToProject, useArtefacts } from '../../app/artefacts';
import { Link } from '../../app/router';
import { useStore } from '../../app/store';
import { ARTEFACT_FILE_MAX_BYTES } from '../../domain/artefacts/file';
import { KIND_ORDER, kindDef, KINDS } from '../../domain/artefacts/kinds';
import type { Artefact, ArtefactKind } from '../../domain/artefacts/types';
import { STEP_BY_ID } from '../../domain/passport/compass';
import { Callout, readFileText } from '../../ui/controls';
import { ArtefactCard } from './ArtefactCard';
import { downloadArtefact } from './ToolPage';
import { TOOL_META } from './toolMeta';
import '../../styles/toolbox.css';

type Filter = ArtefactKind | 'all';

/** `/toolbox/artefacts`: everything the tools have made on this device. */
export default function Artefacts() {
  const { list, duplicate, remove, put, importText } = useArtefacts();
  const { active, toast } = useStore();
  const { state, add } = useAddToProject();
  const [filter, setFilter] = useState<Filter>('all');
  const [problem, setProblem] = useState<{ title: string; lines: string[]; tone: 'error' | 'warning' } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const shown = filter === 'all' ? list : list.filter((a) => a.kind === filter);
  const projectName = active ? active.passport.identity.title.trim() || 'Untitled project' : '';

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setProblem(null);
    let text: string;
    try { text = await readFileText(f, ARTEFACT_FILE_MAX_BYTES); } catch (e) { setProblem({ title: 'The file was not imported', lines: [e instanceof Error ? e.message : 'The file could not be read.'], tone: 'error' }); return; }
    const res = await importText(text);
    if (!res.ok) { setProblem({ title: 'The file was not imported', lines: [res.error], tone: 'error' }); return; }
    setFilter('all');
    toast(`Imported “${res.artefact.title}”.`, 'success');
    if (res.warnings.length) setProblem({ title: `Imported “${res.artefact.title}”, with ${res.warnings.length} thing${res.warnings.length === 1 ? '' : 's'} corrected`, lines: res.warnings.slice(0, 8), tone: 'warning' });
  };

  const del = (a: Artefact) => {
    void remove(a.id);
    toast(`Deleted “${a.title.trim() || 'Untitled'}”.`, 'info', { label: 'Undo', run: () => { void put(a); } });
  };
  const copy = async (a: Artefact) => {
    const made = await duplicate(a.id);
    toast(made ? `Created “${made.title}”.` : 'The copy could not be saved on this device.', made ? 'success' : 'error');
  };

  return (
    <div className="page tbx-mine">
      <div className="page-head tbx-mine-head">
        <div>
          <h1>My artefacts</h1>
          <p className="lede">What your tools have made. Kept on this device, with or without a project.</p>
        </div>
        <div className="btn-row">
          <input ref={file} type="file" accept=".json,application/json" hidden tabIndex={-1} aria-hidden="true"
            onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" className="btn" onClick={() => file.current?.click()}><FileUp size={16} aria-hidden="true" /> Import artefact file</button>
        </div>
      </div>

      {problem && (
        <Callout tone={problem.tone} title={problem.title} role={problem.tone === 'error' ? 'alert' : 'status'}>
          <ul className="tbx-problem">{problem.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </Callout>
      )}

      {list.length > 0 && (
        <div className="tbx-filter" role="group" aria-label="Show">
          <button type="button" className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All <span className="tbx-count">{list.length}</span></button>
          {KIND_ORDER.map((k) => {
            const n = list.filter((a) => a.kind === k).length;
            const Icon = TOOL_META[k].icon;
            return (
              <button key={k} type="button" className={`chip ${TOOL_META[k].tone}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                <Icon size={14} aria-hidden="true" /> {KINDS[k].label} <span className="tbx-count">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="tbx-empty">
          {list.length === 0
            ? <><p><strong>Nothing yet.</strong> Open a tool and start: what you make appears here.</p><Link className="btn primary" to="/toolbox">Open the Toolbox</Link></>
            : <><p>No {KINDS[filter as ArtefactKind].label.toLowerCase()} yet.</p><Link className="btn primary" to={KINDS[filter as ArtefactKind].toolPath}>Make one</Link></>}
        </div>
      ) : (
        <ul className="artefact-cards">
          {shown.map((a) => {
            const def = kindDef(a.kind);
            const to = `${def.toolPath}/${a.id}`;
            const where = state(a);
            const name = a.title.trim() || 'Untitled';
            const nothing = def.isEmpty(a.data);
            return (
              <li key={a.id}>
                <ArtefactCard kind={a.kind} title={a.title} updatedAt={a.updatedAt} summary={def.summary(a.data)} figure={def.figure(a.data)} to={to} headingLevel={2}
                  status={where === 'current' ? <span className="badge success">In project</span> : where === 'outdated' ? <span className="badge warning">Changed since added</span> : undefined}
                  actions={<>
                    <Link className="btn small primary" to={to}>Open<span className="sr-only"> {name}</span></Link>
                    {where === 'current' ? (
                      <Link className="btn small" to={`/project/${def.step}`} title={`In ${projectName}`}><CircleCheck size={14} aria-hidden="true" /> In project<span className="sr-only"> {projectName}: open step {STEP_BY_ID[def.step].number}</span> <ArrowRight size={13} aria-hidden="true" /></Link>
                    ) : (
                      <button type="button" className="btn small" disabled={nothing} title={nothing ? 'Nothing to add yet' : undefined} onClick={() => add(a)}>
                        {where === 'outdated' ? <RefreshCw size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                        {where === 'no-project' ? 'Add to a new project' : where === 'outdated' ? 'Update project' : 'Add to project'}<span className="sr-only">: {name}</span>
                      </button>
                    )}
                    <span className="ac-icons">
                      <button type="button" className="icon-btn" data-tip="Duplicate" aria-label={`Duplicate ${name}`} onClick={() => { void copy(a); }}><Copy size={16} aria-hidden="true" /></button>
                      <button type="button" className="icon-btn" data-tip="Export file" aria-label={`Export ${name} as an artefact file`} onClick={() => downloadArtefact(a)}><FileJson size={16} aria-hidden="true" /></button>
                      <button type="button" className="icon-btn danger" data-tip="Delete" aria-label={`Delete ${name}`} onClick={() => del(a)}><Trash2 size={16} aria-hidden="true" /></button>
                    </span>
                  </>} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
