import GenericEdge, { baseEdgeInfo } from './GenericEdge';
import { edgeConfig } from '../../config/edgeConfig';

/**
 * Merges base parameters with custom parameters from config
 */
const mergeParameters = (baseParams, customParams) => {
  const merged = { ...baseParams };
  Object.keys(customParams || {}).forEach((key) => {
    if (merged[key]) {
      merged[key] = { ...merged[key], ...customParams[key] };
    } else {
      merged[key] = customParams[key];
    }
  });
  return merged;
};

/**
 * Creates complete edgeInfo by merging base with config
 */
const createEdgeInfo = (type, config) => {
  return {
    ...baseEdgeInfo,
    type,
    displayName: config.displayName,
    category: config.category,
    parameters: mergeParameters(baseEdgeInfo.parameters, config.customParameters),
  };
};

/**
 * Collection of all available edge components.
 * All edge types use the same GenericEdge component.
 */
export const edgeTypes = {
  flow: GenericEdge,
  custom: GenericEdge, // Keep for backward compatibility
};

/**
 * Collection of edge info configurations.
 * Contains information about:
 * - Parameters and their constraints (merged from base + custom)
 * - Display names and categories
 */
export const edgeInfo = Object.keys(edgeConfig).reduce((acc, type) => {
  acc[type] = createEdgeInfo(type, edgeConfig[type]);
  return acc;
}, {});

// Add custom edge type for backward compatibility
edgeInfo.custom = baseEdgeInfo;

export default edgeTypes;
