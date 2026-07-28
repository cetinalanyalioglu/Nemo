import { beforeEach, describe, expect, it } from 'vitest';
import { useNotebookStore } from './notebookStore';
import { joinLines } from '../types/notebook';

const store = () => useNotebookStore.getState();
const kinds = () => store().cells.map((c) => c.cell_type);
const sources = () => store().cells.map((c) => joinLines(c.source));

describe('the cells of a notebook', () => {
  beforeEach(() => store().reset());

  it('starts with somewhere to type', () => {
    expect(store().cells).toHaveLength(1);
    expect(store().cells[0].cell_type).toBe('code');
  });

  it('adds a cell after the one it was asked to follow', () => {
    const first = store().cells[0].id;
    store().setSource(first, 'first');
    const added = store().addCell('code', first);
    store().setSource(added, 'second');
    store().addCell('markdown', first);
    expect(sources()).toEqual(['first', '', 'second']);
    expect(kinds()).toEqual(['code', 'markdown', 'code']);
  });

  it('leaves somewhere to type when the last cell is removed', () => {
    // A notebook with no cells has no way back to having one.
    store().removeCell(store().cells[0].id);
    expect(store().cells).toHaveLength(1);
    expect(joinLines(store().cells[0].source)).toBe('');
  });

  it('moves a cell, and refuses to move one off either end', () => {
    const [a] = [store().cells[0].id];
    const b = store().addCell('code', a);
    store().setSource(a, 'a');
    store().setSource(b, 'b');

    store().moveCell(b, -1);
    expect(sources()).toEqual(['b', 'a']);
    store().moveCell(b, -1);
    expect(sources()).toEqual(['b', 'a']);
    store().moveCell(a, 1);
    expect(sources()).toEqual(['b', 'a']);
  });

  it('drops outputs when a code cell becomes a note, since a note has none', () => {
    const id = store().cells[0].id;
    useNotebookStore.setState((s) => ({
      cells: s.cells.map((c) =>
        c.id === id ? { ...c, outputs: [{ output_type: 'stream', name: 'stdout', text: 'hi' }] } : c
      ),
    }));
    store().setKind(id, 'markdown');
    expect(store().cells[0].outputs).toBeUndefined();
    // And going back gives it a list again, as the format requires of a code cell.
    store().setKind(id, 'code');
    expect(store().cells[0].outputs).toEqual([]);
  });

  it('marks a cell unrun once it is edited, so what is shown is not mistaken for current', () => {
    const id = store().cells[0].id;
    useNotebookStore.setState((s) => ({ runState: { ...s.runState, [id]: 'done' } }));
    store().setSource(id, 'changed');
    expect(store().runState[id]).toBe('idle');
  });
});

describe('what a notebook is written out as', () => {
  beforeEach(() => store().reset());

  it('carries its outputs when asked, and not when not', () => {
    const id = store().cells[0].id;
    useNotebookStore.setState((s) => ({
      cells: s.cells.map((c) =>
        c.id === id
          ? {
              ...c,
              execution_count: 4,
              outputs: [{ output_type: 'stream', name: 'stdout', text: 'hi' }],
            }
          : c
      ),
    }));

    expect(store().toNotebook({ outputs: true }).cells[0].outputs).toHaveLength(1);
    const without = store().toNotebook({ outputs: false }).cells[0];
    expect(without.outputs).toEqual([]);
    expect(without.execution_count).toBeNull();
    // What was written is kept either way; it is the printing that is optional.
    expect(joinLines(without.source)).toBe(joinLines(store().cells[0].source));
  });

  it('opens a notebook in place of whatever was there', () => {
    store().setSource(store().cells[0].id, 'old');
    store().open({
      cells: [{ id: 'x', cell_type: 'markdown', source: 'new', metadata: {} }],
      metadata: { kernelspec: {} },
      nbformat: 4,
      nbformat_minor: 5,
    });
    expect(sources()).toEqual(['new']);
    expect(store().dirty).toBe(false);
  });
});

describe('whether there is anything unsaved', () => {
  beforeEach(() => store().reset());

  it('is clean when opened and marked, and dirty once edited', () => {
    expect(store().dirty).toBe(false);
    store().setSource(store().cells[0].id, 'typed');
    expect(store().dirty).toBe(true);
    store().markSaved();
    expect(store().dirty).toBe(false);
  });
});
