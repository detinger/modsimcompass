import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRight, BookOpen, Cpu, Globe, PencilRuler, Scale, type LucideIcon } from 'lucide-react';
import { useArtefacts, useArtefactEditor, type ArtefactEditor } from '../../../app/artefacts';
import { Link } from '../../../app/router';
import { useStore } from '../../../app/store';
import {
  addLibraryChecks, addOwnCheck, CALCULATOR_CHECK_ID, calibrationModeOf, calibrationWords, CHECK_GROUPS, checkCounts, compareRecord, countsText, editCheck,
  groupLabel, moveCheck, recordValidationCheck, removeCheck, restoreCheck, type CheckGroup,
} from '../../../domain/artefacts/checkPlan';
import type { CheckStatus } from '../../../domain/artefacts/types';
import { FAMILIES, METHOD_BY_ID, METHODS, type MethodId } from '../../../domain/methods/registry';
import { FAMILY_ORDER, VV } from '../../../content/diagrams/specs';
import { newId } from '../../../domain/passport/schema';
import { slugify } from '../../../exports/projectFile';
import { downloadFile } from '../../../ui/controls';
import { FigureCard } from '../../../ui/playful';
import { ToolPage, type ToolExport } from '../ToolPage';
import { Calculator } from './Calculator';
import { Calibration } from './Calibration';
import { CheckList, Library } from './CheckList';
import { checkPlanCsv, checkPlanMarkdownFile } from './exports';
import { validationPlotSvg } from './plot';
import './checks.css';

/** `/toolbox/checks[/:id]`: verification, validation and calibration (docs/LEARN-TOOLBOX-PLAN.md §5.4). */
export default function ChecksTool({ id }: { id?: string }) {
  const editor = useArtefactEditor('check-plan', id);
  const { artefact } = editor;
  const d = artefact.data;
  const base = /[a-z0-9]/i.test(artefact.title.normalize('NFKD')) ? slugify(artefact.title) : 'check-plan';
  const now = () => new Date().toISOString();
  const cmp = compareRecord(d.validation);
  const canPlot = cmp.ok && cmp.paired;
  const exports: ToolExport[] = [
    { id: 'plan-md', label: 'Check plan (Markdown)', run: () => downloadFile(`${base}.md`, checkPlanMarkdownFile(artefact.title, d, now()), 'text/markdown') },
    { id: 'plan-csv', label: 'Check plan (CSV)', run: () => downloadFile(`${base}.csv`, checkPlanCsv(d), 'text/csv') },
    ...(canPlot ? [{ id: 'plot-svg', label: 'Validation plot (SVG)', run: () => { const svg = validationPlotSvg(d.validation, { width: 900, standalone: true }); if (svg) downloadFile(`${base}-validation.svg`, svg, 'image/svg+xml'); } }] : []),
  ];
  return (
    <ToolPage kind="check-plan" editor={editor} exports={exports} intro={<FigureCard id="vv-cycle" />}>
      <Plan key={artefact.id} editor={editor} />
    </ToolPage>
  );
}

/** Each check compares two of the three models in the diagram, with the diagram's line pattern. */
const LINK: Record<CheckGroup, [LucideIcon, LucideIcon]> = { verification: [PencilRuler, Cpu], validation: [Globe, Cpu], calibration: [Globe, Cpu] };
const CHECK_TEXT = Object.fromEntries(VV.checks.map((c) => [c.id, c])) as Record<CheckGroup, (typeof VV.checks)[number]>;
const BAR_ORDER: CheckStatus[] = ['passed', 'failed', 'done', 'planned', 'na'];

function StatusBar({ counts }: { counts: ReturnType<typeof checkCounts> }) {
  if (!counts.total) return <span className="ck-bar is-empty" aria-hidden="true" />;
  return (
    <span className="ck-bar" aria-hidden="true">
      {BAR_ORDER.flatMap((s) => Array.from({ length: counts[s] }, (_, i) => <span key={`${s}-${i}`} className={`ck-block is-${s}`} />))}
    </span>
  );
}

