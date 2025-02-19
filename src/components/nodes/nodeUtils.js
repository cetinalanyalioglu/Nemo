import { elementInfo as baseElementInfo } from './BaseCustomNode';

/**
 * Deep merges two elementInfo objects, with the specific node's configuration taking precedence.
 * This allows nodes to inherit and override base configuration as needed.
 *
 * Special care is taken to handle function properties (like isConnectionValid) correctly:
 * - JSON.parse/stringify cannot serialize functions, so we avoid deep copying them
 * - Instead, we use a hybrid approach: shallow copy for the base object to preserve functions,
 *   and deep copy only for data structures (parameters and ports)
 *
 * @param {Object} nodeElementInfo - The specific node's elementInfo configuration
 * @returns {Object} - The merged elementInfo configuration
 */
export const mergeWithBaseElementInfo = (nodeElementInfo) => {
  // Create shallow copy of base element info first
  // This preserves function references like isConnectionValid
  const mergedInfo = { ...baseElementInfo };

  // Deep copy only the data structures that need it
  // We use JSON parse/stringify only for parameters and ports
  // because these are pure data objects without functions
  mergedInfo.parameters = JSON.parse(JSON.stringify(mergedInfo.parameters));
  mergedInfo.ports = JSON.parse(JSON.stringify(mergedInfo.ports));

  // Deep merge parameters
  mergedInfo.parameters = Object.keys(nodeElementInfo.parameters || {}).reduce(
    (acc, paramKey) => {
      if (acc[paramKey]) {
        // If parameter exists in base, merge its properties
        acc[paramKey] = {
          ...acc[paramKey],
          ...(nodeElementInfo.parameters[paramKey] || {}),
        };
      } else {
        // If parameter doesn't exist in base, add it as is
        acc[paramKey] = nodeElementInfo.parameters[paramKey];
      }
      return acc;
    },
    { ...mergedInfo.parameters }
  );

  // Merge ports configuration
  mergedInfo.ports = {
    target: [...mergedInfo.ports.target, ...(nodeElementInfo.ports?.target || [])],
    source: [...mergedInfo.ports.source, ...(nodeElementInfo.ports?.source || [])],
  };

  // Handle isConnectionValid function - use node's validator if provided, otherwise keep base validator
  // This works because we did a shallow copy of baseElementInfo, preserving the original function reference
  mergedInfo.isConnectionValid = nodeElementInfo.isConnectionValid || mergedInfo.isConnectionValid;

  // Final merge of all properties while ensuring our carefully merged properties aren't overwritten
  // Order is important here:
  // 1. First spread mergedInfo (contains base properties with merged data)
  // 2. Then spread nodeElementInfo (override with node-specific properties)
  // 3. Finally explicitly set our carefully merged properties to ensure they're not overwritten
  return {
    ...mergedInfo,
    ...nodeElementInfo,
    parameters: mergedInfo.parameters,
    ports: mergedInfo.ports,
    isConnectionValid: mergedInfo.isConnectionValid,
  };
};

/**
 * Creates a complete elementInfo configuration by merging with base configuration.
 * Use this as a helper to create node configurations.
 *
 * @param {Object} config - The node-specific configuration
 * @returns {Object} - The complete elementInfo configuration
 */
export const createElementInfo = (config) => {
  return mergeWithBaseElementInfo(config);
};
