import type { PreparedSample } from '../../../domain/distributions/inputModel';

/** Where the numbers on screen came from. */
export type SampleSource = 'csv' | 'paste' | 'kept' | 'example';

/** The data on screen. It lives in memory only, unless the user keeps it with the artefact. */
export interface Sample { prepared: PreparedSample; label: string; source: SampleSource }
