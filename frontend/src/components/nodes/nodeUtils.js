import { elementInfo as baseElementInfo } from './BaseCustomNode';

/**
 * Deep merges two elementInfo objects, with the specific node's configuration taking precedence.
 * This allows nodes to inherit and override base configuration as needed.
 * 
 * @param {Object} nodeElementInfo - The specific node's elementInfo configuration
 * @returns {Object} - The merged elementInfo configuration
 */
export const mergeWithBaseElementInfo = (nodeElementInfo) => {
    // Create deep copy of base element info
    const mergedInfo = JSON.parse(JSON.stringify(baseElementInfo));

    // Deep merge parameters
    mergedInfo.parameters = Object.keys(nodeElementInfo.parameters || {}).reduce((acc, paramKey) => {
        if (acc[paramKey]) {
            // If parameter exists in base, merge its properties
            acc[paramKey] = {
                ...acc[paramKey],
                ...(nodeElementInfo.parameters[paramKey] || {})
            };
        } else {
            // If parameter doesn't exist in base, add it as is
            acc[paramKey] = nodeElementInfo.parameters[paramKey];
        }
        return acc;
    }, { ...mergedInfo.parameters });

    // Merge ports configuration
    mergedInfo.ports = {
        target: [
            ...mergedInfo.ports.target,
            ...(nodeElementInfo.ports?.target || [])
        ],
        source: [
            ...mergedInfo.ports.source,
            ...(nodeElementInfo.ports?.source || [])
        ]
    };

    // Merge other top-level properties
    return {
        ...mergedInfo,
        ...nodeElementInfo,
        parameters: mergedInfo.parameters,
        ports: mergedInfo.ports
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