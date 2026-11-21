import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
}

/** Owner rules: English only, no author or institution names, no raster figures. */
describe('owner rules', () => {
  const files = [...walk('src').filter((f) => /\.(ts|tsx|css)$/.test(f)), 'index.html'];
  const FORBIDDEN = /\b(FIPU|Etinger|Juraj|Dobrila|Ceric|Robinson|Sargent|Kelton|Hyndman|Burnham|Sterman|Ulrich|Henseler|Rigdon|MacCallum|Erlang)\b|Čerić|Rönkkö/;
  const CROATIAN = /[čćšžđČĆŠŽĐ]|\b(sustav\w*|vrijeme|varijabl\w*|simulacij\w*|modeliranj\w*|glava|pismo|blagajn\w*|zavisna|događaj\w*|stanje)\b/i;
  it('no author or institution names anywhere in the app source', () => {
    for (const f of files) { const m = readFileSync(f, 'utf8').match(FORBIDDEN); expect(m, `${f}: ${m?.[0]}`).toBeNull(); }
  });
  it('no Croatian characters or words anywhere in the app source', () => {
    for (const f of files) { const m = readFileSync(f, 'utf8').match(CROATIAN); expect(m, `${f}: ${m?.[0]}`).toBeNull(); }
  });
  it('no raster figures are referenced', () => {
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/\.(webp|png|jpe?g)['"`)]/);
  });
});
