import type { DynamicPortConfig, DynamicPortSide, NodePorts } from '../types/flow';

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
