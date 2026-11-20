import { useState, type ReactNode } from 'react';
import {
  Anchor, CircleHelp, ClipboardList, Eye, FlaskConical, Gauge, Hourglass, Megaphone, MessageCircleQuestion, Microscope, Plus, Scale, Scan, ShieldCheck,
  SlidersHorizontal, Sparkles, Trash2, TriangleAlert, User, Waypoints,
} from 'lucide-react';
import { useStore } from '../../app/store';
import { EVIDENCE_KINDS, newId, type Assumption, type ClaimType, type EvidenceKind, type InputRow, type OutcomeRow } from '../../domain/passport/schema';
import { METHODS, type MethodId } from '../../domain/methods/registry';
import { Badge } from '../../ui/controls';
import { usePassport } from './passportContext';
import { Area, Choice, FieldCard, Pick, Txt } from './fields';
import { ConceptMap } from './ConceptMap';

/** The passport field forms, one group per compass step. All read and write through `usePassport()`. */

const CLAIMS: { value: ClaimType; label: string }[] = [
  { value: 'descriptive', label: 'Descriptive' }, { value: 'explanatory', label: 'Explanatory' }, { value: 'predictive', label: 'Predictive' },
  { value: 'exploratory', label: 'Exploratory' }, { value: 'decision-support', label: 'Decision support' },
];
const METHOD_OPTIONS: { value: MethodId | ''; label: string }[] = [{ value: '', label: 'Not yet selected' }, ...METHODS.map((m) => ({ value: m.id, label: m.name }))];
const DIRECTIONS: { value: OutcomeRow['direction']; label: string }[] = [
  { value: 'lower', label: 'Lower is better' }, { value: 'higher', label: 'Higher is better' }, { value: 'target', label: 'Close to a target' },
];
const evidenceLabel = (k: EvidenceKind) => EVIDENCE_KINDS.find((e) => e.value === k)?.label ?? '';

// ── Step 1 · Frame ────────────────────────────────────────────────────────
export function FrameFields() {
  const { doc, update } = usePassport();
  const p = doc.passport;
  return (
    <>
      <FieldCard icon={User} title="Who is it for?">
        <Txt label="Project title" value={p.identity.title} onChange={(v) => update((d) => { d.passport.identity.title = v; })} />
        <Txt label="Stakeholder" value={p.decision.stakeholder} onChange={(v) => update((d) => { d.passport.decision.stakeholder = v; })} hint="Who will use the result?" />
      </FieldCard>
      <FieldCard icon={Eye} title="What is going on?">
        <Area label="Observed problem" value={p.decision.problem} onChange={(v) => update((d) => { d.passport.decision.problem = v; })} hint="What is observed — not yet a solution." />
        <Area label="Decision levers" value={p.decision.levers} onChange={(v) => update((d) => { d.passport.decision.levers = v; })} hint="What can the stakeholder actually change?" rows={2} />
      </FieldCard>
      <FieldCard icon={MessageCircleQuestion} title="What will you answer?">
        <Area label="Outcome of interest" value={p.decision.outcome} onChange={(v) => update((d) => { d.passport.decision.outcome = v; })} hint="What you will measure, with its unit." rows={2} />
        <Area label="Precise question" value={p.decision.question} onChange={(v) => update((d) => { d.passport.decision.question = v; })} hint="Lever, outcome, horizon, constraint." />
        <Choice label="Claim type" value={p.decision.claimType} clearTo="" onChange={(v) => update((d) => { d.passport.decision.claimType = v; })} options={CLAIMS} hint="Each type needs different evidence." />
      </FieldCard>
    </>
  );
}

