import type {
  DynamicPortConfig,
  DynamicPortSide,
  NodePorts,
  PortAngles,
  PortPlacements,
  PortSide,
} from '../types/flow';

/**
 * Resolves the number of ports for one side of a node. When the side is driven
 * by a parameter (`countParameter`), the value is read from the node state and
 * clamped to the configured minimum; otherwise the static port count is used.
 */
export const resolvePortCount = (
  side: DynamicPortSide | undefined,
  staticPorts: string[],
  parameters: Record<string, unknown> | undefined
): number => {
  if (!side || !side.countParameter) {
    return staticPorts.length;
  }
  const min = side.min ?? 0;
  const fallback = Math.max(min, side.default ?? staticPorts.length);
  const raw = parameters?.[side.countParameter];
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }
  const parsed = parseInt(String(raw), 10);
  return isNaN(parsed) ? fallback : Math.max(min, parsed);
};

/**
 * Computes the ports rendered for a node. For dynamic-port nodes the counts are
 * derived from parameters via `dynamicPortConfig`. Ports are numbered
 * sequentially: targets are `0..(T-1)` and sources `T..(T+S-1)`, matching the
 * positional handle ids (`{nodeId}-port-{n}`) used throughout the canvas.
 */
export const computePortLayout = (
  ports: NodePorts,
  dynamicPorts: boolean | undefined,
  dynamicPortConfig: DynamicPortConfig | undefined,
  parameters: Record<string, unknown> | undefined
): NodePorts => {
  if (!dynamicPorts || !dynamicPortConfig) {
    return ports || { target: [], source: [] };
  }

  const targetCount = resolvePortCount(dynamicPortConfig.target, ports.target, parameters);
  const sourceCount = resolvePortCount(dynamicPortConfig.source, ports.source, parameters);

  const target = dynamicPortConfig.target?.countParameter
    ? Array.from({ length: targetCount }, (_, index) => `${index}`)
    : ports.target;
  const source = dynamicPortConfig.source?.countParameter
    ? Array.from({ length: sourceCount }, (_, index) => `${targetCount + index}`)
    : ports.source;

  return { target, source };
};

/**
 * Returns whether `paramName` drives a dynamic-port count for either side of a
 * node. Changing such a parameter adds or removes ports, which renumbers the
 * node's handles — a topological change. Used to gate these edits while the
 * canvas is locked.
 */
export const isPortCountParameter = (
  dynamicPorts: boolean | undefined,
  dynamicPortConfig: DynamicPortConfig | undefined,
  paramName: string
): boolean => {
  if (!dynamicPorts || !dynamicPortConfig) return false;
  return (
    dynamicPortConfig.target?.countParameter === paramName ||
    dynamicPortConfig.source?.countParameter === paramName
  );
};

/** A node port with its positional handle suffix and side. */
export interface PortDescriptor {
  /** Positional port number, also the handle id suffix. */
  port: string;
  side: 'target' | 'source';
}

/** Flattens a port layout into descriptors covering every port on the node. */
export const listPorts = (layout: NodePorts): PortDescriptor[] => [
  ...layout.target.map((port): PortDescriptor => ({ port, side: 'target' })),
  ...layout.source.map((port): PortDescriptor => ({ port, side: 'source' })),
];

/** The edge a port renders on when no placement override is set. */
export const defaultSideForDirection = (direction: 'target' | 'source'): PortSide =>
  direction === 'target' ? 'left' : 'right';

/** A single port resolved to a rendered position on the node's perimeter. */
export interface PlacedPort {
  /** Positional port number = handle-id suffix (`{nodeId}-port-{suffix}`). */
  suffix: string;
  /** Connection direction — drives the React Flow handle `type`, never the side. */
  direction: 'target' | 'source';
  /** Which edge this port renders on. */
  side: PortSide;
}

/** Ports bucketed by the edge they render on, in ascending port-number order. */
export type SideBuckets = Record<PortSide, PlacedPort[]>;

/**
 * Buckets a node's ports by the edge they render on. Port numbering is preserved
 * exactly — targets keep their positional suffix, sources are numbered
 * `targetCount + idx` — so handle ids, connectivity and data-index mapping are
 * untouched; `placements` only redirects where each handle is drawn. Ports keep
 * ascending numeric order within a bucket.
 */
