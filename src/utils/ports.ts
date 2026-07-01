import type {
  DynamicPortConfig,
  DynamicPortSide,
  NodePorts,
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
