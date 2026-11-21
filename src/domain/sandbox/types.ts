/** Complete sandbox contracts (PLAN §6). Units: request-equivalents (req-eq) and days. */

export type DemandMode = 'constant' | 'random' | 'list';
export type CapacityMode = 'direct' | 'staff' | 'list';

export interface DemandConfig {
  mode: DemandMode;
  /** Arrivals per day when mode = 'constant'. */
  constant: number;
  /** Finite discrete distribution when mode = 'random'. */
  values: number[];
  probs: number[];
  /** Explicit per-day arrivals when mode = 'list' (length must equal horizon). */
  list: number[];
}

export interface CapacityConfig {
  mode: CapacityMode;
  /** Capacity per open day when mode = 'direct'. */
  direct: number;
  /** Staff count and daily productivity per staff member when mode = 'staff'. */
  staff: number;
  productivity: number;
  /** Explicit per-day capacity when mode = 'list' (length must equal horizon). */
  list: number[];
}

export interface ScheduleConfig {
  enabled: boolean;
  /** Seven flags, index 0 = day 1 of the horizon, repeating weekly. */
  openDays: boolean[];
  paidDays: boolean[];
}

export interface SandboxConfig {
  horizon: number;
  initialBacklog: number;
  demand: DemandConfig;
  capacity: CapacityConfig;
  schedule: ScheduleConfig;
  abandonment: { enabled: boolean; fraction: number };
  feedback: { enabled: boolean; alpha: number };
  cost: { enabled: boolean; costPerStaffDay: number; holdingRate: number; currency: string };
  replications: number;
  seed: string;
}

export interface DailyRow {
  day: number;
  startBacklog: number;
  arrivals: number;
  open: boolean;
  paid: boolean;
  nominalCapacity: number;
  effectiveCapacity: number;
  available: number;
  served: number;
  remaining: number;
  abandoned: number;
  endBacklog: number;
  staffCost: number | null;
  holdingCost: number | null;
  /** start + arrivals − served − abandoned − end (should be ~0). */
  residual: number;
}

export interface TraceMetrics {
  totalArrivals: number;
  totalServed: number;
  totalAbandoned: number;
  terminalBacklog: number;
  averageEndBacklog: number;
  totalEffectiveCapacity: number;
  /** null when total effective capacity is zero (undefined, not 0%). */
  utilisation: number | null;
  totalStaffCost: number | null;
  totalHoldingCost: number | null;
  totalCost: number | null;
  maxAbsResidual: number;
}

export interface DailyTrace {
  replication: number;
  rows: DailyRow[];
  metrics: TraceMetrics;
}

export interface ReplicationSummary extends TraceMetrics {
  replication: number;
}

export type RunStatus = 'running' | 'partial' | 'complete' | 'failed';

export interface PolicyResult {
  label: string;
  configHash: string;
  summaries: ReplicationSummary[];
  /** Retained subset: the first trajectory (inspected) only. */
  retainedTrace: DailyTrace | null;
}

export interface RunRecord {
  id: string;
  projectId: string;
  modelRevision: number;
  modelHash: string;
  engineVersion: string;
  rngVersion: string;
  seed: string;
  requestedReplications: number;
  completedReplications: number;
  status: RunStatus;
  createdAt: string;
  baselineSnapshot: SandboxConfig;
  alternativeSnapshot: SandboxConfig | null;
  comparisonKind: 'none' | 'paired-policy' | 'scenario';
  baseline: PolicyResult;
  alternative: PolicyResult | null;
  /** Arrival arrays for the first few replications (preview, bounded). */
  arrivalPreview: number[][];
  error?: string;
}

export interface FieldError {
  path: string;
  message: string;
}
