import { useEffect, useId, useRef, useState } from 'react';
import { Calculator as CalcIcon, CheckCircle2, ClipboardPaste, Info, Lock, RefreshCw, XCircle } from 'lucide-react';
import { compareRecord, formatNumber, TOLERANCE_ON, toleranceOnOf, verdictSentence, type ToleranceOn } from '../../../domain/artefacts/checkPlan';
import type { CheckPlan } from '../../../domain/artefacts/types';
import { SvgFigure } from '../SvgFigure';
import { parseNumbers, parseOne, parsePairs, valuesText } from './parse';
import { validationPlotSvg } from './plot';

type Validation = CheckPlan['validation'];

/** The width of an element, followed as it changes. A callback ref, so an element that appears later is measured too. */
function useWidth(): [(el: HTMLElement | null) => void, number] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, w];
}

/** A box of pasted values. Keeps the typed text, so a half-typed value is never thrown away; stores only numbers. */
function ValuesBox({ label, tone, values, onChange }: { label: string; tone: 'observed' | 'simulated'; values: number[]; onChange(xs: number[]): void }) {
  const id = useId();
  const [raw, setRaw] = useState(() => valuesText(values));
  const emitted = useRef(values);
  useEffect(() => {
    if (values !== emitted.current && values.join(',') !== emitted.current.join(',')) { setRaw(valuesText(values)); emitted.current = values; }
  }, [values]);
  const parsed = parseNumbers(raw);
  return (
    <div className={`ck-values is-${tone}`}>
      <label htmlFor={id}><span className="ck-swatch" aria-hidden="true" />{label}</label>
      <textarea id={id} rows={7} value={raw} spellCheck={false} placeholder={'12\n15\n9'} aria-describedby={`${id}-n`}
        onChange={(e) => { setRaw(e.target.value); const p = parseNumbers(e.target.value); emitted.current = p.values; onChange(p.values); }} />
      <span id={`${id}-n`} className={`ck-values-n${parsed.rejectedCount ? ' is-bad' : ''}`}>
        {parsed.values.length} value{parsed.values.length === 1 ? '' : 's'}
        {parsed.rejectedCount > 0 && <> · {parsed.rejectedCount} not a number: {parsed.rejected.map((r) => `“${r}”`).join(', ')}</>}
      </span>
    </div>
  );
}

const pct = (x: number | null) => (x === null ? null : `${formatNumber(Number(x.toFixed(x < 10 ? 2 : 1)))}%`);
const signed = (x: number) => (x > 0 ? `+${formatNumber(x)}` : formatNumber(x));

const ON_TEXT: Record<ToleranceOn, string> = { pairs: 'each pair', means: 'the means' };

/**
 * Observed against simulated, judged against a tolerance set beforehand: on each pair (the mean absolute percentage
 * error, so errors of opposite sign cannot cancel) or on the means. Both measures are always shown; the verdict
 * follows the choice. The numbers, the verdict sentence and the picture all come from `compareRecord`; the verdict
 * says nothing about validity elsewhere.
 */
