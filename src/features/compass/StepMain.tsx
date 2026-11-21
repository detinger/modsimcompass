import { useState, type ReactNode } from 'react';
import { ArrowRight, ClipboardList, Download, FlaskConical, Gauge, Info, Microscope, Milestone, PenLine, ShieldCheck, Sigma } from 'lucide-react';
import { Link } from '../../app/router';
import { kindDef } from '../../domain/artefacts/kinds';
import type { ArtefactKind } from '../../domain/artefacts/types';
import { CALIBRATION_NOTE } from '../../domain/methods/profiles';
import { effectiveProfile, evaluationFields, experimentFields, setStillPlanning, stillPlanning, type StepId, type StepProfile } from '../../domain/passport/compass';
import type { ProjectDoc } from '../../domain/passport/schema';
import { ArtefactCard } from '../toolbox/ArtefactCard';
import { ArtefactSlot, MeasurementInvite } from '../project/ArtefactSlot';
import { usePassport } from '../project/passportContext';
import { Area, FieldCard } from '../project/fields';
import {
  AssumptionsForm, ConceptNotes, ConclusionFields, EvaluationFields, ExperimentFields, FrameFields, InputsForm, MethodChoiceFields, OutcomesForm, ScopeFields,
} from '../project/PassportForms';

const filled = (...xs: string[]) => xs.some((x) => x.trim().length > 0);
const has = (doc: ProjectDoc, kind: ArtefactKind) => (doc.artefacts ?? []).some((i) => i.kind === kind);

/**
 * The fields an artefact fills in, for anyone who would rather write them. Open when nothing is included and the
 * fields already hold text; folded when an artefact is included (it has filled them in) or when they are empty.
 */
function Instead({ kind, hasText, children }: { kind: ArtefactKind; hasText: boolean; children: ReactNode }) {
  const { doc } = usePassport();
  const included = has(doc, kind);
  const [open, setOpen] = useState(!included && hasText);
  return (
    <details className="cp-instead" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary><PenLine size={15} aria-hidden="true" /> Write it here instead{included && <small>Filled in from the {kindDef(kind).label.toLowerCase()} above</small>}</summary>
      <div className="cp-instead-body">{children}</div>
    </details>
  );
}

/** The comparisons of step 6, as a reminder while the results are written. */
function FromExperiment() {
  const { doc, base } = usePassport();
  const copies = (doc.artefacts ?? []).filter((i) => i.kind === 'comparison');
  if (copies.length === 0) return null;
  return (
    <section className="cp-from" aria-labelledby="from-h">
      <h3 id="from-h">From step 6</h3>
      <div className="cp-slot-cards">
        {copies.map((inc) => {
          const def = kindDef(inc.kind);
          let summary: string[] = [], figure: string | null = null;
          try { summary = def.summary(inc.data); figure = def.figure(inc.data); } catch { /* the card shows what it can */ }
          return <ArtefactCard key={inc.id} kind={inc.kind} title={inc.title} updatedAt={inc.addedAt} dateLabel="Added" summary={summary} figure={figure} to={`${base}/experiment`} headingLevel={4} />;
        })}
      </div>
    </section>
  );
}

/** One line on what a step means for the method, for example what calibration means for a statistical model. */
function MethodNote({ children }: { children: ReactNode }) {
  return <p className="cp-method-note"><Info size={16} aria-hidden="true" /><span>{children}</span></p>;
}

/** Step 5's fields with the method's words. A tuned model keeps the general fields. */
function EvaluationByProfile({ profile }: { profile: StepProfile }) {
  const { doc, update } = usePassport();
  if (profile.calibration === 'tuning' || !profile.known) return <EvaluationFields />;
  const icons = { verification: ShieldCheck, validation: Microscope, calibration: Gauge };
  return (
    <div className="cp-trio">
      {evaluationFields(profile).map((f) => (
        <FieldCard key={f.field} icon={icons[f.field]} title={f.title} sub={f.sub}>
          <Area label={f.label} value={doc.passport.evaluation[f.field]} onChange={(v) => update((d) => { d.passport.evaluation[f.field] = v; })} hint={f.hint} rows={f.field === 'calibration' ? 3 : 4} />
        </FieldCard>
      ))}
    </div>
  );
}

/** Step 6's design with the method's words: a scenario analysis or an analysis plan. A policy experiment keeps the general fields. */
function ExperimentByProfile({ profile }: { profile: StepProfile }) {
  const { doc, update } = usePassport();
  if (profile.experiment === 'policy-experiment') return <ExperimentFields />;
  const t = experimentFields(profile), x = doc.passport.experiment;
  const field = (k: keyof typeof t.label, rows: number) => (
    <Area label={t.label[k]} value={x[k]} onChange={(v) => update((d) => { d.passport.experiment[k] = v; })} hint={t.hint[k] || undefined} rows={rows} />
  );
  return (
    <FieldCard icon={profile.experiment === 'analysis-plan' ? Sigma : FlaskConical} title={t.title} sub={t.sub}>
      <div className="cp-duo">
        <div className="cp-duo-a">{field('baseline', profile.experiment === 'analysis-plan' ? 5 : 3)}</div>
        <div className="cp-duo-b">{field('alternatives', 3)}</div>
      </div>
      {field('comparison', 3)}
      {field('runSettings', 3)}
    </FieldCard>
  );
}

