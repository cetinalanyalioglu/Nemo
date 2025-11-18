import GenericNode, { baseElementInfo } from './GenericNode';
import { nodeConfig } from '../../config/nodeConfig';

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
 * Creates complete elementInfo by merging base with config
 */
const createElementInfo = (type, config) => {
  return {
    ...baseElementInfo,
    type,
    displayName: config.displayName,
    category: config.category,
    parameters: mergeParameters(baseElementInfo.parameters, config.customParameters),
    ports: config.ports,
    dynamicPorts: config.dynamicPorts || false,
    icon: config.icon, // Include icon for ElementLibrary
  };
};

/**
 * Collection of all available node components.
 * All node types use the same GenericNode component.
 */
export const nodeTypes = {
  MassFlowInlet: GenericNode,
  PressureOutlet: GenericNode,
  LosslessDuct: GenericNode,
  SuddenExpansion: GenericNode,
  LosslessSplitter: GenericNode,
  Junction: GenericNode,
};

/**
 * Collection of configuration objects for all node types.
 * Contains information about:
 * - Parameters and their constraints (merged from base + custom)
 * - Port configurations
 * - Display names and categories
 */
export const elementInfo = Object.keys(nodeConfig).reduce((acc, type) => {
  acc[type] = createElementInfo(type, nodeConfig[type]);
  return acc;
}, {});

/**
 * Collection of icon components for all node types.
 * Used for visual representation in the node palette and diagrams.
 */
export const elementIcons = Object.keys(nodeConfig).reduce((acc, type) => {
  acc[type] = nodeConfig[type].icon;
  return acc;
}, {});
