import { ChartColumn, ClipboardList, Network, Scale, Shapes, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { ArtefactKind } from '../../domain/artefacts/types';

/** How each tool looks and what it is called on screen. Addresses and steps live in `KINDS` (domain). */
export interface ToolMeta {
  /** Page heading. */
  name: string;
  /** Menu label. */
  short: string;
  /** One line under the name. */
  tagline: string;
  icon: LucideIcon;
  tone: string;
}

export const TOOL_META: Record<ArtefactKind, ToolMeta> = {
  'concept-model': { name: 'Conceptual model', short: 'Conceptual model', tagline: 'Draw what is in the model, and what is left out.', icon: Network, tone: 'tone-teal' },
  'method-choice': { name: 'Method chooser', short: 'Method chooser', tagline: 'Find the method that fits your question.', icon: Shapes, tone: 'tone-purple' },
  'data-model': { name: 'Data and inputs', short: 'Data and inputs', tagline: 'Turn data, or a description, into an input model.', icon: ChartColumn, tone: 'tone-brown' },
  'measurement-data': { name: 'Data and inputs', short: 'Measurement data', tagline: 'Survey items and measured variables, grouped into constructs.', icon: ClipboardList, tone: 'tone-brown' },
  'check-plan': { name: 'Verification, validation, calibration', short: 'Verify and validate', tagline: 'Plan the checks. Record what they showed.', icon: ShieldCheck, tone: 'tone-primary' },
  'comparison': { name: 'Fair comparison', short: 'Fair comparison', tagline: 'Tell a real difference from chance.', icon: Scale, tone: 'tone-orange' },
};
