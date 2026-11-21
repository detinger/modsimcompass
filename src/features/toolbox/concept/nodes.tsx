import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ArrowRight, CircleHelp, Scissors, Target } from 'lucide-react';
import { LIMITS } from '../../../domain/artefacts/clean';
import { CM_GLYPHS, CM_LABEL_MAX, CM_LAYOUT, CM_NODE_LABELS, CM_NODE_TONE, CM_ZONE_HINTS, CM_ZONE_LABELS, labelParts, type CMFrame } from '../../../domain/artefacts/conceptModel';
import type { CMNode, CMNodeType } from '../../../domain/artefacts/types';
import { useConceptCtx } from './useConcept';

export type ElementFlowNode = Node<{ node: CMNode }, 'element'>;
export type FrameFlowNode = Node<{ frame: CMFrame }, 'frame'>;
export type ConceptFlowNode = ElementFlowNode | FrameFlowNode;
export const FRAME_ID = 'cm-frame';

/** The glyph of an element type, from the same paths the picture uses. */
export function Glyph({ type, size = 18 }: { type: CMNodeType; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" className="cm-glyph">
      <path d={CM_GLYPHS[type]} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Colour variables of an element type, for anything drawn in its colours. */
export const toneStyle = (type: CMNodeType): CSSProperties => ({ '--cm-c': CM_NODE_TONE[type].line, '--cm-s': CM_NODE_TONE[type].soft } as CSSProperties);

/**
 * A text field that edits a label in place. Every keystroke is saved at once (`onInput`), so nothing typed is lost
 * when the page is left or reloaded; quick typing is one undo step. Enter or leaving the field keeps the text,
 * Escape puts back the text it started with. React Flow shows a new element only once it has been measured,
 * so the focus is given when the field can take it.
 */
export function InlineEditor({ initial, label, max, multiline = true, onInput, onDone }: {
  initial: string; label: string; max: number; multiline?: boolean; onInput: (value: string) => void; onDone: (value: string | null) => void;
}) {
  const [value, setValue] = useState(initial);
  const start = useRef(initial);
  const done = useRef(false);
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    let frame = 0, tries = 0;
    const grab = () => {
      const el = field.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      if (document.activeElement === el) { el.select(); return; }
      if (++tries < 30) frame = window.requestAnimationFrame(grab);
    };
    grab();
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const finish = (keep: boolean) => {
    if (done.current) return;
    done.current = true;
    if (!keep) onInput(start.current);
    onDone(keep ? value : null);
  };
  const edit = (v: string) => { setValue(v); onInput(v); };
  const common = {
    ref: field, value, maxLength: max, 'aria-label': label, className: 'cm-inline nodrag nopan nowheel',
    onBlur: () => finish(true),
    onKeyDown: (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    },
  };
  return multiline
    ? <textarea {...common} rows={2} onChange={(e) => edit(e.target.value)} />
    : <input {...common} type="text" onChange={(e) => edit(e.target.value)} />;
}

/** Gives the keyboard focus back to an element on the canvas, after editing it in place. */
export function focusElement(id: string): void {
  window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`.cm-canvas .react-flow__node[data-id="${CSS.escape(id)}"]`)?.focus());
}

/** A label, with an abbreviation in brackets at its end (“Perceived usefulness (PU)”) shown as a quiet tag. */
function LabelText({ label }: { label: string }) {
  const { main, abbr } = labelParts(label);
  return abbr ? <>{main} <span className="cm-abbr">{abbr}</span></> : <>{label}</>;
}

