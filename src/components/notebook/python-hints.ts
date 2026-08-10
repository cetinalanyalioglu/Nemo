/**
 * What the editor offers while a cell is being written: the names that could finish what
 * is there, and what the call it is inside takes.
 *
 * Both answers come from the interpreter rather than from a reading of the text, so they
 * are about the objects the session is actually holding. That is the point of asking it:
 * `sol.` lists the fields of the solution in hand, not of solutions in general, and it
 * does so for whatever solver the model brought without anything here knowing what a
 * solver is.
 *
 * It is also the limit. A name is offered once something has defined it, so a cell
 * written before anything has run gets little, and the same cell after a run gets the
 * lot.
 *
 * Exports {@link pythonHints}, the extension a cell editor is built with.
 */

import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { StateEffect, StateField, type Extension } from '@codemirror/state';
import {
  EditorView,
  showTooltip,
  ViewPlugin,
  type Tooltip,
  type ViewUpdate,
} from '@codemirror/view';
import { askForCompletions, askForSignature } from '../../python/python-runtime';
import type { SignatureHint } from '../../python/protocol';

/**
 * How long typing has to stop before the interpreter is asked what the call takes.
 *
 * Every keystroke inside a call would otherwise be a question, and the answer only
 * changes when the caret moves between arguments.
 */
const SETTLE_MS = 150;

/** The answer arriving, for the caret it was asked about. */
const showSignature = StateEffect.define<{ hint: SignatureHint | null; at: number }>();

/** What a signature tooltip is made of. */
const signatureTooltip = (hint: SignatureHint, at: number): Tooltip => ({
  pos: at,
  above: true,
  create: () => {
    const dom = document.createElement('div');
    dom.className = 'cm-signature';

    const label = document.createElement('div');
    label.className = 'cm-signature-label';
    label.textContent = hint.label;
    dom.appendChild(label);

    if (hint.doc) {
      const doc = document.createElement('div');
      doc.className = 'cm-signature-doc';
      doc.textContent = hint.doc;
      dom.appendChild(doc);
    }
    return { dom };
  },
});

/** The tooltip being shown, if any. */
const signatureField = StateField.define<Tooltip | null>({
  create: () => null,
  update(current, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(showSignature)) {
        const { hint, at } = effect.value;
        return hint ? signatureTooltip(hint, at) : null;
      }
    }
    // Anything typed moves the caret, and a tooltip pinned to where the caret was is
    // worse than none; it comes back with the next answer.
    if (transaction.docChanged || transaction.selection) return null;
    return current;
  },
  provide: (field) => showTooltip.from(field),
});

/**
 * Asks what the call under the caret takes, once typing has settled.
 *
 * Answers are matched against the caret they were asked about, so a slow one that
 * arrives after the caret has moved is dropped rather than shown against a different
 * call.
 */
const signatureWatcher = ViewPlugin.fromClass(
  class {
    private timer: ReturnType<typeof setTimeout> | null = null;
    private asked = 0;

    constructor(private readonly view: EditorView) {}

    update(update: ViewUpdate) {
      if (!update.docChanged && !update.selectionSet) return;
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.ask(), SETTLE_MS);
    }

    private async ask() {
      const at = this.view.state.selection.main.head;
      const asked = ++this.asked;
      const hint = await askForSignature(this.view.state.sliceDoc(0, at));
      const stale = asked !== this.asked || this.view.state.selection.main.head !== at;
      if (stale && hint) return;
      this.view.dispatch({ effects: showSignature.of({ hint, at }) });
    }

    destroy() {
      if (this.timer) clearTimeout(this.timer);
    }
  }
);

/**
 * The names that could finish what is written up to the caret.
 *
 * The whole of the text before the caret goes over, and the interpreter says which part
 * of it a name would replace; working out where a word began is its job, since it is the
 * one deciding what a word is.
 */
export const completeFromInterpreter = async (
  context: CompletionContext
): Promise<CompletionResult | null> => {
  const source = context.state.sliceDoc(0, context.pos);
  // An explicit request is always worth asking; typing is worth asking once there is a
  // word, or a dot to list what is behind.
  if (!context.explicit && !/[\w.]$/.test(source)) return null;

  const { items, from } = await askForCompletions(source);
  if (items.length === 0) return null;
  return {
    from: context.pos - source.length + from,
    options: items.map((item) => ({
      label: item.label,
      type: item.kind,
      detail: item.detail,
    })),
    // The list is filtered here as the word grows, rather than asked for again on every
    // keystroke: the names cannot change while nothing is running.
    validFor: /^[\w]*$/,
  };
};

/** Everything a cell editor needs to be asked about what is in it. */
export const pythonHints = (): Extension[] => [
  autocompletion({ override: [completeFromInterpreter], icons: true, activateOnTyping: true }),
  signatureField,
  signatureWatcher,
];
