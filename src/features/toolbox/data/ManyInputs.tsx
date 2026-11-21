import { useState } from 'react';
import { CircleCheck, Layers, Plus } from 'lucide-react';
import { useArtefacts } from '../../../app/artefacts';
import { Link } from '../../../app/router';
import { useStore } from '../../../app/store';
import { dataModel, describeModel } from '../../../domain/artefacts/dataModel';
import { createArtefact } from '../../../domain/artefacts/file';
import { includeArtefact } from '../../../domain/artefacts/include';
import type { Artefact } from '../../../domain/artefacts/types';
import type { CsvColumn } from '../../../domain/distributions/csv';
import { dataModelFromColumn } from '../../../domain/distributions/inputModel';
import { createProject } from '../../../domain/passport/schema';

/**
 * Several inputs at once: one data model per ticked column, each fitted by the lowest AIC, named after its column and
 * saved in My artefacts. Then all of them can go into the open project, or a new one, in one step.
 */
export function useManyInputs() {
  const { put } = useArtefacts();
  const { toast } = useStore();
  const [made, setMade] = useState<Artefact<'data-model'>[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const make = async (columns: CsvColumn[], file: string) => {
    const now = new Date().toISOString(), out: Artefact<'data-model'>[] = [], left: string[] = [];
    for (const c of columns) {
      const data = dataModelFromColumn(dataModel.empty(), c.name, c.values, file);
      if (!data) { left.push(c.name); continue; }
      const a = { ...createArtefact('data-model', { title: c.name, now }), data, revision: 1 } as Artefact<'data-model'>;
      try { await put(a); out.push(a); } catch { left.push(c.name); }
    }
    setMade(out); setSkipped(left);
    toast(`${out.length} data model${out.length === 1 ? '' : 's'} made${left.length ? `; ${left.length} column${left.length === 1 ? '' : 's'} could not be fitted` : ''}.`, out.length ? 'success' : 'warning');
  };
  return { made, skipped, make, clear: () => { setMade([]); setSkipped([]); } };
}

/** The data models just made, with “Add all to project”. */
export function ManyResult({ made, skipped }: { made: Artefact<'data-model'>[]; skipped: string[] }) {
  const { active, update, addProject, toast } = useStore();
  const [added, setAdded] = useState(false);
  if (!made.length && !skipped.length) return null;
  const name = active ? active.passport.identity.title.trim() || 'Untitled project' : '';
  const addAll = () => {
    const now = new Date().toISOString();
    if (!active) {
      const doc = createProject({ now });
      for (const a of made) includeArtefact(doc, a, now);
      void addProject(doc, true);
      toast(`Started “${doc.passport.identity.title}” with ${made.length} inputs.`, 'success');
    } else {
      const before = { passport: structuredClone(active.passport), artefacts: structuredClone(active.artefacts ?? []) };
      update((d) => { for (const a of made) includeArtefact(d, a, now); });
      toast(`Added ${made.length} inputs to “${name}”.`, 'success', { label: 'Undo', run: () => update((d) => { d.passport = before.passport; d.artefacts = before.artefacts; }) });
    }
    setAdded(true);
  };
  return (
    <section className="dm-many" aria-labelledby="dm-many-h">
      <h3 id="dm-many-h"><Layers size={18} aria-hidden="true" /> {made.length} data model{made.length === 1 ? '' : 's'} made</h3>
      <ul className="dm-many-list">
        {made.map((a) => (
          <li key={a.id}><Link to={`/toolbox/data/${a.id}`}><strong>{a.title}</strong></Link> <span className="muted">{describeModel(a.data)} · lowest AIC</span></li>
        ))}
      </ul>
      {skipped.length > 0 && <p className="hint">Not made (fewer than 3 values, or no curve fits): {skipped.join(', ')}.</p>}
      {made.length > 0 && (added
        ? <p className="dm-many-done" role="status"><CircleCheck size={16} aria-hidden="true" /> Added. Each is one input row in step 4.</p>
        : <button type="button" className="btn primary" onClick={addAll}><Plus size={16} aria-hidden="true" /> {active ? <>Add all to <span className="ab-clip">{name}</span></> : 'Add all to a new project'}</button>)}
    </section>
  );
}
