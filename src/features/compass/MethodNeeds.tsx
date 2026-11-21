import { AlertTriangle, Database, Plus, ShieldQuestion } from 'lucide-react';
import { useStore } from '../../app/store';
import { METHOD_BY_ID } from '../../domain/methods/registry';
import { newId } from '../../domain/passport/schema';
import { usePassport } from '../project/passportContext';

/**
 * What the chosen method usually needs: typical data and typical assumptions, each with a
 * one-click "add" that creates a draft row in the passport. These are prompts from the
 * method registry, not requirements; the learner still supplies values, sources and checks.
 */
export function MethodNeeds() {
  const { doc, update, readOnly } = usePassport();
  const { toast } = useStore();
  const id = doc.passport.representation.primaryMethod;
  if (!id) return null;
  const m = METHOD_BY_ID[id];
  const hasInput = (text: string) => doc.passport.inputs.some((r) => r.name === text);
  const hasAssumption = (text: string) => doc.passport.assumptions.some((a) => a.statement === text);
  return (
    <section className="cp-card cp-needs" aria-labelledby="needs-h">
      <h3 id="needs-h" className="cp-needs-title"><Database size={18} aria-hidden="true" /> What {m.name} usually needs</h3>
      <p className="cp-needs-sub">Prompts from your chosen method. Add the ones that apply, then fill in the details.</p>
      <div className="cp-needs-grid">
        <div>
          <p className="field-label">Typical data</p>
          <ul className="cp-needs-list">
            {m.dataNeeds.map((d) => (
              <li key={d}>
                <span>{d}</span>
                {!readOnly && (
                  <button type="button" className="btn small" disabled={hasInput(d)} onClick={() => {
                    const rid = newId('in');
                    update((x) => { x.passport.inputs.push({ id: rid, name: d, value: '', unit: '', sourceType: 'unspecified', provenance: '', uncertainty: '' }); });
                    toast('Added a draft input. Give it a value, unit and source.', 'success', { label: 'Undo', run: () => update((x) => { x.passport.inputs = x.passport.inputs.filter((r) => r.id !== rid); }) });
                  }}><Plus size={13} aria-hidden="true" /> {hasInput(d) ? 'Added' : 'Add input'}</button>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="field-label">Typical assumptions</p>
          <ul className="cp-needs-list">
            {m.assumptions.map((a) => (
              <li key={a}>
                <span>{a}</span>
                {!readOnly && (
                  <button type="button" className="btn small" disabled={hasAssumption(a)} onClick={() => {
                    const aid = newId('as');
                    update((x) => { x.passport.assumptions.push({ id: aid, statement: a, rationale: '', consequenceIfWrong: '', plannedCheck: '', evidenceKind: 'assumed', sourceNote: `Typical assumption of ${m.name}` }); });
                    toast('Added a draft assumption. Say what happens if it fails and how you will check it.', 'success', { label: 'Undo', run: () => update((x) => { x.passport.assumptions = x.passport.assumptions.filter((r) => r.id !== aid); }) });
                  }}><Plus size={13} aria-hidden="true" /> {hasAssumption(a) ? 'Added' : 'Add assumption'}</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Known ways the chosen method goes wrong — shown at the verification and validation step. */
export function MethodWatchOuts() {
  const { doc } = usePassport();
  const id = doc.passport.representation.primaryMethod;
  if (!id) return null;
  const m = METHOD_BY_ID[id];
  return (
    <section className="cp-card cp-needs" aria-labelledby="watch-h">
      <h3 id="watch-h" className="cp-needs-title"><ShieldQuestion size={18} aria-hidden="true" /> Watch out with {m.name}</h3>
      <ul className="cp-watch">
        {m.failureConditions.map((f) => <li key={f}><AlertTriangle size={15} aria-hidden="true" /><span>{f}</span></li>)}
        {m.omits.map((o) => <li key={o} className="omit"><span className="cp-watch-tag">Leaves out</span><span>{o}</span></li>)}
      </ul>
      <p className="cp-needs-sub">Plan a check for each one that matters to your question.</p>
    </section>
  );
}
