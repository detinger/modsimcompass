import { ArrowRight, FolderOpen } from 'lucide-react';
import { useArtefacts } from '../../app/artefacts';
import { Link } from '../../app/router';
import { kindDef, KINDS, TOOL_ORDER } from '../../domain/artefacts/kinds';
import { STEP_BY_ID } from '../../domain/passport/compass';
import { ArtefactCard } from './ArtefactCard';
import { TOOL_META } from './toolMeta';
import '../../styles/toolbox.css';

/** `/toolbox`: the five tools, and the artefacts made most recently. */
export default function Toolbox() {
  const { list } = useArtefacts();
  const recent = list.slice(0, 6);
  return (
    <div className="page tbx-hub">
      <div className="page-head">
        <h1>Toolbox</h1>
        <p className="lede">Five tools. Each makes an artefact you can export or add to a project.</p>
      </div>

      <ul className="tbx-tiles" aria-label="Tools">
        {TOOL_ORDER.map((kind) => {
          const meta = TOOL_META[kind], def = KINDS[kind], step = STEP_BY_ID[def.step];
          const Icon = meta.icon;
          // Everything the tool makes, whatever its kind (Data and inputs makes data models and measurement data).
          const count = list.filter((a) => KINDS[a.kind].toolPath === def.toolPath).length;
          return (
            <li key={kind}>
              <Link to={def.toolPath} className={`tbx-tile ${meta.tone}`}>
                <span className="tbx-tile-top">
                  <span className="tbx-tile-icon" aria-hidden="true"><Icon size={26} /></span>
                  <span className="tbx-tile-step">Step {step.number}</span>
                </span>
                <span className="tbx-tile-name">{meta.name}</span>
                <span className="tbx-tile-text">{meta.tagline}</span>
                <span className="tbx-tile-foot">
                  <span>{count === 0 ? `Makes a ${def.label.toLowerCase()}` : `${count} saved`}</span>
                  <ArrowRight size={18} aria-hidden="true" className="tbx-tile-go" />
                </span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link to="/toolbox/artefacts" className="tbx-tile tbx-tile-mine">
            <span className="tbx-tile-top">
              <span className="tbx-tile-icon" aria-hidden="true"><FolderOpen size={26} /></span>
            </span>
            <span className="tbx-tile-name">My artefacts</span>
            <span className="tbx-tile-text">Everything you made, kept on this device.</span>
            <span className="tbx-tile-foot">
              <span>{list.length === 0 ? 'Nothing yet' : `${list.length} saved`}</span>
              <ArrowRight size={18} aria-hidden="true" className="tbx-tile-go" />
            </span>
          </Link>
        </li>
      </ul>

      <section aria-labelledby="tbx-recent">
        <div className="section-title">
          <h2 id="tbx-recent">Recent artefacts</h2>
          {list.length > 0 && <Link to="/toolbox/artefacts">My artefacts ({list.length})</Link>}
        </div>
        {recent.length === 0 ? (
          <div className="tbx-empty"><p><strong>Nothing yet.</strong> What you make in a tool is kept here.</p></div>
        ) : (
          <ul className="artefact-cards">
            {recent.map((a) => {
              const def = kindDef(a.kind);
              const to = `${def.toolPath}/${a.id}`;
              return (
                <li key={a.id}>
                  <ArtefactCard kind={a.kind} title={a.title} updatedAt={a.updatedAt} summary={def.summary(a.data)} figure={def.figure(a.data)} to={to}
                    actions={<Link className="btn small" to={to}>Open</Link>} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
