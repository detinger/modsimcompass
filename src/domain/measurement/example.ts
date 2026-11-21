import { createRng } from '../sandbox/rng';
import type { Cell } from './stats';

/**
 * A small example survey, made by the app: four constructs of technology acceptance measured on a 1–7 scale.
 * Seeded, so it is the same for everyone. It is an example and never responses from real people.
 *
 * Built from four latent scores (ease of use, usefulness, attitude, intention to use) with a simple structure, items
 * that load on them with noise, one reverse-worded item, a few missing answers and three straight-lining cases.
 */
export const EXAMPLE_SURVEY_SEED = 'example-survey';
export const EXAMPLE_SURVEY_CASES = 150;

export interface ExampleSurvey {
  columns: string[];
  labels: string[];
  /** Columns worded in reverse, recoded before analysis. */
  reverse: string[];
  rows: Cell[][];
}

const ITEMS: { column: string; label: string; construct: 0 | 1 | 2 | 3; reverse?: boolean }[] = [
  { column: 'PEOU1', label: 'Learning to use it is easy', construct: 0 },
  { column: 'PEOU2', label: 'It is easy to get it to do what I want', construct: 0 },
  { column: 'PEOU3', label: 'Using it is clear and understandable', construct: 0 },
  { column: 'PEOU4', label: 'It is easy to become skilful with it', construct: 0 },
  { column: 'PU1', label: 'It helps me work faster', construct: 1 },
  { column: 'PU2', label: 'It improves my results', construct: 1 },
  { column: 'PU3', label: 'It makes my work easier', construct: 1 },
  { column: 'PU4', label: 'It wastes my time (reverse worded)', construct: 1, reverse: true },
  { column: 'ATT1', label: 'Using it is a good idea', construct: 2 },
  { column: 'ATT2', label: 'I like using it', construct: 2 },
  { column: 'ATT3', label: 'Using it is pleasant', construct: 2 },
  { column: 'BI1', label: 'I intend to use it next month', construct: 3 },
  { column: 'BI2', label: 'I plan to use it regularly', construct: 3 },
  { column: 'BI3', label: 'I will recommend it', construct: 3 },
];

export function exampleSurvey(): ExampleSurvey {
  const u = createRng(EXAMPLE_SURVEY_SEED);
  const normal = () => { let s = 0; for (let i = 0; i < 12; i++) s += u(); return s - 6; }; // sum of uniforms: close enough for an example
  const rows: Cell[][] = [];
  for (let r = 0; r < EXAMPLE_SURVEY_CASES; r++) {
    const peou = normal();
    const pu = 0.5 * peou + 0.85 * normal();
    const att = 0.35 * peou + 0.45 * pu + 0.75 * normal();
    const bi = 0.6 * att + 0.25 * pu + 0.7 * normal();
    const latent = [peou, pu, att, bi];
    const straight = r % 50 === 7; // three cases answer every item the same
    const row = ITEMS.map((it) => {
      if (straight) return r < 50 ? 7 : r < 100 ? 4 : 1;
      if (u() < 0.02) return null; // a few missing answers
      const value = 4.3 + 1.15 * (0.8 * latent[it.construct] + 0.55 * normal());
      const v = Math.min(7, Math.max(1, Math.round(value)));
      return it.reverse ? 8 - v : v;
    });
    rows.push(row);
  }
  return { columns: ITEMS.map((i) => i.column), labels: ITEMS.map((i) => i.label), reverse: ITEMS.filter((i) => i.reverse).map((i) => i.column), rows };
}

export const EXAMPLE_SURVEY_SOURCE = 'Example survey made by the app (seeded, 150 cases). Not responses from real people.';
