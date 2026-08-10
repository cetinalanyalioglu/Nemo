import { beforeEach, describe, expect, it } from 'vitest';
import { alignToAnchor, pickAnchor } from './align-nodes';
import type { AlignCandidate } from './align-nodes';
import { useGraphStore } from '../store/graphStore';

/** A node of the default size, at a given top-left. */
const at = (id: string, x: number, y: number, width = 150, height = 50): AlignCandidate => ({
  id,
  position: { x, y },
  width,
  height,
});

describe('pickAnchor', () => {
  // Three nodes at different heights, in no particular order.
  const selection = [at('b', 300, 40), at('a', 0, 100), at('c', 600, 220)];

  it('anchors on the last clicked node when it is one of the selection', () => {
    expect(pickAnchor(selection, 'horizontal', 'c')?.id).toBe('c');
    expect(pickAnchor(selection, 'vertical', 'c')?.id).toBe('c');
  });

  it('ignores a last clicked node that is not in the selection', () => {
    // A shift-click that *removes* a node records it as clicked just the same, and a
    // marquee never clicks one at all — so membership decides, not the id alone.
    expect(pickAnchor(selection, 'horizontal', 'gone')?.id).toBe('b');
  });

  it('falls back to the topmost node when bringing a selection into a row', () => {
    expect(pickAnchor(selection, 'horizontal', null)?.id).toBe('b');
  });

  it('falls back to the leftmost node when bringing a selection into a column', () => {
    expect(pickAnchor(selection, 'vertical', undefined)?.id).toBe('a');
  });

  it('compares centers rather than corners, so size counts', () => {
    // The two rank one way by top edge and the other way by center: `tall` starts
    // higher (0 against 10) but its center sits lower (20 against 15). The center is
    // what a row is made of, so `short` is the topmost of the two.
    const tall = at('tall', 0, 0, 150, 40);
    const short = at('short', 300, 10, 150, 10);
    expect(pickAnchor([tall, short], 'horizontal', null)?.id).toBe('short');
  });

  it('settles a tie the same way every time', () => {
    const first = at('z', 0, 100);
    const second = at('y', 0, 100);
    expect(pickAnchor([first, second], 'horizontal', null)?.id).toBe('y');
    expect(pickAnchor([second, first], 'horizontal', null)?.id).toBe('y');
  });

  it('has no anchor to offer for an empty selection', () => {
    expect(pickAnchor([], 'horizontal', null)).toBeUndefined();
  });
});

describe('alignToAnchor', () => {
  it('leaves the anchor where it is and brings the rest onto its line', () => {
    const anchor = at('anchor', 0, 100);
    const other = at('other', 400, 260);
    const moves = alignToAnchor([anchor, other], 'horizontal', anchor);

    expect(moves).toEqual([{ id: 'other', position: { x: 400, y: 100 } }]);
  });

  it('equalizes centers, not top edges, for nodes of different heights', () => {
    const anchor = at('anchor', 0, 100, 150, 50); // center y = 125
    const tall = at('tall', 400, 300, 150, 90);
    const [move] = alignToAnchor([anchor, tall], 'horizontal', anchor);

    expect(move.position.y).toBe(125 - 45);
    expect(move.position.y + 90 / 2).toBe(125);
  });

  it('moves along one axis only', () => {
    const anchor = at('anchor', 0, 100);
    const other = at('other', 400, 260);

    expect(alignToAnchor([anchor, other], 'horizontal', anchor)[0].position.x).toBe(400);
    expect(alignToAnchor([anchor, other], 'vertical', anchor)[0].position.y).toBe(260);
  });

  it('aligns a column on the anchor’s horizontal center', () => {
    const anchor = at('anchor', 100, 0, 80, 50); // center x = 140
    const wide = at('wide', 500, 200, 200, 50);
    const [move] = alignToAnchor([anchor, wide], 'vertical', anchor);

    expect(move.position.x).toBe(140 - 100);
  });

  it('has nothing to move when the selection already sits on the line', () => {
    const anchor = at('anchor', 0, 100);
    const beside = at('beside', 400, 100);

    expect(alignToAnchor([anchor, beside], 'horizontal', anchor)).toEqual([]);
  });

  it('does not move the anchor even when it is given twice over', () => {
    const anchor = at('anchor', 0, 100);
    const moves = alignToAnchor([anchor, at('other', 0, 300)], 'horizontal', anchor);

    expect(moves.some((move) => move.id === 'anchor')).toBe(false);
  });
});

/**
 * Which id the control hands to {@link pickAnchor}.
 *
 * It is the last element *clicked*, which is not the last element selected: dropping
 * an element onto the canvas selects it too, and an element dropped a minute ago is
 * nothing anyone would expect a later marquee-and-align to pivot on. The two were the
 * same field until a run through the browser showed the difference.
 */
describe('the anchor the canvas offers', () => {
  beforeEach(() => {
    useGraphStore.setState({ nodes: [], edges: [], model: null, past: [], future: [] });
    useGraphStore.getState().setLastClickedNodeId(null);
  });

  it('is not set by putting an element on the canvas', () => {
    // Adding one selects it — that is how the properties panel comes up on what was
    // just dropped — but selecting is not clicking, and only clicking nominates.
    useGraphStore.getState().addAnnotation({ position: { x: 0, y: 0 }, text: 'a' });

    expect(useGraphStore.getState().nodes).toHaveLength(1);
    expect(useGraphStore.getState().lastClickedNodeId).toBeNull();
  });

  it('is set by clicking one', () => {
    const note = useGraphStore.getState().addAnnotation({ position: { x: 0, y: 0 }, text: 'a' })!;
    useGraphStore.getState().setLastClickedNodeId(note.id);

    expect(useGraphStore.getState().lastClickedNodeId).toBe(note.id);
  });

  it('is let go of with the case it belonged to', () => {
    useGraphStore.getState().setLastClickedNodeId('gone');
    useGraphStore.getState().reset();

    expect(useGraphStore.getState().lastClickedNodeId).toBeNull();
  });
});
