import { useMemo, useState } from 'react';
import type { DailyTrace, ReplicationSummary, RunRecord } from '../../../domain/sandbox/types';
import { CONSERVATION_TOLERANCE, changedInputs, conservationHolds } from '../../../domain/sandbox/engine';
import { histogram, pairedDifferences, summarise } from '../../../domain/sandbox/stats';
import { Badge, Callout, Kpi, fmt } from '../../../ui/controls';
import { ChartFrame, Histogram, HistogramTable, IntervalBar, Legend, StepChart, StepTable, type Series } from '../../../ui/charts';

export type OutcomeKey = 'terminalBacklog' | 'averageEndBacklog' | 'totalServed' | 'totalAbandoned' | 'totalCost' | 'utilisation';
export const OUTCOMES: { value: OutcomeKey | 'waiting'; label: string; unit: string }[] = [
  { value: 'terminalBacklog', label: 'Terminal backlog', unit: 'req-eq' },
  { value: 'averageEndBacklog', label: 'Average end-of-day backlog', unit: 'req-eq' },
  { value: 'totalServed', label: 'Total served', unit: 'req-eq' },
  { value: 'totalAbandoned', label: 'Total abandoned', unit: 'req-eq' },
  { value: 'totalCost', label: 'Total cost', unit: 'currency' },
  { value: 'utilisation', label: 'Capacity utilisation', unit: 'ratio' },
  { value: 'waiting', label: 'Individual waiting time', unit: '' },
];

function pick(s: ReplicationSummary, k: OutcomeKey | 'totalArrivals'): number | null {
  return s[k] as number | null;
}

