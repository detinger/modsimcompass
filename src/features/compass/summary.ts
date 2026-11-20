import type { StepId } from '../../domain/passport/compass';
import { METHOD_BY_ID } from '../../domain/methods/registry';
import { EVIDENCE_KINDS, type ProjectDoc } from '../../domain/passport/schema';

export interface SummaryItem { label: string; value: string | string[] }

const CLAIM_LABEL: Record<string, string> = {
  descriptive: 'Descriptive', explanatory: 'Explanatory', predictive: 'Predictive', exploratory: 'Exploratory', 'decision-support': 'Decision support',
};
const DIRECTION_LABEL: Record<string, string> = { lower: 'lower is better', higher: 'higher is better', target: 'close to a target' };
const join = (parts: (string | false | undefined)[], sep = ' · ') => parts.filter((x): x is string => !!x && x.trim().length > 0).join(sep);

/** A step of a passport as plain label → text pairs (used for the read-only “peek” at the worked example). */
export function stepSummary(doc: ProjectDoc, step: StepId): SummaryItem[] {
  const p = doc.passport;
  const items: SummaryItem[] = (() => {
    switch (step) {
      case 'frame': return [
        { label: 'Stakeholder', value: p.decision.stakeholder },
        { label: 'Observed problem', value: p.decision.problem },
        { label: 'Decision levers', value: p.decision.levers },
        { label: 'Outcome of interest', value: p.decision.outcome },
        { label: 'Precise question', value: p.decision.question },
        { label: 'Claim type', value: CLAIM_LABEL[p.decision.claimType] ?? '' },
      ];
      case 'scope': {
        const name = (id: string) => p.representation.nodes.find((n) => n.id === id)?.label || '(unnamed)';
        return [
          { label: 'Boundary (included)', value: p.scope.boundary },
          { label: 'Exclusions', value: p.scope.exclusions },
          { label: 'Horizon', value: join([p.scope.horizon, p.scope.timeUnit && `time unit: ${p.scope.timeUnit}`]) },
          { label: 'Level of detail', value: p.scope.detail },
          { label: 'Constraints', value: p.scope.constraints },
          { label: 'Conceptual sketch', value: p.representation.relations.map((r) => `${name(r.from)} ${r.directed ? '→' : '—'} ${r.label || 'relates to'} ${r.directed ? '→' : '—'} ${name(r.to)}`) },
        ];
      }
      case 'method': return [
        { label: 'Primary method', value: p.representation.primaryMethod ? METHOD_BY_ID[p.representation.primaryMethod].name : '' },
        { label: 'Why it fits', value: p.representation.justification },
        { label: 'Alternative method', value: p.representation.alternativeMethod ? METHOD_BY_ID[p.representation.alternativeMethod].name : '' },
        { label: 'Why it is less suitable', value: p.representation.alternativeJustification },
      ];
      case 'inputs': return [
        { label: 'Inputs', value: p.inputs.map((r) => join([`${r.name}: ${join([r.value, r.unit], ' ')}`, EVIDENCE_KINDS.find((e) => e.value === r.sourceType)?.label, r.provenance, r.uncertainty && `uncertainty: ${r.uncertainty}`])) },
        { label: 'Assumptions', value: p.assumptions.map((a) => join([a.statement, a.consequenceIfWrong && `Consequence: ${a.consequenceIfWrong}`, a.plannedCheck && `Check: ${a.plannedCheck}`], ' ')) },
      ];
      case 'evaluation': return [
        { label: 'Verification checks', value: p.evaluation.verification },
        { label: 'Validation evidence plan', value: p.evaluation.validation },
        { label: 'Calibration (kept separate)', value: p.evaluation.calibration },
      ];
      case 'experiment': return [
        { label: 'Outcomes', value: p.outcomes.map((o) => join([`${o.metric}${o.unit ? ` (${o.unit})` : ''}`, DIRECTION_LABEL[o.direction], o.definition, o.aggregation, o.criterion])) },
        { label: 'Baseline', value: p.experiment.baseline },
        { label: 'Alternatives', value: p.experiment.alternatives },
        { label: 'Comparison logic', value: p.experiment.comparison },
        { label: 'Run settings', value: p.experiment.runSettings },
      ];
      case 'conclude': return [
        { label: 'Results summary', value: p.conclusion.results },
        { label: 'Recommendation', value: p.conclusion.recommendation },
        { label: 'Conditions that would change the decision', value: p.conclusion.changeConditions },
        { label: 'Limitations', value: p.conclusion.limitations },
      ];
    }
  })();
  return items.filter((i) => (Array.isArray(i.value) ? i.value.length > 0 : i.value.trim().length > 0));
}
