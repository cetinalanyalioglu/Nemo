import GenericEdge, { baseEdgeInfo } from './GenericEdge';
import { edgeConfig } from '../../config/edgeConfig';
import type { EdgeInfoEntry } from '../../types/flow';

const mergeParameters = (
  baseParams: Record<string, Record<string, unknown>>,
  customParams: Record<string, Record<string, unknown>> | undefined
): Record<string, Record<string, unknown>> => {
  const merged = { ...baseParams };
  const custom = customParams ?? {};
  Object.keys(custom).forEach((key) => {
    if (merged[key]) {
      merged[key] = { ...merged[key], ...custom[key] };
    } else {
      merged[key] = custom[key];
    }
  });
  return merged;
};

const createEdgeInfo = (type: string, config: (typeof edgeConfig)[string]): EdgeInfoEntry => {
  return {
    ...(baseEdgeInfo as unknown as EdgeInfoEntry),
    type,
    displayName: config.displayName,
    category: config.category,
    parameters: mergeParameters(
      baseEdgeInfo.parameters as unknown as Record<string, Record<string, unknown>>,
      config.customParameters as Record<string, Record<string, unknown>>
    ) as EdgeInfoEntry['parameters'],
  };
};

/** Collection of all available edge components. */
export const edgeTypes = {
  flow: GenericEdge,
  custom: GenericEdge,
};

/** Edge info keyed by type (includes legacy `custom` alias). */
export const edgeInfo: Record<string, EdgeInfoEntry> = Object.keys(edgeConfig).reduce(
  (acc, type) => {
    acc[type] = createEdgeInfo(type, edgeConfig[type]);
    return acc;
  },
  {} as Record<string, EdgeInfoEntry>
);

edgeInfo.custom = baseEdgeInfo as unknown as EdgeInfoEntry;

export default edgeTypes;
