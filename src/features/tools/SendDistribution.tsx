import { useState } from 'react';
import { ClipboardPlus, Waves } from 'lucide-react';
import { useStore } from '../../app/store';
import { Link } from '../../app/router';
import { describeLaw, lawFor, type Kind } from '../../domain/distributions/laws';
import { lawToDemand } from '../../domain/distributions/transfer';
import { newId } from '../../domain/passport/schema';
import { Callout, Dialog, fmt } from '../../ui/controls';
import { SendArea } from './ToolFrame';

/** “Add to project inputs” and “Use as sandbox demand”: each previewed, never duplicated, each with undo. */
export function SendDistribution({ kind, fields, provenance, label }: { kind: Kind; fields: (number | string)[]; provenance: string; label?: string }) {
  const { active, update, toast } = useStore();
  const [dialog, setDialog] = useState<'passport' | 'sandbox' | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  let law;
  try { law = lawFor(kind, fields); } catch { return null; }
  const desc = describeLaw(kind, fields);
  const demand = lawToDemand(law);
  return (
    <SendArea what={<strong>{desc}</strong>}>
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => setDialog('passport')}><ClipboardPlus size={16} aria-hidden="true" /> Add to project inputs</button>
        {law.discrete && <button type="button" className="btn" onClick={() => setDialog('sandbox')}><Waves size={16} aria-hidden="true" /> Use as sandbox demand</button>}
      </div>
      {active && dialog === 'passport' && (
        <Dialog title="Add to project inputs" narrow onClose={() => setDialog(null)}
          actions={<><button className="btn" onClick={() => setDialog(null)}>Cancel</button><button className="btn primary" onClick={() => {
            if (active.passport.inputs.some((r) => r.value === desc && r.provenance === provenance)) { toast('Already in your inputs; nothing duplicated.'); setDialog(null); return; }
            const id = newId('in');
            update((d) => { d.passport.inputs.push({ id, name: name.trim() || label || 'Uncertain input', value: desc, unit: unit.trim(), sourceType: 'unspecified', provenance, uncertainty: `Modelled as ${desc}; parameter uncertainty not quantified.` }); });
            setDialog(null); setName(''); setUnit('');
            toast(name.trim() && unit.trim() ? 'Added to Inputs. Add its source there.' : 'Added to Inputs. Give it a name, unit and source there.', 'success', { label: 'Undo', run: () => update((d) => { d.passport.inputs = d.passport.inputs.filter((r) => r.id !== id); }) });
          }}>Add</button></>}>
          <div className="card subtle"><p className="field-label">Project → step 4, Inputs → new row</p><p style={{ margin: 0 }}><strong>{desc}</strong></p>{Number.isFinite(law.mean) && !law.undefinedMean && <p className="subtle-text" style={{ margin: 0 }}>Mean {fmt(law.mean, 3)}</p>}<p className="subtle-text" style={{ margin: 0 }}>Provenance: {provenance}</p></div>
          <div className="send-fields">
            <label className="field"><span className="field-label">What is this input?</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Service time per customer" maxLength={120} /></label>
            <label className="field"><span className="field-label">Unit</span><input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. minutes" maxLength={40} /></label>
          </div>
          <p className="subtle-text">A distribution is an assumption until data support it. Add the evidence in step 4.</p>
        </Dialog>
      )}
      {active && dialog === 'sandbox' && (
        <Dialog title="Use as sandbox demand" narrow onClose={() => setDialog(null)}
          actions={<><button className="btn" onClick={() => setDialog(null)}>Cancel</button>{demand.ok && <button className="btn primary" onClick={() => {
            const before = structuredClone(active.sandbox.baseline.demand);
            update((d) => { d.sandbox.baseline.demand = { ...d.sandbox.baseline.demand, mode: 'random', values: demand.values, probs: demand.probs }; });
            setDialog(null);
            toast('Baseline arrivals now follow this distribution. Earlier sandbox results are marked as stale.', 'success', { label: 'Undo', run: () => update((d) => { d.sandbox.baseline.demand = before; }) });
          }}>Replace baseline demand</button>}</>}>
          {demand.ok ? (
            <>
              <p>Daily arrivals in the sandbox will be drawn from <strong>{desc}</strong>:</p>
              <div className="stat-row">
                <div className="stat"><small>Values</small><strong>{demand.values[0]}–{demand.values[demand.values.length - 1]}</strong></div>
                <div className="stat"><small>Mean / day</small><strong>{fmt(demand.mean)}</strong></div>
                <div className="stat"><small>Trimmed tail</small><strong>{fmt(demand.droppedMass * 100, 3)}%</strong></div>
              </div>
              <p className="subtle-text">The extreme tails are trimmed and the rest renormalised. This replaces the baseline demand of your active project.</p>
            </>
          ) : <Callout tone="info">{demand.reason}</Callout>}
        </Dialog>
      )}
      <p className="send-links"><Link to="/project/inputs">Open Inputs</Link>{law.discrete && <> · <Link to="/tools/sandbox">Open the sandbox</Link></>}</p>
    </SendArea>
  );
}
