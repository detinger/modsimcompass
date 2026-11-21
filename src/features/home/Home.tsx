import { ArrowRight, BookOpen, BookOpenCheck, Compass, Plus, Wrench } from 'lucide-react';
import { useStore } from '../../app/store';
import { Link, useRouter } from '../../app/router';
import { CompassArt } from './CompassArt';
import { titleOf } from './ProjectCard';
import { OVERVIEW, ProjectLibrary } from './ProjectLibrary';
import '../../styles/tools.css';

const DOORS = [
  { to: '/learn', title: 'Learn', text: 'The process and every method.', icon: BookOpen, tone: 'tone-purple' },
  { to: '/toolbox', title: 'Toolbox', text: 'Five tools. Each makes an artefact.', icon: Wrench, tone: 'tone-teal' },
  { to: '/project', title: 'Project', text: 'Your projects, seven steps each.', icon: Compass, tone: 'tone-primary' },
  { to: '/project#examples', title: 'Examples', text: 'Ready-made projects to start from.', icon: BookOpenCheck, tone: 'tone-orange' },
];

export default function Home() {
  const { projects, active, activate, createAndActivate } = useStore();
  const { navigate } = useRouter();
  const current = active ?? projects[0] ?? null;
  const open = async (id: string) => { await activate(id); navigate(OVERVIEW); };
  const startNew = () => { createAndActivate({ title: 'Untitled project' }); navigate(OVERVIEW); };

  const doors = (
    <nav aria-label="Areas">
      <ul className="tiles four doors">
        {DOORS.map((d) => (
          <li key={d.to}>
            <Link to={d.to} className={`tile door ${d.tone}`}>
              <span className="tile-icon"><d.icon size={24} aria-hidden="true" /></span>
              <span className="tile-title">{d.title}</span>
              <span className="tile-text">{d.text}</span>
              <span className="tile-meta">Open <ArrowRight size={13} aria-hidden="true" /></span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <div className="page home">
      <section className="hero home-hero">
        <div className="home-hero-text">
          <h1>Modelling &amp; Simulation compass</h1>
          <p className="lede">Plan, check and defend your modelling project, one step at a time.</p>
          <div className="btn-row">
            {current ? (
              <>
                <button className="btn primary cta" onClick={() => open(current.id)}><span className="clip">Continue {titleOf(current)}</span> <ArrowRight size={18} aria-hidden="true" /></button>
                <button className="btn cta" onClick={startNew}><Plus size={18} aria-hidden="true" /> New project</button>
              </>
            ) : (
              <>
                <button className="btn primary cta" onClick={startNew}><Plus size={18} aria-hidden="true" /> Start a new project</button>
                <Link className="btn cta" to="/example"><BookOpenCheck size={18} aria-hidden="true" /> See the worked example</Link>
              </>
            )}
          </div>
        </div>
        <CompassArt />
      </section>

      {projects.length === 0 && doors}

      <ProjectLibrary />

      {projects.length > 0 && doors}
    </div>
  );
}
