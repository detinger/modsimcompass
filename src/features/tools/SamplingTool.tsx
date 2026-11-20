import { useState } from 'react';
import { Coins, Dices } from 'lucide-react';
import { flipCoins, sampleLetters } from '../../domain/distributions/experiments';
import { COINS_CODE, LETTERS_CODE } from '../../domain/distributions/code';
import { NumberField, fmt } from '../../ui/controls';
import { CodeTabs } from '../../ui/playful';
import { RunningLine } from './toolCharts';
import { ToolFrame } from './ToolFrame';

export default function SamplingTool() {
  const [nL, setNL] = useState(12);
  const [round, setRound] = useState(1);
  const [nF, setNF] = useState(1000);
  const [p, setP] = useState(0.5);
  const [flipRound, setFlipRound] = useState(0);
  const letters = sampleLetters(nL, `letters-${round}`);
  const coins = flipRound > 0 ? flipCoins(nF, p, `coins-${flipRound}`) : null;
  return (
    <ToolFrame id="sampling">
      <div className="grid two">
        <section className="lab-panel tone-teal" aria-labelledby="letters-h">
          <h2 id="letters-h" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Dices size={20} aria-hidden="true" /> Letter lottery</h2>
          <NumberField label="Letters" value={nL} min={1} max={40} integer slider onChange={(v) => setNL(Math.max(1, Math.min(40, v)))} />
          <button className="btn primary" onClick={() => setRound((r) => r + 1)}>Draw again</button>
          <div className="letter-tiles" key={round} aria-live="polite">{letters.map((l, i) => <span key={i} style={{ animationDelay: `${i * 25}ms` }}>{l}</span>)}</div>
          <p className="subtle-text">Every letter has a 1-in-26 chance, so repeats happen more often than intuition says.</p>
          <CodeTabs r={LETTERS_CODE.r(nL)} py={LETTERS_CODE.py(nL)} />
        </section>
        <section className="lab-panel tone-blue" aria-labelledby="coins-h">
          <h2 id="coins-h" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Coins size={20} aria-hidden="true" /> Coin flipper</h2>
          <div className="grid two">
            <NumberField label="Flips" value={nF} min={10} max={20000} step={10} integer slider onChange={(v) => setNF(Math.max(1, Math.min(20000, v)))} />
            <NumberField label="P(heads)" value={p} min={0} max={1} step={0.01} slider onChange={(v) => setP(Math.max(0, Math.min(1, v)))} />
          </div>
          <button className="btn primary" onClick={() => setFlipRound((r) => r + 1)}>Flip {nF.toLocaleString('en-GB')} coins</button>
          {coins && (
            <div aria-live="polite">
              <div className="coin-bar" role="img" aria-label={`${coins.heads} heads and ${nF - coins.heads} tails`}>
                <span className="h" style={{ width: `${(coins.heads / nF) * 100}%` }}>{coins.heads > nF * 0.08 ? `H ${coins.heads}` : ''}</span>
                <span className="t" style={{ width: `${(1 - coins.heads / nF) * 100}%` }}>{nF - coins.heads > nF * 0.08 ? `T ${nF - coins.heads}` : ''}</span>
              </div>
              <div className="stat-row">
                <div className="stat"><small>Heads share</small><strong>{fmt((coins.heads / nF) * 100, 1)}%</strong></div>
                <div className="stat"><small>Expected</small><strong>{fmt(p * 100, 1)}%</strong></div>
                <div className="stat"><small>Expected heads</small><strong>{fmt(p * nF, 0)}</strong></div>
              </div>
              <RunningLine values={coins.running} target={p} />
              <p className="subtle-text">Early flips swing wildly; the share settles towards {fmt(p * 100, 0)}% as flips accumulate.</p>
            </div>
          )}
          <CodeTabs r={COINS_CODE.r(nF, p)} py={COINS_CODE.py(nF, p)} />
        </section>
      </div>
    </ToolFrame>
  );
}
