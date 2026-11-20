import { lazy, Suspense, useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { lawFor, type Kind } from '../domain/distributions/laws';

const DiagramView = lazy(() => import('./diagrams/DiagramView'));
const DiagramHeading = lazy(() => import('./diagrams/DiagramView').then((m) => ({ default: m.DiagramHeading })));
const DiagramText = lazy(() => import('./diagrams/DiagramView').then((m) => ({ default: m.DiagramText })));

/**
 * One of the app's five diagrams (ids in src/content/diagrams/types.ts), with its title, caption and a text equivalent.
 * The diagram code is loaded on demand, so cards cost nothing until one is shown.
 */
export function FigureCard({ id, caption }: { id: string; caption?: string }) {
  return (
    <figure className="figure-card diagram-card" data-diagram={id}>
      <Suspense fallback={<div className="dg-loading" style={{ minHeight: 220 }} aria-hidden="true" />}>
        <DiagramHeading id={id} caption={caption} />
        <div className="dgm-stage"><DiagramView id={id} /></div>
        <details className="dgm-as-text"><summary>As text</summary><DiagramText id={id} /></details>
      </Suspense>
    </figure>
  );
}

/** Flip cards: term on the front, short meaning on the back. Keyboard: Enter/Space flips. */
export function FlipCards({ items, tone = 'tone-primary' }: { items: { front: string; back: string; hr?: string }[]; tone?: string }) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  return (
    <div className={`flips ${tone}`}>
      {items.map((c, i) => (
        <button key={i} type="button" className="flip" aria-pressed={!!flipped[i]} aria-label={flipped[i] ? `${c.front}: ${c.back}` : `${c.front}. Flip to see meaning.`}
          onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))}>
          <span className="flip-inner">
            <span className="flip-face flip-front">{c.front}{c.hr && <small>{c.hr}</small>}</span>
            <span className="flip-face flip-back">{c.back}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** R / Python tabs with copy. */
export function CodeTabs({ r, py, title = 'Same thing in code' }: { r: string; py: string; title?: string }) {
  const [tab, setTab] = useState<'r' | 'py'>('r');
  const [copied, setCopied] = useState(false);
  const code = tab === 'r' ? r : py;
  return (
    <details className="code-tabs">
      <summary>{title}</summary>
      <div className="tabbar" role="tablist" aria-label="Language">
        <button role="tab" aria-selected={tab === 'r'} onClick={() => setTab('r')}>R</button>
        <button role="tab" aria-selected={tab === 'py'} onClick={() => setTab('py')}>Python</button>
        <button className="btn small ghost" style={{ marginLeft: 'auto' }} onClick={() => { void navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          <Copy size={13} aria-hidden="true" /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre tabIndex={0}>{code}</pre>
    </details>
  );
}

/** Tiny density/mass sketch drawn from the real law. */
export function Thumb({ kind, fields, className = 'thumb' }: { kind: Kind; fields: (number | string)[]; className?: string }) {
  const shape = useMemo(() => {
    try {
      const law = lawFor(kind, fields);
      const W = 140, H = 50;
      if (law.discrete) {
        const lo = Math.floor(law.inv(0.001)), hi = Math.max(lo + 1, Math.ceil(law.inv(0.999)));
        const xs = Array.from({ length: Math.min(60, hi - lo + 1) }, (_, i) => lo + i);
        const ps = xs.map(law.pdf), top = Math.max(...ps) || 1, step = W / xs.length;
        return { bars: xs.map((_, i) => ({ x: i * step + step * 0.18, w: step * 0.64, h: (ps[i] / top) * (H - 4) })), H };
      }
      const lo = law.inv(0.004), hi = law.inv(0.996);
      const pts = Array.from({ length: 61 }, (_, i) => { const x = lo + ((hi - lo) * i) / 60; return law.pdf(x); });
      const top = Math.max(...pts) || 1;
      return { area: `M0,${H} ${pts.map((p, i) => `L${((i / 60) * W).toFixed(1)},${(H - Math.min(p / top, 1) * (H - 4)).toFixed(1)}`).join(' ')} L${W},${H} Z`, H };
    } catch { return { H: 50 }; }
  }, [kind, fields]);
  return (
    <svg className={className} viewBox={`0 0 140 ${shape.H}`} aria-hidden="true" preserveAspectRatio="none">
      {'bars' in shape && shape.bars ? shape.bars.map((b, i) => <rect key={i} x={b.x} y={shape.H - b.h} width={b.w} height={b.h} rx="1" />) : 'area' in shape && shape.area ? <path d={shape.area} /> : null}
    </svg>
  );
}
