import { useState } from 'react';
import { ChartColumn, ClipboardList } from 'lucide-react';
import { useArtefacts } from '../../../app/artefacts';
import { useRouter } from '../../../app/router';
import { useStore } from '../../../app/store';
import { METHOD_BY_ID, type MethodId } from '../../../domain/methods/registry';
import { profileFor } from '../../../domain/methods/profiles';
import { DistributionsTool } from './Distributions';
import { MeasurementTool } from './measurement/MeasurementTool';
import './data.css';

type Mode = 'distributions' | 'measurement';

/**
 * `/toolbox/data[/:id]`: Data and inputs. Two kinds share the tool: data models (one uncertain input as a probability
 * law) and measurement data (measured variables or survey items grouped into constructs). An address with an id opens
 * whichever kind that id is; without one, the tool opens in the mode the method calls for.
 */
export default function DataTool({ id }: { id?: string }) {
  const { ready, get, ofKind } = useArtefacts();
  const { active } = useStore();
  const { navigate } = useRouter();
  const [chosen, setChosen] = useState<Mode | null>(null);

  // The method of the open project comes first, then the latest method choice in the Toolbox.
  const method = (active?.passport.representation.primaryMethod || ofKind('method-choice').find((a) => a.data.primary)?.data.primary || '') as MethodId | '';
  const preferred: Mode = profileFor(method)?.inputs === 'measurement' ? 'measurement' : 'distributions';
  if (id && !ready) return <p className="muted" role="status">Loading…</p>;

  const routed = id ? get(id) : undefined;
  const mode: Mode = routed?.kind === 'measurement-data' ? 'measurement' : routed?.kind === 'data-model' ? 'distributions' : chosen ?? preferred;
  // An id of the other kind is not passed on: the editor then opens the latest artefact of its own kind.
  const idFor = (kind: 'data-model' | 'measurement-data') => (routed ? (routed.kind === kind ? id : undefined) : id);
  const switchTo = (m: Mode) => { if (m === mode) return; setChosen(m); navigate('/toolbox/data'); };

  const modeSwitch = (
    <div className="dm-mode-switch">
      <div className="dm-switch" role="group" aria-label="What to describe">
        <button type="button" aria-pressed={mode === 'distributions'} onClick={() => switchTo('distributions')}><ChartColumn size={16} aria-hidden="true" /> Distributions</button>
        <button type="button" aria-pressed={mode === 'measurement'} onClick={() => switchTo('measurement')}><ClipboardList size={16} aria-hidden="true" /> Measurement data</button>
      </div>
      <p className="hint">
        {mode === 'measurement' ? 'Survey items or measured variables, grouped into constructs.' : 'Uncertain inputs as probability laws, one per input.'}
        {method && <> {METHOD_BY_ID[method].name} works with {profileFor(method)?.inputs === 'measurement' ? 'measured variables' : profileFor(method)?.inputs === 'parameters' ? 'parameters with a source each' : 'uncertain inputs'}.</>}
      </p>
    </div>
  );
  return mode === 'measurement'
    ? <MeasurementTool key="measurement" id={idFor('measurement-data')} modeSwitch={modeSwitch} />
    : <DistributionsTool key="distributions" id={idFor('data-model')} modeSwitch={modeSwitch} />;
}
