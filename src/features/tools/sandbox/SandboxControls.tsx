import { useState } from 'react';
import type { FieldError, SandboxConfig } from '../../../domain/sandbox/types';
import { discreteMean, MAX_HORIZON, MAX_REPLICATIONS, normaliseProbabilities, validateDiscrete } from '../../../domain/sandbox/engine';
import { Callout, NumberField, Segmented, TextField, fmt } from '../../../ui/controls';
import { Link } from '../../../app/router';

const WEEKDAYS = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];

function errFor(errors: FieldError[], path: string) {
  return errors.find((e) => e.path === path)?.message;
}

/** Comma-separated per-day list editor that preserves incomplete text. */
function ListField({ label, values, onChange, horizon, unit, error }: { label: string; values: number[]; onChange: (v: number[]) => void; horizon: number; unit: string; error?: string }) {
  const [text, setText] = useState(values.join(', '));
  const [local, setLocal] = useState<string | null>(null);
  const commit = (t: string) => {
    setText(t);
    const parts = t.split(/[,;\s]+/).filter(Boolean);
    const nums = parts.map((p) => Number(p.replace(',', '.')));
    if (nums.some((n) => !Number.isFinite(n))) { setLocal('Every entry must be a number.'); return; }
    setLocal(null);
    onChange(nums);
  };
  return (
    <div className="field">
      <label>{label} <span className="unit">({unit}, one per day)</span>
        <input type="text" value={text} onChange={(e) => commit(e.target.value)} aria-invalid={local || error ? true : undefined} style={{ marginTop: 4 }} />
      </label>
      <span className="hint">{values.length} of {horizon} days entered</span>
      {(local ?? error) && <span className="field-error" role="alert">{local ?? error}</span>}
    </div>
  );
}

