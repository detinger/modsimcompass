/** Where the earlier Tools pages went (docs/TOOLBOX-SPEC.md §1). */
const OLD_TOOLS: Record<string, string> = {
  distributions: '/toolbox/data', choose: '/toolbox/data', fitting: '/toolbox/data',
  sampling: '/learn/ideas', regression: '/learn/ideas', sandbox: '/toolbox/compare', apps: '/learn/methods',
};

function redirectOnce(p: string): string | null {
  const exact: Record<string, string> = {
    '/start': '/', '/projects': '/', '/help': '/', '/settings': '/', '/glossary': '/learn/glossary', '/methods': '/project/method', '/sandbox': '/tools/sandbox',
    '/labs': '/tools', '/labs/linear-model': '/tools/regression', '/legacy': '/tools', '/legacy/linear-model': '/tools/regression',
  };
  if (exact[p]) return exact[p];
  if (/^\/(lenses|detective|challenges|examples|lectures)(\/|$)/.test(p)) return '/';
  const lab = p.match(/^\/(labs|legacy)\/(.+)$/);
  if (lab) return `/tools/${lab[2]}`;
  const tool = p.match(/^\/tools(?:\/([^/]+))?(?:\/.*)?$/);
  if (tool) return (tool[1] && Object.hasOwn(OLD_TOOLS, tool[1]) ? OLD_TOOLS[tool[1]] : null) ?? '/toolbox';
  return null;
}
/** Old addresses (v1 experiences, labs, legacy, the earlier Tools area) redirect to where the content lives now. */
export function redirectFor(p: string): string | null {
  let to = redirectOnce(p);
  for (let i = 0; to !== null && i < 4; i++) { const next = redirectOnce(to); if (next === null) break; to = next; }
  return to;
}
