import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FAMILIES, METHODS, METHOD_BY_ID, appForMethod } from '../src/domain/methods/registry';
import { KIND_ORDER, KINDS, TOOL_ORDER } from '../src/domain/artefacts/kinds';
import { STEPS } from '../src/domain/passport/compass';
import { DIAGRAMS, JOURNEY } from '../src/content/diagrams/specs';
import { MODEL_KINDS, PROCESS_LOOP, PROCESS_STOPS } from '../src/content/learn/process';
import { METHOD_PROFILES } from '../src/domain/methods/profiles';
import { KEY_IDEAS, LEARN_PAGES, UNCERTAINTY } from '../src/content/learn/ideas';
import { GLOSSARY, glossaryHref, termId } from '../src/content/learn/glossary';
import { METHOD_PICTURE_TEXT } from '../src/content/learn/pictures';
import { METHOD_PICTURES } from '../src/features/learn/pictures';
import { ABM, CA_GENS, caStep, type CaState } from '../src/features/learn/pictures/emergence';
import { queueLength } from '../src/features/learn/pictures/processes';
import { UNC } from '../src/features/learn/pictures/uncertainty';
import { destination } from '../src/features/learn/links';
import Landing from '../src/features/learn/Landing';
import ProcessPage from '../src/features/learn/ProcessPage';
import MethodsPage from '../src/features/learn/MethodsPage';
import IdeasPage from '../src/features/learn/IdeasPage';
import GlossaryPage from '../src/features/learn/GlossaryPage';

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe('method registry as used by Learn', () => {
  it('has eleven methods in four families', () => {
    expect(METHODS).toHaveLength(11);
    expect(new Set(METHODS.map((m) => m.family))).toEqual(new Set(Object.keys(FAMILIES)));
  });
  it('gives every method a one-sentence purpose and an example question', () => {
    for (const m of METHODS) {
      expect(m.purpose, m.id).toMatch(/^[A-Z].*\.$/);
      expect(m.purpose.slice(0, -1), `${m.id}: one sentence`).not.toMatch(/[.!?] [A-Z]/);
      expect(m.exampleQuestion, m.id).toMatch(/\?$/);
    }
  });
  it('lists what each method needs, leaves out and when it fails', () => {
    for (const m of METHODS) {
      expect(m.dataNeeds.length, m.id).toBeGreaterThan(0);
      expect(m.omits.length, m.id).toBeGreaterThan(0);
      expect(m.failureConditions.length, m.id).toBeGreaterThan(0);
    }
  });
  it('links a specialist app only where a URL is configured', () => {
    for (const m of METHODS) {
      const app = appForMethod(m.id);
      expect(app, m.id).toBeDefined();
      if (app.url) expect(app.url).toMatch(/^https:\/\//);
    }
  });
});

describe('method pictures', () => {
  it('has a moving picture and a text equivalent for every method', () => {
    expect(Object.keys(METHOD_PICTURES).sort()).toEqual(METHODS.map((m) => m.id).sort());
    expect(Object.keys(METHOD_PICTURE_TEXT).sort()).toEqual(METHODS.map((m) => m.id).sort());
    for (const m of METHODS) expect(METHOD_PICTURE_TEXT[m.id].length, m.id).toBeGreaterThan(60);
  });
  it('renders each picture as an SVG image on the shared 280 × 150 canvas, named by its text', () => {
    for (const m of METHODS) {
      const html = render(createElement(METHOD_PICTURES[m.id], { label: METHOD_PICTURE_TEXT[m.id] }));
      expect(html, m.id).toMatch(/^<svg[^>]*class="lp-pic"/);
      expect(html, m.id).toContain('viewBox="0 0 280 150"');
      expect(html, m.id).toContain('role="img"');
      expect(html, m.id).toContain(`aria-label="${METHOD_PICTURE_TEXT[m.id].replace(/&/g, '&amp;')}"`);
      expect(html, m.id).not.toMatch(/<image|<foreignObject|href=/);
    }
  });
  it('cellular automaton: firing cells rest, resting cells recover, neighbours of firing cells fire', () => {
    const g: CaState[][] = [[0, 0, 0], [0, 1, 0], [0, 0, 2]];
    expect(caStep(g)).toEqual([[0, 1, 0], [1, 2, 1], [0, 1, 0]]);
    // The two rings meet, cancel and leave the grid: the last generation is quiet again.
    expect(CA_GENS[CA_GENS.length - 1].flat().every((s) => s === 0)).toBe(true);
    expect(CA_GENS[5].flat().filter((s) => s === 1).length).toBeGreaterThan(10);
  });
  it('agent-based model: adoption starts with one agent, never falls back, and reaches everyone', () => {
    expect(ABM.share[0]).toBeCloseTo(1 / ABM.N);
    for (let i = 1; i < ABM.share.length; i++) expect(ABM.share[i]).toBeGreaterThanOrEqual(ABM.share[i - 1]);
    expect(ABM.share[ABM.share.length - 1]).toBe(1);
    expect(ABM.need.every((n) => n >= 1 && n <= 3)).toBe(true);
  });
  it('queueing: the average number in a one-server system is ρ / (1 − ρ)', () => {
    expect(queueLength(0.5)).toBeCloseTo(1);
    expect(queueLength(0.9)).toBeCloseTo(9);
    expect(queueLength(0.95)).toBeCloseTo(19);
  });
  it('uncertainty picture: forty observations stacked into their bins', () => {
    expect(UNC.obs).toHaveLength(40);
    expect(UNC.bins.reduce((a, b) => a + b, 0)).toBe(40);
    expect(UNCERTAINTY.stages).toHaveLength(4);
    expect(UNCERTAINTY.caption).toMatch(/illustrative/i);
  });
});

describe('the simulation process', () => {
  it('has one card per compass stop, in order', () => {
    expect(PROCESS_STOPS.map((s) => s.step)).toEqual(STEPS.map((s) => s.id));
    for (const s of PROCESS_STOPS) { expect(s.does.length).toBeGreaterThan(20); expect(s.wrong.length).toBeGreaterThan(10); }
  });
  it('links each stop to the tool that belongs to the same step', () => {
    for (const s of PROCESS_STOPS) if (s.tool) expect(KINDS[s.tool].step, s.step).toBe(s.step);
    expect(new Set(PROCESS_STOPS.flatMap((s) => (s.tool ? [s.tool] : [])))).toEqual(new Set(TOOL_ORDER));
  });
  it('says in a few words how each stop differs for a simulation, a statistical and an analytic model', () => {
    expect(new Set(MODEL_KINDS.map((k) => k.id))).toEqual(new Set(Object.values(METHOD_PROFILES).map((p) => p.model)));
    for (const s of PROCESS_STOPS) for (const k of MODEL_KINDS) {
      const line = s.byKind[k.id];
      expect(line, `${s.step} ${k.id}`).toMatch(/^[A-Z].*[.?]$/);
      expect(line.length, `${s.step} ${k.id}`).toBeLessThanOrEqual(90);
    }
    expect(PROCESS_STOPS.find((s) => s.step === 'evaluation')!.byKind.statistical).toMatch(/No tuning/);
    expect(PROCESS_STOPS.find((s) => s.step === 'experiment')!.byKind.statistical).toMatch(/analysis plan/i);
  });
  it('loops back the same way as the compass diagram', () => {
    const n = (id: string) => STEPS.findIndex((s) => s.id === id) + 1;
    expect([n(PROCESS_LOOP.from), n(PROCESS_LOOP.to)]).toEqual([JOURNEY.loopFrom, JOURNEY.loopTo]);
  });
});

describe('key ideas and glossary', () => {
  it('has four Learn pages, in order, adding up to a 20 to 30 minute read', () => {
    expect(LEARN_PAGES.map((p) => p.id)).toEqual(['process', 'methods', 'ideas', 'glossary']);
    const total = LEARN_PAGES.reduce((s, p) => s + p.minutes, 0);
    expect(total).toBeGreaterThanOrEqual(20);
    expect(total).toBeLessThanOrEqual(30);
  });
  it('pairs each idea with its diagram and the tool of its compass stop', () => {
    expect(KEY_IDEAS.map((i) => [i.id, KINDS[i.tool].step])).toEqual([['concept', 'scope'], ['uncertainty', 'inputs'], ['checks', 'evaluation'], ['comparison', 'experiment']]);
    for (const i of KEY_IDEAS) {
      if (i.figure !== 'uncertainty') expect(Object.hasOwn(DIAGRAMS, i.figure), i.id).toBe(true);
      expect(i.lines.length).toBeLessThanOrEqual(3);
    }
  });
  it('folds “one run is one draw” into the fair comparison, and points each idea at its words in the glossary', () => {
    expect(KEY_IDEAS.find((i) => i.id === 'comparison')!.lines[0]).toBe('One run is one draw: compare many, paired.');
    const terms = new Set(GLOSSARY.map((t) => t.term));
    for (const i of KEY_IDEAS) {
      expect(i.terms.length, i.id).toBeGreaterThan(0);
      for (const t of i.terms) expect(terms.has(t), `${i.id}: ${t}`).toBe(true);
    }
  });
  it('keeps the glossary alphabetical, unique and linked to real pages', () => {
    const terms = GLOSSARY.map((t) => t.term);
    expect(terms).toEqual([...terms].sort((a, b) => a.localeCompare(b, 'en')));
    expect(new Set(terms).size).toBe(terms.length);
    const valid = new Set(['/toolbox/artefacts', ...KIND_ORDER.map((k) => KINDS[k].toolPath), ...METHODS.map((m) => `/learn/methods/${m.id}`)]);
    for (const t of GLOSSARY) if (t.to) {
      expect(valid.has(t.to), `${t.term}: ${t.to}`).toBe(true);
      expect(destination(t.to)).not.toMatch(/^\//);
    }
    expect(destination('/learn/methods/des')).toContain(METHOD_BY_ID.des.name);
    // Every term has its own address on the glossary page.
    expect(new Set(GLOSSARY.map((t) => termId(t.term))).size).toBe(GLOSSARY.length);
    expect(glossaryHref('Random seed')).toBe('/learn/glossary#term-random-seed');
    for (const t of GLOSSARY) expect(termId(t.term)).toMatch(/^term-[a-z0-9-]+$/);
  });
});

describe('Learn pages', () => {
  it('landing: four doors, the glossary among them, and every method one click away', () => {
    const html = render(createElement(Landing));
    expect(count(html, /class="lrn-door /g)).toBe(4);
    expect(html).toContain('href="/learn/glossary"');
    expect(html).not.toContain('#glossary');
    for (const m of METHODS) expect(html).toContain(`href="/learn/methods/${m.id}"`);
  });
  it('process: seven stops as tabs, the first one open', () => {
    const html = render(createElement(ProcessPage));
    expect(count(html, /role="tab"/g)).toBe(7);
    expect(count(html, /aria-selected="true"/g)).toBe(1);
    expect(html).toContain('href="/project/frame"');
    expect(html).toContain('role="tabpanel"');
    expect(count(html, /class="lrn-kind is-/g)).toBe(3);
    expect(count(html, /class="lrn-kind[^"]*" aria-pressed="true"/g)).toBe(1);
    expect(html).toContain(PROCESS_STOPS[0].byKind.simulation);
  });
  it('methods: eleven cards and eleven table rows; the card in the address is open', () => {
    const html = render(createElement(MethodsPage, { open: 'des' }));
    expect(count(html, /<article /g)).toBe(11);
    expect(count(html, /<th scope="row"/g)).toBe(11);
    expect(count(html, /aria-expanded="true"/g)).toBe(1);
    expect(html).toMatch(/id="method-des-more" class="lrn-method-more">/);
    expect(html).toMatch(/id="method-abm-more" class="lrn-method-more" hidden=""/);
    expect(count(html, /App link not configured/g)).toBe(METHODS.filter((m) => !appForMethod(m.id).url).length);
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it('ideas: four ideas, each with its tool button and its words in the glossary; no demos, no glossary of its own', () => {
    const html = render(createElement(IdeasPage));
    expect(count(html, /class="lrn-idea /g)).toBe(4);
    for (const k of ['concept-model', 'data-model', 'check-plan', 'comparison'] as const) expect(html).toContain(`href="${KINDS[k].toolPath}"`);
    expect(html).toContain(`href="${glossaryHref('Paired comparison')}"`);
    expect(html).not.toMatch(/lrn-demo|id="glossary"|id="chance"|<dt>/);
  });
  it('glossary: every term as a card with its own address, a search box and an A–Z row', () => {
    const html = render(createElement(GlossaryPage));
    expect(count(html, /<dt>/g)).toBe(GLOSSARY.length);
    for (const t of GLOSSARY) expect(html).toContain(`id="${termId(t.term)}"`);
    expect(html).toContain('type="search"');
    const letters = new Set(GLOSSARY.map((t) => t.term[0].toUpperCase()));
    expect(count(html, /href="#letter-[a-z]"/g)).toBe(letters.size);
    expect(html).toContain('href="/toolbox"'); // the pager leads on to the Toolbox
  });
});

describe('Learn wording', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const files = [...walk('src/features/learn'), ...walk('src/content/learn'), 'src/styles/learn.css'];
  it('stays reviewer-neutral and has no quizzes, scores or progress tracking', () => {
    for (const f of files) {
      const m = readFileSync(f, 'utf8').match(/\b(students?|teachers?|courses?|graded|grades?|quiz\w*|scores?|lessons?|progress bar)\b/i);
      expect(m, `${f}: ${m?.[0]}`).toBeNull();
    }
  });
  it('does not show where specialist links were checked', () => {
    const html = render(createElement(MethodsPage, {}));
    expect(html).not.toMatch(/portfolio|checked 20/i);
  });
});

describe('review fixes: motion that stops, one pause label, glossary wording', () => {
  const css = readFileSync('src/styles/learn.css', 'utf8');
  const landing = readFileSync('src/features/learn/Landing.tsx', 'utf8');

  it('the landing pictures play once and never loop on their own', () => {
    expect(landing).not.toMatch(/repeatCount="indefinite"/);
    for (const sel of ['.lrn-art-fam rect', '.lrn-art-drop']) {
      const rule = css.split('\n').find((l) => l.trim().startsWith(`${sel} {`) && l.includes('animation:'));
      expect(rule, sel).toBeDefined();
      expect(rule, sel).not.toMatch(/infinite/);
    }
  });

  it('the pause button of the method pictures keeps one name; its pressed state carries the state', () => {
    const src = readFileSync('src/features/learn/MethodsPage.tsx', 'utf8');
    expect(src).toContain('aria-pressed={!playing}');
    expect(src).not.toMatch(/'Play pictures'/);
  });

  it('the glossary agrees with itself on randomness, simulation and sensitivity', () => {
    const text = (term: string) => GLOSSARY.find((t) => t.term === term)?.text ?? '';
    expect(text('Stochastic model')).toMatch(/seed/);
    expect(text('Stochastic model')).not.toMatch(/every run gives a different result/);
    expect(text('Simulation')).toMatch(/many times/);
    expect(text('Sensitivity analysis')).toMatch(/together/);
  });
});
