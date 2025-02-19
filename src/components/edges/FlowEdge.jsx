import React from 'react';
import { useNodeContext } from '../../context/NodeContext';
import BaseCustomEdge from './BaseCustomEdge';
import { createEdgeInfo } from './edgeUtils';

/**
 * Configuration object for the FlowEdge element.
 * Defines an edge that represents fluid flow between nodes.
 */
export const elementInfo = createEdgeInfo({
  type: 'FlowEdge',
  displayName: 'Flow Edge',
  category: 'Flow Connections',
  parameters: {
    area: {
      label: 'Area',
      type: 'float',
      defaultValue: 1.0,
      unit: 'm^2',
      category: 'Flow Properties',
      description: 'Cross-sectional area of the flow path',
      editable: false,
      visible: true,
    },
  },
});

/**
 * FlowEdge component representing a fluid flow connection between nodes.
 * Extends BaseCustomEdge with flow-specific parameters and visualization.
 *
 * @param {Object} props - Component props inherited from BaseCustomEdge
 * @returns {React.Component} FlowEdge component
 */
const FlowEdge = (props) => {
  const { edgeStates } = useNodeContext();
  const edgeState = edgeStates[props.id];

  if (!edgeState) {
    return null;
  }

  // For now, we just pass through to BaseCustomEdge
  // Later we can add flow-specific visualizations
  return <BaseCustomEdge {...props} />;
};

export default FlowEdge;
