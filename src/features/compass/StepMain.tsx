import { Component, type ReactNode } from 'react';
import { MethodNeeds, MethodWatchOuts } from './MethodNeeds';
import { ArrowRight, ChartNoAxesCombined, Dices, Download, FlaskConical, Milestone, Route, Shapes } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from '../../app/router';
import type { StepId } from '../../domain/passport/compass';
import { FigureCard } from '../../ui/playful';
import { usePassport } from '../project/passportContext';
import {
  AssumptionsForm, ConceptSketch, ConclusionFields, EvaluationFields, ExperimentFields, FrameFields, InputsForm, MethodChoiceFields, OutcomesForm, ScopeFields,
} from '../project/PassportForms';
import { AppLink, MethodCatalogue, MethodChooser } from '../methods/Methods';

/** A diagram is a helper: if it cannot load, the step and its fields must still work. */
class FigureBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p className="cp-empty-row" role="status">The diagram could not be loaded.</p> : this.props.children; }
}
const Figure = ({ id }: { id: string }) => <FigureBoundary><FigureCard id={id} /></FigureBoundary>;

function ToolLink({ to, icon: Icon, title, text, tone }: { to: string; icon: LucideIcon; title: string; text: string; tone: string }) {
  return (
    <Link to={to} className={`cp-tool ${tone}`}>
      <span className="cp-tool-icon" aria-hidden="true"><Icon size={20} /></span>
      <span className="cp-tool-text"><strong>{title}</strong><small>{text}</small></span>
      <ArrowRight size={16} aria-hidden="true" className="cp-tool-go" />
    </Link>
  );
}

/** The main column of a step: its passport fields plus the helpers named in the spec (§3). */
export function StepMain({ step, onExport }: { step: StepId; onExport: () => void }) {
  const { doc, readOnly, base } = usePassport();
  const primary = doc.passport.representation.primaryMethod;
  switch (step) {
    case 'frame': return <FrameFields />;
    case 'scope': return (
      <>
        <ScopeFields />
        <Figure id="concept-components" />
        <ConceptSketch />
      </>
    );
    case 'method': return (
      <>
        <MethodChooser />
        <MethodChoiceFields aside={primary ? <p className="cp-handoff"><AppLink method={primary} /><span>Hand-off is manual: export the passport first.</span></p> : undefined} />
        <Figure id="method-families" />
        <MethodCatalogue />
      </>
    );
    case 'inputs': return (
      <>
        <div className="cp-tools three" role="group" aria-label="Distribution tools">
          <ToolLink to="/tools/choose" icon={Route} title="Choose" text="a distribution" tone="tone-teal" />
          <ToolLink to="/tools/distributions" icon={Shapes} title="Explore" text="a distribution" tone="tone-purple" />
          <ToolLink to="/tools/fitting" icon={ChartNoAxesCombined} title="Fit" text="a distribution" tone="tone-orange" />
        </div>
        <MethodNeeds />
        <InputsForm />
        <AssumptionsForm />
      </>
    );
    case 'evaluation': return (
      <>
        <EvaluationFields />
        <MethodWatchOuts />
        <Figure id="vv-cycle" />
        <div className="cp-tools">
          <ToolLink to="/tools/sandbox" icon={FlaskConical} title="Practise in the backlog sandbox" text="Try balance and drain checks on a small model." tone="tone-primary" />
        </div>
      </>
    );
    case 'experiment': return (
      <>
        <OutcomesForm />
        <ExperimentFields />
        <Figure id="paired-comparison" />
        <div className="cp-tools">
          <ToolLink to="/tools/sandbox" icon={Dices} title="Try a paired comparison" text="Replications on shared arrivals, in the sandbox." tone="tone-orange" />
        </div>
      </>
    );
    case 'conclude': return (
      <>
        <ConclusionFields />
        <section className="cp-finish">
          <div>
            <h3>{readOnly ? 'Assessed at five checkpoints' : 'Ready to share?'}</h3>
            <p>{readOnly ? 'See how the example was reviewed.' : 'One file carries everything a reviewer needs.'}</p>
          </div>
          <div className="btn-row">
            {!readOnly && <button type="button" className="btn primary cp-big" onClick={onExport}><Download size={18} aria-hidden="true" /> Export passport</button>}
            <Link to={`${base}/checkpoints`} className="btn cp-big"><Milestone size={18} aria-hidden="true" /> Checkpoints</Link>
          </div>
        </section>
      </>
    );
  }
}
