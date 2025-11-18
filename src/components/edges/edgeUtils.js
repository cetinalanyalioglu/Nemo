import { baseEdgeInfo } from './GenericEdge';

/**
 * Deep merges two edgeInfo objects, with the specific edge's configuration taking precedence.
 * This allows edges to inherit and override base configuration as needed.
 *
 * @param {Object} edgeElementInfo - The specific edge's edgeInfo configuration
 * @returns {Object} - The merged edgeInfo configuration
 */
export const mergeWithBaseEdgeInfo = (edgeElementInfo) => {
  // Create deep copy of base element info
  const mergedInfo = JSON.parse(JSON.stringify(baseEdgeInfo));

  // Deep merge parameters
  mergedInfo.parameters = Object.keys(edgeElementInfo.parameters || {}).reduce(
    (acc, paramKey) => {
      if (acc[paramKey]) {
        // If parameter exists in base, merge its properties
        acc[paramKey] = {
          ...acc[paramKey],
          ...(edgeElementInfo.parameters[paramKey] || {}),
        };
      } else {
        // If parameter doesn't exist in base, add it as is
        acc[paramKey] = edgeElementInfo.parameters[paramKey];
      }
      return acc;
    },
    { ...mergedInfo.parameters }
  );

  // Merge other top-level properties
  return {
    ...mergedInfo,
    ...edgeElementInfo,
    parameters: mergedInfo.parameters,
  };
};

/**
 * Creates a complete edgeInfo configuration by merging with base configuration.
 * Use this as a helper to create edge configurations.
 *
 * @param {Object} config - The edge-specific configuration
 * @returns {Object} - The complete edgeInfo configuration
 */
export const createEdgeInfo = (config) => {
  return mergeWithBaseEdgeInfo(config);
};