export function Calculator({ v, recorded, onChange, onRecord }: {
  v: Validation; /** True when a check from the calculator is already in the plan. */ recorded: boolean;
  onChange(fn: (v: Validation) => void): void; onRecord(): void;
}) {
  const measureId = useId(), tolId = useId(), pairsId = useId(), headId = useId(), onName = useId(), onHint = useId();
  const [tolRaw, setTolRaw] = useState(v.tolerancePct === null ? '' : String(v.tolerancePct));
  const [tolError, setTolError] = useState<string | null>(null);
  const [lateTolerance, setLateTolerance] = useState(false);
  const [pairs, setPairs] = useState('');
  const [pairsNote, setPairsNote] = useState<string | null>(null);
  const [plotRef, plotWidth] = useWidth();
  const on = toleranceOnOf(v);
  const cmp = compareRecord(v);
  const setOn = (next: ToleranceOn) => { if (next === on) return; if (cmp.ok && v.tolerancePct !== null) setLateTolerance(true); onChange((x) => { x.toleranceOn = next; }); };

  const setTolerance = (text: string) => {
    setTolRaw(text);
    const t = text.trim();
    if (!t) { setTolError(null); onChange((x) => { x.tolerancePct = null; }); return; }
    const n = parseOne(t.replace(/%$/, ''));
    if (!Number.isFinite(n)) { setTolError('Enter a number, such as 10.'); return; }
    if (n < 0) { setTolError('A tolerance cannot be negative.'); return; }
    setTolError(null);
    if (cmp.ok) setLateTolerance(true);
    onChange((x) => { x.tolerancePct = n; });
  };

  const usePairs = () => {
    const p = parsePairs(pairs);
    if (!p.observed.length) { setPairsNote('No pairs found. Put one observed and one simulated value on each line.'); return; }
    onChange((x) => { x.observed = p.observed; x.simulated = p.simulated; });
    setPairsNote(`${p.observed.length} pairs read${p.header ? ', first line taken as a header' : ''}${p.skipped ? `, ${p.skipped} line${p.skipped === 1 ? '' : 's'} skipped` : ''}.`);
    setPairs('');
  };

  const svg = cmp.ok && cmp.paired && plotWidth > 0 ? validationPlotSvg(v, { width: plotWidth }) : null;
  const VerdictIcon = cmp.ok && cmp.verdict === 'within' ? CheckCircle2 : cmp.ok && cmp.verdict === 'outside' ? XCircle : Info;
  const judged = (k: ToleranceOn) => (on === k ? ' is-judged' : '');
  const judgedTag = (k: ToleranceOn) => (on === k ? <span className="ck-judged">judged</span> : null);

  return (
    <section className="ck-tool ck-calc" aria-labelledby={headId}>
      <h3 id={headId} className="ck-tool-h"><CalcIcon size={18} aria-hidden="true" /> Validation calculator</h3>
      <div className="ck-calc-setup">
        <div className="field">
          <label htmlFor={measureId}>What is compared</label>
          <input id={measureId} type="text" value={v.measure} maxLength={500} placeholder="Mean weekly backlog" onChange={(e) => onChange((x) => { x.measure = e.target.value; })} />
        </div>
        <div className="field ck-tol">
          <label htmlFor={tolId}><Lock size={12} aria-hidden="true" /> Tolerance, set beforehand</label>
          <div className="ck-tol-input">
            <span aria-hidden="true">±</span>
            <input id={tolId} type="text" inputMode="decimal" value={tolRaw} placeholder="10" aria-invalid={tolError ? true : undefined}
              aria-describedby={`${tolId}-hint${tolError ? ` ${tolId}-err` : ''}`} onChange={(e) => setTolerance(e.target.value)} />
            <span aria-hidden="true">%</span>
          </div>
          <span id={`${tolId}-hint`} className="hint">{on === 'pairs' ? 'Of each observed value' : 'Of the mean observed value'}. Decide it before you compare.</span>
          {tolError && <span id={`${tolId}-err`} className="field-error" role="alert">{tolError}</span>}
        </div>
      </div>
      <fieldset className="ck-on" aria-describedby={onHint}>
        <legend>Tolerance applies to</legend>
        <div className="ck-on-options">
          {TOLERANCE_ON.map((k) => (
            <label key={k} className={`ck-on-option${on === k ? ' is-checked' : ''}`}>
              <input type="radio" name={onName} value={k} checked={on === k} onChange={() => setOn(k)} />
              {ON_TEXT[k]}
            </label>
          ))}
        </div>
        <p id={onHint} className="hint">Each pair when value i of both lists is the same case or period: errors cannot cancel out. The means when only the overall level must match.</p>
      </fieldset>
      {lateTolerance && <p className="ck-late" role="status">Changed after seeing the values? Say so in the evidence.</p>}

      <div className="ck-values-row">
        <ValuesBox label="Observed" tone="observed" values={v.observed} onChange={(xs) => onChange((x) => { x.observed = xs; })} />
        <ValuesBox label="Simulated" tone="simulated" values={v.simulated} onChange={(xs) => onChange((x) => { x.simulated = xs; })} />
      </div>
      <details className="ck-pairs">
        <summary><ClipboardPaste size={14} aria-hidden="true" /> Paste two columns</summary>
        <label htmlFor={pairsId} className="hint">One pair per line: observed, then simulated. A header line is skipped.</label>
        <textarea id={pairsId} rows={4} value={pairs} spellCheck={false} placeholder={'observed\tsimulated\n12\t11.4\n15\t16.1'} onChange={(e) => setPairs(e.target.value)} />
        <div className="btn-row"><button type="button" className="btn small" disabled={!pairs.trim()} onClick={usePairs}>Use these pairs</button>{pairsNote && <span className="hint" role="status">{pairsNote}</span>}</div>
      </details>

      {!cmp.ok ? (
        cmp.reason === 'missing'
          ? <p className="ck-calc-msg is-warning" role="status">{cmp.nObserved} observed and {cmp.nSimulated} simulated. Paste both lists to compare.</p>
          : <p className="ck-calc-msg" role="status">Paste both lists to compare.</p>
      ) : (
        <div className="ck-result">
          <p className={`ck-verdict is-${cmp.verdict}`} role="status"><VerdictIcon size={20} aria-hidden="true" /><span>{verdictSentence(cmp, v.tolerancePct)}</span></p>
          <dl className="ck-kpis">
            <div className={`ck-kpi${judged('pairs')}`}><dt>Mean absolute % error {judgedTag('pairs')}</dt>
              <dd>{!cmp.paired ? <span className="ck-undef">Needs pairs</span> : pct(cmp.mape) ?? <span className="ck-undef">Undefined: an observed value is 0</span>}</dd></div>
            <div className={`ck-kpi${judged('means')}`}><dt>Difference of the means {judgedTag('means')}</dt>
              <dd>{pct(cmp.gapPct) ?? <span className="ck-undef">Undefined: the mean observed value is 0</span>}</dd></div>
            <div><dt>{cmp.paired ? 'Pairs' : 'Values'}</dt><dd>{cmp.paired ? cmp.n : `${cmp.nObserved} · ${cmp.nSimulated}`}</dd></div>
            <div><dt>Mean observed</dt><dd>{formatNumber(cmp.meanObserved)}</dd></div>
            <div><dt>Mean simulated</dt><dd>{formatNumber(cmp.meanSimulated)}</dd></div>
            {cmp.paired && <div><dt>Mean error</dt><dd>{signed(cmp.bias ?? 0)}</dd></div>}
            {cmp.paired && <div><dt>Mean absolute error</dt><dd>{formatNumber(cmp.mae ?? 0)}</dd></div>}
          </dl>
          {cmp.paired ? (
            <div className="ck-plot" ref={plotRef}>
              <SvgFigure svg={svg} label={`Plot of ${cmp.n} pairs: observed and simulated values case by case, and simulated against observed with the line of perfect agreement. Means: observed ${formatNumber(cmp.meanObserved)}, simulated ${formatNumber(cmp.meanSimulated)}.`} />
            </div>
          ) : <p className="hint">The lists differ in length, so there are no pairs to plot.</p>}
          {cmp.paired && <details className="ck-table">
            <summary>The values as a table</summary>
            <div className="table-wrap tall" role="region" aria-label="Observed and simulated values" tabIndex={0}>
              <table className="data">
                <thead><tr><th scope="col" className="num">Case</th><th scope="col" className="num">Observed</th><th scope="col" className="num">Simulated</th><th scope="col" className="num">Error</th><th scope="col" className="num">% error</th></tr></thead>
                <tbody>
                  {v.observed.map((o, i) => {
                    const s = v.simulated[i], e = s - o;
                    return <tr key={i}><td className="num">{i + 1}</td><td className="num">{formatNumber(o)}</td><td className="num">{formatNumber(s)}</td><td className="num">{signed(e)}</td><td className="num">{o === 0 ? '—' : pct(Math.abs(e / o) * 100)}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          </details>}
          <div className="ck-record">
            <button type="button" className="btn primary" onClick={onRecord}>
              {recorded ? <><RefreshCw size={16} aria-hidden="true" /> Update the recorded check</> : <><CheckCircle2 size={16} aria-hidden="true" /> Record as a validation check</>}
            </button>
            <span className="hint">Agreement on these data does not show the model is valid for other uses.</span>
          </div>
        </div>
      )}
    </section>
  );
}

