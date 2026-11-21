import { useId } from 'react';
import { CircleHelp, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import {
  analyse, differenceSvg, differenceText, fmtNum, isPaired, minimumOf, outcomeName, policiesSvg, policyNames, replicationsText, VERDICT_SCOPE,
} from '../../../domain/artefacts/comparison';
import type { Comparison } from '../../../domain/artefacts/types';
import { sampleSD } from '../../../domain/sandbox/stats';
import { useWidth } from '../../../ui/charts';
import { SvgFigure } from '../SvgFigure';

const TONE = { none: 'info', neutral: 'info', good: 'success', caution: 'warning' } as const;

/** Everything the results say, computed by `analyse` from the artefact alone. */
export function Answer({ d }: { d: Comparison }) {
  const [box, width] = useWidth(720);
  const tableA = useId(), tableB = useId();
  const an = analyse(d), diff = an.difference, names = policyNames(d), paired = isPaired(d);
  const unit = d.unit.trim();
  if (diff.kind === 'none') {
    return (
      <div className="cmp-empty">
        <Scale size={30} aria-hidden="true" />
        <p><strong>Waiting for results.</strong></p>
        <p className="muted">One value per replication for each policy. Or try the example.</p>
      </div>
    );
  }
  const v = an.verdict;
  const Icon = v.favours === null ? CircleHelp : (v.favours === 'alternative') === (d.direction === 'lower') ? TrendingDown : TrendingUp;
  const m = minimumOf(d);
  const inner = Math.min(width - 26, 900); // the figure frame takes 26 px of padding and border
  const dsvg = differenceSvg(d, { width: inner });
  const psvg = policiesSvg(d, { width: inner });
  return (
    <div className="cmp-answer" ref={box}>
      <div className={`cmp-verdict is-${TONE[v.tone]}`} role="status">
        <span className="cmp-verdict-icon" aria-hidden="true"><Icon size={24} /></span>
        <div>
          <strong>{v.headline}</strong>
          <p>{v.detail}</p>
          <p className="cmp-scope">{VERDICT_SCOPE}</p>
        </div>
      </div>

      <dl className="cmp-tiles">
        <div className="cmp-tile"><dt>{paired ? 'Mean difference' : 'Difference of means'}</dt><dd>{fmtNum(diff.mean)}{unit && <small> {unit}</small>}</dd><dd className="cmp-tile-sub">{names.alternative} − {names.baseline}</dd></div>
        <div className="cmp-tile"><dt>95% {paired ? 'paired' : 'Welch'} interval</dt><dd>{diff.lower === null ? 'unavailable' : `${fmtNum(diff.lower)} to ${fmtNum(diff.upper)}`}</dd><dd className="cmp-tile-sub">{diff.halfWidth === null ? (diff.unavailableReason ?? '') : `± ${fmtNum(diff.halfWidth)}`}</dd></div>
        <div className="cmp-tile"><dt>Replications</dt><dd>{paired ? d.baseline.length : `${d.baseline.length} + ${d.alternative.length}`}</dd><dd className="cmp-tile-sub">{paired ? 'pairs, same inputs' : 'not paired'}</dd></div>
        {paired && diff.favour !== null && <div className="cmp-tile"><dt>Favour {names.alternative}</dt><dd>{diff.favour} of {diff.differences.length}</dd><dd className="cmp-tile-sub">{d.direction} is better</dd></div>}
      </dl>
      {!paired && <p className="cmp-welch">Not paired, so the interval is a two-sample (Welch) interval and there is no dot per replication. Same random inputs for both policies would usually sharpen it.</p>}

      <figure className="cmp-figure">
        <figcaption className="cmp-figure-cap">{paired ? 'Each dot: one replication’s difference' : 'The difference between the means'}</figcaption>
        <SvgFigure svg={dsvg} label={`${differenceText(diff)}. ${paired ? `${diff.differences.length} differences shown as dots.` : 'Not paired: no dots.'}${m !== null ? ` Smallest difference that matters: ±${fmtNum(m)}.` : ''} Table below.`} className="cmp-svg" />
      </figure>
      <figure className="cmp-figure">
        <figcaption className="cmp-figure-cap">The two policies</figcaption>
        <SvgFigure svg={psvg} label={`${names.baseline}: mean ${fmtNum(an.baseline?.mean)}. ${names.alternative}: mean ${fmtNum(an.alternative?.mean)}. Thick bar: 95% interval for the mean. Thin line: 5th to 95th percentile. Table below.`} className="cmp-svg" />
      </figure>

      <details className="cmp-fold">
        <summary>As tables</summary>
        <div className="table-wrap" tabIndex={0} role="region" aria-labelledby={tableA}>
          <table className="data">
            <caption id={tableA}>Each policy · {outcomeName(d)} · {replicationsText(d)}</caption>
            <thead><tr><th scope="col">Policy</th><th scope="col" className="num">Replications</th><th scope="col" className="num">Mean</th><th scope="col" className="num">95% interval for the mean</th><th scope="col" className="num">Standard deviation</th><th scope="col" className="num">5th to 95th percentile</th></tr></thead>
            <tbody>
              {([[names.baseline, d.baseline, an.baseline], [names.alternative, d.alternative, an.alternative]] as const).map(([name, xs, s]) => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  <td className="num">{xs.length}</td>
                  <td className="num">{fmtNum(s?.mean)}</td>
                  <td className="num">{!s || s.ci.lower === null ? '—' : `${fmtNum(s.ci.lower)} to ${fmtNum(s.ci.upper)}`}</td>
                  <td className="num">{xs.length > 1 ? fmtNum(sampleSD(xs)) : '—'}</td>
                  <td className="num">{s && xs.length > 1 ? `${fmtNum(s.p05)} to ${fmtNum(s.p95)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap tall" tabIndex={0} role="region" aria-labelledby={tableB}>
          <table className="data">
            <caption id={tableB}>Each replication{paired ? ': the difference is alternative − baseline' : ''}</caption>
            <thead><tr><th scope="col" className="num">Replication</th><th scope="col" className="num">{names.baseline}</th><th scope="col" className="num">{names.alternative}</th>{paired && <th scope="col" className="num">Difference</th>}</tr></thead>
            <tbody>
              {Array.from({ length: Math.max(d.baseline.length, d.alternative.length) }, (_, i) => (
                <tr key={i}>
                  <td className="num">{i + 1}</td>
                  <td className="num">{d.baseline[i] === undefined ? '' : fmtNum(d.baseline[i])}</td>
                  <td className="num">{d.alternative[i] === undefined ? '' : fmtNum(d.alternative[i])}</td>
                  {paired && <td className="num">{fmtNum(diff.differences[i])}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
