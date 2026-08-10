import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGraphStore } from './graphStore';
import { useNotebookStore } from './notebookStore';
import { ANNOTATION_NODE_TYPE, type AnnotationData } from '../types/annotations';
import { SAVE_CONTENTS_DEFAULTS } from '../types/flow';

const annotationOf = (id: string): AnnotationData =>
  useGraphStore.getState().nodes.find((n) => n.id === id)!.data.annotation as AnnotationData;

const pinnedFigure = () => {
  const node = useGraphStore.getState().addAnnotation({
    kind: 'image',
    src: 'data:image/svg+xml;charset=utf-8,light',
    figure: { data: [{ y: [1, 2] }], layout: {} },
  });
  return node!.id;
};

describe('an annotation that is a pinned figure', () => {
  beforeEach(() => {
    useGraphStore.setState({ nodes: [], edges: [], past: [], future: [] });
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('keeps the figure it was drawn from beside the picture', () => {
    // A picture cannot be recoloured. Keeping what it was drawn from is what lets it be
    // drawn again — for a theme change, and for an export.
    const id = pinnedFigure();
    expect(annotationOf(id).figure).toEqual({ data: [{ y: [1, 2] }], layout: {} });
  });

  it('takes a fresh picture, which is a change like any other', () => {
    // The no-op guard compares every field a patch can carry. Leaving one out means a
    // change to that field looks like no change and is silently dropped — which is
    // exactly what a redrawn figure is.
    const id = pinnedFigure();
    useGraphStore.getState().updateAnnotation(id, { src: 'data:image/svg+xml;charset=utf-8,dark' });
    expect(annotationOf(id).src).toBe('data:image/svg+xml;charset=utf-8,dark');
  });

  it('still does nothing when nothing changed', () => {
    const id = pinnedFigure();
    const before = useGraphStore.getState().nodes;
    useGraphStore
      .getState()
      .updateAnnotation(id, { src: 'data:image/svg+xml;charset=utf-8,light' });
    expect(useGraphStore.getState().nodes).toBe(before);
  });

  it('carries both through a save and back', () => {
    const id = pinnedFigure();
    const saved = useGraphStore.getState().captureCase();
    const stored = saved.annotations?.find((a) => a.id === id);
    expect(stored?.src).toBeTruthy();
    expect(stored?.figure).toEqual({ data: [{ y: [1, 2] }], layout: {} });

    useGraphStore.setState({ nodes: [], edges: [] });
    useGraphStore.getState().applySaveData(saved);
    const reopened = useGraphStore.getState().nodes.find((n) => n.type === ANNOTATION_NODE_TYPE)!
      .data.annotation as AnnotationData;
    expect(reopened.figure).toEqual({ data: [{ y: [1, 2] }], layout: {} });
    expect(reopened.src).toBeTruthy();
  });
});

describe('what a saved case is asked to carry', () => {
  beforeEach(() => {
    useGraphStore.setState({ nodes: [], edges: [], past: [], future: [] });
    useNotebookStore.getState().reset();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('carries everything by default', () => {
    pinnedFigure();
    useNotebookStore.getState().setSource(useNotebookStore.getState().cells[0].id, 'net = ...');
    const saved = useGraphStore.getState().generateSaveData();
    expect(saved.annotations?.[0].figure).toBeTruthy();
    expect(saved.notebook?.cells).toHaveLength(1);
  });

  it('leaves out a pinned figure’s description when told to', () => {
    // The picture still travels; it is simply fixed in the colours it was pinned in.
    pinnedFigure();
    const saved = useGraphStore
      .getState()
      .generateSaveData({ ...SAVE_CONTENTS_DEFAULTS, figures: false });
    expect(saved.annotations?.[0].src).toBeTruthy();
    expect(saved.annotations?.[0].figure).toBeUndefined();
  });

  it('leaves out the notebook when told to', () => {
    useNotebookStore.getState().setSource(useNotebookStore.getState().cells[0].id, 'net = ...');
    const saved = useGraphStore
      .getState()
      .generateSaveData({ ...SAVE_CONTENTS_DEFAULTS, notebook: false });
    expect(saved.notebook).toBeUndefined();
  });

  it('what it leaves out of the file is still there in the case it hands over', () => {
    // The choice is about the file. Anything reading the case in memory -- the console
    // -- sees the whole of it, whatever the file is set to carry.
    pinnedFigure();
    const handed = useGraphStore.getState().captureCase();
    expect(handed.annotations?.[0].figure).toBeTruthy();
  });
});
