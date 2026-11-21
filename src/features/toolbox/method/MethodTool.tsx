import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, ListChecks, MessageCircleQuestion, Shapes } from 'lucide-react';
import { useArtefactEditor, type ArtefactEditor } from '../../../app/artefacts';
import { Link } from '../../../app/router';
import {
  chooseMethod, clearAnswers, clearRole, compareSet, defaultCompared, dropMethod, keepMethod, keptByHand, setAnswer, shortlistEntries, swapRoles,
  MAX_COMPARED, type MethodRole,
} from '../../../domain/artefacts/methodChoice';
import { FAMILIES, FAMILY_TONE, METHOD_BY_ID, METHODS, type MethodFamily, type MethodId } from '../../../domain/methods/registry';
import { evaluateRules, QUESTIONS } from '../../../domain/methods/rules';
import { FAMILY_ORDER } from '../../../content/diagrams/specs';
import { slugify } from '../../../exports/projectFile';
import { downloadFile } from '../../../ui/controls';
import { FigureCard } from '../../../ui/playful';
import { ToolPage, type ToolExport } from '../ToolPage';
import { Decision } from './Decision';
import { methodDecisionHtml, methodDecisionMarkdown } from './exports';
import { FamilyGlyph } from './glyphs';
import { MethodCard, MethodTile } from './parts';
import { Questions } from './Questions';
import { SideBySide } from './SideBySide';
import './method.css';

/** `/toolbox/method[/:id]`: the method chooser (docs/LEARN-TOOLBOX-PLAN.md §5.2). */
export default function MethodTool({ id }: { id?: string }) {
  const editor = useArtefactEditor('method-choice', id);
  const { artefact } = editor;
  const fileBase = /[a-z0-9]/i.test(artefact.title.normalize('NFKD')) ? slugify(artefact.title) : 'method-decision';
  const exports: ToolExport[] = [
    { id: 'decision-md', label: 'Method decision (Markdown)', run: () => downloadFile(`${fileBase}.md`, methodDecisionMarkdown(artefact.title, artefact.data, new Date().toISOString()), 'text/markdown') },
    { id: 'decision-html', label: 'Method decision (HTML)', run: () => downloadFile(`${fileBase}.html`, methodDecisionHtml(artefact.title, artefact.data, new Date().toISOString()), 'text/html') },
  ];
  return (
    <ToolPage kind="method-choice" editor={editor} exports={exports} intro={<FigureCard id="method-families" />}>
      {/* A fresh view for every artefact: which family is open and what is compared belong to the one being edited. */}
      <Chooser key={artefact.id} editor={editor} />
    </ToolPage>
  );
}

type Path = 'family' | 'questions';

