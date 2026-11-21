import { ArrowLeft, ArrowRight, Lightbulb, Route, Shapes, type LucideIcon } from 'lucide-react';
import { Link } from '../../app/router';
import NotFound from '../help/NotFound';

/** The three Learn pages. Placeholder until they are written. */
const PAGES: { id: string; title: string; text: string; icon: LucideIcon; tone: string }[] = [
  { id: 'process', title: 'The simulation process', text: 'Seven stops from a question to a recommendation.', icon: Route, tone: 'tone-blue' },
  { id: 'methods', title: 'Methods at a glance', text: 'Eleven methods, side by side.', icon: Shapes, tone: 'tone-purple' },
  { id: 'ideas', title: 'Key ideas', text: 'The few ideas every model rests on.', icon: Lightbulb, tone: 'tone-orange' },
];

/** `/learn`, `/learn/:page` and `/learn/methods/:id`. */
export default function Learn({ page, id }: { page?: string; id?: string }) {
  if (!page) {
    return (
      <div className="page">
        <div className="page-head">
          <h1>Learn</h1>
          <p className="lede">A short, visual tour. Mostly pictures.</p>
        </div>
        <ul className="tiles three">
          {PAGES.map((p) => {
            const Icon = p.icon;
            return (
              <li key={p.id}>
                <Link to={`/learn/${p.id}`} className={`tile ${p.tone}`}>
                  <span className="tile-icon"><Icon size={22} aria-hidden="true" /></span>
                  <span className="tile-title">{p.title}</span>
                  <span className="tile-text">{p.text}</span>
                  <span className="tile-meta">Open <ArrowRight size={14} aria-hidden="true" /></span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  const found = PAGES.find((p) => p.id === page);
  if (!found || (id && page !== 'methods')) return <NotFound />;
  return (
    <div className="page">
      <div className="page-head">
        <p><Link to="/learn"><ArrowLeft size={14} aria-hidden="true" /> Learn</Link></p>
        <h1>{found.title}</h1>
        <p className="lede">{found.text}</p>
      </div>
      <div className="home-empty"><p><strong>This page is being written.</strong>{id ? ` It will open on the method “${id}”.` : ''}</p></div>
    </div>
  );
}
