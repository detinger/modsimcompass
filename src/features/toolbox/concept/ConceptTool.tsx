import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Background, BackgroundVariant, Panel, ReactFlow, ReactFlowProvider, useReactFlow, type EdgeTypes, type NodeTypes } from '@xyflow/react';
import { ClipboardList, LayoutGrid, List, Maximize, Minus, Network, Plus, Redo2, Sparkles, Undo2 } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { useArtefactEditor, useArtefacts } from '../../../app/artefacts';
import { useRouter } from '../../../app/router';
import { useStore } from '../../../app/store';
import { CM_EDGE_KINDS, CM_EDGE_LABELS, CM_NODE_H, CM_NODE_HINTS, CM_NODE_W, CM_NODE_LABELS, CM_NODE_TYPES, CM_ZONE_LABELS } from '../../../domain/artefacts/conceptModel';
import type { CMNodeType, CMZone } from '../../../domain/artefacts/types';
import { newId } from '../../../domain/passport/schema';
import { FigureCard } from '../../../ui/playful';
import { MenuButton } from '../Menu';
import { ToolPage, type ToolExport } from '../ToolPage';
import { arrange } from './arrange';
import { ConnectionEdge, ConnectionPreview, EdgeMarkers, type ConnectionFlowEdge } from './edges';
import { exportMarkdown, exportPng, exportSvg } from './exports';
import { Inspector, KindSample, type LinkKind, type Sign } from './Inspector';
import { ListView } from './ListView';
import { ElementNode, focusElement, FRAME_ID, FrameNode, Glyph, toneStyle, type ConceptFlowNode } from './nodes';
import { addConstructs, addNode, autoKind, connect, focusAfterRemoval, moveNodes, moveToZone, nodeCentre, nudge, removeElements, type ConnectResult } from './ops';
import { buildStarter, putStarter, STARTERS } from './starters';
import { syncEdges, syncNodes } from './sync';
import { ConceptCtx, useConceptEditing, type ConceptCtxValue, type ConceptEditing } from './useConcept';
import './concept.css';

const nodeTypes: NodeTypes = { element: ElementNode, frame: FrameNode };
const edgeTypes: EdgeTypes = { connection: ConnectionEdge };
const DND_TYPE = 'application/x-modsim-element';
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const fitOptions = () => ({ padding: 0.05, maxZoom: 1.1, duration: reducedMotion() ? 0 : 280 });

const isEditable = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** `/toolbox/concept[/:id]`: the conceptual model tool. */
export default function ConceptTool({ id }: { id?: string }) {
  const editor = useArtefactEditor('concept-model', id);
  const editing = useConceptEditing(editor);
  const { toast } = useStore();
  const { title } = editor.artefact;
  const exports: ToolExport[] = [
    { id: 'svg', label: 'Picture (SVG)', run: () => exportSvg(title, editing.model) },
    { id: 'png', label: 'Picture (PNG)', run: () => { exportPng(title, editing.model).catch(() => toast('The picture could not be drawn. Try the SVG picture instead.', 'error')); } },
    { id: 'md', label: 'Text description (Markdown)', run: () => exportMarkdown(title, editing.model) },
  ];
  return (
    <ToolPage kind="concept-model" editor={editor} exports={exports} intro={<FigureCard id="concept-components" />}>
      {/* A fresh canvas for each artefact: its own selection, view and undo history. */}
      <ReactFlowProvider key={editor.artefact.id}>
        <Workspace editing={editing} />
      </ReactFlowProvider>
    </ToolPage>
  );
}

