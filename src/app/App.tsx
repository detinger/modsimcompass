import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { RouterProvider, match, useRouter } from './router';
import { StoreProvider, useStore } from './store';
import { ArtefactsProvider, useArtefacts } from './artefacts';
import { Shell } from './Shell';
import { ErrorBoundary } from './ErrorBoundary';
import { redirectFor } from './redirects';
import Home from '../features/home/Home';
import Settings from '../features/settings/Settings';
import Help from '../features/help/Help';
import NotFound from '../features/help/NotFound';
import { KIND_ORDER, KINDS } from '../domain/artefacts/kinds';
import { TOOL_META } from '../features/toolbox/toolMeta';

// The project screens, Learn and the Toolbox are loaded when first opened.
const Compass = lazy(() => import('../features/compass/Compass'));
const Learn = lazy(() => import('../features/learn/Learn'));
const Toolbox = lazy(() => import('../features/toolbox/Toolbox'));
const Artefacts = lazy(() => import('../features/toolbox/Artefacts'));
/** Tool pages by the last part of their address (`/toolbox/<slug>[/:id]`). Each takes the artefact id from the address. */
const TOOL_PAGES = {
  concept: lazy(() => import('../features/toolbox/concept/ConceptTool')),
  method: lazy(() => import('../features/toolbox/method/MethodTool')),
  data: lazy(() => import('../features/toolbox/data/DataTool')),
  checks: lazy(() => import('../features/toolbox/checks/ChecksTool')),
  compare: lazy(() => import('../features/toolbox/compare/CompareTool')),
};
const isTool = (slug: string): slug is keyof typeof TOOL_PAGES => Object.hasOwn(TOOL_PAGES, slug);

/** Page titles by address prefix; the first match wins, so the more specific address comes first. */
const TITLES: [string, string][] = [
  ['/learn', 'Learn'], ['/toolbox/artefacts', 'My artefacts'],
  ...KIND_ORDER.map((k): [string, string] => [KINDS[k].toolPath, TOOL_META[k].name]),
  ['/toolbox', 'Toolbox'], ['/project', 'Project'], ['/example', 'Worked example'], ['/settings', 'Settings'], ['/help', 'Help'],
];
const Loading = ({ what }: { what: string }) => <p className="muted" role="status">Loading {what}…</p>;

function Routes() {
  const { path, navigate } = useRouter();
  const { ready } = useStore();
  const artefacts = useArtefacts();
  const p = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const redirect = redirectFor(p);
  useEffect(() => {
    const t = TITLES.find(([pre]) => p === pre || p.startsWith(`${pre}/`))?.[1];
    document.title = t ? `${t} · ModSim Essentials` : 'ModSim Essentials';
  }, [p]);
  useEffect(() => { if (redirect) navigate(redirect, { replace: true }); }, [redirect, navigate]);
  if (!ready || !artefacts.ready) return <p className="muted" role="status">Loading your local workspace…</p>;
  if (redirect) return null;
  let m: Record<string, string> | null;
  if (p === '/') return <Home />;
  if ((m = match('/learn', p)) || (m = match('/learn/:page', p)) || (m = match('/learn/:page/:id', p))) {
    return <Suspense fallback={<Loading what="Learn" />}><Learn page={m.page} id={m.id} /></Suspense>;
  }
  if (p === '/toolbox') return <Suspense fallback={<Loading what="the Toolbox" />}><Toolbox /></Suspense>;
  if (p === '/toolbox/artefacts') return <Suspense fallback={<Loading what="your artefacts" />}><Artefacts /></Suspense>;
  if (((m = match('/toolbox/:tool', p)) || (m = match('/toolbox/:tool/:id', p))) && isTool(m.tool)) {
    // The same element for both addresses, so a tool keeps its state when the artefact id enters the address.
    const Tool = TOOL_PAGES[m.tool];
    return <Suspense fallback={<Loading what="the tool" />}><Tool key={m.tool} id={m.id} /></Suspense>;
  }
  if ((m = match('/project', p)) || (m = match('/project/:step', p))) return <Suspense fallback={<Loading what="the project" />}><Compass step={m.step} /></Suspense>;
  if ((m = match('/example', p)) || (m = match('/example/:step', p))) return <Suspense fallback={<Loading what="the worked example" />}><Compass step={m.step} example /></Suspense>;
  if (p === '/settings') return <Settings />;
  if (p === '/help') return <Help />;
  return <NotFound />;
}

/** A failing screen shows a recovery card instead of a blank page; moving to another address clears it. */
function Guarded({ children }: { children: ReactNode }) {
  const { path } = useRouter();
  const { active } = useStore();
  return <ErrorBoundary resetKey={path} project={active}>{children}</ErrorBoundary>;
}

export default function App() {
  return (
    <RouterProvider>
      <StoreProvider>
        <ArtefactsProvider>
          <Shell><Guarded><Routes /></Guarded></Shell>
        </ArtefactsProvider>
      </StoreProvider>
    </RouterProvider>
  );
}
