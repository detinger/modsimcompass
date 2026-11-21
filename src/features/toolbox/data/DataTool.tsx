import { StubTool } from '../StubTool';

/** `/toolbox/data[/:id]`. Placeholder until the data and inputs tool is built. */
export default function DataTool({ id }: { id?: string }) {
  return (
    <StubTool kind="data-model" id={id} example={(d) => {
      d.name = 'Daily arrivals'; d.unit = 'requests per day';
      d.family = 'poisson'; d.params = [12]; d.origin = 'described';
      d.provenance = 'Made-up example, not data.'; d.uncertainty = 'Typical days range from 8 to 16.';
      d.availability = 'assume';
    }} />
  );
}