// ── Step 2 · Scope and concept ────────────────────────────────────────────
export function ScopeFields() {
  const { doc, update } = usePassport();
  const s = doc.passport.scope;
  return (
    <>
      <FieldCard icon={Scan} title="Draw the boundary">
        <div className="cp-duo">
          <div className="cp-duo-in"><Area label="Boundary (included)" value={s.boundary} onChange={(v) => update((d) => { d.passport.scope.boundary = v; })} hint="What is inside the model." rows={4} /></div>
          <div className="cp-duo-out"><Area label="Exclusions" value={s.exclusions} onChange={(v) => update((d) => { d.passport.scope.exclusions = v; })} hint="What is left out on purpose." rows={4} /></div>
        </div>
      </FieldCard>
      <FieldCard icon={Hourglass} title="Time and detail">
        <div className="inline-fields">
          <Txt label="Horizon" value={s.horizon} onChange={(v) => update((d) => { d.passport.scope.horizon = v; })} placeholder="e.g. 30 working days" />
          <Txt label="Time unit" value={s.timeUnit} onChange={(v) => update((d) => { d.passport.scope.timeUnit = v; })} placeholder="e.g. day, hour, event-driven" />
        </div>
        <Area label="Level of detail" value={s.detail} onChange={(v) => update((d) => { d.passport.scope.detail = v; })} hint="Individuals, groups or totals?" rows={2} />
        <Area label="Constraints" value={s.constraints} onChange={(v) => update((d) => { d.passport.scope.constraints = v; })} hint="Budget, rules, time, data." rows={2} />
      </FieldCard>
    </>
  );
}

