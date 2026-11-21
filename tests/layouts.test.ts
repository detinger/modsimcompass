import { describe, expect, it } from 'vitest';
import ELK from 'elkjs/lib/elk.bundled.js';
import stored from '../src/ui/diagrams/layouts.generated.json';
import { BUILDERS, allVariants } from '../src/ui/diagrams/graphDefs';
import { WIDTH_MAX, WIDTH_MIN, WIDTH_STEP, computeLayout, finishLayout, layoutKey, snapWidth, type StoredLayout } from '../src/ui/diagrams/layoutCore';

const STORED = stored as unknown as Record<string, StoredLayout>;

describe('stored diagram layouts', () => {
  const variants = allVariants();

  it('match what the layout engine produces today (run `npm run gen:layouts` if this fails)', async () => {
    const elk = new ELK();
    const fresh: Record<string, StoredLayout> = {};
    for (const v of variants) fresh[v.key] = await computeLayout(elk, v.def, v.dir);
    expect(Object.keys(STORED).sort()).toEqual(Object.keys(fresh).sort());
    expect(STORED).toEqual(fresh);
  });

  it('have one key per distinct graph, with no hash collisions', () => {
    const byKey = new Map<string, string>();
    for (const build of Object.values(BUILDERS)) {
      for (const dir of ['RIGHT', 'DOWN'] as const) {
        for (let w = WIDTH_MIN; w <= WIDTH_MAX; w += WIDTH_STEP) {
          const def = build(dir, w), key = layoutKey(def, dir), text = dir + JSON.stringify(def);
          expect(byKey.get(key) ?? text).toBe(text);
          byKey.set(key, text);
        }
      }
    }
    expect(byKey.size).toBe(variants.length);
  });

  it('cover every screen width for every diagram, in at least one direction that fits or scrolls', () => {
    for (const build of Object.values(BUILDERS)) {
      for (let width = 120; width <= 2600; width += 7) {
        const w = snapWidth(width);
        const right = STORED[layoutKey(build('RIGHT', w), 'RIGHT')];
        const down = STORED[layoutKey(build('DOWN', w), 'DOWN')];
        expect(right, `RIGHT at ${width}`).toBeTruthy();
        expect(down, `DOWN at ${width}`).toBeTruthy();
        // from 280 px of card width (a 320 px screen) the chosen layout never needs sideways scrolling
        if (width >= 280) expect(right.width <= width || down.width <= width, `fits at ${width}`).toBe(true);
      }
    }
  });

  it('turn stored corner points into paths with an arrowhead at the last point', () => {
    const any = finishLayout(STORED[variants[0].key]);
    for (const [id, e] of Object.entries(any.edges)) {
      const pts = STORED[variants[0].key].edges[id].pts, last = pts[pts.length - 1];
      expect(e.d.startsWith(`M${pts[0][0]},${pts[0][1]}`)).toBe(true);
      expect(e.head.startsWith(`${last[0]},${last[1]} `)).toBe(true);
      expect(e.route.endsWith(`L${last[0].toFixed(1)},${last[1].toFixed(1)}`)).toBe(true);
    }
  });
});
