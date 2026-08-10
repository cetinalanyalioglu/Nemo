import React, { useEffect, useRef } from 'react';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import {
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, placeholder } from '@codemirror/view';
import { pythonHints } from './python-hints';

/**
 * The box a cell is written in.
 *
 * CodeMirror does the editing — indentation, brackets, highlighting, undo — because
 * that is the part of a notebook that is genuinely hard and already solved. What is
 * added here is the two things a *cell* needs that a text box does not: keys that run
 * it, and growing to fit rather than scrolling inside itself, so a notebook scrolls as
 * one document.
 *
 * Enter is a newline. Running a cell is a decision, and a decision should not be what
 * happens when you reach for a new line in the middle of writing one.
 */

interface CellEditorProps {
  value: string;
  language: 'python' | 'markdown';
  readOnly?: boolean;
  placeholderText?: string;
  onChange: (value: string) => void;
  /** Shift+Enter: run this cell and leave it at that. */
  onRun: () => void;
  /** Ctrl/Cmd+Enter: run this cell and open a fresh one under it. */
  onRunAndAdd: () => void;
  /** Ctrl/Cmd+Shift+Up or Down: move this cell one place, without leaving it. */
  onMove?: (delta: number) => void;
  onFocus?: () => void;
}

/** Held apart so the language can be swapped when a cell changes kind. */
const languageSlot = new Compartment();
const hintsSlot = new Compartment();
const readOnlySlot = new Compartment();

const CellEditor = React.memo(
  ({
    value,
    language,
    readOnly,
    placeholderText,
    onChange,
    onRun,
    onRunAndAdd,
    onMove,
    onFocus,
  }: CellEditorProps) => {
    const host = useRef<HTMLDivElement>(null);
    const view = useRef<EditorView | null>(null);
    // Held in refs so changing a handler does not tear down and rebuild the editor,
    // which would lose the cursor mid-typing.
    const handlers = useRef({ onChange, onRun, onRunAndAdd, onMove, onFocus });
    handlers.current = { onChange, onRun, onRunAndAdd, onMove, onFocus };

    useEffect(() => {
      if (!host.current) return;

      const state = EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          indentOnInput(),
          bracketMatching(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          keymap.of([
            // Enter is a newline, as it is in any editor. Running is deliberate:
            // Shift+Enter runs this cell, Ctrl/Cmd+Enter runs it and opens the next.
            {
              key: 'Shift-Enter',
              run: () => {
                handlers.current.onRun();
                return true;
              },
            },
            {
              key: 'Mod-Enter',
              run: () => {
                handlers.current.onRunAndAdd();
                return true;
              },
            },
            // Reordering from the keyboard, for what the gutter does with a drag.
            {
              key: 'Mod-Shift-ArrowUp',
              run: () => {
                handlers.current.onMove?.(-1);
                return true;
              },
            },
            {
              key: 'Mod-Shift-ArrowDown',
              run: () => {
                handlers.current.onMove?.(1);
                return true;
              },
            },
            // Tab indents inside a cell rather than moving to the next control; a cell
            // is a code editor first and a form field second.
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          languageSlot.of(language === 'python' ? python() : []),
          // Asked of the interpreter, so the names offered are the ones the session is
          // actually holding. A note is prose and has none of this.
          hintsSlot.of(language === 'python' ? pythonHints() : []),
          readOnlySlot.of(EditorState.readOnly.of(Boolean(readOnly))),
          placeholder(placeholderText ?? ''),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) handlers.current.onChange(update.state.doc.toString());
            if (update.focusChanged && update.view.hasFocus) handlers.current.onFocus?.();
          }),
        ],
      });

      view.current = new EditorView({ state, parent: host.current });
      return () => {
        view.current?.destroy();
        view.current = null;
      };
      // Built once. Everything that can change afterwards is pushed in below rather
      // than rebuilding, so typing is never interrupted.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // The document is only replaced when it differs, so an edit made here does not
    // come back round and reset the cursor to the end of the line.
    useEffect(() => {
      const editor = view.current;
      if (!editor) return;
      const current = editor.state.doc.toString();
      if (current === value) return;
      editor.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }, [value]);

    useEffect(() => {
      view.current?.dispatch({
        effects: [
          languageSlot.reconfigure(language === 'python' ? python() : []),
          hintsSlot.reconfigure(language === 'python' ? pythonHints() : []),
        ],
      });
    }, [language]);

    useEffect(() => {
      view.current?.dispatch({
        effects: readOnlySlot.reconfigure(EditorState.readOnly.of(Boolean(readOnly))),
      });
    }, [readOnly]);

    return <div className="cell-editor" ref={host} />;
  }
);

CellEditor.displayName = 'CellEditor';

export default CellEditor;
