/**
 * Computes the diagram layouts with elkjs and stores them in src/ui/diagrams/layouts.generated.json.
 * Run `npm run gen:layouts` after changing a graph in src/ui/diagrams/graphDefs.ts or the layout options.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ELK from 'elkjs/lib/elk.bundled.js';
import { allVariants } from '../src/ui/diagrams/graphDefs';
import { computeLayout, type StoredLayout } from '../src/ui/diagrams/layoutCore';

const elk = new ELK();
const out: Record<string, StoredLayout> = {};
const variants = allVariants();
for (const v of variants) out[v.key] = await computeLayout(elk, v.def, v.dir);
const file = fileURLToPath(new URL('../src/ui/diagrams/layouts.generated.json', import.meta.url));
writeFileSync(file, JSON.stringify(out) + '\n');
console.log(`${variants.length} layouts written to ${file}`);
