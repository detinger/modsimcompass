import { FigureCard } from '../../../ui/playful';
import { StubTool } from '../StubTool';

/** `/toolbox/checks[/:id]`. Placeholder until the verification and validation tool is built. */
export default function ChecksTool({ id }: { id?: string }) {
  return (
    <StubTool kind="check-plan" id={id} intro={<FigureCard id="vv-cycle" />} example={(d) => {
      d.checks = [
        { id: 'c1', group: 'verification', text: 'Every day: start + arrivals − served = end.', status: 'passed', evidence: 'Residual is zero in all runs.' },
        { id: 'c2', group: 'verification', text: 'The same seed gives the same result.', status: 'planned', evidence: '' },
        { id: 'c3', group: 'validation', text: 'Compare with records that were not used for tuning.', status: 'planned', evidence: '' },
      ];
      d.validation.measure = 'Mean end-of-day backlog over 30 days'; d.validation.tolerancePct = 20;
    }} />
  );
}
