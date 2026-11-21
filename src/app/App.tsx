import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { RouterProvider, match, useRouter } from './router';
import { StoreProvider, useStore } from './store';
import { Shell } from './Shell';
import { ErrorBoundary } from './ErrorBoundary';
import Home from '../features/home/Home';
import Compass from '../features/compass/Compass';
import Settings from '../features/settings/Settings';
import Help from '../features/help/Help';
import NotFound from '../features/help/NotFound';

const Tools = lazy(() => import('../features/tools/Tools'));

/** Old addresses (v1 experiences, labs, legacy) redirect into the three areas. */
function redirectFor(p: string): string | null {
  const exact: Record<string, string> = {
    '/start': '/', '/projects': '/', '/glossary': '/', '/methods': '/project/method', '/sandbox': '/tools/sandbox',
    '/labs': '/tools', '/labs/linear-model': '/tools/regression', '/legacy': '/tools', '/legacy/linear-model': '/tools/regression',
  };
  if (exact[p]) return exact[p];
  if (/^\/(lenses|detective|challenges|learn|examples|lectures)(\/|$)/.test(p)) return '/';
  const lab = p.match(/^\/(labs|legacy)\/(.+)$/);
  if (lab) return `/tools/${lab[2]}`;
  return null;
}

const TITLES: [string, string][] = [['/project', 'Project'], ['/example', 'Worked example'], ['/tools', 'Tools'], ['/settings', 'Settings'], ['/help', 'Help']];

function Routes() {
  const { path, navigate } = useRouter();
  const { ready } = useStore();
  const p = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const redirect = redirectFor(p);
  useEffect(() => {
    const t = TITLES.find(([pre]) => p === pre || p.startsWith(`${pre}/`))?.[1];
    document.title = t ? `${t} · ModSim Essentials` : 'ModSim Essentials';
  }, [p]);
  useEffect(() => { if (redirect) navigate(redirect, { replace: true }); }, [redirect, navigate]);
  if (!ready) return <p className="muted" role="status">Loading your local workspace…</p>;
  if (redirect) return null;
  let m: Record<string, string> | null;
  if (p === '/') return <Home />;
  if ((m = match('/project', p)) || (m = match('/project/:step', p))) return <Compass step={m.step} />;
  if ((m = match('/example', p)) || (m = match('/example/:step', p))) return <Compass step={m.step} example />;
  if ((m = match('/tools', p)) || (m = match('/tools/:id', p)) || (m = match('/tools/:id/:sub', p))) return <Suspense fallback={<p role="status">Loading tool…</p>}><Tools toolId={m.id} sub={m.sub} /></Suspense>;
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
        <Shell><Guarded><Routes /></Guarded></Shell>
      </StoreProvider>
    </RouterProvider>
  );
}