export function ConceptSketch() {
  const { doc, update, readOnly } = usePassport();
  const r = doc.passport.representation;
  return (
    <FieldCard icon={Waypoints} title="Conceptual sketch" sub="Elements and labelled relations. An arrow means only what its label says.">
      <ConceptMap />
      <Area label="Notes on the sketch" value={r.notes} onChange={(v) => update((d) => { d.passport.representation.notes = v; })} rows={2} />
      {doc.lensNotes.length > 0 && (
        <div className="field">
          <span className="field-label">Earlier notes</span>
          <ul className="list-reset cp-notes">
            {doc.lensNotes.map((n) => (
              <li key={n.id}>
                <span>{n.text}</span>
                {!readOnly && <button type="button" className="btn small ghost" onClick={() => update((d) => { d.lensNotes = d.lensNotes.filter((x) => x.id !== n.id); })} aria-label="Remove note"><Trash2 size={14} aria-hidden="true" /></button>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </FieldCard>
  );
}

// ── Step 3 · Method choice ────────────────────────────────────────────────
export function MethodChoiceFields({ aside }: { aside?: ReactNode }) {
  const { doc, update } = usePassport();
  const r = doc.passport.representation;
  return (
    <FieldCard icon={Scale} title="Your choice" sub="Your argument, in your words." id="method-choice">
      <div className="cp-duo">
        <div className="cp-duo-in">
          <Pick label="Primary method" value={r.primaryMethod} onChange={(v) => update((d) => { d.passport.representation.primaryMethod = v; })} options={METHOD_OPTIONS} />
          <Area label="Why the primary method fits" value={r.justification} onChange={(v) => update((d) => { d.passport.representation.justification = v; })} rows={4} />
        </div>
        <div className="cp-duo-out">
          <Pick label="Alternative method" value={r.alternativeMethod} onChange={(v) => update((d) => { d.passport.representation.alternativeMethod = v; })} options={METHOD_OPTIONS} />
          <Area label="Why the alternative is less suitable (or complementary)" value={r.alternativeJustification} onChange={(v) => update((d) => { d.passport.representation.alternativeJustification = v; })} rows={4} />
        </div>
      </div>
      {aside}
    </FieldCard>
  );
}

// ── Step 4 · Inputs and assumptions ───────────────────────────────────────
function RowHead({ n, title, onDelete, deleteLabel }: { n: number; title: string; onDelete: () => void; deleteLabel: string }) {
  return (
    <div className="cp-row-head">
      <span className="cp-row-n" aria-hidden="true">{n}</span>
      <strong>{title}</strong>
      <button type="button" className="btn small ghost" onClick={onDelete} aria-label={deleteLabel}><Trash2 size={14} aria-hidden="true" /> Remove</button>
    </div>
  );
}

/** Which collapsible rows are open. Rows that start empty open by default; the rest stay folded. */
function useOpenRows<T extends { id: string }>(rows: T[], isEmpty: (r: T) => boolean) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.filter(isEmpty).map((r) => [r.id, true])));
  const set = (id: string, o: boolean) => setOpen((s) => (!!s[id] === o ? s : { ...s, [id]: o }));
  return { isOpen: (id: string) => !!open[id], set };
}

export function InputsForm() {
  const { doc, update, readOnly } = usePassport();
  const { toast } = useStore();
  const rows = doc.passport.inputs;
  const open = useOpenRows(rows, (r) => !r.name.trim());
  const edit = (id: string, fn: (r: InputRow) => void) => update((d) => { const r = d.passport.inputs.find((x) => x.id === id); if (r) fn(r); });
  const missing = (r: InputRow) => (!r.value.trim() ? 'No value' : !r.unit.trim() ? 'No unit' : r.sourceType === 'unspecified' || !r.provenance.trim() ? 'No source' : null);
  return (
    <FieldCard icon={SlidersHorizontal} title="Inputs" sub="Value, unit, source, uncertainty." aside={rows.length > 0 ? <span className="cp-count">{rows.length}</span> : undefined}>
      {rows.length === 0 && <p className="cp-empty-row">No inputs yet.</p>}
      {readOnly ? (
        <ul className="list-reset cp-facts">
          {rows.map((r, i) => (
            <li key={r.id}>
              <div className="cp-fact-top"><strong>{r.name || `Input ${i + 1}`}</strong><span className="cp-fact-value">{r.value || '—'}{r.unit && <small> {r.unit}</small>}</span></div>
              <p><Badge>{evidenceLabel(r.sourceType)}</Badge> {r.provenance}</p>
              {r.uncertainty && <p><span className="cp-fact-key">Uncertainty</span> {r.uncertainty}</p>}
            </li>
          ))}
        </ul>
      ) : rows.map((r, i) => (
        <details key={r.id} className="cp-row" open={open.isOpen(r.id)} onToggle={(e) => open.set(r.id, e.currentTarget.open)}>
          <summary>
            <span className="cp-row-n" aria-hidden="true">{i + 1}</span>
            <span className="cp-row-sum">{r.name || 'New input'}{r.value.trim() && <span className="cp-row-val"> · {r.value} {r.unit}</span>}</span>
            {missing(r) && <Badge tone="warning"><TriangleAlert size={11} aria-hidden="true" /> {missing(r)}</Badge>}
          </summary>
          <div className="cp-grid-3">
            <Txt label="Name" value={r.name} onChange={(v) => edit(r.id, (x) => { x.name = v; })} />
            <Txt label="Value or range" value={r.value} onChange={(v) => edit(r.id, (x) => { x.value = v; })} />
            <Txt label="Unit" value={r.unit} onChange={(v) => edit(r.id, (x) => { x.unit = v; })} />
          </div>
          <div className="cp-grid-2">
            <Pick label="Source type" value={r.sourceType} onChange={(v) => edit(r.id, (x) => { x.sourceType = v; })} options={EVIDENCE_KINDS} />
            <Txt label="Provenance" value={r.provenance} onChange={(v) => edit(r.id, (x) => { x.provenance = v; })} placeholder="Where exactly does it come from?" />
          </div>
          <Txt label="Uncertainty" value={r.uncertainty} onChange={(v) => edit(r.id, (x) => { x.uncertainty = v; })} placeholder="Range, distribution or unknown" />
          <button type="button" className="btn small ghost" aria-label={`Remove input ${i + 1}`} onClick={() => {
            const removed = structuredClone(r);
            update((d) => { d.passport.inputs = d.passport.inputs.filter((x) => x.id !== r.id); });
            toast('Input removed.', 'info', { label: 'Undo', run: () => update((d) => { d.passport.inputs.splice(i, 0, removed); }) });
          }}><Trash2 size={14} aria-hidden="true" /> Remove input</button>
        </details>
      ))}
      {!readOnly && (
        <button type="button" className="btn cp-add" onClick={() => {
          const id = newId('in');
          open.set(id, true);
          update((d) => { d.passport.inputs.push({ id, name: '', value: '', unit: '', sourceType: 'unspecified', provenance: '', uncertainty: '' }); });
        }}>
          <Plus size={16} aria-hidden="true" /> Add input
        </button>
      )}
    </FieldCard>
  );
}

export function AssumptionsForm() {
  const { doc, update, readOnly } = usePassport();
  const { toast } = useStore();
  const rows = doc.passport.assumptions;
  const open = useOpenRows(rows, (a) => !a.statement.trim());
  const edit = (id: string, fn: (r: Assumption) => void) => update((d) => { const r = d.passport.assumptions.find((x) => x.id === id); if (r) fn(r); });
  return (
    <FieldCard icon={Anchor} title="Assumptions" sub="What you assume, what if not, and how you will check." aside={rows.length > 0 ? <span className="cp-count">{rows.length}</span> : undefined}>
      {rows.length === 0 && <p className="cp-empty-row">No assumptions yet. Every model makes some.</p>}
      {readOnly ? (
        <ul className="list-reset cp-facts">
          {rows.map((a, i) => (
            <li key={a.id}>
              <div className="cp-fact-top"><strong>{i + 1}. {a.statement || 'Assumption'}</strong><Badge>{evidenceLabel(a.evidenceKind)}</Badge></div>
              {a.rationale && <p><span className="cp-fact-key">Why</span> {a.rationale}</p>}
              {a.consequenceIfWrong && <p><span className="cp-fact-key">Consequence if it fails</span> {a.consequenceIfWrong}</p>}
              {a.plannedCheck && <p><span className="cp-fact-key">Planned check</span> {a.plannedCheck}</p>}
              {a.sourceNote && <p><span className="cp-fact-key">Source</span> {a.sourceNote}</p>}
            </li>
          ))}
        </ul>
      ) : rows.map((a, i) => (
        <details key={a.id} className="cp-row" open={open.isOpen(a.id)} onToggle={(e) => open.set(a.id, e.currentTarget.open)}>
          <summary>
            <span className="cp-row-n" aria-hidden="true">{i + 1}</span>
            <span className="cp-row-sum">{a.statement || 'New assumption'}</span>
            {!a.plannedCheck.trim() && <Badge tone="warning"><TriangleAlert size={11} aria-hidden="true" /> No planned check</Badge>}
          </summary>
          <Area label="Statement" value={a.statement} onChange={(v) => edit(a.id, (x) => { x.statement = v; })} rows={2} />
          <Area label="Rationale" value={a.rationale} onChange={(v) => edit(a.id, (x) => { x.rationale = v; })} rows={2} hint="Why is it reasonable?" />
          <div className="cp-duo">
            <Area label="Consequence if it fails" value={a.consequenceIfWrong} onChange={(v) => edit(a.id, (x) => { x.consequenceIfWrong = v; })} rows={2} />
            <Area label="Planned check" value={a.plannedCheck} onChange={(v) => edit(a.id, (x) => { x.plannedCheck = v; })} rows={2} />
          </div>
          <div className="inline-fields">
            <Pick label="Evidence" value={a.evidenceKind} onChange={(v) => edit(a.id, (x) => { x.evidenceKind = v; })} options={EVIDENCE_KINDS} hint="Where the claim comes from." />
            <Txt label="Source note" value={a.sourceNote} onChange={(v) => edit(a.id, (x) => { x.sourceNote = v; })} />
          </div>
          <button type="button" className="btn small ghost" onClick={() => {
            const removed = structuredClone(a);
            update((d) => { d.passport.assumptions = d.passport.assumptions.filter((x) => x.id !== a.id); });
            toast('Assumption removed.', 'info', { label: 'Undo', run: () => update((d) => { d.passport.assumptions.splice(i, 0, removed); }) });
          }}><Trash2 size={14} aria-hidden="true" /> Remove assumption</button>
        </details>
      ))}
      {!readOnly && (
        <button type="button" className="btn cp-add" onClick={() => {
          const id = newId('as');
          open.set(id, true);
          update((d) => { d.passport.assumptions.push({ id, statement: '', rationale: '', consequenceIfWrong: '', plannedCheck: '', evidenceKind: 'unspecified', sourceNote: '' }); });
        }}><Plus size={16} aria-hidden="true" /> Add assumption</button>
      )}
    </FieldCard>
  );
}

// ── Step 5 · Verification and validation ──────────────────────────────────
export function EvaluationFields() {
  const { doc, update } = usePassport();
  const e = doc.passport.evaluation;
  return (
    <div className="cp-trio">
      <FieldCard icon={ShieldCheck} title="Verification" sub="Is the model built as specified?">
        <Area label="Verification checks" value={e.verification} onChange={(v) => update((d) => { d.passport.evaluation.verification = v; })} hint="Units, conservation, simple cases with known answers." rows={4} />
      </FieldCard>
      <FieldCard icon={Microscope} title="Validation" sub="Is it adequate for its purpose?">
        <Area label="Validation evidence plan" value={e.validation} onChange={(v) => update((d) => { d.passport.evaluation.validation = v; })} hint="Evidence that was not used for tuning." rows={4} />
      </FieldCard>
      <FieldCard icon={Gauge} title="Calibration" sub="Tuning — kept separate from validation.">
        <Area label="Calibration (kept separate)" value={e.calibration} onChange={(v) => update((d) => { d.passport.evaluation.calibration = v; })} hint="Which parameters, on which data period?" rows={3} />
      </FieldCard>
    </div>
  );
}

// ── Step 6 · Outcomes and experiment ──────────────────────────────────────
export function OutcomesForm() {
  const { doc, update, readOnly } = usePassport();
  const rows = doc.passport.outcomes;
  const edit = (id: string, fn: (r: OutcomeRow) => void) => update((d) => { const r = d.passport.outcomes.find((x) => x.id === id); if (r) fn(r); });
  return (
    <FieldCard icon={ClipboardList} title="Outcomes" sub="Defined so someone else could compute them." aside={rows.length > 0 ? <span className="cp-count">{rows.length}</span> : undefined}>
      {rows.length === 0 && <p className="cp-empty-row">No outcome metric yet.</p>}
      {readOnly ? (
        <ul className="list-reset cp-facts">
          {rows.map((o, i) => (
            <li key={o.id}>
              <div className="cp-fact-top"><strong>{o.metric || `Outcome ${i + 1}`}{o.unit && <small> ({o.unit})</small>}</strong>{o.direction && <Badge>{DIRECTIONS.find((x) => x.value === o.direction)?.label}</Badge>}</div>
              {o.definition && <p><span className="cp-fact-key">Definition</span> {o.definition}</p>}
              {o.aggregation && <p><span className="cp-fact-key">Aggregation</span> {o.aggregation}</p>}
              {o.criterion && <p><span className="cp-fact-key">Decision criterion</span> {o.criterion}</p>}
            </li>
          ))}
        </ul>
      ) : rows.map((o, i) => (
        <div key={o.id} className="cp-row">
          <RowHead n={i + 1} title={o.metric || 'New outcome'} deleteLabel={`Remove outcome ${i + 1}`} onDelete={() => update((d) => { d.passport.outcomes = d.passport.outcomes.filter((x) => x.id !== o.id); })} />
          <div className="inline-fields">
            <Txt label="Metric" value={o.metric} onChange={(v) => edit(o.id, (x) => { x.metric = v; })} />
            <Txt label="Unit" value={o.unit} onChange={(v) => edit(o.id, (x) => { x.unit = v; })} />
          </div>
          <Choice label="Desired direction" value={o.direction} clearTo="" onChange={(v) => edit(o.id, (x) => { x.direction = v; })} options={DIRECTIONS} />
          <Area label="Definition" value={o.definition} onChange={(v) => edit(o.id, (x) => { x.definition = v; })} rows={2} />
          <div className="inline-fields">
            <Txt label="Aggregation" value={o.aggregation} onChange={(v) => edit(o.id, (x) => { x.aggregation = v; })} placeholder="e.g. mean over replications" />
            <Txt label="Decision criterion" value={o.criterion} onChange={(v) => edit(o.id, (x) => { x.criterion = v; })} placeholder="Which value changes the decision?" />
          </div>
        </div>
      ))}
      {!readOnly && (
        <button type="button" className="btn cp-add" onClick={() => update((d) => { d.passport.outcomes.push({ id: newId('out'), metric: '', definition: '', unit: '', direction: '', aggregation: '', criterion: '' }); })}>
          <Plus size={16} aria-hidden="true" /> Add outcome
        </button>
      )}
    </FieldCard>
  );
}

export function ExperimentFields() {
  const { doc, update, readOnly } = usePassport();
  const { toast } = useStore();
  const x = doc.passport.experiment;
  const appendSandbox = () => {
    const b = doc.sandbox.baseline;
    const text = `ModSim Essentials sandbox (engine backlog-daily-v1, RNG sfc32-cyrb128-v1): horizon ${b.horizon} days; initial backlog ${b.initialBacklog} req-eq; demand ${b.demand.mode}${b.demand.mode === 'random' ? ` (values ${b.demand.values.join('/')}, probabilities ${b.demand.probs.join('/')}); ${b.replications} replications; seed "${b.seed}"` : ''}; capacity ${b.capacity.mode}${doc.sandbox.alternative ? '; one alternative policy, paired on shared arrivals where demand is identical' : ''}.`;
    update((d) => { d.passport.experiment.runSettings = d.passport.experiment.runSettings ? `${d.passport.experiment.runSettings}\n${text}` : text; });
    toast('Current sandbox settings appended to Run settings.', 'success');
  };
  return (
    <FieldCard icon={FlaskConical} title="Experiment" sub="Change one thing. Keep the rest identical.">
      <div className="cp-duo">
        <div className="cp-duo-a"><Area label="Baseline" value={x.baseline} onChange={(v) => update((d) => { d.passport.experiment.baseline = v; })} rows={3} /></div>
        <div className="cp-duo-b"><Area label="Alternatives" value={x.alternatives} onChange={(v) => update((d) => { d.passport.experiment.alternatives = v; })} rows={3} /></div>
      </div>
      <Area label="Comparison logic" value={x.comparison} onChange={(v) => update((d) => { d.passport.experiment.comparison = v; })} hint="What stays identical? Which outcome decides?" />
      <Area label="Run settings" value={x.runSettings} onChange={(v) => update((d) => { d.passport.experiment.runSettings = v; })} hint="Horizon, replications, seed, software version." />
      {!readOnly && <button type="button" className="btn small" onClick={appendSandbox}><Sparkles size={14} aria-hidden="true" /> Append current sandbox settings</button>}
    </FieldCard>
  );
}

// ── Step 7 · Conclude ─────────────────────────────────────────────────────
export function ConclusionFields() {
  const { doc, update } = usePassport();
  const c = doc.passport.conclusion;
  return (
    <>
      <FieldCard icon={Sparkles} title="What you found">
        <Area label="Results summary" value={c.results} onChange={(v) => update((d) => { d.passport.conclusion.results = v; })} hint="Effect sizes with uncertainty, and the settings behind them." rows={4} />
      </FieldCard>
      <FieldCard icon={Megaphone} title="What you recommend">
        <Area label="Recommendation" value={c.recommendation} onChange={(v) => update((d) => { d.passport.conclusion.recommendation = v; })} hint="Under which assumptions does it hold?" />
        <Area label="Conditions that would change the decision" value={c.changeConditions} onChange={(v) => update((d) => { d.passport.conclusion.changeConditions = v; })} />
      </FieldCard>
      <FieldCard icon={CircleHelp} title="What it cannot say">
        <Area label="Limitations" value={c.limitations} onChange={(v) => update((d) => { d.passport.conclusion.limitations = v; })} />
      </FieldCard>
    </>
  );
}
