import { FigureCard } from '../../../ui/playful';
import { StubTool } from '../StubTool';

/** `/toolbox/concept[/:id]`. Placeholder until the conceptual model tool is built. */
export default function ConceptTool({ id }: { id?: string }) {
  return (
    <StubTool kind="concept-model" id={id} intro={<FigureCard id="concept-components" />} example={(d) => {
      d.objectives = 'See how daily capacity changes the backlog.';
      d.nodes = [
        { id: 'n1', type: 'lever', label: 'Daily capacity', x: 80, y: 120, zone: 'inputs' },
        { id: 'n2', type: 'stock', label: 'Open requests', x: 320, y: 120, zone: 'content' },
        { id: 'n3', type: 'outcome', label: 'Average backlog', x: 560, y: 120, zone: 'outputs' },
        { id: 'n4', type: 'external', label: 'Other offices', x: 320, y: 300, zone: 'outside' },
      ];
      d.edges = [
        { id: 'e1', from: 'n1', to: 'n2', kind: 'influence', sign: '-', label: '' },
        { id: 'e2', from: 'n2', to: 'n3', kind: 'information', sign: '', label: 'measured as' },
      ];
    }} />
  );
}
