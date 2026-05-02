import React, { useCallback } from 'react';
import { useReactFlow } from '../../context/ReactFlowContext';
import { useNodeContext } from '../../context/NodeContext';
import { getLayoutedElements } from '../../utils/layoutUtils';
import { IoGitNetwork } from 'react-icons/io5';

const LayoutButton = () => {
  const { reactFlowInstance } = useReactFlow();
  const { nodes, edges, onNodesChange } = useNodeContext();

  const onLayout = useCallback(() => {
    if (!reactFlowInstance) return;

    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges);

    const changes = layoutedNodes.map((node) => ({
      type: 'position' as const,
      id: node.id,
      position: node.position,
    }));

    onNodesChange(changes);

    const { x, y, zoom } = reactFlowInstance.getViewport();
    reactFlowInstance.setViewport({ x, y, zoom });
  }, [nodes, edges, reactFlowInstance, onNodesChange]);

  return (
    <button type="button" onClick={onLayout} className="control-button" title="Auto Layout">
      <IoGitNetwork />
    </button>
  );
};

export default LayoutButton;
