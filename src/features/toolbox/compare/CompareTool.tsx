import { FigureCard } from '../../../ui/playful';
import { StubTool } from '../StubTool';

/** `/toolbox/compare[/:id]`. Placeholder until the fair comparison tool is built. */
export default function CompareTool({ id }: { id?: string }) {
  return (
    <StubTool kind="comparison" id={id} intro={<FigureCard id="paired-comparison" />} example={(d) => {
      d.outcome = 'Average end-of-day backlog'; d.unit = 'requests'; d.direction = 'lower';
      d.baselineLabel = 'Capacity 10'; d.alternativeLabel = 'Capacity 12';
      d.baseline = [30, 28, 33, 31, 29]; d.alternative = [6, 5, 8, 7, 6]; d.paired = true;
      d.origin = 'example'; d.note = 'Made-up numbers to try the frame.';
    }} />
  );
}
