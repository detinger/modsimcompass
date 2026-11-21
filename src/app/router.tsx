import { createContext, useContext, useEffect, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

/** Minimal history-API router. Static hosts need an SPA fallback (netlify.toml, server.mjs). */
interface RouterValue { path: string; navigate: (to: string, opts?: { replace?: boolean; /** false: stay where the page is scrolled (an address that changes while the user is working). */ scroll?: boolean }) => void }
const RouterCtx = createContext<RouterValue>({ path: '/', navigate: () => {} });

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname + window.location.search);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = (to: string, opts?: { replace?: boolean; scroll?: boolean }) => {
    if (to === window.location.pathname + window.location.search) return;
    if (opts?.replace) window.history.replaceState(null, '', to);
    else window.history.pushState(null, '', to);
    setPath(to);
    if (opts?.scroll !== false) window.scrollTo(0, 0);
  };
  return <RouterCtx.Provider value={{ path, navigate }}>{children}</RouterCtx.Provider>;
}

export function useRouter() { return useContext(RouterCtx); }

export function Link({ to, children, onClick, ...rest }: { to: string; children: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const { navigate } = useRouter();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={handle} {...rest}>{children}</a>;
}

/** Match `/a/:b` patterns. Returns params or null. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const pp = pattern.split('/'), sp = clean.split('/');
  if (pp.length !== sp.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) { try { params[pp[i].slice(1)] = decodeURIComponent(sp[i]); } catch { return null; } } // a malformed % sequence matches nothing
    else if (pp[i] !== sp[i]) return null;
  }
  return params;
}
