import { baseEdgeInfo } from './GenericEdge';
import type { EdgeInfoEntry } from '../../types/flow';

/**
 * Deep merges two edgeInfo objects, with the specific edge's configuration taking precedence.
 * This allows edges to inherit and override base configuration as needed.
 */
export const mergeWithBaseEdgeInfo = (edgeElementInfo: EdgeInfoEntry): EdgeInfoEntry => {
  const mergedInfo = JSON.parse(JSON.stringify(baseEdgeInfo)) as EdgeInfoEntry;

  mergedInfo.parameters = Object.keys(edgeElementInfo.parameters || {}).reduce(
    (acc, paramKey) => {
      if (acc[paramKey]) {
        acc[paramKey] = {
          ...acc[paramKey],
          ...(edgeElementInfo.parameters[paramKey] || {}),
        };
      } else {
        acc[paramKey] = edgeElementInfo.parameters[paramKey];
      }
      return acc;
    },
    { ...mergedInfo.parameters }
  );

  return {
    ...mergedInfo,
    ...edgeElementInfo,
    parameters: mergedInfo.parameters,
  };
};

/** Creates a complete edgeInfo configuration by merging with base configuration. */
export const createEdgeInfo = (config: EdgeInfoEntry): EdgeInfoEntry => {
  return mergeWithBaseEdgeInfo(config);
};
