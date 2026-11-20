import { CircleDashed, Flag, FlaskConical, Lightbulb, Scan, Shapes, ShieldCheck, SlidersHorizontal, Target, TriangleAlert, type LucideIcon } from 'lucide-react';
import { STEPS, type Severity, type StepId, type Warning } from '../../domain/passport/compass';
import type { CheckpointId, ReviewStatus } from '../../domain/passport/schema';

/** Colour and icon for each compass step. Colours come from the tone-* token classes. */
export const STEP_META: Record<StepId, { tone: string; icon: LucideIcon }> = {
  frame: { tone: 'tone-blue', icon: Target },
  scope: { tone: 'tone-teal', icon: Scan },
  method: { tone: 'tone-purple', icon: Shapes },
  inputs: { tone: 'tone-brown', icon: SlidersHorizontal },
  evaluation: { tone: 'tone-primary', icon: ShieldCheck },
  experiment: { tone: 'tone-orange', icon: FlaskConical },
  conclude: { tone: 'tone-green', icon: Flag },
};

export const CHECKPOINT_TONE: Record<CheckpointId, string> = {
  proposal: 'tone-blue', design: 'tone-purple', baseline: 'tone-primary', evaluation: 'tone-orange', final: 'tone-green',
};

/** Open-item severities: label, icon and colour class. Wording never judges written reasoning. */
export const SEVERITY: Record<Severity, { label: string; icon: LucideIcon; cls: string }> = {
  gap: { label: 'Missing', icon: CircleDashed, cls: 'sev-gap' },
  check: { label: 'Check this', icon: TriangleAlert, cls: 'sev-check' },
  tip: { label: 'Suggestion', icon: Lightbulb, cls: 'sev-tip' },
};
export const SEVERITY_ORDER: Severity[] = ['gap', 'check', 'tip'];

export const STATUS_CLASS: Record<ReviewStatus, string> = {
  draft: 'st-draft', 'self-reviewed': 'st-self', 'teacher-reviewed': 'st-teacher', 'needs-revision': 'st-revise',
};

export const CHECKPOINTS_ID = 'checkpoints';
export const stepNumber = (id: StepId) => STEPS.findIndex((s) => s.id === id) + 1;

/**
 * Tips are labelled by their group, so the leading “Suggestion:” is dropped from the sentence.
 * The assumption field is labelled “Consequence if it fails”, so the message uses the same words.
 */
export function warningText(w: Warning): string {
  const t = w.message.replace(/^Suggestion:\s*/i, '').replace(/consequence if wrong/i, 'consequence if it fails');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Gaps and checks are “open”; tips are optional suggestions. */
export const openCount = (ws: Warning[]) => ws.filter((w) => w.severity !== 'tip').length;
