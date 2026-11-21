import { BadgeCheck, Compass, Hourglass, House, ListChecks, PenLine, ShieldCheck, Wrench } from 'lucide-react';
import { Link } from '../../app/router';
import '../../styles/tools.css';

const AREAS = [
  { to: '/', title: 'Home', text: 'Your projects. Start, import, back up.', icon: House, tone: 'tone-orange' },
  { to: '/project', title: 'Project', text: 'Seven steps with warnings and checkpoints.', icon: Compass, tone: 'tone-primary' },
  { to: '/toolbox', title: 'Toolbox', text: 'Make artefacts, then add them to your project.', icon: Wrench, tone: 'tone-teal' },
];

const NOT = [
  { icon: Hourglass, title: 'No waiting times from backlog', text: 'The sandbox counts unfinished work per day. It cannot say how long anyone waited.' },
  { icon: PenLine, title: 'Your words are never scored', text: 'Written answers are yours. The app never marks them right or wrong.' },
  { icon: ListChecks, title: 'Complete is not valid', text: '“Steps started” counts progress. It says nothing about model quality.' },
  { icon: BadgeCheck, title: 'Reviewer feedback is a label', text: 'It is set by hand. There are no accounts and no sign-in.' },
];

const KEYS: [string, string][] = [
  ['Tab', 'Next control'],
  ['Shift + Tab', 'Previous control'],
  ['Enter / Space', 'Press a button'],
  ['Esc', 'Close a dialog'],
];

export default function Help() {
  return (
    <div className="page help">
      <div className="page-head">
        <h1>Help</h1>
        <p className="lede">A checklist and compass for a modelling project.</p>
      </div>

      <section aria-labelledby="help-areas">
        <h2 id="help-areas" className="sr-only">Three areas</h2>
        <ul className="tiles three doors">
          {AREAS.map((a) => (
            <li key={a.to}>
              <Link to={a.to} className={`tile door ${a.tone}`}>
                <span className="tile-icon"><a.icon size={24} aria-hidden="true" /></span>
                <span className="tile-title">{a.title}</span>
                <span className="tile-text">{a.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="help-section" aria-labelledby="help-not">
        <h2 id="help-not">What this app does not do</h2>
        <ul className="not-cards">
          {NOT.map((n) => (
            <li key={n.title} className="not-card">
              <span className="not-icon" aria-hidden="true"><n.icon size={22} /></span>
              <strong>{n.title}</strong>
              <span>{n.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="help-section" aria-labelledby="help-data">
        <h2 id="help-data">Your data</h2>
        <div className="help-data">
          <span className="handoff-icon" aria-hidden="true"><ShieldCheck size={22} /></span>
          <p><strong>Everything stays in this browser.</strong> Nothing is uploaded. To back up or move your work, download a project file on Home and import it elsewhere.</p>
        </div>
      </section>

      <section className="help-section" aria-labelledby="help-keys">
        <h2 id="help-keys">Keyboard</h2>
        <ul className="keys">
          {KEYS.map(([k, what]) => <li key={k}><kbd>{k}</kbd> {what}</li>)}
        </ul>
        <p className="subtle-text" style={{ marginTop: 10 }}>“Skip to main content” appears on the first Tab. Every chart has a data table.</p>
      </section>
    </div>
  );
}
