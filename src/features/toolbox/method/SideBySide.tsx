import { useId } from 'react';
import { COMPARE_ROWS, MAX_COMPARED } from '../../../domain/artefacts/methodChoice';
import { FAMILY_TONE, METHOD_BY_ID, METHODS, type MethodId } from '../../../domain/methods/registry';
import { FAMILY_ORDER } from '../../../content/diagrams/specs';
import { MethodGlyph } from './glyphs';

/**
 * Two or three methods side by side, one column each. The rows come from the method registry, so this table, the
 * cards and Learn cannot disagree. On a narrow screen the table scrolls inside its own labelled region.
 */
export function SideBySide({ compared, onToggle }: { compared: MethodId[]; onToggle(m: MethodId): void }) {
  const capId = useId();
  return (
    <>
      <div className="mt-pickers" role="group" aria-label={`Methods to compare, up to ${MAX_COMPARED}`}>
        {FAMILY_ORDER.map((f) => (
          <div key={f} className={`mt-pick-row ${FAMILY_TONE[f]}`}>
            {METHODS.filter((m) => m.family === f).map((m) => (
              <button key={m.id} type="button" className="mt-pick mt-anim" aria-pressed={compared.includes(m.id)} onClick={() => onToggle(m.id)}>
                <MethodGlyph method={m.id} size={22} />{m.name}
              </button>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-pick-hint">Up to {MAX_COMPARED}. A fourth replaces the earliest.</p>
      {compared.length < 2 ? (
        <p className="mt-empty">Pick at least two methods.</p>
      ) : (
        <div className="table-wrap mt-table-wrap" role="region" aria-labelledby={capId} tabIndex={0}>
          <table className="data mt-table">
            <caption id={capId} className="sr-only">Side by side: {compared.map((m) => METHOD_BY_ID[m].name).join(', ')}</caption>
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Aspect</span></th>
                {compared.map((m) => (
                  <th key={m} scope="col" className={`mt-col-head ${FAMILY_TONE[METHOD_BY_ID[m].family]}`}>
                    <span className="mt-col-name"><span className="mt-glyph-box is-small"><MethodGlyph method={m} size={26} /></span>{METHOD_BY_ID[m].name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((r) => (
                <tr key={r.key} className={`is-${r.key}`}>
                  <th scope="row">{r.label}</th>
                  {compared.map((m) => {
                    const cell = r.cell(m);
                    return <td key={m}>{cell.length === 1 ? cell[0] : <ul>{cell.map((x) => <li key={x}>{x}</li>)}</ul>}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
