import { lazy, Suspense } from 'react';
import { METHOD_BY_ID, type MethodId } from '../../domain/methods/registry';
import NotFound from '../help/NotFound';
import Landing from './Landing';
import '../../styles/learn.css';

// Each Learn page is its own chunk; the landing page stays light.
const ProcessPage = lazy(() => import('./ProcessPage'));
const MethodsPage = lazy(() => import('./MethodsPage'));
const IdeasPage = lazy(() => import('./IdeasPage'));
const GlossaryPage = lazy(() => import('./GlossaryPage'));

const isMethodId = (id: string): id is MethodId => Object.hasOwn(METHOD_BY_ID, id);
const loading = <p className="muted" role="status">Loading…</p>;

/** `/learn`, `/learn/:page` (process, methods, ideas, glossary) and `/learn/methods/:id`. */
export default function Learn({ page, id }: { page?: string; id?: string }) {
  if (!page) return <Landing />;
  if (page === 'methods' && (!id || isMethodId(id))) return <Suspense fallback={loading}><MethodsPage open={id} /></Suspense>;
  if (id) return <NotFound />;
  if (page === 'process') return <Suspense fallback={loading}><ProcessPage /></Suspense>;
  if (page === 'ideas') return <Suspense fallback={loading}><IdeasPage /></Suspense>;
  if (page === 'glossary') return <Suspense fallback={loading}><GlossaryPage /></Suspense>;
  return <NotFound />;
}