function Plan({ editor }: { editor: ArtefactEditor<'check-plan'> }) {
  const d = editor.artefact.data;
  const edit = editor.setData;
  const { toast } = useStore();
  const { ofKind } = useArtefacts();
  const [group, setGroup] = useState<CheckGroup>('verification');
  const tabRefs = useRef<Record<CheckGroup, HTMLButtonElement | null>>({ verification: null, validation: null, calibration: null });
  const methodId = useId();
  const all = checkCounts(d);
  const words = calibrationWords(d.method), estimated = calibrationModeOf(d.method) === 'estimation';
  /** The question under each tab; for a model estimated from data the third one is about estimation. */
  const question = (g: CheckGroup) => (g === 'calibration' && estimated ? 'What was estimated?' : CHECK_TEXT[g].question);

  // The method of the latest method choice in the Toolbox, offered when it differs from the plan's.
  const fromChooser = ofKind('method-choice').find((a) => a.data.primary);
  const offered = fromChooser && fromChooser.data.primary !== d.method ? (fromChooser.data.primary as MethodId) : null;

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = CHECK_GROUPS.indexOf(group);
    const next = e.key === 'ArrowRight' ? (i + 1) % 3 : e.key === 'ArrowLeft' ? (i + 2) % 3 : e.key === 'Home' ? 0 : e.key === 'End' ? 2 : -1;
    if (next < 0) return;
    e.preventDefault();
    const g = CHECK_GROUPS[next];
    setGroup(g);
    tabRefs.current[g]?.focus();
  };

  const remove = (id: string) => {
    let removed: ReturnType<typeof removeCheck> = null;
    edit((x) => { removed = removeCheck(x, id); });
    toast('Check removed.', 'info', { label: 'Undo', run: () => edit((x) => { if (removed) restoreCheck(x, removed); }) });
  };

  return (
    <div className="ck-tool-root">
      <section className="ck-top" aria-label="Method and progress">
        <div className="field ck-method">
          <label htmlFor={methodId}>Method</label>
          <select id={methodId} value={d.method} onChange={(e) => edit((x) => { x.method = e.target.value as MethodId | ''; })}>
            <option value="">Any method</option>
            {FAMILY_ORDER.map((f) => (
              <optgroup key={f} label={FAMILIES[f].label}>
                {METHODS.filter((m) => m.family === f).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        {offered && (
          <button type="button" className="btn small ck-offer" onClick={() => edit((x) => { x.method = offered; })}>
            Use {METHOD_BY_ID[offered].name}<span className="ck-offer-from"> from your method choice</span>
          </button>
        )}
        <p className="ck-overall" role="status">
          {all.total ? <><strong>{all.total} check{all.total === 1 ? '' : 's'}</strong> {countsText(all, ' · ')}</> : 'No checks yet'}
        </p>
      </section>

      <div className="ck-tabs" role="tablist" aria-label="Three checks" onKeyDown={onTabKey}>
        {CHECK_GROUPS.map((g) => {
          const [A, B] = LINK[g];
          const n = checkCounts(d, g);
          return (
            <button key={g} ref={(el) => { tabRefs.current[g] = el; }} type="button" role="tab" id={`ck-tab-${g}`} aria-controls={group === g ? `ck-panel-${g}` : undefined}
              aria-selected={group === g} tabIndex={group === g ? 0 : -1} className={`ck-tab is-${g}`} onClick={() => setGroup(g)}>
              <span className="ck-link" aria-hidden="true">
                <A size={18} />
                <svg width="44" height="10" viewBox="0 0 44 10"><path d="M2,5 H42" /></svg>
                <B size={18} />
              </span>
              <span className="ck-tab-name">{groupLabel(d.method, g)}</span>
              <span className="ck-tab-q">{question(g)}</span>
              <span className="ck-tab-foot">
                <StatusBar counts={n} />
                <span className="ck-tab-n">{n.total ? `${n.total} · ${countsText(n, ', ')}` : 'none yet'}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className={`ck-panel is-${group}`} role="tabpanel" id={`ck-panel-${group}`} aria-labelledby={`ck-tab-${group}`}>
        <h2 className="sr-only">{groupLabel(d.method, group)}</h2>
        {group === 'calibration' && words.note
          ? <p className="ck-panel-text ck-note">{words.note}</p>
          : <p className="ck-panel-text">{CHECK_TEXT[group].text}</p>}
        {group === 'validation' && (
          <Calculator v={d.validation} recorded={d.checks.some((c) => c.id === CALCULATOR_CHECK_ID)}
            onChange={(fn) => edit((x) => { fn(x.validation); })}
            onRecord={() => { edit((x) => { recordValidationCheck(x); }); toast('Recorded in the validation checks.', 'success'); }} />
        )}
        {group === 'calibration' && <Calibration c={d.calibration} d={d} words={words} estimated={estimated} onChange={(fn) => edit((x) => { fn(x.calibration); })} />}
        <div className="ck-columns">
          <CheckList group={group} d={d}
            onEdit={(id, ch) => edit((x) => { editCheck(x, id, ch); })}
            onMove={(id, dir) => edit((x) => { moveCheck(x, id, dir); })}
            onRemove={remove}
            onAdd={(text) => edit((x) => { addOwnCheck(x, group, text, newId('own')); })} />
          <Library group={group} d={d} onAdd={(list) => {
            let n = 0;
            edit((x) => { n = addLibraryChecks(x, list); });
            if (list.length > 1) toast(`Added ${n} check${n === 1 ? '' : 's'}.`, 'success');
          }} />
        </div>
      </div>

      <nav className="ck-next" aria-label="Related">
        <Link to="/learn/ideas" className="ck-next-link"><BookOpen size={16} aria-hidden="true" /> Key ideas</Link>
        <Link to="/toolbox/compare" className="ck-next-link"><Scale size={16} aria-hidden="true" /> Next: a fair comparison <ArrowRight size={14} aria-hidden="true" /></Link>
      </nav>
    </div>
  );
}