/** One element: a card in the colours of its type, with its glyph and label. */
export function ElementNode({ id, data, selected }: NodeProps<ElementFlowNode>) {
  const { editingNode, setEditingNode, change } = useConceptCtx();
  const n = data.node;
  const editing = editingNode === id;
  const named = n.label.trim();
  // The same key as the name field of the panel above the canvas, so a burst of typing is one undo step.
  const save = (value: string) => change((d) => { const x = d.nodes.find((m) => m.id === id); if (x) x.label = value.replace(/\s*\n\s*/g, ' ').trim(); }, `label:${id}`);
  return (
    <div className={`cm-node cm-t-${n.type}${selected ? ' is-selected' : ''}${editing ? ' is-editing' : ''}`} style={toneStyle(n.type)}>
      <Handle type="target" position={Position.Left} id="in" className="cm-drop" isConnectableStart={false} />
      <span className="cm-badge"><Glyph type={n.type} size={14} /></span>
      {editing ? (
        <InlineEditor initial={n.label} label={`Name of this ${CM_NODE_LABELS[n.type].toLowerCase()}`} max={CM_LABEL_MAX} onInput={save} onDone={(value) => {
          setEditingNode(null);
          if (value !== null) save(value);
          focusElement(id);
        }} />
      ) : (
        <span className={`cm-label${named ? '' : ' is-empty'}`}>{named ? <LabelText label={named} /> : 'Unnamed'}</span>
      )}
      <Handle type="source" position={Position.Right} id="out" className="cm-knob" title="Drag to connect" />
    </div>
  );
}

function BandText({ field, label, hint, icon }: { field: 'objectives' | 'assumptions' | 'simplifications'; label: string; hint: string; icon: React.ReactNode }) {
  const { model, change } = useConceptCtx();
  const id = useId();
  return (
    <div className={`cm-band-part cm-${field}`}>
      <label className="cm-band-label" htmlFor={id}>{icon}{label}</label>
      <textarea id={id} className="cm-band-text nodrag nopan nowheel" value={model[field]} maxLength={LIMITS.text} placeholder={hint} spellCheck
        onChange={(e) => { const v = e.target.value; change((d) => { d[field] = v; }, `text:${field}`); }} />
    </div>
  );
}

/**
 * The frame behind the elements: the “Parts of a conceptual model” layout. It takes no pointer events of its own
 * (the canvas underneath still pans and selects); only its three texts can be clicked and typed into.
 */
export function FrameNode({ data }: NodeProps<FrameFlowNode>) {
  const f = data.frame;
  const [, a, b, c] = f.columns;
  const cols = [['inputs', 0, a], ['content', a, b], ['outputs', b, c]] as const;
  return (
    <div className="cm-frame" style={{ width: f.outside.x + f.outside.w, height: Math.max(f.height, f.outside.h) }}>
      <div className="cm-boundary" style={{ width: f.width, height: f.height }}>
        <div className="cm-band cm-head" style={{ height: CM_LAYOUT.head }}>
          <BandText field="objectives" label="Objectives" hint="What must the model answer?" icon={<Target size={15} aria-hidden="true" />} />
        </div>
        {cols.map(([zone, lo, hi], i) => (
          <div key={zone} className={`cm-col cm-col-${zone}`} style={{ left: lo, width: hi - lo, top: CM_LAYOUT.head, height: f.middleBottom - CM_LAYOUT.head }}>
            <span className="cm-col-head"><strong>{CM_ZONE_LABELS[zone]}</strong><span>{CM_ZONE_HINTS[zone]}</span></span>
            {i < 2 && <span className="cm-col-arrow" aria-hidden="true"><ArrowRight size={14} strokeWidth={2.5} /></span>}
          </div>
        ))}
        <div className="cm-band cm-foot" style={{ top: f.middleBottom, height: CM_LAYOUT.foot }}>
          <BandText field="assumptions" label="Assumptions" hint="What you believe without checking" icon={<CircleHelp size={15} aria-hidden="true" />} />
          <BandText field="simplifications" label="Simplifications" hint="What you leave out on purpose" icon={<Scissors size={15} aria-hidden="true" />} />
        </div>
      </div>
      <div className="cm-outside" style={{ left: f.outside.x, top: f.outside.y, width: f.outside.w, height: f.outside.h }}>
        <span className="cm-col-head"><strong>Outside</strong><span>{CM_ZONE_HINTS.outside}</span></span>
      </div>
    </div>
  );
}
