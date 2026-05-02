import GenericNode, { baseElementInfo } from './GenericNode';
import { nodeConfig } from '../../config/nodeConfig';
import type { ElementInfoEntry } from '../../types/flow';

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

const createElementInfo = (
  type: string,
  config: (typeof nodeConfig)[string]
): ElementInfoEntry => ({
  ...baseElementInfo,
  type,
  displayName: config.displayName,
  category: config.category,
  parameters: mergeParameters(
    baseElementInfo.parameters as unknown as Record<string, Record<string, unknown>>,
    config.customParameters as Record<string, Record<string, unknown>>
  ) as ElementInfoEntry['parameters'],
  ports: config.ports,
  dynamicPorts: config.dynamicPorts || false,
  icon: config.icon,
});

export const nodeTypes = {
  MassFlowInlet: GenericNode,
  PressureOutlet: GenericNode,
  LosslessDuct: GenericNode,
  SuddenExpansion: GenericNode,
  LosslessSplitter: GenericNode,
  Junction: GenericNode,
};

export const elementInfo: Record<string, ElementInfoEntry> = (
  Object.keys(nodeConfig) as Array<keyof typeof nodeConfig>
).reduce(
  (acc, typeKey) => {
    const typeStr = String(typeKey);
    acc[typeStr] = createElementInfo(typeStr, nodeConfig[typeKey]);
    return acc;
  },
  {} as Record<string, ElementInfoEntry>
);

export const elementIcons: Record<string, ElementInfoEntry['icon']> = (
  Object.keys(nodeConfig) as Array<keyof typeof nodeConfig>
).reduce(
  (acc, typeKey) => {
    const typeStr = String(typeKey);
    acc[typeStr] = nodeConfig[typeKey].icon;
    return acc;
  },
  {} as Record<string, ElementInfoEntry['icon']>
);
