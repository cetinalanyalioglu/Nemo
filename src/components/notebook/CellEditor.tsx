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

/**
 * The box a cell is written in.
 *
 * CodeMirror does the editing — indentation, brackets, highlighting, undo — because
 * that is the part of a notebook that is genuinely hard and already solved. What is
 * added here is the two things a *cell* needs that a text box does not: running on
 * Ctrl/Cmd+Enter, and growing to fit rather than scrolling inside itself, so a notebook
 * scrolls as one document.
 */

interface CellEditorProps {
  value: string;
  language: 'python' | 'markdown';
  readOnly?: boolean;
  placeholderText?: string;
  onChange: (value: string) => void;
  /** Ctrl/Cmd+Enter. Runs the cell without adding a line. */
  onRun: () => void;
  onFocus?: () => void;
}

/** Held apart so the language can be swapped when a cell changes kind. */
const languageSlot = new Compartment();
const readOnlySlot = new Compartment();

const CellEditor = React.memo(
  ({ value, language, readOnly, placeholderText, onChange, onRun, onFocus }: CellEditorProps) => {
    const host = useRef<HTMLDivElement>(null);
    const view = useRef<EditorView | null>(null);
    // Held in refs so changing a handler does not tear down and rebuild the editor,
    // which would lose the cursor mid-typing.
    const handlers = useRef({ onChange, onRun, onFocus });
    handlers.current = { onChange, onRun, onFocus };

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
            {
              key: 'Mod-Enter',
              run: () => {
                handlers.current.onRun();
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
        effects: languageSlot.reconfigure(language === 'python' ? python() : []),
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
