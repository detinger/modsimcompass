import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Check, CircleCheckBig } from 'lucide-react';
import { useStore } from '../../app/store';
import { useArtefacts } from '../../app/artefacts';
import { Link, useRouter } from '../../app/router';
import { FAMILY_TONE, METHOD_BY_ID, type MethodId } from '../../domain/methods/registry';
import { TEMPLATES, originalsFor, startFromTemplate, type Started } from '../../content/templates';
import { EXAMPLE_TITLE, workedExampleCopy } from '../../content/workedExample';
import { MethodGlyph } from '../toolbox/method/glyphs';
import { titleOf } from '../home/ProjectCard';
import { OVERVIEW, ProjectLibrary } from '../home/ProjectLibrary';
import './projects.css';

/** The worked example's card: a finished project beside the planned ones. Starting from it gives an editable copy. */
const WORKED = { id: 'worked-example', method: 'system-dynamics' as MethodId, title: EXAMPLE_TITLE, area: 'IT support', data: 'Daily ticket counts',
  pitch: 'Open tickets pile up at the helpdesk: does one more part-time technician stop the growth?',
  shows: ['All seven steps, results and recommendation', 'One stock, its inflow and outflow, day by day', 'An honest self-review at every checkpoint'] };

/**
 * `/project`: the Project page. The reader's projects, then the examples: the worked example and the templates,
 * planned projects from IT and information systems that start a new project. The open project's overview is
 * `/project/overview`.
 */
export default function Projects() {
  const { active, projects, addProject, toast } = useStore();
  const { put } = useArtefacts();
  const { path, navigate } = useRouter();
  const examples = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // `/project#examples` (the Examples tile on Home) lands on the examples.
  useEffect(() => {
    if (path.includes('#examples') || window.location.hash === '#examples') examples.current?.scrollIntoView({ block: 'start' });
  }, [path]);

  /**
   * A new, editable project from an example, and its artefacts in My artefacts, linked to the project's copies. A second
   * project from the same example gets a number, so the two can be told apart. Should storing an artefact fail, its copy
   * still works: Edit makes the original again.
   */
  const start = async (id: string, base: string, make: (title: string) => Started, done: string) => {
    if (busy) return;
    setBusy(id);
    const taken = new Set(projects.map(titleOf));
    let title = base;
    for (let n = 2; taken.has(title); n++) title = `${base} (${n})`;
    try {
      const { project, artefacts } = make(title);
      let stored = 0;
      for (const a of artefacts) { try { await put(a); stored++; } catch { /* the copy stays usable */ } }
      await addProject(project, true);
      toast(`“${title}” is ready. ${done}${stored ? ` Its ${stored} artefacts are in My artefacts.` : ''}`, 'success');
      navigate(OVERVIEW);
    } finally { setBusy(null); }
  };
  const startButton = (id: string, title: string, run: () => void) => (
    <button type="button" className="btn primary" disabled={busy !== null} onClick={run}>
      Start from this<span className="sr-only">: {title}</span> <ArrowRight size={16} aria-hidden="true" />
    </button>
  );

  return (
    <div className="page prj">
      <header className="prj-head">
        <div>
          <h1>Projects</h1>
          <p className="lede">Open one of yours, or start from an example.</p>
        </div>
        {active && (
          <Link to={OVERVIEW} className="btn primary cta"><span className="clip">Continue {titleOf(active)}</span> <ArrowRight size={18} aria-hidden="true" /></Link>
        )}
      </header>

      <ProjectLibrary alwaysNew />

      <section id="examples" ref={examples} className="prj-examples" aria-labelledby="prj-examples-h">
        <div className="section-title"><h2 id="prj-examples-h">Examples</h2></div>
        <p className="prj-sub">Projects from IT and information systems, each yours to edit. One is finished; the others are planned up to the experiment, so you build the model and write the conclusion.</p>
        <ul className="tpl-grid">
          <li>
            <ExampleCard method={WORKED.method} tone="tone-orange" area={WORKED.area} title={WORKED.title} pitch={WORKED.pitch} data={WORKED.data} shows={WORKED.shows}
              badge={<><CircleCheckBig size={12} aria-hidden="true" /> All 7 steps</>}
              action={startButton(WORKED.id, WORKED.title, () => { void start(WORKED.id, WORKED.title, (title) => { const project = workedExampleCopy({ title }); return { project, artefacts: originalsFor(project, new Date().toISOString()) }; }, 'All seven steps are yours to edit.'); })} />
          </li>
          {TEMPLATES.map((t) => {
            const method = t.content.representation.primaryMethod;
            return (
              <li key={t.id}>
                <ExampleCard method={method} tone={FAMILY_TONE[METHOD_BY_ID[method].family]} area={t.area} title={t.title} pitch={t.pitch} data={t.data} shows={t.shows}
                  action={startButton(t.id, t.title, () => { void start(t.id, t.title, (title) => startFromTemplate(t, { title }), 'Steps 1 to 6 are planned; the model and the conclusion are yours.'); })} />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function ExampleCard({ method, tone, area, title, pitch, data, shows, badge, action }: {
  method: MethodId; tone: string; area: string; title: string; pitch: string; data: string; shows?: readonly string[]; badge?: ReactNode; action: ReactNode;
}) {
  return (
    <article className={`tpl-card mt-anim ${tone}`} aria-label={title}>
      <div className="tpl-art">
        <span className="tpl-glyph"><MethodGlyph method={method} size={52} /></span>
        <span className="tpl-area">{area}</span>
        {badge && <span className="tpl-badge">{badge}</span>}
      </div>
      <div className="tpl-body">
        <h3>{title}</h3>
        <p className="tpl-pitch">{pitch}</p>
        <dl className="tpl-facts">
          <div><dt>Method</dt><dd>{METHOD_BY_ID[method].name}</dd></div>
          <div><dt>Data</dt><dd>{data}</dd></div>
        </dl>
        {shows && shows.length > 0 && (
          <ul className="tpl-shows" aria-label="What it shows">
            {shows.map((s) => <li key={s}><Check size={14} aria-hidden="true" /> {s}</li>)}
          </ul>
        )}
      </div>
      <footer className="tpl-foot">{action}</footer>
    </article>
  );
}