function Workspace({ editing }: { editing: ConceptEditing }) {
  const { model, change, undo, redo, canUndo, canRedo, stamp, undoIf } = editing;
  const rf = useReactFlow<ConceptFlowNode, ConnectionFlowEdge>();
  const { toast, toasts, dismissToast } = useStore();
  /* An Undo offered in a message belongs to this canvas: it takes back only the change it names, in this artefact.
     The canvas is drawn afresh for each artefact, so its messages are put away when another artefact is opened. */
  const offered = useRef(new Set<string>());
  const toastsNow = useRef(toasts);
  useEffect(() => { toastsNow.current = toasts; });
  useEffect(() => () => {
    for (const t of toastsNow.current) if (offered.current.has(t.text)) dismissToast(t.id);
  }, [dismissToast]);
  const offerUndo = useCallback((text: string) => {
    const token = stamp();
    offered.current.add(text);
    toast(text, 'info', { label: 'Undo', run: () => { if (!undoIf(token)) toast('Nothing undone: the drawing has changed since.', 'info'); } });
  }, [stamp, undoIf, toast]);
  const [view, setView] = useState<'canvas' | 'list'>(() => (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 720px)').matches ? 'list' : 'canvas'));
  const [nodes, setNodes] = useState<ConceptFlowNode[]>(() => syncNodes([], model));
  const [edges, setEdges] = useState<ConnectionFlowEdge[]>(() => syncEdges([], model));
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editingEdge, setEditingEdge] = useState<string | null>(null);
  const [linkKind, setLinkKind] = useState<LinkKind>('auto');
  const [listFocus, setListFocus] = useState<string | null>(null);
  const [message, setMessage] = useState({ text: '', n: 0 });
  const pending = useRef<{ nodes: string[]; edges: string[] } | null>(null);
  const modelRef = useRef(model);
  const fitNext = useRef(false);
  const wrap = useRef<HTMLDivElement>(null);
  const announce = useCallback((text: string) => setMessage((m) => ({ text, n: m.n + 1 })), []);

  // The model is the truth: rebuild React Flow's nodes and edges after every change.
  useLayoutEffect(() => {
    modelRef.current = model;
    const want = pending.current;
    pending.current = null;
    setNodes((prev) => syncNodes(prev, model, want?.nodes));
    setEdges((prev) => syncEdges(prev, model, want?.edges));
  }, [model]);

  // After a starter or an arrange, fit the view (in the list view the canvas fits itself when it is shown again).
  useEffect(() => {
    if (!fitNext.current) return;
    fitNext.current = false;
    if (view === 'canvas') window.requestAnimationFrame(() => { void rf.fitView(fitOptions()); });
  }, [nodes, rf, view]);

  const selNodes = useMemo(() => nodes.filter((n) => n.type === 'element' && n.selected).map((n) => n.id), [nodes]);
  const selEdges = useMemo(() => edges.filter((e) => e.selected).map((e) => e.id), [edges]);

  const selectOnly = useCallback((ns: string[], es: string[] = []) => {
    setNodes((prev) => prev.map((n) => (n.type !== 'element' || !!n.selected === ns.includes(n.id) ? n : { ...n, selected: ns.includes(n.id) })));
    setEdges((prev) => prev.map((e) => (!!e.selected === es.includes(e.id) ? e : { ...e, selected: es.includes(e.id) })));
  }, []);

  /** A change whose result should be selected once it is drawn. */
  const changeAndSelect = useCallback((fn: Parameters<typeof change>[0], select: { nodes?: string[]; edges?: string[] }) => {
    pending.current = { nodes: select.nodes ?? [], edges: select.edges ?? [] };
    const changed = change(fn);
    if (!changed) pending.current = null;
    return changed;
  }, [change]);

  /** Pans to an element that is out of view, without changing the zoom. */
  const reveal = useCallback((x: number, y: number) => {
    window.requestAnimationFrame(() => {
      const box = wrap.current?.getBoundingClientRect();
      if (!box) return;
      const p = rf.flowToScreenPosition({ x, y });
      if (p.x < box.left + 40 || p.x > box.right - 40 || p.y < box.top + 40 || p.y > box.bottom - 40) void rf.setCenter(x, y, { zoom: rf.getZoom(), duration: reducedMotion() ? 0 : 250 });
    });
  }, [rf]);

  const addElement = useCallback((type: CMNodeType, at?: { x: number; y: number }, label = '', zone?: CMZone) => {
    const id = newId('n');
    const made = { at: null as { x: number; y: number } | null };
    changeAndSelect((d) => {
      const n = addNode(d, type, id, at, label);
      if (zone && zone !== n.zone) moveToZone(d, id, zone);
      const placed = d.nodes.find((x) => x.id === id)!;
      made.at = nodeCentre(placed);
    }, { nodes: [id] });
    announce(`${CM_NODE_LABELS[type]} added.`);
    if (view === 'canvas') {
      setEditingNode(id);
      if (made.at && !at) reveal(made.at.x, made.at.y);
    } else setListFocus(id);
    return id;
  }, [changeAndSelect, announce, view, reveal]);

  const connectNodes = useCallback((from: string, to: string, kind: LinkKind = linkKind, sign: Sign = '') => {
    const m = modelRef.current;
    const a = m.nodes.find((n) => n.id === from), b = m.nodes.find((n) => n.id === to);
    if (!a || !b) return;
    const k = kind === 'auto' ? autoKind(a.type, b.type) : kind;
    const id = newId('e');
    let result = null as ConnectResult | null;
    const changed = changeAndSelect((d) => { result = connect(d, from, to, k, id, sign); }, { edges: [id] });
    const names = `${a.label.trim() || 'unnamed'} to ${b.label.trim() || 'unnamed'}`;
    if (changed) { announce(`Connected ${names} as ${CM_EDGE_LABELS[k]}.`); return; }
    const r = result as ConnectResult | null;
    if (r && !r.ok && r.reason === 'same' && r.edge) { selectOnly([], [r.edge.id]); announce(`That ${CM_EDGE_LABELS[k]} from ${names} is already there.`); }
  }, [linkKind, changeAndSelect, announce, selectOnly]);

  const removeSelected = useCallback(() => {
    const ns = selNodes, es = selEdges;
    if (!ns.length && !es.length) return;
    const count = ns.length + es.length;
    if (!change((d) => removeElements(d, ns, es))) return;
    const text = count === 1 ? (ns.length ? 'Element deleted.' : 'Connection deleted.') : `${count} items deleted.`;
    announce(text);
    offerUndo(text);
  }, [selNodes, selEdges, change, announce, offerUndo]);

  /** Deletes what is selected and keeps the keyboard on the canvas: the focus moves to a neighbouring element, which is not selected. */
  const skipFocusSelect = useRef(false);
  const removeAndRefocus = useCallback(() => {
    const next = focusAfterRemoval(modelRef.current, selNodes, selEdges);
    removeSelected();
    if (next) { skipFocusSelect.current = true; focusElement(next); }
    else window.requestAnimationFrame(() => toolRef.current?.querySelector<HTMLElement>('.cm-palette button')?.focus());
  }, [selNodes, selEdges, removeSelected]);

  const commitDrag = useCallback((dragged: ConceptFlowNode[]) => {
    const moves = dragged.filter((n) => n.type === 'element').map((n) => ({ id: n.id, x: n.position.x, y: n.position.y }));
    if (!moves.length) return;
    const before = new Map(modelRef.current.nodes.map((n) => [n.id, n.zone]));
    let after: { id: string; zone: CMZone; label: string }[] = [];
    const changed = change((d) => { moveNodes(d, moves); after = d.nodes.filter((n) => moves.some((m) => m.id === n.id)).map((n) => ({ id: n.id, zone: n.zone, label: n.label })); });
    // Nothing changed (a drop back where it was, or into a band it may not cover): put React Flow back on the model.
    if (!changed) { setNodes((prev) => syncNodes(prev, modelRef.current)); return; }
    const moved = after.filter((n) => before.get(n.id) !== n.zone);
    if (moved.length === 1) announce(`${moved[0].label.trim() || 'Element'} is now in ${CM_ZONE_LABELS[moved[0].zone]}.`);
  }, [change, announce]);

  const fit = useCallback(() => { void rf.fitView(fitOptions()); }, [rf]);

  const applyStarter = useCallback((id: (typeof STARTERS)[number]['id']) => {
    const had = modelRef.current.nodes.length > 0;
    const s = buildStarter(id, (p) => newId(p));
    fitNext.current = true;
    if (!change((d) => putStarter(d, s))) { fitNext.current = false; return; }
    const label = STARTERS.find((x) => x.id === id)?.label ?? 'Starter';
    announce(`${label} starter in place.`);
    if (had) offerUndo(`${label} replaced your drawing.`);
  }, [change, announce, offerUndo]);

  /** Adds the constructs of a measurement-data artefact as variables, in one undo step; names already on the canvas are skipped. */
  const { ofKind } = useArtefacts();
  const { navigate } = useRouter();
  const measurements = ofKind('measurement-data');
  const addFrom = useCallback((title: string, names: string[]) => {
    // The ids are made before the change, so the new elements can be selected as soon as they are drawn.
    const fresh = names.map(() => newId('n'));
    const made = { ids: [] as string[] };
    const name = title.trim() || 'the measurement data';
    fitNext.current = true;
    let k = 0;
    const changed = changeAndSelect((d) => { made.ids = addConstructs(d, names, () => fresh[k++]); }, { nodes: fresh });
    if (!changed) { fitNext.current = false; toast(`Every construct of “${name}” is already on the canvas.`, 'info'); return; }
    const n = made.ids.length, text = `Added ${n} construct${n === 1 ? '' : 's'} from “${name}”${n < names.length ? `; ${names.length - n} already there` : ''}.`;
    announce(text);
    offerUndo(text);
  }, [changeAndSelect, announce, offerUndo, toast]);

  const arrangeAll = useCallback(() => {
    fitNext.current = true;
    if (!change((d) => { d.nodes = arrange(d); })) fitNext.current = false;
    else announce('Arranged by zone.');
  }, [change, announce]);

  // Keyboard: undo and redo anywhere in the tool; on the canvas, move, rename, delete and leave.
  // A click on the canvas can leave the focus on the page itself, so the last place clicked or focused counts too.
  const toolRef = useRef<HTMLElement>(null);
  const engaged = useRef<'canvas' | 'tool' | null>(null);
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    onKey.current = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null, tool = toolRef.current;
      if (!t || !tool) return;
      const inside = tool.contains(t), around = !inside && t.contains(tool) && engaged.current !== null;
      if (!inside && !around) return;
      if (isEditable(t) || t.closest('.menu-pop')) return;
      const mod = e.metaKey || e.ctrlKey, key = e.key.toLowerCase();
      if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && key === 'y') { e.preventDefault(); redo(); return; }
      if (view !== 'canvas' || mod || e.altKey) return;
      if (inside ? !t.closest('.cm-canvas') : engaged.current !== 'canvas') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selNodes.length && !selEdges.length) return;
        e.preventDefault();
        removeAndRefocus();
        return;
      }
      const step = e.shiftKey ? 40 : 8;
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (arrows[e.key] && selNodes.length) {
        e.preventDefault();
        const [dx, dy] = arrows[e.key];
        const before = new Map(modelRef.current.nodes.map((n) => [n.id, n.zone]));
        const moved = { to: null as { label: string; zone: CMZone } | null };
        change((d) => {
          nudge(d, selNodes, dx, dy);
          const one = selNodes.length === 1 ? d.nodes.find((n) => n.id === selNodes[0]) : undefined;
          if (one && before.get(one.id) !== one.zone) moved.to = { label: one.label, zone: one.zone };
        }, `move:${selNodes.join(',')}`);
        if (moved.to) announce(`${moved.to.label.trim() || 'Element'} is now in ${CM_ZONE_LABELS[moved.to.zone]}.`);
        return;
      }
      if ((e.key === 'Enter' || e.key === 'F2') && selNodes.length === 1) { e.preventDefault(); setEditingNode(selNodes[0]); return; }
      if (e.key === 'Escape' && (selNodes.length || selEdges.length)) selectOnly([]);
    };
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey.current(e);
    const where = (e: Event) => {
      const t = e.target as HTMLElement | null, tool = toolRef.current;
      if (!t || !tool) return;
      // Focus moving to the page around the tool (after a click on the canvas) keeps the tool engaged.
      if (e.type === 'focusin' && t.contains(tool)) return;
      engaged.current = tool.contains(t) ? (t.closest('.cm-canvas') ? 'canvas' : 'tool') : null;
    };
    document.addEventListener('keydown', listener);
    document.addEventListener('pointerdown', where, true);
    document.addEventListener('focusin', where, true);
    return () => {
      document.removeEventListener('keydown', listener);
      document.removeEventListener('pointerdown', where, true);
      document.removeEventListener('focusin', where, true);
    };
  }, []);

  /** Moving through the elements with Tab selects each one, so the arrow keys and Delete act on it. */
  const onCanvasFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (skipFocusSelect.current) { skipFocusSelect.current = false; return; }
    if (!t.matches(':focus-visible')) return;
    const id = t.getAttribute('data-id');
    if (!id || id === FRAME_ID) return;
    if (t.classList.contains('react-flow__node') && !(selNodes.length === 1 && selNodes[0] === id)) selectOnly([id]);
    else if (t.classList.contains('react-flow__edge') && !(selEdges.length === 1 && selEdges[0] === id)) selectOnly([], [id]);
  };

  const onDrop = (e: React.DragEvent) => {
    const type = e.dataTransfer.getData(DND_TYPE) as CMNodeType;
    if (!CM_NODE_TYPES.includes(type)) return;
    e.preventDefault();
    const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addElement(type, { x: p.x - CM_NODE_W / 2, y: p.y - CM_NODE_H / 2 });
  };

  const ctx = useMemo<ConceptCtxValue>(() => ({ model, change, editingNode, setEditingNode, editingEdge, setEditingEdge, selectOnly }), [model, change, editingNode, editingEdge, selectOnly]);
  // The relationship starters (causal paths, technology acceptance) sit together under a line.
  const starterItems = STARTERS.map((s) => ({ id: s.id, label: s.label, detail: s.detail, divider: s.id === 'causal', run: () => applyStarter(s.id) }));
  const constructItems = measurements.length
    ? measurements.slice(0, 20).map((a) => {
      const names = a.data.constructs.map((c) => c.name);
      return { id: a.id, label: a.title.trim() || 'Untitled measurement data', detail: `${names.length} construct${names.length === 1 ? '' : 's'}${names.length ? `: ${names.slice(0, 4).join(', ')}${names.length > 4 ? '…' : ''}` : ''}`, run: () => addFrom(a.title, names) };
    })
    : [{ id: 'make', label: 'Make measurement data', detail: 'Data and inputs → Measurement data', run: () => navigate('/toolbox/data') }];

  return (
    <ConceptCtx.Provider value={ctx}>
      <section className="cm-tool" aria-label="Conceptual model" ref={toolRef}>
        <div className="cm-toolbar">
          <div className="cm-seg" role="group" aria-label="View">
            <button type="button" aria-pressed={view === 'canvas'} onClick={() => setView('canvas')}><Network size={15} aria-hidden="true" /> Canvas</button>
            <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={15} aria-hidden="true" /> List</button>
          </div>
          <span className="cm-sep" aria-hidden="true" />
          <button type="button" className="btn small cm-icon-btn" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)"><Undo2 size={16} aria-hidden="true" /></button>
          <button type="button" className="btn small cm-icon-btn" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><Redo2 size={16} aria-hidden="true" /></button>
          <MenuButton label="Starters" icon={Sparkles} items={starterItems} className="btn small" />
          <MenuButton label="Constructs" icon={ClipboardList} items={constructItems} className="btn small"
            empty={measurements.length ? 'Add constructs from measurement data' : 'No measurement data yet.'} />
          {view === 'canvas' && (
            <>
              <button type="button" className="btn small" onClick={arrangeAll} disabled={!model.nodes.length} title="Tidy up, zone by zone"><LayoutGrid size={15} aria-hidden="true" /> Arrange</button>
              <span className="cm-sep" aria-hidden="true" />
              <label className="cm-link-kind">
                <span>New links</span>
                <select value={linkKind} onChange={(e) => setLinkKind(e.target.value as LinkKind)}>
                  <option value="auto">Best guess</option>
                  {CM_EDGE_KINDS.map((k) => <option key={k} value={k}>{CM_EDGE_LABELS[k]}</option>)}
                </select>
              </label>
            </>
          )}
        </div>

        {view === 'canvas' ? (
          <>
            <div className="cm-palette" role="group" aria-label="Add an element">
              {CM_NODE_TYPES.map((t) => (
                <button key={t} type="button" className="cm-chip" style={toneStyle(t)} draggable title={`${CM_NODE_HINTS[t]}. Click to add, or drag onto the canvas.`}
                  onDragStart={(e) => { e.dataTransfer.setData(DND_TYPE, t); e.dataTransfer.effectAllowed = 'copy'; }}
                  onClick={() => addElement(t)}>
                  <span className="cm-chip-badge"><Glyph type={t} size={15} /></span>{CM_NODE_LABELS[t]}
                </button>
              ))}
            </div>
            <Inspector model={model} selNodes={selNodes} selEdges={selEdges} change={change} onRemove={removeAndRefocus}
              onConnect={(from, to, kind, sign) => connectNodes(from, to, kind, sign)} />
            <div className="cm-canvas" ref={wrap} onFocus={onCanvasFocus}
              onDragOver={(e) => { if (e.dataTransfer.types.includes(DND_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }} onDrop={onDrop}>
              <EdgeMarkers />
              <ReactFlow<ConceptFlowNode, ConnectionFlowEdge>
                nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
                onNodesChange={(c) => setNodes((n) => c.applyTo(n))}
                onEdgesChange={(c) => setEdges((x) => c.applyTo(x))}
                onNodeDragStop={(_, __, dragged) => commitDrag(dragged)}
                onSelectionDragStop={(_, dragged) => commitDrag(dragged)}
                onConnect={(c) => connectNodes(c.source, c.target)}
                isValidConnection={(c) => c.source !== c.target && c.source !== FRAME_ID && c.target !== FRAME_ID}
                onNodeDoubleClick={(_, n) => { if (n.type === 'element') setEditingNode(n.id); }}
                onEdgeDoubleClick={(_, e) => setEditingEdge(e.id)}
                connectionLineComponent={ConnectionPreview}
                connectionRadius={30}
                deleteKeyCode={null}
                disableKeyboardA11y
                zoomOnDoubleClick={false}
                snapToGrid snapGrid={[8, 8]}
                nodeDragThreshold={2}
                minZoom={0.2} maxZoom={2}
                fitView fitViewOptions={{ padding: 0.05, maxZoom: 1.1 }}
                proOptions={{ hideAttribution: true }}
                ariaLabelConfig={{
                  'node.a11yDescription.keyboardDisabled': 'Arrow keys move the element. Enter renames it. Delete removes it.',
                  'node.a11yDescription.default': 'Arrow keys move the element. Enter renames it. Delete removes it.',
                  'edge.a11yDescription.default': 'Delete removes the connection.',
                }}
              >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1.3} color="var(--border-strong)" />
                <Panel position="bottom-left" className="cm-legend" aria-label="Connections">
                  {CM_EDGE_KINDS.map((k) => <span key={k}><KindSample kind={k} width={28} /> {CM_EDGE_LABELS[k]}{k === 'influence' ? ' ±' : ''}</span>)}
                </Panel>
                <Panel position="bottom-right" className="cm-zoom">
                  <button type="button" onClick={() => { void rf.zoomIn({ duration: reducedMotion() ? 0 : 160 }); }} aria-label="Zoom in" title="Zoom in"><Plus size={16} aria-hidden="true" /></button>
                  <button type="button" onClick={() => { void rf.zoomOut({ duration: reducedMotion() ? 0 : 160 }); }} aria-label="Zoom out" title="Zoom out"><Minus size={16} aria-hidden="true" /></button>
                  <button type="button" onClick={fit} aria-label="Zoom to fit" title="Zoom to fit"><Maximize size={15} aria-hidden="true" /></button>
                </Panel>
              </ReactFlow>
              {!model.nodes.length && (
                <p className="cm-empty" aria-hidden="true">Drag an element in, or pick a starter.</p>
              )}
            </div>
            <p className="cm-keys">Double-click to rename · drag from <span className="cm-knob-sample" aria-hidden="true" /> to connect · Delete removes · Ctrl+Z undoes</p>
          </>
        ) : (
          <ListView model={model} change={change} focusId={listFocus}
            onConnect={(from, to, kind, sign) => connectNodes(from, to, kind, sign)}
            onAdd={(type, label, zone) => { addElement(type, undefined, label, zone); }} />
        )}
        <p className="sr-only" role="status" aria-live="polite">{message.text}{message.n % 2 ? '\u00a0' : ''}</p>
      </section>
    </ConceptCtx.Provider>
  );
}