function Chooser({ editor }: { editor: ArtefactEditor<'method-choice'> }) {
  const d = editor.artefact.data;
  const edit = editor.setData;
  const advice = useMemo(() => evaluateRules(d.answers), [d.answers]);
  const entries = useMemo(() => shortlistEntries(d), [d]);
  const answered = QUESTIONS.filter((q) => d.answers[q.key] !== 'unsure').length;
  const [path, setPath] = useState<Path>(() => (answered > 0 ? 'questions' : 'family'));
  const [family, setFamily] = useState<MethodFamily | null>(() => (d.primary ? METHOD_BY_ID[d.primary].family : null));
  // Until a method is picked by hand, the comparison follows the decision and the shortlist.
  const [picked, setPicked] = useState<MethodId[] | null>(null);
  const compared = picked ?? defaultCompared(d);

  const roleOf = (m: MethodId): MethodRole | null => (d.primary === m ? 'primary' : d.alternative === m ? 'alternative' : null);
  const listed = new Set(entries.map((e) => e.method));
  const suggested = new Set(advice.candidates.map((c) => c.method));
  const hand = new Set(keptByHand(d));
  const toggleCompare = (m: MethodId) => setPicked(compared.includes(m) ? compared.filter((x) => x !== m) : compareSet([...(compared.length >= MAX_COMPARED ? compared.slice(1) : compared), m]));
  const choose = (role: MethodRole, m: MethodId) => edit((x) => { chooseMethod(x, role, m); });

  return (
    <div className="mt-tool">
      {/* ── 1 · Start from the question ── */}
      <section className="mt-sec" aria-labelledby="mt-start-h">
        <div className="mt-sec-head">
          <h2 id="mt-start-h"><span className="mt-num" aria-hidden="true">1</span>Start from your question</h2>
          <div className="mt-path" role="group" aria-label="How to start">
            <button type="button" aria-pressed={path === 'family'} onClick={() => setPath('family')}><Shapes size={16} aria-hidden="true" /> Pick a family</button>
            <button type="button" aria-pressed={path === 'questions'} onClick={() => setPath('questions')}>
              <MessageCircleQuestion size={16} aria-hidden="true" /> Answer questions <span className="mt-path-count">{answered}/{QUESTIONS.length}</span>
            </button>
          </div>
        </div>

        {path === 'family' ? (
          <>
            <div className="mt-families" role="group" aria-label="Method families">
              {FAMILY_ORDER.map((f) => {
                const n = METHODS.filter((m) => m.family === f && listed.has(m.id)).length;
                return (
                  <button key={f} type="button" className={`mt-family mt-anim ${FAMILY_TONE[f]}`} aria-pressed={family === f} onClick={() => setFamily(family === f ? null : f)}>
                    <span className="mt-family-glyph"><FamilyGlyph family={f} size={44} /></span>
                    <span className="mt-family-name">{FAMILIES[f].label}</span>
                    <span className="mt-family-q">{FAMILIES[f].question}</span>
                    <span className="mt-family-foot">
                      {METHODS.filter((m) => m.family === f).length} methods{n > 0 && <span className="mt-family-n"> · {n} shortlisted</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            {family ? (
              <div className={`mt-family-panel ${FAMILY_TONE[family]}`}>
                <h3 className="sr-only">{FAMILIES[family].label}: methods</h3>
                <div className="mt-tiles">
                  {METHODS.filter((m) => m.family === family).map((m) => {
                    const role = roleOf(m.id);
                    const lock = role ? (role === 'primary' ? 'Primary' : 'Alternative') : suggested.has(m.id) ? 'From your answers' : null;
                    return (
                      <MethodTile key={m.id} method={m.id} listed={listed.has(m.id)} lock={lock} compared={compared.includes(m.id)} onCompare={() => toggleCompare(m.id)}
                        onToggleList={() => edit((x) => { if (hand.has(m.id)) dropMethod(x, m.id); else keepMethod(x, m.id); })} />
                    );
                  })}
                </div>
              </div>
            ) : <p className="mt-hint">Which question is closest to yours?</p>}
          </>
        ) : (
          <Questions answers={d.answers} advice={advice}
            onAnswer={(key, value) => edit((x) => { setAnswer(x, key, value); })} onClear={() => edit((x) => { clearAnswers(x); })} />
        )}
      </section>

      {/* ── 2 · Shortlist ── */}
      <section className="mt-sec" aria-labelledby="mt-list-h">
        <div className="mt-sec-head">
          <h2 id="mt-list-h"><span className="mt-num" aria-hidden="true">2</span>Shortlist</h2>
          <p className="mt-sec-note" role="status">
            {entries.length === 0 ? 'Empty' : `${entries.length} method${entries.length === 1 ? '' : 's'}`}
            {entries.some((e) => e.fromAnswers) && answered < QUESTIONS.length ? ' · provisional while answers are open' : ''}
          </p>
        </div>
        {entries.length === 0 ? (
          <div className="mt-empty-box">
            <span className="mt-empty-glyphs" aria-hidden="true">{FAMILY_ORDER.map((f) => <span key={f} className={FAMILY_TONE[f]}><FamilyGlyph family={f} size={30} /></span>)}</span>
            <p>Pick a family or answer a few questions.</p>
          </div>
        ) : (
          <>
            {entries.some((e) => e.fromAnswers) && <p className="mt-order-note">Ordered by matched reasons: a reading aid, not a score.</p>}
            <ul className="mt-cards">
              {entries.map((e) => {
                const role = roleOf(e.method);
                return (
                  <li key={e.method}>
                    <MethodCard entry={e} actions={{
                      role, compared: compared.includes(e.method), onChoose: (r) => choose(r, e.method), onCompare: () => toggleCompare(e.method),
                      onDrop: !e.fromAnswers && !role ? () => edit((x) => { dropMethod(x, e.method); }) : undefined,
                    }} />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* ── 3 · Side by side ── */}
      <section className="mt-sec" aria-labelledby="mt-cmp-h">
        <div className="mt-sec-head">
          <h2 id="mt-cmp-h"><span className="mt-num" aria-hidden="true">3</span>Side by side</h2>
        </div>
        <SideBySide compared={compared} onToggle={toggleCompare} />
      </section>

      {/* ── 4 · Decision ── */}
      <section className="mt-sec" aria-labelledby="mt-dec-h">
        <div className="mt-sec-head">
          <h2 id="mt-dec-h"><span className="mt-num" aria-hidden="true">4</span>Your decision</h2>
        </div>
        <Decision d={d} onChoose={choose} onClear={(r) => edit((x) => { clearRole(x, r); })}
          onWhy={(r, t) => edit((x) => { if (r === 'primary') x.justification = t; else x.alternativeJustification = t; })}
          onSwap={() => edit((x) => { swapRoles(x); })} />
      </section>

      <nav className="mt-next" aria-label="Related">
        <Link to="/learn/methods" className="mt-next-link"><BookOpen size={16} aria-hidden="true" /> Methods at a glance</Link>
        <Link to="/toolbox/checks" className="mt-next-link"><ListChecks size={16} aria-hidden="true" /> Next: plan the checks <ArrowRight size={14} aria-hidden="true" /></Link>
      </nav>
    </div>
  );
}
