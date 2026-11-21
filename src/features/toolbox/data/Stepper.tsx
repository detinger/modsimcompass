import { Check, ChartColumn, Dices, FileInput, SlidersHorizontal, Tag, type LucideIcon } from 'lucide-react';

export type StepNo = 1 | 2 | 3 | 4 | 5;
export interface StepDef { n: StepNo; title: string; short: string; hint: string; icon: LucideIcon }
/** The steps of the distributions path. */
export const STEPS: StepDef[] = [
  { n: 1, title: 'Bring data, or describe it', short: 'Bring', hint: 'A CSV file, pasted numbers, or a few questions.', icon: FileInput },
  { n: 2, title: 'Discover', short: 'Discover', hint: 'What the numbers look like, and which curves fit.', icon: ChartColumn },
  { n: 3, title: 'Settle the model', short: 'Settle', hint: 'Take a fit, or set the curve by hand.', icon: SlidersHorizontal },
  { n: 4, title: 'Generate', short: 'Generate', hint: 'Seeded synthetic values from the model.', icon: Dices },
  { n: 5, title: 'Name it', short: 'Name', hint: 'What it is, its unit, and where it comes from.', icon: Tag },
];

/** The five steps as a path of numbered stops. Every stop can be visited at any time. */
export function Stepper({ steps = STEPS, current, done, onGo }: { steps?: StepDef[]; current: StepNo; done: Record<StepNo, boolean>; onGo: (n: StepNo) => void }) {
  return (
    <nav className="dm-steps" aria-label="Five steps">
      <ol>
        {steps.map((s) => {
          const Icon = s.icon;
          const here = s.n === current;
          return (
            <li key={s.n} className={`${here ? 'is-here' : ''}${done[s.n] ? ' is-done' : ''}`}>
              <button type="button" onClick={() => onGo(s.n)} aria-current={here ? 'step' : undefined}>
                <span className="dm-bubble" aria-hidden="true">
                  <Icon size={19} />
                  {done[s.n] && !here && <span className="dm-tick-badge"><Check size={11} strokeWidth={3} /></span>}
                </span>
                <span className="dm-step-label"><span className="dm-step-n">{s.n}</span> {s.short}<span className="sr-only">{done[s.n] ? ', done' : ''}</span></span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
