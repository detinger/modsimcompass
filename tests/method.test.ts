import { describe, expect, it } from 'vitest';
import {
  chooseMethod, clearAnswers, clearRole, COMPARE_ROWS, compareSet, decisionCautions, defaultCompared, dropMethod, keepMethod, keptByHand, MAX_COMPARED,
  methodChoice, setAnswer, shortlistEntries, swapRoles,
} from '../src/domain/artefacts/methodChoice';
import type { MethodChoice } from '../src/domain/artefacts/types';
import { METHODS, METHOD_BY_ID } from '../src/domain/methods/registry';
import { emptyAnswers, evaluateRules, QUESTIONS, RULE_VERSION } from '../src/domain/methods/rules';
import { isSafeSvg } from '../src/features/toolbox/SvgFigure';
import { decisionSheet, methodDecisionHtml, methodDecisionMarkdown } from '../src/features/toolbox/method/exports';

const blank = (): MethodChoice => methodChoice.empty();
const NOW = '2026-11-21T10:00:00.000Z';
const hostile = '<script>alert(1)</script> | **x** <img src=x onerror=alert(1)> "quote" & ampersand';

describe('method chooser: answers and the shortlist', () => {
  it('an answer puts the suggested methods on the stored shortlist and records the rule table', () => {
    const d = blank();
    d.ruleVersion = 'old';
    setAnswer(d, 'feedback', 'yes');
    expect(d.answers.feedback).toBe('yes');
    expect(d.ruleVersion).toBe(RULE_VERSION);
    expect(d.shortlist).toEqual(evaluateRules(d.answers).candidates.map((c) => c.method));
    expect(d.shortlist).toContain('system-dynamics');
  });

  it('methods kept by hand stay when answers change; methods only an earlier answer suggested leave', () => {
    const d = blank();
    keepMethod(d, 'abm');
    setAnswer(d, 'queues', 'simple'); // suggests queueing theory and DES
    expect(d.shortlist).toEqual(expect.arrayContaining(['queueing-theory', 'des', 'abm']));
    setAnswer(d, 'queues', 'none');
    expect(d.shortlist).toEqual(['abm']);
    expect(keptByHand(d)).toEqual(['abm']);
  });

  it('keeping a method twice lists it once; a suggested method cannot be dropped, a kept one can', () => {
    const d = blank();
    setAnswer(d, 'spatial', 'yes');
    keepMethod(d, 'monte-carlo'); keepMethod(d, 'monte-carlo');
    expect(d.shortlist.filter((m) => m === 'monte-carlo')).toHaveLength(1);
    dropMethod(d, 'cellular-automata');
    expect(d.shortlist).toContain('cellular-automata');
    dropMethod(d, 'monte-carlo');
    expect(d.shortlist).not.toContain('monte-carlo');
  });

  it('clearing the answers keeps only the hand-kept methods', () => {
    const d = blank();
    setAnswer(d, 'heterogeneous', 'yes'); keepMethod(d, 'petri-nets');
    clearAnswers(d);
    expect(d.answers).toEqual(emptyAnswers());
    expect(d.shortlist).toEqual(['petri-nets']);
  });

  it('the shortlist shown puts suggested methods first, in rule order, then kept, then a chosen method on neither list', () => {
    const d = blank();
    setAnswer(d, 'feedback', 'yes'); setAnswer(d, 'granularity', 'aggregate');
    keepMethod(d, 'des');
    d.primary = 'abm'; // set directly, as an imported file might
    const list = shortlistEntries(d);
    expect(list[0]).toMatchObject({ method: 'system-dynamics', fromAnswers: true });
    expect(list.map((e) => e.method).slice(-2)).toEqual(['des', 'abm']);
    expect(list.find((e) => e.method === 'abm')).toMatchObject({ reasons: [], cautions: [], fromAnswers: false });
  });
});

describe('method chooser: roles', () => {
  it('a method holds one role at a time and joins the shortlist when chosen', () => {
    const d = blank();
    chooseMethod(d, 'primary', 'des');
    expect(d.shortlist).toEqual(['des']);
    chooseMethod(d, 'alternative', 'des');
    expect(d).toMatchObject({ primary: '', alternative: 'des' });
    chooseMethod(d, 'primary', 'system-dynamics');
    expect(d).toMatchObject({ primary: 'system-dynamics', alternative: 'des' });
    expect(decisionCautions(d)).toEqual([]);
  });

  it('swapping moves the methods and their reasons together; clearing a role keeps the reasons', () => {
    const d = blank();
    chooseMethod(d, 'primary', 'des'); chooseMethod(d, 'alternative', 'queueing-theory');
    d.justification = 'Waits matter.'; d.alternativeJustification = 'A quick formula check.';
    swapRoles(d);
    expect(d).toMatchObject({ primary: 'queueing-theory', alternative: 'des', justification: 'A quick formula check.', alternativeJustification: 'Waits matter.' });
    clearRole(d, 'primary');
    expect(d.primary).toBe('');
    expect(d.justification).toBe('A quick formula check.');
  });

  it('flags a primary that equals the alternative (possible in data kept from before)', () => {
    const d = { ...blank(), primary: 'des' as const, alternative: 'des' as const };
    expect(decisionCautions(d)).toHaveLength(1);
  });
  it('a file whose alternative is the primary loses the alternative, keeps the reasons, and says so', () => {
    const w: string[] = [];
    const raw = { ...JSON.parse(JSON.stringify(blank())), primary: 'des', alternative: 'des', alternativeJustification: 'Kept as written.' };
    const out = methodChoice.sanitize(raw, (m) => w.push(m))!;
    expect(out).toMatchObject({ primary: 'des', alternative: '', alternativeJustification: 'Kept as written.' });
    expect(w).toEqual(['alternative: the same method as the primary; cleared.']);
    expect(decisionCautions(out)).toEqual([]);
    const fine = methodChoice.sanitize({ ...raw, alternative: 'abm' }, () => {})!;
    expect(fine.alternative).toBe('abm');
  });
});

