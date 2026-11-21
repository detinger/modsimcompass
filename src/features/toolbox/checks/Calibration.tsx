import { useId } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { dataSeparation, type CalibrationWords, type DataSeparation } from '../../../domain/artefacts/checkPlan';
import type { CheckPlan } from '../../../domain/artefacts/types';

type Record_ = CheckPlan['calibration'];

const STATE_TEXT: Record<'tuning' | 'estimation', Record<DataSeparation, { title: string; text: string }>> = {
  tuning: {
    // Only the descriptions differ: the app cannot see the data, so it never claims they are separate.
    separate: { title: 'Described as different data.', text: 'Check that the two do not overlap.' },
    same: { title: 'Same data', text: 'Tuning and validation use the same data. Validation needs data that was not used for tuning.' },
    incomplete: { title: 'Name both data sets', text: 'Say which data tuned the model and which data tests it.' },
  },
  estimation: {
    separate: { title: 'Described as different cases.', text: 'Check that no case is in both.' },
    same: { title: 'Same cases', text: 'Estimation and prediction use the same cases. A prediction check needs cases that were not used for estimation.' },
    incomplete: { title: 'Name both', text: 'Say which data the estimates come from and which cases test the prediction.' },
  },
};
const PLACEHOLDERS = {
  tuning: { parameters: 'Arrival rate; mean service time', used: 'January to June records', kept: 'July to September records' },
  estimation: { parameters: 'Loadings, weights and paths', used: 'Survey wave 1, 412 cases', kept: '100 cases held out at random' },
};

/**
 * Two circles: the tuning data and the validation data. Apart when they are described differently, on top of each
 * other when they are the same, dashed while one is not named. It reads the two descriptions; it cannot see the data.
 */
function SeparationPicture({ state, a, b }: { state: DataSeparation; a: string; b: string }) {
  const gap = state === 'same' ? 0 : state === 'separate' ? 58 : 44;
  const same = state === 'same';
  return (
    <svg className={`ck-sep is-${state}`} viewBox="0 0 230 124" width="230" height="124" aria-hidden="true" focusable="false">
      <g className="ck-sep-a" style={{ transform: `translateX(${-gap}px)` }}>
        <circle cx="115" cy="58" r="44" />
        {!same && <text x="115" y="62" textAnchor="middle">{a}</text>}
      </g>
      <g className="ck-sep-b" style={{ transform: `translateX(${gap}px)` }}>
        <circle cx="115" cy="58" r="44" />
        {!same && <text x="115" y="62" textAnchor="middle">{b}</text>}
      </g>
      {same && <><text x="115" y="54" textAnchor="middle">{a}</text><text x="115" y="72" textAnchor="middle">= {b.toLowerCase()}</text></>}
    </svg>
  );
}

/**
 * Which parameters were tuned and on which data, with a visible prompt to keep validation data apart from tuning data.
 * For a model estimated from data the same fields record what was estimated, on which data, and the cases kept for prediction.
 */
export function Calibration({ c, d, words, estimated, onChange }: { c: Record_; d: CheckPlan; words: CalibrationWords; estimated: boolean; onChange(fn: (c: Record_) => void): void }) {
  const pId = useId(), tId = useId(), vId = useId(), headId = useId();
  const state = dataSeparation(d);
  const mode = estimated ? 'estimation' : 'tuning';
  const t = STATE_TEXT[mode][state], ph = PLACEHOLDERS[mode];
  return (
    <section className="ck-tool ck-cal" aria-labelledby={headId}>
      <h3 id={headId} className="ck-tool-h"><SlidersHorizontal size={18} aria-hidden="true" /> {words.record}</h3>
      <div className="ck-cal-grid">
        <div className="ck-cal-fields">
          <div className="field">
            <label htmlFor={pId}>{words.parameters}</label>
            <textarea id={pId} rows={2} value={c.parameters} maxLength={20000} placeholder={ph.parameters} onChange={(e) => onChange((x) => { x.parameters = e.target.value; })} />
          </div>
          <div className="field">
            <label htmlFor={tId}><span className="ck-dot is-tune" aria-hidden="true" />{words.usedOn}</label>
            <input id={tId} type="text" value={c.tunedOn} maxLength={2000} placeholder={ph.used} onChange={(e) => onChange((x) => { x.tunedOn = e.target.value; })} />
          </div>
          <div className="field">
            <label htmlFor={vId}><span className="ck-dot is-valid" aria-hidden="true" />{words.keptFor}</label>
            <input id={vId} type="text" value={c.validatedOn} maxLength={2000} placeholder={ph.kept} onChange={(e) => onChange((x) => { x.validatedOn = e.target.value; })} />
          </div>
        </div>
        <div className={`ck-sep-card is-${state}`}>
          <SeparationPicture state={state} a={words.usedShort} b={words.keptShort} />
          <p role="status"><strong>{t.title}</strong> <span>{t.text}</span></p>
        </div>
      </div>
    </section>
  );
}
