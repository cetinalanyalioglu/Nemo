import type { XYPosition } from 'reactflow';

/** Which axis of the selected nodes' centers gets equalized. */
export type AlignAxis = 'horizontal' | 'vertical';

/**
 * A selected node, reduced to what an alignment needs of it: where it sits and how
 * big it is. Resolving the size is the caller's job, since that is the only part of
 * this that has to touch the canvas.
 */
export interface AlignCandidate {
  id: string;
  position: XYPosition;
  width: number;
  height: number;
}

/** Where one node goes. Nodes already on the line are not given one. */
export interface AlignMove {
  id: string;
  position: XYPosition;
}

/**
 * A node's center. Rotation pivots on the center, so this is the one point a rotation
 * leaves alone -- which is why aligning centers needs no special handling for a
 * rotated node.
 */
const centerOf = (candidate: AlignCandidate): XYPosition => ({
  x: candidate.position.x + candidate.width / 2,
  y: candidate.position.y + candidate.height / 2,
});

/** A candidate's coordinates as [along the axis being equalized, across it]. */
const ordered = (candidate: AlignCandidate, axis: AlignAxis): [number, number] => {
  const center = centerOf(candidate);
  return axis === 'horizontal' ? [center.y, center.x] : [center.x, center.y];
};

/**
 * The node the others move onto.
 *
 * `preferredId` is the last node the user clicked, and it wins whenever it is one of
 * the nodes being aligned: it is the one they touched most recently and the one the
 * properties panel is showing, so it is the one they are least expecting to move.
 * Its membership is checked rather than assumed -- a click that *removes* a node from
 * a selection records it just the same, and a marquee selects without clicking any
 * node at all.
 *
 * Failing that, the node furthest against the axis holds: the topmost when a
 * selection is being brought into a row, the leftmost when into a column. Something
 * has to stay still for the result to be predictable, and reading order is the rule
 * that takes the least explaining. Ties fall to the other coordinate and then to the
 * id, so the same selection always picks the same anchor.
 */
export const pickAnchor = (
  candidates: AlignCandidate[],
  axis: AlignAxis,
  preferredId?: string | null
): AlignCandidate | undefined => {
  const preferred = preferredId
    ? candidates.find((candidate) => candidate.id === preferredId)
    : undefined;
  if (preferred) return preferred;

  return candidates.reduce<AlignCandidate | undefined>((best, candidate) => {
    if (!best) return candidate;
    const [along, across] = ordered(candidate, axis);
    const [bestAlong, bestAcross] = ordered(best, axis);
    if (along !== bestAlong) return along < bestAlong ? candidate : best;
    if (across !== bestAcross) return across < bestAcross ? candidate : best;
    return candidate.id < best.id ? candidate : best;
  }, undefined);
};

/**
 * Where each node goes to sit on the anchor's centerline.
 *
 * Only the nodes that actually move come back, so an already-aligned selection
 * produces nothing to apply and adds no undo step. The anchor is one of those: it is
 * already on its own line, so it falls out of the result by the same test rather than
 * by being treated as a special case.
 */
export const alignToAnchor = (
  candidates: AlignCandidate[],
  axis: AlignAxis,
  anchor: AlignCandidate
): AlignMove[] => {
  const line = centerOf(anchor);
  const moves: AlignMove[] = [];

  for (const candidate of candidates) {
    const position =
      axis === 'vertical'
        ? { x: line.x - candidate.width / 2, y: candidate.position.y }
        : { x: candidate.position.x, y: line.y - candidate.height / 2 };
    if (position.x !== candidate.position.x || position.y !== candidate.position.y) {
      moves.push({ id: candidate.id, position });
    }
  }

  return moves;
};
