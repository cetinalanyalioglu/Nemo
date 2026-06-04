import type { NodeTypes, EdgeTypes } from 'reactflow';
import type { RuntimeModel } from './model-builder';

type StableTypeMaps = {
  nodeTypes: NodeTypes;
  edgeTypes: EdgeTypes;
};

const stableTypeMapsByModelId = new Map<string, StableTypeMaps>();

/**
 * Reuses nodeTypes/edgeTypes object references per model id so React Flow does
 * not treat them as new maps on every fetch or provider re-render.
 */
export const withStableTypeMaps = (runtimeModel: RuntimeModel): RuntimeModel => {
  const cached = stableTypeMapsByModelId.get(runtimeModel.id);
  if (cached) {
    return {
      ...runtimeModel,
      nodeTypes: cached.nodeTypes,
      edgeTypes: cached.edgeTypes,
    };
  }

  stableTypeMapsByModelId.set(runtimeModel.id, {
    nodeTypes: runtimeModel.nodeTypes,
    edgeTypes: runtimeModel.edgeTypes,
  });
  return runtimeModel;
};