export function SandboxControls({ config, onChange, errors, showAdvanced }: { config: SandboxConfig; onChange: (fn: (c: SandboxConfig) => void) => void; errors: FieldError[]; showAdvanced: boolean }) {
  const c = config;
  const [normPreview, setNormPreview] = useState<number[] | null>(null);
  const discErr = c.demand.mode === 'random' ? validateDiscrete(c.demand.values, c.demand.probs) : [];
  return (
    <div>
      <fieldset>
        <legend>Demand</legend>
        <Segmented label="Arrival process" value={c.demand.mode} onChange={(v) => onChange((d) => { d.demand.mode = v; })}
          options={[{ value: 'constant', label: 'Constant' }, { value: 'random', label: 'Random (discrete)' }, { value: 'list', label: 'Day list' }]} />
        {c.demand.mode === 'constant' && (
          <NumberField label="Arrivals per day" unit="req-eq/day" value={c.demand.constant} min={0} max={100} step={1} slider
            onChange={(v) => onChange((d) => { d.demand.constant = v; })} error={errFor(errors, 'demand.constant')} />
        )}
        {c.demand.mode === 'list' && (
          <ListField label="Arrivals" unit="req-eq" values={c.demand.list} horizon={c.horizon} onChange={(v) => onChange((d) => { d.demand.list = v; })} error={errFor(errors, 'demand.list')} />
        )}
        {c.demand.mode === 'random' && (
          <div>
            <p className="hint">Values with probabilities; one draw per day. <Link to="/tools/distributions/poisson">Pick a distribution</Link> and send it here.</p>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th scope="col">Value (req-eq/day)</th><th scope="col">Probability</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead>
                <tbody>
                  {c.demand.values.map((v, i) => (
                    <tr key={`${i}-${c.demand.values.length}`}>
                      <td><input type="text" inputMode="decimal" aria-label={`Value ${i + 1}`} defaultValue={v}
                        onChange={(e) => { const n = Number(e.target.value); if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange((d) => { d.demand.values[i] = n; }); }} /></td>
                      <td><input type="text" inputMode="decimal" aria-label={`Probability ${i + 1}`} defaultValue={c.demand.probs[i]} key={`p${i}-${c.demand.probs[i]}`}
                        onChange={(e) => { const n = Number(e.target.value); if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange((d) => { d.demand.probs[i] = n; }); }} /></td>
                      <td><button type="button" className="btn ghost small" disabled={c.demand.values.length <= 1} onClick={() => onChange((d) => { d.demand.values.splice(i, 1); d.demand.probs.splice(i, 1); })} aria-label={`Remove value ${i + 1}`}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="btn-row" style={{ margin: '8px 0' }}>
              <button type="button" className="btn small" onClick={() => onChange((d) => { d.demand.values.push(0); d.demand.probs.push(0); })}>Add value</button>
              <button type="button" className="btn small" onClick={() => setNormPreview(normaliseProbabilities(c.demand.probs))}>Normalise probabilities…</button>
            </div>
            {normPreview && (
              <Callout tone="info" title="Preview of normalised probabilities">
                <p>{normPreview.map((p) => fmt(p, 4)).join(', ')} (sum 1). Nothing changes until you apply.</p>
                <div className="btn-row">
                  <button type="button" className="btn small primary" onClick={() => { onChange((d) => { d.demand.probs = normPreview; }); setNormPreview(null); }}>Apply normalisation</button>
                  <button type="button" className="btn small" onClick={() => setNormPreview(null)}>Cancel</button>
                </div>
              </Callout>
            )}
            {discErr.length === 0
              ? <p className="hint">Mean daily arrivals: {fmt(discreteMean(c.demand.values, c.demand.probs))} req-eq/day.</p>
              : discErr.map((e, i) => <p key={i} className="field-error" role="alert">{e.message}</p>)}
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Capacity</legend>
        <Segmented label="Capacity input" value={c.capacity.mode} onChange={(v) => onChange((d) => { d.capacity.mode = v; })}
          options={[{ value: 'direct', label: 'Direct' }, { value: 'staff', label: 'Staff × productivity' }, { value: 'list', label: 'Day list' }]} />
        {c.capacity.mode === 'direct' && (
          <NumberField label="Capacity per open day" unit="req-eq/day" value={c.capacity.direct} min={0} max={100} step={1} slider
            onChange={(v) => onChange((d) => { d.capacity.direct = v; })} error={errFor(errors, 'capacity.direct')} />
        )}
        {c.capacity.mode === 'staff' && (
          <>
            <NumberField label="Staff on duty" unit="people" value={c.capacity.staff} min={0} max={30} step={1} slider onChange={(v) => onChange((d) => { d.capacity.staff = v; })} error={errFor(errors, 'capacity.staff')} />
            <NumberField label="Productivity per staff member" unit="req-eq/staff-day" value={c.capacity.productivity} min={0} max={40} step={0.5} onChange={(v) => onChange((d) => { d.capacity.productivity = v; })} error={errFor(errors, 'capacity.productivity')} />
            <p className="hint">Capacity per open day = {fmt(c.capacity.staff)} × {fmt(c.capacity.productivity)} = {fmt(c.capacity.staff * c.capacity.productivity)} req-eq/day.</p>
          </>
        )}
        {c.capacity.mode === 'list' && (
          <ListField label="Capacity" unit="req-eq" values={c.capacity.list} horizon={c.horizon} onChange={(v) => onChange((d) => { d.capacity.list = v; })} error={errFor(errors, 'capacity.list')} />
        )}
        <p className="hint">Unused capacity does not carry over to the next day.</p>
      </fieldset>

      <fieldset>
        <legend>Start and horizon</legend>
        <NumberField label="Initial backlog" unit="req-eq" value={c.initialBacklog} min={0} max={500} onChange={(v) => onChange((d) => { d.initialBacklog = v; })} error={errFor(errors, 'initialBacklog')} />
        <NumberField label="Horizon" unit="days" value={c.horizon} min={1} max={MAX_HORIZON} integer slider onChange={(v) => onChange((d) => { d.horizon = v; })} error={errFor(errors, 'horizon')} />
      </fieldset>

      {(showAdvanced || c.demand.mode === 'random') && (
        <fieldset>
          <legend>Replications</legend>
          {c.demand.mode !== 'random' && <p className="hint">Inactive: demand is deterministic, so one replication reproduces the result exactly. Your settings are kept.</p>}
          <NumberField label="Replications" unit="trajectories" value={c.replications} min={1} max={MAX_REPLICATIONS} integer onChange={(v) => onChange((d) => { d.replications = v; })} error={errFor(errors, 'replications')}
            hint="Decide this before running; do not keep adding runs until a result looks significant." disabled={c.demand.mode !== 'random'} />
          <TextField label="Seed" value={c.seed} onChange={(v) => onChange((d) => { d.seed = v; })} hint="Same seed + settings reproduce the same arrivals (RNG sfc32-cyrb128-v1)." maxLength={64} />
          {errFor(errors, 'seed') && <p className="field-error">{errFor(errors, 'seed')}</p>}
        </fieldset>
      )}

      {showAdvanced && (
        <>
          <fieldset>
            <legend>Weekly schedule</legend>
            <label className="check"><input type="checkbox" checked={c.schedule.enabled} onChange={(e) => onChange((d) => { d.schedule.enabled = e.target.checked; })} /> Use a weekly open/paid pattern</label>
            {!c.schedule.enabled && <p className="hint">Inactive: every day is open and paid. Your pattern is kept.</p>}
            <div className="table-wrap" style={{ opacity: c.schedule.enabled ? 1 : 0.6 }}>
              <table className="data">
                <thead><tr><th scope="col">Day of week</th>{WEEKDAYS.map((w) => <th key={w} scope="col" className="num">{w.replace('Day ', '')}</th>)}</tr></thead>
                <tbody>
                  {(['openDays', 'paidDays'] as const).map((k) => (
                    <tr key={k}>
                      <th scope="row">{k === 'openDays' ? 'Open' : 'Paid'}</th>
                      {c.schedule[k].map((v, i) => (
                        <td key={i} className="num"><input type="checkbox" aria-label={`${k === 'openDays' ? 'Open' : 'Paid'} on ${WEEKDAYS[i]}`} checked={v} disabled={!c.schedule.enabled}
                          onChange={(e) => onChange((d) => { d.schedule[k][i] = e.target.checked; })} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint">Day 1 of the horizon is weekday 1. Closed days have zero capacity but still receive arrivals.</p>
          </fieldset>

          <fieldset>
            <legend>Abandonment</legend>
            <label className="check"><input type="checkbox" checked={c.abandonment.enabled} onChange={(e) => onChange((d) => { d.abandonment.enabled = e.target.checked; })} /> Some unfinished requests are withdrawn each day</label>
            <NumberField label="Abandonment fraction of remaining requests" unit="per day" value={c.abandonment.fraction} min={0} max={1} step={0.01} slider disabled={!c.abandonment.enabled}
              onChange={(v) => onChange((d) => { d.abandonment.fraction = v; })} error={errFor(errors, 'abandonment.fraction')}
              hint={c.abandonment.enabled ? 'Applied after service as an aggregate fraction. Abandoned requests are not served.' : 'Inactive — does not affect results; your value is kept.'} />
          </fieldset>

          <fieldset>
            <legend>Feedback (hypothetical)</legend>
            <label className="check"><input type="checkbox" checked={c.feedback.enabled} onChange={(e) => onChange((d) => { d.feedback.enabled = e.target.checked; })} /> Productivity falls as backlog grows</label>
            <div className="formula">effectiveCapacity[t] = C[t] / (1 + α · B[t])</div>
            <NumberField label="α (productivity loss per unit backlog)" unit="1/req-eq" value={c.feedback.alpha} min={0} max={0.2} step={0.001} disabled={!c.feedback.enabled}
              onChange={(v) => onChange((d) => { d.feedback.alpha = v; })} error={errFor(errors, 'feedback.alpha')}
              hint={c.feedback.enabled ? undefined : 'Inactive — does not affect results; your value is kept.'} />
            {c.feedback.enabled && <Callout tone="warning" title="Untested assumption">This feedback rule is hypothetical. Test how your conclusion changes without it. At α = 0 it reduces exactly to the base model.</Callout>}
          </fieldset>

          <fieldset>
            <legend>Cost</legend>
            <label className="check"><input type="checkbox" checked={c.cost.enabled} onChange={(e) => onChange((d) => { d.cost.enabled = e.target.checked; })} /> Report costs</label>
            <NumberField label="Cost per paid staff-day" unit={c.cost.currency || 'currency'} value={c.cost.costPerStaffDay} min={0} max={10000} disabled={!c.cost.enabled}
              onChange={(v) => onChange((d) => { d.cost.costPerStaffDay = v; })} error={errFor(errors, 'cost.costPerStaffDay')}
              hint={c.capacity.mode === 'staff' ? 'Daily staff cost = staff × cost per paid staff-day × paid-day indicator.' : 'Staff cost needs “Staff × productivity” capacity; it is reported as not defined otherwise.'} />
            <NumberField label="Backlog holding rate (modelling convention)" unit={`${c.cost.currency || 'currency'}/req-eq/day`} value={c.cost.holdingRate} min={0} max={1000} step={0.1} disabled={!c.cost.enabled}
              onChange={(v) => onChange((d) => { d.cost.holdingRate = v; })} error={errFor(errors, 'cost.holdingRate')} hint="Rate × end-of-day backlog. A modelling convention, not an observed cost." />
            <TextField label="Currency label" value={c.cost.currency} onChange={(v) => onChange((d) => { d.cost.currency = v.slice(0, 8); })} hint="A label only; no exchange-rate conversion." maxLength={8} />
          </fieldset>
        </>
      )}
    </div>
  );
}
