/** Small preferences in localStorage only (PLAN §12). Key kept under the original `modsim101` prefix. */
export const PREFS_KEY = 'modsim101.prefs';
export const ACTIVE_KEY = 'modsim101.activeProject';

export type ThemePref = 'system' | 'light' | 'dark';
export interface Prefs { theme: ThemePref; sidebarCollapsed: boolean; readingMode: boolean; includeAuthor: boolean }
const DEFAULTS: Prefs = { theme: 'system', sidebarCollapsed: false, readingMode: false, includeAuthor: false };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULTS };
    const o = JSON.parse(raw) as Partial<Prefs>;
    return {
      theme: o.theme === 'light' || o.theme === 'dark' ? o.theme : 'system',
      sidebarCollapsed: o.sidebarCollapsed === true,
      readingMode: o.readingMode === true,
      includeAuthor: o.includeAuthor === true,
    };
  } catch { return { ...DEFAULTS }; }
}

export function savePrefs(p: Prefs): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* preferences are optional */ }
}

export function applyTheme(theme: ThemePref): void {
  const el = document.documentElement;
  if (theme === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', theme);
}

export function loadActiveId(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}
export function saveActiveId(id: string | null): void {
  try { if (id) localStorage.setItem(ACTIVE_KEY, id); else localStorage.removeItem(ACTIVE_KEY); } catch { /* optional */ }
}