describe('method chooser: side by side', () => {
  it('compares at most three distinct, known methods', () => {
    expect(compareSet(['des', 'des', 'nope', 'abm', 'monte-carlo', 'markov-chains'])).toEqual(['des', 'abm', 'monte-carlo']);
    expect(MAX_COMPARED).toBe(3);
  });

  it('starts with the primary, the alternative, then the shortlist', () => {
    const d = blank();
    setAnswer(d, 'queues', 'detailed');
    chooseMethod(d, 'primary', 'abm'); chooseMethod(d, 'alternative', 'system-dynamics');
    expect(defaultCompared(d)).toEqual(['abm', 'system-dynamics', 'des']);
    expect(defaultCompared(blank())).toEqual([]);
  });

  it('every row has text for every method, taken from the registry', () => {
    for (const m of METHODS) for (const r of COMPARE_ROWS) {
      const cell = r.cell(m.id);
      expect(cell.length, `${m.id}/${r.key}`).toBeGreaterThan(0);
      expect(cell.every((x) => x.trim().length > 0), `${m.id}/${r.key}`).toBe(true);
    }
    expect(COMPARE_ROWS.find((r) => r.key === 'omits')!.cell('des')).toEqual(METHOD_BY_ID.des.omits);
  });
});

describe('method decision exports', () => {
  const decided = (): MethodChoice => {
    const d = blank();
    setAnswer(d, 'feedback', 'yes'); setAnswer(d, 'granularity', 'aggregate'); setAnswer(d, 'queues', 'detailed');
    chooseMethod(d, 'primary', 'system-dynamics'); chooseMethod(d, 'alternative', 'des');
    d.justification = 'The backlog builds up over weeks.\nFeedback through overtime.';
    d.alternativeJustification = 'If individual waits turn out to matter.';
    return d;
  };

  it('the sheet holds both roles with reasons from the answers and what each leaves out', () => {
    const s = decisionSheet(decided());
    expect(s.primary.method).toBe('system-dynamics');
    expect(s.primary.reasons.length).toBeGreaterThan(0);
    expect(s.primary.leavesOut).toEqual(METHOD_BY_ID['system-dynamics'].omits);
    expect(s.alternative.leavesOut).toEqual(METHOD_BY_ID.des.omits);
    expect(s.answers).toHaveLength(3);
    expect(s.shortlist.find((e) => e.method === 'des')?.role).toBe('alternative');
  });

  it('a method kept by hand has no rule reasons, and a repeated alternative is not shown twice', () => {
    const d = blank();
    chooseMethod(d, 'primary', 'petri-nets');
    d.alternative = 'petri-nets';
    const s = decisionSheet(d);
    expect(s.primary.reasons).toEqual([]);
    expect(s.alternative.method).toBe('');
    expect(s.checks).toHaveLength(1);
  });

  it('Markdown: heading from the title, both roles, what is left out, answers table; user text cannot add structure', () => {
    const d = decided();
    d.justification = hostile;
    const md = methodDecisionMarkdown('# My decision', d, NOW);
    expect(md.startsWith('# My decision\n')).toBe(true);
    expect(md).toContain('Exported 2026-11-21');
    expect(md).toContain('## Primary method: System dynamics (Processes & dynamics)');
    expect(md).toContain('## Alternative method: Discrete-event simulation');
    expect(md).toContain(`**What it leaves out:** ${METHOD_BY_ID['system-dynamics'].omits.join('; ')}.`);
    expect(md).toContain('| Question | Answer |');
    expect(md).toContain('does not judge the reasons');
    // The hostile text sits after a label, on one list item.
    const line = md.split('\n').find((l) => l.includes('<script>'))!;
    expect(line.startsWith('- **Why it fits:**')).toBe(true);
    // No line of the file starts with the user's text.
    expect(md.split('\n').some((l) => l.startsWith('<script>'))).toBe(false);
  });

  it('Markdown for an empty choice still reads well', () => {
    const md = methodDecisionMarkdown('', blank(), NOW);
    expect(md.startsWith('# Method decision')).toBe(true);
    expect(md).toContain('_Not yet specified_');
    expect(md).not.toContain('## Shortlist');
  });

  it('HTML: a standalone page with no scripts or outside resources; user text escaped; the picture passes the safety check', () => {
    const d = decided();
    d.alternativeJustification = hostile;
    const html = methodDecisionHtml(`Title ${hostile}`, d, NOW);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toMatch(/<script|<img|<link|<iframe|@import|url\(/i);
    expect(html).not.toMatch(/<[a-z][^>]*\son[a-z]+\s*=/i); // no event attribute on any tag
    expect(html.replaceAll('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:\/\//);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('System dynamics');
    expect(html).toContain('Discrete-event simulation');
    for (const o of METHOD_BY_ID.des.omits) expect(html).toContain(o.replace(/&/g, '&amp;'));
    const svg = html.match(/<svg[\s\S]*<\/svg>/)?.[0];
    expect(svg && isSafeSvg(svg)).toBe(true);
    expect(html).toContain(`3 of ${QUESTIONS.length} questions answered`);
  });

  it('the figure is safe for every single method as primary', () => {
    for (const m of METHODS) {
      const d = blank();
      chooseMethod(d, 'primary', m.id);
      const svg = methodChoice.figure(d);
      expect(isSafeSvg(svg), m.id).toBe(true);
    }
  });
});
