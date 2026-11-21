import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FolderOpen, Play, Plus, Square } from 'lucide-react';
import { useStore } from '../../../app/store';
import { Link } from '../../../app/router';
import { configHash, defaultConfig, validateConfig } from '../../../domain/sandbox/engine';
import { requiredReplications, runHash } from '../../../domain/sandbox/experiment';
import type { RunRecord, SandboxConfig } from '../../../domain/sandbox/types';
import { newId, type ProjectDoc } from '../../../domain/passport/schema';
import { FIXTURES } from '../../../content/fixtures';
import { runToCsv } from '../../../exports/csv';
import { slugify } from '../../../exports/bundle';
import { Badge, Callout, SelectField, TextArea, downloadFile } from '../../../ui/controls';
import { SendArea, ToolFrame } from '../ToolFrame';
import { ToolArt } from '../ToolArt';
import { SandboxControls } from './SandboxControls';
import { SandboxResults, OUTCOMES, type OutcomeKey } from './SandboxResults';
import { StockFlowScene } from './StockFlowScene';
import { useSandboxRun } from './useSandboxRun';

const MODEL_ASSUMPTIONS = [
  { statement: 'Requests are aggregated into request-equivalents per day; individual requests and their order are not represented.', consequence: 'Individual waiting times and fairness cannot be estimated from this model.', check: 'Use DES if waiting-time distributions matter.' },
  { statement: 'Same-day arrivals can be served on the day they arrive; intra-day timing is ignored.', consequence: 'Backlog may be understated if arrivals cluster late in the day.', check: 'Compare with timestamped arrival data or an hourly model.' },
  { statement: 'Unused capacity on one day does not carry over to the next.', consequence: 'If staff can catch up later, backlog is overstated.', check: 'Ask the office how slack time is used.' },
  { statement: 'Abandonment (if enabled) is a fixed aggregate fraction of remaining requests, applied after service.', consequence: 'Real withdrawal depends on individual patience and may vary with backlog.', check: 'Estimate withdrawal rates from records; test sensitivity to the fraction.' },
];

const PRESET_IDS = Object.keys(FIXTURES);

/** One reproducible line for step 6 of the passport, built only from what the saved run recorded. */
function runSettingsText(run: RunRecord): string {
  const n = run.completedReplications;
  const parts = [
    `Backlog sandbox run ${run.id}`,
    `horizon ${run.baselineSnapshot.horizon} days`,
    `${n} replication${n === 1 ? '' : 's'}${run.alternative ? ' per policy' : ''}`,
    `seed “${run.seed}”`,
    `engine ${run.engineVersion}`,
    `RNG ${run.rngVersion}`,
  ];
  if (run.comparisonKind === 'paired-policy') parts.push('same arrival traces in each policy pair');
  return `${parts.join('; ')}.`;
}

function SandboxEmpty() {
  const { createAndActivate } = useStore();
  return (
    <ToolFrame id="sandbox" wide={false}>
      <div className="tool-empty tone-primary">
        <ToolArt id="sandbox" />
        <h2>The sandbox lives inside a project</h2>
        <p>Its settings and runs are saved with the project you have open.</p>
        <div className="btn-row">
          <button className="btn primary" onClick={() => createAndActivate({ title: 'Sandbox experiments' })}><Plus size={16} aria-hidden="true" /> Create a draft project</button>
          <Link className="btn" to="/"><FolderOpen size={16} aria-hidden="true" /> Open one on Home</Link>
        </div>
      </div>
    </ToolFrame>
  );
}

export default function SandboxTool() {
  const { active } = useStore();
  if (!active) return <SandboxEmpty />;
  return <SandboxWorkspace key={active.id} doc={active} />;
}

