import { useId, useMemo } from 'react';
import type { MeasurementData } from '../../../../domain/artefacts/types';
import { recoded, straightLining } from '../../../../domain/measurement/build';
import { column, valueCounts, type Cell } from '../../../../domain/measurement/stats';

const f2 = (x: number) => x.toFixed(2).replace('-', '−');
const f1 = (x: number) => String(Number(x.toFixed(2))).replace('-', '−');

/** A tiny bar per scale point: how often each answer was given. The row of the table states the numbers. */
function Bars({ counts }: { counts: { value: number; count: number }[] }) {
  const top = Math.max(1, ...counts.map((c) => c.count));
  const w = 10, gap = 2;
  return (
    <svg className="ms-bars" width={counts.length * (w + gap)} height={24} viewBox={`0 0 ${counts.length * (w + gap)} 24`} aria-hidden="true" focusable="false">
      {counts.map((c, i) => { const h = Math.max(c.count ? 2 : 0.5, (c.count / top) * 22); return <rect key={c.value} x={i * (w + gap)} y={24 - h} width={w} height={h} rx={2}><title>{`${c.value}: ${c.count}`}</title></rect>; })}
    </svg>
  );
}

/** Per item: answers, missing, mean, spread, range and skew, after reverse coding; and the cases that answered everything the same. */
export function ItemsStep({ d, rows }: { d: MeasurementData; rows: Cell[][] | null }) {
  const capId = useId();
  const data = useMemo(() => (rows ? recoded(d, rows) : null), [d, rows]);
  const lined = useMemo(() => (rows ? straightLining(d, rows) : null), [d, rows]);
  const byId = new Map(d.items.map((it, j) => [it.id, { it, j }]));
  if (!d.items.length) return <p className="muted">Bring the data first.</p>;
  const missingAll = d.items.reduce((s, it) => s + (it.summary?.missing ?? 0), 0);
  return (
    <div className="dm-stack">
      <dl className="dm-tiles">
        <div className="dm-tile"><dt>Cases</dt><dd>{d.cases}</dd></div>
        <div className="dm-tile"><dt>Items</dt><dd>{d.items.length}</dd></div>
        <div className="dm-tile"><dt>Scale</dt><dd>{d.scale ? `${d.scale.min}–${d.scale.max}` : '—'}</dd></div>
        <div className="dm-tile"><dt>Missing answers</dt><dd>{missingAll}</dd></div>
        <div className="dm-tile"><dt>Same answer to every item</dt><dd>{lined === null ? '—' : lined}</dd></div>
      </dl>
      {lined !== null && lined > 0 && <p className="hint">{lined} case{lined === 1 ? '' : 's'} gave the same answer to every item (straight-lining). Look at them before the analysis; the screen does not remove anything.</p>}
      <div className="table-wrap tall" tabIndex={0} role="region" aria-labelledby={capId}>
        <table className="data ms-table">
          <caption id={capId}>Items after reverse coding. Skew: 0 is symmetric; beyond ±1 the answers pile up at one end.</caption>
          <thead>
            <tr><th scope="col">Construct</th><th scope="col">Item</th><th scope="col" className="num">n</th><th scope="col" className="num">Missing</th><th scope="col" className="num">Mean</th><th scope="col" className="num">SD</th><th scope="col" className="num">Range</th><th scope="col" className="num">Skew</th>{data && d.scale && <th scope="col">Answers</th>}</tr>
          </thead>
          <tbody>
            {d.constructs.flatMap((c) => c.items.map((id, k) => {
              const hit = byId.get(id);
              if (!hit) return null;
              const s = hit.it.summary;
              const skewed = s?.skew !== null && s?.skew !== undefined && Math.abs(s.skew) > 1;
              return (
                <tr key={id}>
                  <td>{k === 0 ? c.name : ''}</td>
                  <th scope="row">{hit.it.column}{hit.it.reverse && <span className="ms-tag"> reversed</span>}{hit.it.label && <span className="ms-sub">{hit.it.label}</span>}</th>
                  <td className="num">{s ? s.n : '—'}</td>
                  <td className="num">{s ? s.missing : '—'}</td>
                  <td className="num">{s ? f2(s.mean) : '—'}</td>
                  <td className="num">{s ? f2(s.sd) : '—'}</td>
                  <td className="num">{s ? `${f1(s.min)}–${f1(s.max)}` : '—'}</td>
                  <td className="num">{s && s.skew !== null ? <>{f2(s.skew)}{skewed && <span className="ms-tag"> lopsided</span>}</> : '—'}</td>
                  {data && d.scale && <td><Bars counts={valueCounts(column(data, hit.j), d.scale)} /></td>}
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>
      {!rows && <p className="hint">The answers are not in memory, so the bars and the straight-lining count are not shown.</p>}
    </div>
  );
}