export const groupPortsBySide = (
  layout: NodePorts,
  placements: PortPlacements | undefined
): SideBuckets => {
  const buckets: SideBuckets = { left: [], right: [], top: [], bottom: [] };
  const targetCount = layout.target.length;

  const place = (suffix: string, direction: 'target' | 'source') => {
    const side = placements?.[suffix] ?? defaultSideForDirection(direction);
    buckets[side].push({ suffix, direction, side });
  };

  layout.target.forEach((portId) => place(portId, 'target'));
  layout.source.forEach((_portId, idx) => place(String(targetCount + idx), 'source'));

  return buckets;
};

/**
 * A circular element's port resolved to an outward angle on its border. `suffix`
 * and `direction` match every other layout (targets keep their suffix, sources
 * are `targetCount + idx`) so handle ids and connectivity are untouched;
 * `exitAngle` is the outward direction in math convention (0° = right, 90° = up)
 * and `side` is the nearest cardinal, used only to pick the React Flow handle
 * `position` (which drives the edge-exit vector).
 */
export interface RadialPort {
  suffix: string;
  direction: 'target' | 'source';
  exitAngle: number;
  side: PortSide;
}

/**
 * Half-angle (degrees) of the arc each side's ports fan across, centred on that
 * side's cardinal direction. Kept ≤ 45° so every port's nearest cardinal stays
 * the side it belongs to — targets read as `left`, sources as `right` — which
 * keeps React Flow's edge-exit vectors clean.
 */
const RADIAL_HALF_ARC = 45;

/** Nearest cardinal side for an outward angle (math convention, degrees). */
export const nearestSide = (angleDeg: number): PortSide => {
  const a = ((angleDeg % 360) + 360) % 360;
  if (a >= 315 || a < 45) return 'right';
  if (a < 135) return 'top';
  if (a < 225) return 'left';
  return 'bottom';
};

/**
 * Places a circular element's ports on its border. A per-instance manual `angle`
 * (from the node's UI data) always wins. Otherwise placement follows one of two
 * automatic schemes:
 *
 * - Default (static-port elements): targets across the left arc, sources across
 *   the right, evenly spaced within ±`RADIAL_HALF_ARC` of their cardinal (a lone
 *   port lands on the cardinal itself).
 * - `even` (dynamic-port elements, e.g. the junction node-dot): ALL ports fan
 *   evenly around the full circle at a uniform `360/n` pitch — the target block
 *   centred on the left (180°), the source block on the right (0°) — so the two
 *   blocks meet with the same pitch and the element reads as a graph node where
 *   flows converge. Direction (target/source) is preserved, so edge validity and
 *   connectivity are untouched; only the rendered angle differs.
 *
 * Port numbering is unchanged in either scheme.
 */
export const computeRadialPorts = (
  layout: NodePorts,
  angles?: PortAngles,
  options?: { even?: boolean }
): RadialPort[] => {
  const targetCount = layout.target.length;
  const total = targetCount + layout.source.length;
  const even = options?.even ?? false;
  const pitch = total > 0 ? 360 / total : 0;

  const arc = (
    ids: string[],
    direction: 'target' | 'source',
    centerAngle: number,
    offset: number
  ) =>
    ids.map((_id, i): RadialPort => {
      const suffix = String(offset + i);
      const manual = angles?.[suffix];
      let exitAngle: number;
      if (manual != null) {
        exitAngle = manual;
      } else if (even) {
        // Uniform pitch around the whole circle, this group centred on its side.
        exitAngle = centerAngle + pitch * (i - (ids.length - 1) / 2);
      } else {
        exitAngle =
          centerAngle + RADIAL_HALF_ARC * (ids.length === 1 ? 0 : (2 * i + 1) / ids.length - 1);
      }
      return { suffix, direction, exitAngle, side: nearestSide(exitAngle) };
    });

  return [...arc(layout.target, 'target', 180, 0), ...arc(layout.source, 'source', 0, targetCount)];
};
