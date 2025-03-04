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

    // Create change objects for each node's position
    const changes = layoutedNodes.map((node) => ({
      type: 'position',
      id: node.id,
      position: node.position,
    }));

    // Apply all position changes
    onNodesChange(changes);

    // Maintain viewport
    const { x, y, zoom } = reactFlowInstance.getViewport();
    reactFlowInstance.setViewport({ x, y, zoom });
  }, [nodes, edges, reactFlowInstance, onNodesChange]);

  return (
    <button onClick={onLayout} className="control-button" title="Auto Layout">
      <IoGitNetwork />
    </button>
  );
};

export default LayoutButton;
