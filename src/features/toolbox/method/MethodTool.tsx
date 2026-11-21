import { FigureCard } from '../../../ui/playful';
import { StubTool } from '../StubTool';

/** `/toolbox/method[/:id]`. Placeholder until the method chooser is built. */
export default function MethodTool({ id }: { id?: string }) {
  return (
    <StubTool kind="method-choice" id={id} intro={<FigureCard id="method-families" />} example={(d) => {
      d.answers.feedback = 'yes'; d.answers.time = 'dynamic'; d.answers.granularity = 'aggregate';
      d.shortlist = ['system-dynamics', 'des'];
      d.primary = 'system-dynamics'; d.alternative = 'des';
      d.justification = 'The question is about a total that builds up over weeks.';
      d.alternativeJustification = 'Needed only if individual waiting times turn out to matter.';
    }} />
  );
}
