import type { ProjectDoc } from '../domain/passport/schema';
import type { DailyRow, ReplicationSummary, RunRecord } from '../domain/sandbox/types';
import { runIsStale } from './runInfo';

/**
 * CSV export of sandbox results (PLAN §13): unlocalised numbers (dot decimal, no
 * thousands separators), explicit units in column names, row type, run ID and
 * partial/stale status on every row. Retained subset: daily rows exist only for the
 * inspected first trajectory of each policy; replication rows cover every completed replication.
 */
const COLUMNS = [
  'run_id', 'run_status', 'stale', 'row_type', 'policy', 'replication', 'day',
  'start_backlog_req_eq', 'arrivals_req_eq', 'nominal_capacity_req_eq', 'effective_capacity_req_eq',
  'served_req_eq', 'abandoned_req_eq', 'end_backlog_req_eq', 'open_day', 'paid_day',
  'staff_cost', 'holding_cost', 'conservation_residual_req_eq',
  'total_arrivals_req_eq', 'total_served_req_eq', 'total_abandoned_req_eq', 'terminal_backlog_req_eq',
  'average_end_backlog_req_eq', 'total_effective_capacity_req_eq', 'utilisation_ratio', 'total_cost', 'currency',
];

/** Neutralise spreadsheet formula injection in text cells and quote as needed. */
export function csvText(s: string): string {
  let t = s;
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  if (/[",\n\r]/.test(t)) t = `"${t.replace(/"/g, '""')}"`;
  return t;
}
const num = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '' : String(n));

export function runToCsv(doc: ProjectDoc, run: RunRecord): string {
  const stale = runIsStale(doc) ? 'true' : 'false';
  const lines = [COLUMNS.join(',')];
  const currency = run.baselineSnapshot.cost.enabled ? run.baselineSnapshot.cost.currency : '';
  const base = (rowType: string, policy: string) => [csvText(run.id), csvText(run.status), stale, rowType, csvText(policy)];
  const daily = (policy: string, rep: number, r: DailyRow) => [
    ...base('daily', policy), String(rep), String(r.day),
    num(r.startBacklog), num(r.arrivals), num(r.nominalCapacity), num(r.effectiveCapacity), num(r.served), num(r.abandoned), num(r.endBacklog),
    r.open ? '1' : '0', r.paid ? '1' : '0', num(r.staffCost), num(r.holdingCost), num(r.residual),
    '', '', '', '', '', '', '', '', csvText(currency),
  ];
  const repl = (policy: string, s: ReplicationSummary) => [
    ...base('replication', policy), String(s.replication), '',
    '', '', '', '', '', '', '', '', '', '', '', '',
    num(s.totalArrivals), num(s.totalServed), num(s.totalAbandoned), num(s.terminalBacklog), num(s.averageEndBacklog),
    num(s.totalEffectiveCapacity), num(s.utilisation), num(s.totalCost), csvText(currency),
  ];
  const policies = [run.baseline, ...(run.alternative ? [run.alternative] : [])];
  for (const p of policies) {
    if (p.retainedTrace) for (const r of p.retainedTrace.rows) lines.push(daily(p.label, p.retainedTrace.replication, r).join(','));
  }
  for (const p of policies) for (const s of p.summaries) lines.push(repl(p.label, s).join(','));
  return lines.join('\r\n') + '\r\n';
}
