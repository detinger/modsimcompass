import { createContext, useCallback, useContext, useLayoutEffect, useReducer, useRef } from 'react';
import type { ArtefactEditor } from '../../../app/artefacts';
import { sameData } from '../../../domain/artefacts/clean';
import type { ConceptModel } from '../../../domain/artefacts/types';
import { emptyHistory, record, redo as redoStep, settle, tokenHolds, undo as undoStep, type History, type UndoToken } from './history';

export interface ConceptEditing {
  model: ConceptModel;
  /** Applies an edit to a copy of the model as one undo step; `key` joins quick edits of the same thing into one step. */
  change: (fn: (d: ConceptModel) => void, key?: string | null) => boolean;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** Marks the state right after a change, for an Undo offered in a message. */
  stamp: () => UndoToken;
  /** Takes that change back, but only in the same artefact and only when nothing has changed since. */
  undoIf: (token: UndoToken) => boolean;
}

/**
 * The editing session of the conceptual model on top of the artefact editor: every edit goes through
 * `editor.setData` (which autosaves), and is recorded for undo. The history belongs to one artefact and starts
 * afresh when another one is opened.
 */
export function useConceptEditing(editor: ArtefactEditor<'concept-model'>): ConceptEditing {
  const model = editor.artefact.data, artefactId = editor.artefact.id;
  const { setData } = editor;
  const latest = useRef(model);
  const hist = useRef<{ id: string; h: History<ConceptModel> }>({ id: artefactId, h: emptyHistory() });
  const [, bump] = useReducer((x: number) => x + 1, 0);
  /** Counts every change, undo and redo, so an offered Undo can tell whether it is still the latest step. */
  const version = useRef(0);

  useLayoutEffect(() => { latest.current = model; }, [model]);
  useLayoutEffect(() => {
    if (hist.current.id === artefactId) return;
    hist.current = { id: artefactId, h: emptyHistory() };
    bump();
  }, [artefactId]);

  const commit = useCallback((next: ConceptModel) => {
    latest.current = next;
    version.current++;
    setData((d) => {
      d.objectives = next.objectives; d.assumptions = next.assumptions; d.simplifications = next.simplifications;
      d.nodes = next.nodes; d.edges = next.edges;
    });
    bump();
  }, [setData]);

  const change = useCallback((fn: (d: ConceptModel) => void, key: string | null = null) => {
    const before = latest.current;
    const next = structuredClone(before);
    fn(next);
    if (sameData(before, next)) return false;
    hist.current.h = settle(record(hist.current.h, before, key, Date.now()), next, sameData);
    commit(next);
    return true;
  }, [commit]);

  const undo = useCallback(() => {
    const r = undoStep(hist.current.h, latest.current);
    if (!r) return false;
    hist.current.h = r.history;
    commit(r.state);
    return true;
  }, [commit]);

  const redo = useCallback(() => {
    const r = redoStep(hist.current.h, latest.current);
    if (!r) return false;
    hist.current.h = r.history;
    commit(r.state);
    return true;
  }, [commit]);

  const stamp = useCallback((): UndoToken => ({ owner: hist.current.id, version: version.current }), []);
  const undoIf = useCallback((t: UndoToken) => tokenHolds(t, hist.current.id, version.current) && undo(), [undo]);

  const h = hist.current.id === artefactId ? hist.current.h : emptyHistory<ConceptModel>();
  return { model, change, undo, redo, canUndo: h.past.length > 0, canRedo: h.future.length > 0, stamp, undoIf };
}

/** What the canvas pieces (elements, connections, frame) need from the tool. */
export interface ConceptCtxValue {
  model: ConceptModel;
  change: ConceptEditing['change'];
  editingNode: string | null;
  setEditingNode: (id: string | null) => void;
  editingEdge: string | null;
  setEditingEdge: (id: string | null) => void;
  selectOnly: (nodes: string[], edges?: string[]) => void;
}

export const ConceptCtx = createContext<ConceptCtxValue | null>(null);

export function useConceptCtx(): ConceptCtxValue {
  const v = useContext(ConceptCtx);
  if (!v) throw new Error('useConceptCtx outside the conceptual model tool');
  return v;
}
