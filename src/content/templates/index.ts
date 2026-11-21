import type { ProjectDoc } from '../../domain/passport/schema';
import { startFromTemplate } from './build';
import { cicdPipeline } from './cicd-pipeline';
import { cloudAvailability } from './cloud-availability';
import { erpRollout } from './erp-rollout';
import { phishingSpread } from './phishing-spread';
import { platformAdoption } from './platform-adoption';
import type { ProjectTemplate } from './types';

export type { ProjectTemplate } from './types';
export { originalsFor, startFromTemplate, type Started } from './build';

/** The templates on the Project page, in the order shown: one method each, from IT and information systems. */
export const TEMPLATES: readonly ProjectTemplate[] = [cicdPipeline, erpRollout, cloudAvailability, platformAdoption, phishingSpread];

/** Where a project made from a template came from (`ProjectDoc.origin.ref`). */
export const templateRef = (t: ProjectTemplate) => `template:${t.id}`;

/**
 * A new project from a template: steps 1 to 6 filled in and the template's artefacts included, step 7 left to the
 * reader, so it starts in the planning stage. Checkpoints start as drafts; everything is a copy, so the template itself
 * never changes. `startFromTemplate` also returns the artefacts, for My artefacts.
 */
export function projectFromTemplate(t: ProjectTemplate, opts: { now?: string; title?: string } = {}): ProjectDoc {
  return startFromTemplate(t, opts).project;
}