/** For an analysis plan: where the effects come from and where they are checked, instead of a policy comparison. */
function AnalysisPointer() {
  const { base } = usePassport();
  return (
    <section className="cp-pointer" aria-label="Where the effects come from">
      <span className="cp-pointer-icon" aria-hidden="true"><ClipboardList size={20} /></span>
      <p>Effects are estimated from your <Link to={`${base}/inputs`}>measurement data <ArrowRight size={13} aria-hidden="true" /></Link> and checked in your <Link to={`${base}/evaluation`}>check plan <ArrowRight size={13} aria-hidden="true" /></Link></p>
    </section>
  );
}

/** The main column of a step: the artefact slot first (steps 2, 3, 5, 6), then the step's questions, worded for the method. */
/**
 * “Still planning”, on every step: the step comes later, so while it is empty nothing in it counts as missing
 * (compass.ts `stillPlanning`). Once something is written in it, the usual open items come back.
 */
export function StillPlanning({ step }: { step: StepId }) {
  const { doc, update, readOnly } = usePassport();
  if (readOnly) return null;
  const id = step === 'conclude' ? 'stage-planning' : `still-planning-${step}`;
  const help = step === 'conclude' ? 'nothing has been run yet, so this step is due later.' : 'this step comes later. Until you write in it, nothing here counts as missing.';
  return (
    <div className="cp-stage">
      <input id={id} type="checkbox" aria-describedby={`${id}-help`} checked={stillPlanning(doc.passport, step)}
        onChange={(e) => update((d) => setStillPlanning(d.passport, step, e.target.checked))} />
      <span><label htmlFor={id}><strong>Still planning</strong></label><span id={`${id}-help`}> — {help}</span></span>
    </div>
  );
}

export function StepMain({ step, onExport }: { step: StepId; onExport: () => void }) {
  const { doc, readOnly, base } = usePassport();
  const p = doc.passport, rep = p.representation;
  const profile = effectiveProfile(doc);
  const calibrationNote = profile.known ? CALIBRATION_NOTE[profile.calibration] : null;
  switch (step) {
    case 'frame': return <FrameFields />;
    case 'scope': return (
      <>
        <ArtefactSlot kind="concept-model" />
        <ScopeFields />
        <Instead kind="concept-model" hasText={filled(rep.notes) || rep.nodes.length > 0}><ConceptNotes /></Instead>
      </>
    );
    case 'method': return (
      <>
        <ArtefactSlot kind="method-choice" />
        <Instead kind="method-choice" hasText={!!rep.primaryMethod || !!rep.alternativeMethod || filled(rep.justification, rep.alternativeJustification)}><MethodChoiceFields /></Instead>
      </>
    );
    case 'inputs': return (
      <>
        {profile.inputs === 'measurement'
          ? <InputsForm title="Measured variables" sub="Constructs, their items, and where the answers come from." invite={<MeasurementInvite />} />
          : profile.inputs === 'parameters'
            ? <InputsForm title="Parameters" sub="A value, a unit and a source for each." />
            : <InputsForm />}
        <AssumptionsForm />
      </>
    );
    case 'evaluation': return (
      <>
        <ArtefactSlot kind="check-plan" />
        {calibrationNote && <MethodNote>{calibrationNote}</MethodNote>}
        <Instead kind="check-plan" hasText={filled(p.evaluation.verification, p.evaluation.validation, p.evaluation.calibration)}><EvaluationByProfile profile={profile} /></Instead>
      </>
    );
    case 'experiment': return (
      <>
        {profile.experiment === 'policy-experiment' && <ArtefactSlot kind="comparison" />}
        {profile.experiment === 'analysis-plan' && <AnalysisPointer />}
        <OutcomesForm />
        <ExperimentByProfile profile={profile} />
      </>
    );
    case 'conclude': return (
      <>
        <FromExperiment />
        <ConclusionFields />
        <section className="cp-finish">
          <div>
            <h3>{readOnly ? 'Reviewed at five checkpoints' : 'Ready to share?'}</h3>
            <p>{readOnly ? 'See how the example was reviewed.' : 'One report, with every artefact in it.'}</p>
          </div>
          <div className="btn-row">
            {!readOnly && <button type="button" className="btn primary cp-big" onClick={onExport}><Download size={18} aria-hidden="true" /> Export project</button>}
            <Link to={`${base}/checkpoints`} className="btn cp-big"><Milestone size={18} aria-hidden="true" /> Checkpoints</Link>
          </div>
        </section>
      </>
    );
  }
}
