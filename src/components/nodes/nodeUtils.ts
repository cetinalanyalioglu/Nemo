import { baseElementInfo } from './GenericNode';
import type { ElementInfoEntry } from '../../types/flow';

/**
 * Deep merges two elementInfo objects, with the specific node's configuration taking precedence.
 */
export const mergeWithBaseElementInfo = (nodeElementInfo: ElementInfoEntry): ElementInfoEntry => {
  const mergedInfo = { ...baseElementInfo } as ElementInfoEntry;

  mergedInfo.parameters = JSON.parse(JSON.stringify(mergedInfo.parameters));
  mergedInfo.ports = JSON.parse(JSON.stringify(mergedInfo.ports));

  mergedInfo.parameters = Object.keys(nodeElementInfo.parameters || {}).reduce(
    (acc, paramKey) => {
      if (acc[paramKey]) {
        acc[paramKey] = {
          ...acc[paramKey],
          ...(nodeElementInfo.parameters[paramKey] || {}),
        };
      } else {
        acc[paramKey] = nodeElementInfo.parameters[paramKey];
      }
      return acc;
    },
    { ...mergedInfo.parameters }
  );

  mergedInfo.ports = {
    target: [...mergedInfo.ports.target, ...(nodeElementInfo.ports?.target || [])],
    source: [...mergedInfo.ports.source, ...(nodeElementInfo.ports?.source || [])],
  };

  return {
    ...mergedInfo,
    ...nodeElementInfo,
    parameters: mergedInfo.parameters,
    ports: mergedInfo.ports,
  };
};

export const createElementInfo = (config: ElementInfoEntry): ElementInfoEntry => {
  return mergeWithBaseElementInfo(config);
};