export function DailyTable({ trace, currency, title }: { trace: DailyTrace; currency?: string | null; title: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const showCost = trace.rows.some((r) => r.staffCost !== null || r.holdingCost !== null);
  const row = sel !== null ? trace.rows[sel] : null;
  const maxRes = trace.metrics.maxAbsResidual;
  return (
    <div>
      <div className="table-wrap tall" tabIndex={0} role="region" aria-label={`${title}: daily arithmetic table`}>
        <table className="data">
          <caption>{title}. Units: request-equivalents. Select a day to see its arithmetic.</caption>
          <thead>
            <tr>
              <th scope="col">Day</th><th scope="col" className="num">Start backlog</th><th scope="col" className="num">Arrivals</th>
              <th scope="col" className="num">Effective capacity</th><th scope="col" className="num">Served</th><th scope="col" className="num">Abandoned</th>
              <th scope="col" className="num">End backlog</th>{showCost && <th scope="col" className="num">Cost ({currency})</th>}
            </tr>
          </thead>
          <tbody>
            {trace.rows.map((r, i) => (
              <tr key={r.day} className={sel === i ? 'selected' : undefined}>
                <td><button type="button" className="rowbtn" aria-pressed={sel === i} onClick={() => setSel(sel === i ? null : i)}>{r.day}{r.open ? '' : ' (closed)'}</button></td>
                <td className="num">{fmt(r.startBacklog, 3)}</td><td className="num">{fmt(r.arrivals, 3)}</td><td className="num">{fmt(r.effectiveCapacity, 3)}</td>
                <td className="num">{fmt(r.served, 3)}</td><td className="num">{fmt(r.abandoned, 3)}</td><td className="num">{fmt(r.endBacklog, 3)}</td>
                {showCost && <td className="num">{fmt((r.staffCost ?? 0) + (r.holdingCost ?? 0))}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {row && (
        <div className="formula" aria-live="polite" style={{ marginTop: 8 }}>
{`Day ${row.day}
available  = B + A                 = ${fmt(row.startBacklog, 4)} + ${fmt(row.arrivals, 4)} = ${fmt(row.available, 4)}
capacity   = ${row.nominalCapacity === row.effectiveCapacity ? `C = ${fmt(row.nominalCapacity, 4)}` : `C / (1 + α·B) = ${fmt(row.nominalCapacity, 4)} / (1 + α·${fmt(row.startBacklog, 4)}) = ${fmt(row.effectiveCapacity, 4)}`}${row.open ? '' : '  (closed day)'}
served     = min(available, cap)   = min(${fmt(row.available, 4)}, ${fmt(row.effectiveCapacity, 4)}) = ${fmt(row.served, 4)}
remaining  = available − served    = ${fmt(row.remaining, 4)}
abandoned  = f · remaining         = ${fmt(row.abandoned, 4)}
B[next]    = remaining − abandoned = ${fmt(row.endBacklog, 4)}
check: start + arrivals − served − abandoned − end = ${row.residual.toExponential(2)}`}
        </div>
      )}
      <p className="subtle-text" style={{ marginTop: 6 }}>
        Conservation check: largest daily residual |start + arrivals − served − abandoned − end| = {maxRes.toExponential(2)} (tolerance {CONSERVATION_TOLERANCE} × daily volume).{' '}
        {conservationHolds(trace) ? <strong>The accounting balances for every day.</strong> : <strong style={{ color: 'var(--error)' }}>Conservation violated — report this as a defect.</strong>}
      </p>
    </div>
  );
}

export function SandboxResults({ run, stale, outcome }: { run: RunRecord; stale: boolean; outcome: OutcomeKey }) {
  const policies = [run.baseline, ...(run.alternative ? [run.alternative] : [])];
  const stochastic = run.requestedReplications > 1 || run.baselineSnapshot.demand.mode === 'random' || run.alternativeSnapshot?.demand.mode === 'random';
  const currency = run.baselineSnapshot.cost.enabled ? run.baselineSnapshot.cost.currency : null;
  const outDef = OUTCOMES.find((o) => o.value === outcome)!;
  const unit = outcome === 'totalCost' ? currency ?? '' : outDef.unit;
  const n = run.completedReplications;

  const sums = useMemo(() => policies.map((p) => {
    const vals = p.summaries.map((s) => pick(s, outcome)).filter((x): x is number => x !== null);
    return { label: p.label, vals, s: vals.length ? summarise(vals) : null };
  }), [run, outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  const series: Series[] = policies.filter((p) => p.retainedTrace).map((p, i) => ({
    label: `${p.label}${stochastic ? ' (replication 1)' : ''}`, values: p.retainedTrace!.rows.map((r) => r.endBacklog), color: i === 0 ? 'baseline' : 'alternative', dashed: i === 1,
  }));
  const initial = policies.filter((p) => p.retainedTrace).map((p) => p.retainedTrace!.rows[0]?.startBacklog ?? 0);
  const diffs = run.alternative ? pairedDifferences(
    run.baseline.summaries.map((s) => pick(s, outcome) ?? NaN),
    run.alternative.summaries.map((s) => pick(s, outcome) ?? NaN),
  ).filter((x) => Number.isFinite(x)) : [];
  const diffSum = diffs.length ? summarise(diffs) : null;
  const changes = run.alternativeSnapshot ? changedInputs(run.baselineSnapshot, run.alternativeSnapshot) : [];

  const statusText = run.status === 'partial' ? `${n} of ${run.requestedReplications} replications completed. Results are partial.`
    : run.status === 'failed' ? `Run failed${run.error ? `: ${run.error}` : ''}.`
    : run.status === 'running' ? `Running: ${n} of ${run.requestedReplications} replications completed.`
    : `${n} replication${n === 1 ? '' : 's'} completed.`;

  return (
    <div className={`stack${stale ? '' : ''}`}>
      {stale && <Callout tone="warning" title="From earlier settings">These results use earlier settings. Run again to update them.</Callout>}
      {run.status === 'partial' && <Callout tone="warning" title="Partial results">{statusText}</Callout>}
      <div className={stale ? 'stale' : undefined}>
        <div className="btn-row" style={{ marginBottom: 8 }}>
          <Badge tone="evidence">{stochastic ? 'Simulation result' : 'Calculated'}</Badge>
          <span className="subtle-text">{statusText}</span>
          {run.comparisonKind === 'paired-policy' && <Badge>Same arrival traces in each policy pair</Badge>}
          {run.comparisonKind === 'scenario' && <Badge tone="warning">Scenario comparison: inputs differ</Badge>}
        </div>
        <details>
          <summary>Run details</summary>
          <p className="subtle-text">Run <code>{run.id}</code> · model revision {run.modelRevision} · engine {run.engineVersion} · RNG {run.rngVersion} · seed <code>{run.seed}</code> · {run.requestedReplications} requested / {n} completed · status {run.status}</p>
          {changes.length > 0 && <p className="subtle-text">Alternative changes: {changes.join(', ')}.</p>}
        </details>

        {policies.map((p, i) => {
          const s0 = p.summaries[0];
          if (!s0) return null;
          const agg = (k: OutcomeKey | 'totalArrivals') => {
            const xs = p.summaries.map((s) => pick(s, k)).filter((x): x is number => x !== null);
            return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
          };
          const pre = stochastic ? 'Mean ' : '';
          return (
            <section key={p.label} aria-label={`${p.label} key results`} style={{ marginTop: 12 }}>
              <h3 style={{ fontSize: 14 }}>{p.label}{i === 1 ? ' (dashed line)' : run.alternative ? ' (solid line)' : ''}</h3>
              <div className="kpis">
                <Kpi label={`${pre}terminal backlog`} value={fmt(agg('terminalBacklog'))} unit="req-eq" />
                <Kpi label={`${pre}total served`} value={fmt(agg('totalServed'))} unit="req-eq" detail={`of ${fmt(agg('totalArrivals'))} arrivals`} />
                <Kpi label={`${pre}total abandoned`} value={fmt(agg('totalAbandoned'))} unit="req-eq" detail={agg('totalAbandoned') ? 'Withdrawn, not served' : undefined} />
                <Kpi label={`${pre}average end-of-day backlog`} value={fmt(agg('averageEndBacklog'))} unit="req-eq" />
                <Kpi label={`${pre}utilisation`} value={agg('utilisation') === null ? null : fmt((agg('utilisation') ?? 0) * 100, 1)} unit="%" undefinedText="Not defined — no available capacity" detail="Served ÷ effective capacity" />
                {run.baselineSnapshot.cost.enabled && <Kpi label={`${pre}total cost`} value={agg('totalCost') === null ? null : fmt(agg('totalCost'))} unit={currency ?? ''} detail={p.summaries[0].totalStaffCost === null ? 'Staff cost not defined (direct capacity)' : 'Staff + holding'} />}
              </div>
              {!stochastic && (
                <p className="subtle-text" style={{ marginTop: 6 }}>
                  Accounting: initial backlog {fmt(p.retainedTrace?.rows[0]?.startBacklog ?? 0)} + arrivals {fmt(s0.totalArrivals)} = served {fmt(s0.totalServed)} + abandoned {fmt(s0.totalAbandoned)} + remaining {fmt(s0.terminalBacklog)}.
                </p>
              )}
            </section>
          );
        })}

        {run.alternative && diffSum && (
          <Callout tone="info" title="Which outcome matters?">
            Smaller backlog alone does not establish better service if abandonment increases. Compare served, abandoned, remaining backlog and cost together; there is no automatic winner.
          </Callout>
        )}

        {series.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <ChartFrame title="Backlog trajectory" question={`How does the end-of-day backlog evolve?${stochastic ? ' One inspected trajectory (replication 1) per policy.' : ''} Day 0 shows the initial backlog; each step holds the end-of-day value.`}
              units="request-equivalents" legend={<Legend series={series} />} table={<StepTable series={series} initial={initial} unit="req-eq" />}>
              <StepChart series={series} initial={initial} yLabel="Backlog (req-eq)" ariaLabel="Backlog trajectory step chart" />
            </ChartFrame>
          </div>
        )}

        {stochastic && sums.map((x, i) => x.s && (
          <div key={x.label} className="grid two" style={{ marginTop: 12 }}>
            <ChartFrame title={`${x.label}: ${outDef.label.toLowerCase()} across replications`} question={`How variable is the outcome? ${x.vals.length} replications; equal-width bins.`} units={unit}
              table={<HistogramTable bins={histogram(x.vals)} unit={unit} />}>
              <Histogram bins={histogram(x.vals)} xLabel={`${outDef.label} (${unit})`} color={i === 0 ? 'baseline' : 'alternative'} ariaLabel={`Histogram of ${outDef.label}`} />
            </ChartFrame>
            <div className="card">
              <h3>What the intervals mean</h3>
              <h4>Mean and approximate 95% confidence interval</h4>
              <p className="subtle-text">Uncertainty about the long-run mean, from replicate-level SD and a Student-t quantile. Coverage is approximate, especially for few or skewed replications.</p>
              {x.s.ci.unavailableReason ? <p><strong>{x.s.ci.unavailableReason}</strong></p> : (
                <>
                  <p>Mean {fmt(x.s.mean)} {unit}; CI {fmt(x.s.ci.lower)} to {fmt(x.s.ci.upper)} (n = {x.s.n}, SD {fmt(x.s.ci.sd)})</p>
                  <IntervalBar lower={x.s.ci.lower!} upper={x.s.ci.upper!} point={x.s.mean} min={x.s.min} max={x.s.max === x.s.min ? x.s.min + 1 : x.s.max} label={`Confidence interval for the mean from ${fmt(x.s.ci.lower)} to ${fmt(x.s.ci.upper)}`} color={i === 0 ? 'baseline' : 'alternative'} />
                </>
              )}
              <h4 style={{ marginTop: 10 }}>Outcome percentiles (5th–95th)</h4>
              <p className="subtle-text">Where individual replications fall. This is not a confidence interval and does not shrink with more replications.</p>
              <p>{fmt(x.s.p05)} to {fmt(x.s.p95)} {unit}; median {fmt(x.s.p50)}</p>
              {x.vals.length > 1 && <IntervalBar lower={x.s.p05} upper={x.s.p95} point={x.s.p50} min={x.s.min} max={x.s.max === x.s.min ? x.s.min + 1 : x.s.max} label={`Outcome 5th to 95th percentile from ${fmt(x.s.p05)} to ${fmt(x.s.p95)}`} color="reference" />}
            </div>
          </div>
        ))}

        {run.alternative && diffSum && (
          <div className="card" style={{ marginTop: 12 }}>
            <h3>Paired difference: alternative − baseline ({outDef.label.toLowerCase()})</h3>
            <p className="subtle-text">{run.comparisonKind === 'paired-policy' ? 'Each replication pair used identical arrival arrays, so the difference isolates the changed policy inputs.' : 'Demand assumptions differ between the two sides; this is a scenario comparison, not an isolated policy effect.'}</p>
            <p>Mean difference {fmt(diffSum.mean)} {unit}; {diffSum.ci.unavailableReason ?? `approximate 95% t interval from paired differences ${fmt(diffSum.ci.lower)} to ${fmt(diffSum.ci.upper)}`} (n = {diffs.length}).</p>
            {diffs.length > 1 && (
              <ChartFrame title="Distribution of paired differences" question="Negative values mean the alternative produced a smaller value than the baseline in that replication." units={unit} table={<HistogramTable bins={histogram(diffs)} unit={unit} />}>
                <Histogram bins={histogram(diffs)} xLabel={`Alternative − baseline (${unit})`} color="reference" ariaLabel="Histogram of paired differences" markers={[{ value: 0, label: '0' }]} />
              </ChartFrame>
            )}
            {run.arrivalPreview.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary>Inspect paired daily input arrays (first {run.arrivalPreview.length} replications)</summary>
                <div className="table-wrap" tabIndex={0} role="region" aria-label="Arrival arrays">
                  <table className="data">
                    <thead><tr><th scope="col">Replication</th><th scope="col">Arrivals per day (baseline{run.comparisonKind === 'paired-policy' ? ' = alternative' : ''})</th></tr></thead>
                    <tbody>{run.arrivalPreview.map((a, i) => <tr key={i}><td>{i + 1}</td><td className="mono">{a.join(', ')}</td></tr>)}</tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        )}

        {stochastic && (
          <details style={{ marginTop: 12 }}>
            <summary>Per-replication summary ({n} rows{n > 200 ? '; first 200 shown, full data in the CSV export' : ''})</summary>
            <div className="table-wrap tall" tabIndex={0} role="region" aria-label="Per-replication summary">
              <table className="data">
                <thead><tr><th scope="col">Replication</th>{policies.map((p) => <th key={p.label} scope="col" className="num">{p.label}: {outDef.label.toLowerCase()} ({unit})</th>)}</tr></thead>
                <tbody>
                  {run.baseline.summaries.slice(0, 200).map((s, i) => (
                    <tr key={i}><td>{s.replication + 1}</td>{policies.map((p) => <td key={p.label} className="num">{fmt(p.summaries[i] ? pick(p.summaries[i], outcome) : null)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {policies.map((p) => p.retainedTrace && (
          <details key={p.label} style={{ marginTop: 12 }} open={!stochastic && p === run.baseline}>
            <summary>{p.label}: daily arithmetic table{stochastic ? ' (replication 1)' : ''}</summary>
            <DailyTable trace={p.retainedTrace} currency={currency} title={`${p.label} daily table${stochastic ? ', replication 1' : ''}`} />
          </details>
        ))}
      </div>
    </div>
  );
}
