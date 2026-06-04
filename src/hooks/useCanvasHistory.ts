import { useCallback, useReducer } from 'react';
import type { Edge, Node } from 'reactflow';
import type { EdgeRuntimeState, NodeRuntimeState } from '../types/flow';

/**
 * Maximum number of undo steps retained in history. Older entries are dropped
 * once this depth is exceeded.
 */
export const MAX_HISTORY_DEPTH = 100;

/**
 * A serializable snapshot of the canvas graph. Captures everything required to
 * fully restore the graph on undo/redo while deliberately excluding transient
 * UI concerns (viewport, zoom and selection).
 */
export interface CanvasSnapshot {
  nodes: Node[];
  edges: Edge[];
  nodeStates: Record<string, NodeRuntimeState>;
  edgeStates: Record<string, EdgeRuntimeState>;
  nodeCounters: Record<string, number>;
  totalNodeCounters: Record<string, number>;
}

interface HistoryState {
  past: CanvasSnapshot[];
  future: CanvasSnapshot[];
}

type HistoryReducerAction =
  | { type: 'RECORD'; snapshot: CanvasSnapshot }
  | { type: 'UNDO'; current: CanvasSnapshot }
  | { type: 'REDO'; current: CanvasSnapshot }
  | { type: 'CLEAR' };

const INITIAL_HISTORY: HistoryState = { past: [], future: [] };

const serialize = (snapshot: CanvasSnapshot): string => JSON.stringify(snapshot);

const historyReducer = (state: HistoryState, action: HistoryReducerAction): HistoryState => {
  switch (action.type) {
    case 'RECORD': {
      // Collapse identical consecutive snapshots. This keeps batched mutations
      // (e.g. deleting several selected nodes in one keypress, which each
      // capture the same pre-change state) to a single undo step.
      const last = state.past[state.past.length - 1];
      if (last && serialize(last) === serialize(action.snapshot)) {
        // A fresh change still invalidates the redo stack.
        return state.future.length === 0 ? state : { ...state, future: [] };
      }

      // A fresh change always invalidates the redo stack.
      const past = [...state.past, action.snapshot];
      const trimmed =
        past.length > MAX_HISTORY_DEPTH ? past.slice(past.length - MAX_HISTORY_DEPTH) : past;
      return { past: trimmed, future: [] };
    }
    case 'UNDO': {
      if (state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        future: [...state.future, action.current],
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      return {
        past: [...state.past, action.current],
        future: state.future.slice(0, -1),
      };
    }
    case 'CLEAR':
      return INITIAL_HISTORY;
    default:
      return state;
  }
};

export interface CanvasHistory {
  /** Pushes a snapshot of the pre-change state. Call before a mutation. */
  record: (snapshot: CanvasSnapshot) => void;
  /**
   * Returns the snapshot to restore for an undo (or null if unavailable). The
   * caller supplies the current snapshot so it can be moved onto the redo stack.
   */
  undo: (current: CanvasSnapshot) => CanvasSnapshot | null;
  /** Mirror of {@link undo} for the redo direction. */
  redo: (current: CanvasSnapshot) => CanvasSnapshot | null;
  /** Drops all history. Used when a new document is started or loaded. */
  clear: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Manages an undo/redo history of canvas snapshots. The applied state lives in
 * the caller (NodeContext); this hook only owns the past/future stacks and
 * returns the snapshot that should be applied for undo/redo.
 */
export const useCanvasHistory = (): CanvasHistory => {
  const [state, dispatch] = useReducer(historyReducer, INITIAL_HISTORY);

  const record = useCallback((snapshot: CanvasSnapshot) => {
    dispatch({ type: 'RECORD', snapshot });
  }, []);

  const undo = useCallback(
    (current: CanvasSnapshot): CanvasSnapshot | null => {
      if (state.past.length === 0) return null;
      const target = state.past[state.past.length - 1];
      dispatch({ type: 'UNDO', current });
      return target;
    },
    [state.past]
  );

  const redo = useCallback(
    (current: CanvasSnapshot): CanvasSnapshot | null => {
      if (state.future.length === 0) return null;
      const target = state.future[state.future.length - 1];
      dispatch({ type: 'REDO', current });
      return target;
    },
    [state.future]
  );

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  return {
    record,
    undo,
    redo,
    clear,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
};