function SandboxWorkspace({ doc }: { doc: ProjectDoc }) {
  const { update, toast } = useStore();
  const [tab, setTab] = useState<'baseline' | 'alternative'>('baseline');
  const [advanced, setAdvanced] = useState(() => {
    const b = doc.sandbox.baseline;
    return b.schedule.enabled || b.abandonment.enabled || b.feedback.enabled || b.cost.enabled;
  });
  const [outcome, setOutcome] = useState<OutcomeKey | 'waiting'>('terminalBacklog');
  const [announce, setAnnounce] = useState('');
  const [preset, setPreset] = useState(PRESET_IDS[0]);
  /** Bumped whenever settings are replaced wholesale, so text-backed fields re-read them. */
  const [settingsKey, setSettingsKey] = useState(0);
  const sandbox = doc.sandbox;
  const projectIdRef = useRef(doc.id);

  const { phase, live, start, cancel } = useSandboxRun((run) => {
    if (run.projectId !== projectIdRef.current) return; // never attach to another project
    update((d) => { d.sandbox.lastRun = run; });
    setAnnounce(run.status === 'complete' ? `Run complete: ${run.completedReplications} replication(s).` : run.status === 'partial' ? `${run.completedReplications} of ${run.requestedReplications} replications completed. Results are partial.` : 'Run failed.');
  });

  const cfg = tab === 'alternative' && sandbox.alternative ? sandbox.alternative : sandbox.baseline;
  const setCfg = (fn: (c: SandboxConfig) => void) => update((d) => {
    const target = tab === 'alternative' && d.sandbox.alternative ? d.sandbox.alternative : d.sandbox.baseline;
    fn(target);
    // Shared experiment settings live on the baseline; mirror them for clarity.
    if (d.sandbox.alternative && target === d.sandbox.baseline) { d.sandbox.alternative.seed = target.seed; d.sandbox.alternative.replications = target.replications; }
  });
  const errors = useMemo(() => validateConfig(cfg), [cfg]);
  const allErrors = useMemo(() => [...validateConfig(sandbox.baseline), ...(sandbox.alternative ? validateConfig(sandbox.alternative) : [])], [sandbox.baseline, sandbox.alternative]);
  const currentHash = runHash(sandbox.baseline, sandbox.alternative);
  const running = phase === 'running' || phase === 'cancelling';
  const shownRun = running ? live : sandbox.lastRun;
  const stale = !!shownRun && shownRun.modelHash !== currentHash && phase !== 'running';
  const total = requiredReplications(sandbox.baseline, sandbox.alternative);
  const question = doc.passport.decision.question.trim();

  useEffect(() => { projectIdRef.current = doc.id; }, [doc.id]);
  const recordable = !!sandbox.lastRun && !running && sandbox.lastRun.status === 'complete' && sandbox.lastRun.modelHash === currentHash;
  const recorded = recordable && doc.passport.experiment.runSettings.includes(runSettingsText(sandbox.lastRun!));

  /** Replace both policies at once (preset, reset, undo). */
  const replaceSettings = (baseline: SandboxConfig, alternative: SandboxConfig | null) => {
    update((d) => { d.sandbox.baseline = structuredClone(baseline); d.sandbox.alternative = alternative ? structuredClone(alternative) : null; });
    setTab('baseline');
    setAdvanced((a) => a || baseline.schedule.enabled || baseline.abandonment.enabled || baseline.feedback.enabled || baseline.cost.enabled);
    setSettingsKey((k) => k + 1);
  };
  const loadPreset = () => {
    const fx = FIXTURES[preset];
    if (!fx) return;
    const before = { baseline: structuredClone(sandbox.baseline), alternative: sandbox.alternative ? structuredClone(sandbox.alternative) : null };
    replaceSettings(fx.config, null);
    toast(`Loaded “${fx.label}”. It replaced the sandbox settings.`, 'success', { label: 'Undo', run: () => replaceSettings(before.baseline, before.alternative) });
  };

  return (
    <ToolFrame id="sandbox" aside={<Badge tone="primary">Daily aggregate model</Badge>}>
      <div className="sandbox-brief">
        <p className="sandbox-question"><strong>Question</strong> {question || <span className="muted">None yet. <Link to="/project/frame">Write one in step 1</Link>.</span>}</p>
        <details><summary>How it works</summary><p className="subtle-text">Unfinished request-equivalents per day. <code>B[t+1] = B[t] + A[t] − served[t] − abandoned[t]</code>, with <code>served[t] = min(B[t] + A[t], capacity[t])</code>.</p></details>
      </div>

      <div className="workspace">
        <aside aria-label="Model settings" className="lab-panel">
          <h2 className="panel-title">Settings</h2>
          <div className="preset">
            <label htmlFor="sb-preset">Load a preset</label>
            <div className="preset-row">
              <select id="sb-preset" value={preset} onChange={(e) => setPreset(e.target.value)} aria-describedby="sb-preset-hint">
                {PRESET_IDS.map((id) => <option key={id} value={id}>{FIXTURES[id].label}</option>)}
              </select>
              <button type="button" className="btn" onClick={loadPreset} disabled={running}>Load</button>
            </div>
            <span id="sb-preset-hint" className="hint">{FIXTURES[preset].description} Loading replaces the current sandbox settings.</span>
          </div>

          <div className="btn-row policy-tabs">
            <div className="seg" role="tablist" aria-label="Policy being edited">
              <button role="tab" aria-selected={tab === 'baseline'} onClick={() => setTab('baseline')}>Baseline</button>
              <button role="tab" aria-selected={tab === 'alternative'} disabled={!sandbox.alternative} onClick={() => setTab('alternative')}>Alternative</button>
            </div>
            {!sandbox.alternative ? (
              <button className="btn small" onClick={() => { update((d) => { const a = structuredClone(d.sandbox.baseline); if (a.capacity.mode === 'direct') a.capacity.direct += 2; else if (a.capacity.mode === 'staff') a.capacity.staff += 1; d.sandbox.alternative = a; }); setTab('alternative'); }}>
                Compare with an alternative
              </button>
            ) : (
              <button className="btn small ghost" onClick={() => { update((d) => { d.sandbox.alternative = null; }); setTab('baseline'); }}>Remove alternative</button>
            )}
          </div>
          {tab === 'alternative' && <p className="hint">Editing the alternative. Seed and replications are shared with the baseline so that replication pairs use the same random stream.</p>}
          <SandboxControls key={`${tab}-${settingsKey}`} config={cfg} onChange={setCfg} errors={errors} showAdvanced={advanced} />
          <button className="btn small wrap" aria-expanded={advanced} onClick={() => setAdvanced((a) => !a)}>{advanced ? 'Hide' : 'Reveal'} advanced controls (schedule, abandonment, feedback, cost)</button>
          <hr />
          <div className="btn-row">
            <button className="btn small ghost" onClick={() => replaceSettings(defaultConfig(), null)}>Reset sandbox settings</button>
          </div>
          <p className="subtle-text">Resets only the sandbox settings of this project. Saved runs stay until you run again.</p>
        </aside>

        <section aria-label="Scene and results" className="stack" style={{ minWidth: 0 }}>
          <div className="lab-panel">
            <h2 className="panel-title">Flows</h2>
            <StockFlowScene trace={shownRun?.baseline.retainedTrace ?? null} label={shownRun && total > 1 ? 'Baseline, replication 1' : 'Baseline'} />
          </div>

          <div className="lab-panel run-panel">
            <h2 className="panel-title">Predict, then run</h2>
            <TextArea label="Your prediction before running (for example: terminal backlog after five days)" value={doc.start.prediction} rows={2}
              onChange={(v) => update((d) => { d.start.prediction = v; })} hint="Predicting first makes the comparison with the result informative. Saved with the project." />
            <div className="btn-row">
              {running ? (
                <button className="btn run-btn" onClick={cancel} disabled={phase === 'cancelling'}><Square size={16} aria-hidden="true" /> {phase === 'cancelling' ? 'Cancelling…' : 'Cancel'}</button>
              ) : (
                <button className="btn primary run-btn" disabled={allErrors.length > 0} aria-disabled={allErrors.length > 0}
                  onClick={() => start({ projectId: doc.id, modelRevision: doc.modelRevision, base: sandbox.baseline, alt: sandbox.alternative })}>
                  <Play size={16} aria-hidden="true" /> Run model
                </button>
              )}
              <span className="subtle-text">{total} replication{total === 1 ? '' : 's'}{sandbox.alternative ? ' per policy' : ''} · seed <code>{sandbox.baseline.seed}</code></span>
              {sandbox.lastRun && (
                <button className="btn small" onClick={() => { const r = sandbox.lastRun!; downloadFile(`${slugify(doc.passport.identity.title)}-sandbox-results.csv`, runToCsv(doc, r), 'text/csv'); toast('CSV generated. Use your browser download to save it.', 'success'); }}>
                  <Download size={14} aria-hidden="true" /> Download CSV
                </button>
              )}
            </div>
            {allErrors.length > 0 && (
              <div className="callout error" role="alert" style={{ marginTop: 8 }}>
                <div><strong>Fix these inputs before running:</strong><ul style={{ margin: '4px 0 0' }}>{allErrors.slice(0, 6).map((e, i) => <li key={i}>{e.message}</li>)}</ul></div>
              </div>
            )}
            {running && live && (
              <div style={{ marginTop: 10 }}>
                <p className="subtle-text" role="status">{live.completedReplications} of {live.requestedReplications} replications completed.</p>
                <div className="progress" aria-hidden="true"><span style={{ width: `${(live.completedReplications / Math.max(1, live.requestedReplications)) * 100}%` }} /></div>
              </div>
            )}
            <p className="sr-only" aria-live="polite">{announce}</p>
          </div>

          <div className="lab-panel">
            <h2 className="panel-title">Results</h2>
            <SelectField label="Which outcome matters for your question?" value={outcome} onChange={setOutcome} options={OUTCOMES.map((o) => ({ value: o.value, label: o.label }))} />
            {outcome === 'waiting' ? (
              <Callout tone="info" title="This daily model does not estimate individual waiting times.">
                Backlog is an aggregate stock; it does not say how long any request waited, and dividing backlog by throughput only gives a long-run average under strong assumptions. Explore DES or queueing theory for waiting-time questions (see <Link to="/tools/apps">Specialist apps</Link>). Showing terminal backlog instead.
              </Callout>
            ) : null}
            {shownRun ? (
              <SandboxResults run={shownRun} stale={stale} outcome={outcome === 'waiting' ? 'terminalBacklog' : outcome} />
            ) : (
              <p className="muted">No results yet. Choose settings, write a prediction and run the model.</p>
            )}
            {shownRun && doc.start.prediction.trim() && phase !== 'running' && (
              <Callout tone="info" title="Compare with your prediction">You predicted: “{doc.start.prediction.trim()}”. Where does the result differ, and which part of the arithmetic explains it?</Callout>
            )}
          </div>

          <SendArea>
            <ul className="list-reset send-list">
              <li>
                <div>
                  <p><strong>Run settings</strong> <span className="subtle-text">→ step 6</span></p>
                  <p className="subtle-text">{recordable ? runSettingsText(sandbox.lastRun!) : 'Finish a run with the current settings first. Stale and partial runs are not recorded.'}</p>
                </div>
                <button className="btn small" disabled={!recordable || recorded} onClick={() => {
                  const text = runSettingsText(sandbox.lastRun!);
                  const before = doc.passport.experiment.runSettings;
                  update((d) => { d.passport.experiment.runSettings = before.trim() ? `${before.trimEnd()}\n${text}` : text; });
                  toast('Run settings added to step 6 of your passport.', 'success', { label: 'Undo', run: () => update((d) => { d.passport.experiment.runSettings = before; }) });
                }}>{recorded ? 'Already in your passport' : 'Add to run settings'}</button>
              </li>
            </ul>
            <p className="send-what">Assumptions and limitations of this teaching model. Add the ones that matter for your question.</p>
            <ul className="list-reset send-list">
              {MODEL_ASSUMPTIONS.map((a) => {
                const exists = doc.passport.assumptions.some((x) => x.statement === a.statement);
                return (
                  <li key={a.statement}>
                    <div>
                      <p><strong>{a.statement}</strong></p>
                      <p className="subtle-text">If wrong: {a.consequence} · Check: {a.check}</p>
                    </div>
                    <button className="btn small" disabled={exists} onClick={() => {
                      const id = newId('as');
                      update((d) => { d.passport.assumptions.push({ id, statement: a.statement, rationale: 'Property of the ModSim Essentials daily backlog model.', consequenceIfWrong: a.consequence, plannedCheck: a.check, evidenceKind: 'assumed', sourceNote: '' }); });
                      toast('Assumption added to step 4 of your passport.', 'success', { label: 'Undo', run: () => update((d) => { d.passport.assumptions = d.passport.assumptions.filter((x) => x.id !== id); }) });
                    }}>{exists ? 'Already in your passport' : 'Add to assumptions'}</button>
                  </li>
                );
              })}
            </ul>
            <p className="subtle-text">Hash of current scientific inputs: <code>{configHash(sandbox.baseline)}</code>. Editing notes does not invalidate results; changing model inputs does.</p>
          </SendArea>
        </section>
      </div>
    </ToolFrame>
  );
}
