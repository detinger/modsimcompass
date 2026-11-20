import type { ComponentType } from 'react';
import { DIAGRAMS } from '../../content/diagrams/specs';
import type { DiagramId } from '../../content/diagrams/types';
import CompassJourney from './CompassJourney';
import ConceptComponents from './ConceptComponents';
import MethodFamilies from './MethodFamilies';
import PairedComparison from './PairedComparison';
import VvCycle from './VvCycle';
import '../../styles/diagrams.css';

const VIEWS: Record<DiagramId, ComponentType> = {
  'compass-journey': CompassJourney,
  'concept-components': ConceptComponents,
  'method-families': MethodFamilies,
  'vv-cycle': VvCycle,
  'paired-comparison': PairedComparison,
};

const spec = (id: string) => (Object.hasOwn(DIAGRAMS, id) ? DIAGRAMS[id as DiagramId] : undefined);

/** The diagram itself. This module (and everything it imports) is loaded lazily by FigureCard. */
export default function DiagramView({ id }: { id: string }) {
  const View = Object.hasOwn(VIEWS, id) ? VIEWS[id as DiagramId] : null;
  return View ? <View /> : <p className="field-error">Diagram “{id}” not found.</p>;
}

/** Title and one-sentence caption; a card may override the caption. */
export function DiagramHeading({ id, caption }: { id: string; caption?: string }) {
  const s = spec(id);
  if (!s) return null;
  return <figcaption className="dgm-heading"><strong>{s.title}</strong><span>{caption ?? s.caption}</span></figcaption>;
}

/** Plain-text equivalent for the “As text” disclosure. */
export function DiagramText({ id }: { id: string }) {
  const s = spec(id);
  return s ? <ul>{s.text.map((line) => <li key={line}>{line}</li>)}</ul> : null;
}
