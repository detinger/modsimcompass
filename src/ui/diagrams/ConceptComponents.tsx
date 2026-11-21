import { BarChart3, Boxes, CircleHelp, Cpu, Globe, PencilRuler, Scissors, SlidersHorizontal, Target, type LucideIcon } from 'lucide-react';
import { CONCEPT } from '../../content/diagrams/specs';
import { GraphView, useGraphLayout } from './ElkGraph';
import { conceptGraph } from './graphDefs';
import { WalkControls, useWalkthrough, useWidth } from './walkthrough';

/**
 * Real system → conceptual model → computer model. The conceptual model is a container: its inner chain
 * (inputs → content → outputs) is laid out by elkjs, while objectives (header) and assumptions and
 * simplifications (footer) belong to the container itself and live in its padding.
 */

/** Walkthrough step at which each element appears. */
const NODE_STEP: Record<string, number> = { real: 1, model: 2, inputs: 3, outputs: 3, content: 4, computer: 6 };
const EDGE_STEP: Record<string, number> = { abstract: 2, feed: 4, produce: 4, implement: 6 };

const ICON: Record<string, LucideIcon> = { real: Globe, computer: Cpu, inputs: SlidersHorizontal, content: Boxes, outputs: BarChart3 };

export default function ConceptComponents() {
  const [ref, width] = useWidth<HTMLDivElement>();
  const layout = useGraphLayout(conceptGraph, width);
  const walk = useWalkthrough(CONCEPT.steps.length, { intro: 900 });
  const off = (n: number) => (walk.has(n) ? '' : ' is-off');
  const now = (n: number) => (walk.walking && walk.shown === n ? ' is-new' : '');
  return (
    <div className="dgm-concept" ref={walk.hostRef} data-walk={walk.walking ? 'walk' : 'rest'}>
      <div className="dgm-scroll" ref={ref}>
        {layout ? (
          <GraphView
            layout={layout}
            label="Real system leads to the conceptual model, which leads to the computer model. Inside the conceptual model, inputs feed the content and the content produces the outputs."
            nodeClass={(id) => `dgm-n-${id}${id === 'model' ? '' : off(NODE_STEP[id]) + now(NODE_STEP[id])}`}
            edgeClass={(id) => `dgm-build${off(EDGE_STEP[id])}`}
            renderBackdrop={(id) => (id === 'model' ? <div className={`dgm-model-frame${off(2)}`} /> : null)}
            renderNode={(id) => {
              if (id === 'model') {
                return (
                  <>
                    <div className={`dgm-model-head${off(2)}${now(2)}`}>
                      <div className="dgm-model-title"><PencilRuler size={18} aria-hidden="true" /><strong>{CONCEPT.model.label}</strong><span className="dgm-tag">{CONCEPT.model.sub}</span></div>
                      <div className="dgm-objectives"><Target size={18} aria-hidden="true" /><strong>{CONCEPT.objectives.label}</strong><span>{CONCEPT.objectives.sub}</span></div>
                    </div>
                    <div className={`dgm-model-foot${off(5)}${now(5)}`}>
                      <div className="dgm-note"><span><CircleHelp size={16} aria-hidden="true" /><strong>{CONCEPT.assumptions.label}</strong></span><span>{CONCEPT.assumptions.sub}</span></div>
                      <div className="dgm-note"><span><Scissors size={16} aria-hidden="true" /><strong>{CONCEPT.simplifications.label}</strong></span><span>{CONCEPT.simplifications.sub}</span></div>
                    </div>
                  </>
                );
              }
              const Icon = ICON[id];
              const t = CONCEPT[id as 'real' | 'computer' | 'inputs' | 'content' | 'outputs'];
              if (id === 'real' || id === 'computer') return <><span className="dgm-node-icon"><Icon size={20} aria-hidden="true" /></span><span className="dgm-node-text"><strong>{t.label}</strong><span>{t.sub}</span></span></>;
              return <span className="dgm-node-text dgm-part"><strong><Icon size={16} aria-hidden="true" />{t.label}</strong><span>{t.sub}</span></span>;
            }}
          />
        ) : <div className="dgm-placeholder" style={{ height: 300 }} />}
      </div>
      <WalkControls walk={walk} captions={CONCEPT.steps} summary={CONCEPT.summary} />
    </div>
  );
}
