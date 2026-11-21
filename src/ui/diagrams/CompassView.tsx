import { useState } from 'react';
import CompassJourney from './CompassJourney';
import CompassWheel from './CompassWheel';
import type { CompassJourneyProps } from './compassShared';
import '../../styles/diagrams.css';

/**
 * The project compass with a small Line / Circle switch, so the two designs can be compared side by side.
 * The choice is remembered on this device (one key for every place that shows the switch). The circle is the
 * default; the line is the second option (owner's choice, 21 Nov 2026).
 */
export type CompassShape = 'line' | 'circle';
const KEY = 'modsim.compassView';
const read = (): CompassShape => { try { return window.localStorage.getItem(KEY) === 'line' ? 'line' : 'circle'; } catch { return 'circle'; } };
const write = (v: CompassShape) => { try { window.localStorage.setItem(KEY, v); } catch { /* storage unavailable: the choice lasts for this page only */ } };

const LineIcon = () => <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><path d="M1.5 3.5 H11 a3 3 0 0 1 0 6 H5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="1.5" cy="3.5" r="1.5" fill="currentColor" /></svg>;
const CircleIcon = () => <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M7 3.4 L8.3 7 L7 10.6 L5.7 7 Z" fill="currentColor" /></svg>;

export default function CompassView(props: CompassJourneyProps) {
  const [shape, setShape] = useState<CompassShape>(read);
  const pick = (v: CompassShape) => { setShape(v); write(v); };
  return (
    <div className="dgm-compass-view">
      <div className="dgm-view-bar">
        <div className="dgm-view-toggle" role="group" aria-label="Shape of the compass">
          <button type="button" aria-pressed={shape === 'circle'} onClick={() => pick('circle')}><CircleIcon />Circle</button>
          <button type="button" aria-pressed={shape === 'line'} onClick={() => pick('line')}><LineIcon />Line</button>
        </div>
      </div>
      {shape === 'circle' ? <CompassWheel {...props} /> : <CompassJourney {...props} />}
    </div>
  );
}
