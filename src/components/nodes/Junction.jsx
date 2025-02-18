import React, { useLayoutEffect, useMemo } from 'react';
import { useNodeContext } from '../../context/NodeContext';
import BaseCustomNode from './BaseCustomNode';
import { BsLightningFill } from 'react-icons/bs';
import { createElementInfo } from './nodeUtils';
import { useUpdateNodeInternals } from 'reactflow';
export const elementIcon = BsLightningFill;

/**
 * Configuration object for the Junction element.
 * Defines the element type, display name, ports, category and configurable parameters.
 */
export const elementInfo = createElementInfo({
  type: 'Junction',
  displayName: 'Junction',
  category: 'Dynamic Port Elements',
  // Ports are dynamically created based on user input parameters
  ports: {
    target: [],
    source: [],
  },
  parameters: {
    label: {
      defaultValue: 'Junction',
    },
    leftPorts: {
      label: 'Left Ports',
      type: 'number',
      defaultValue: 2,
      min: 1,
      step: 1,
      category: 'Ports',
      description: 'Number of left ports',
    },
    rightPorts: {
      label: 'Right Ports',
      type: 'number',
      defaultValue: 1,
      min: 1,
      step: 1,
      category: 'Ports',
      description: 'Number of right ports',
    },
  },
});

/**
 * Junction component that represents a node with configurable number of input and output ports.
 *
 * @param {string} id - Unique identifier for the node
 * @param {Object} data - Node data containing parameters and state
 * @param {boolean} selected - Whether the node is currently selected
 * @param {string} type - Type of the node
 * @returns {React.Component} Junction node component
 */
const Junction = ({ id, selected, type }) => {
  const {
    edges,
    setEdges,
    nodeStates,
    editingStates,
    startEditing: contextStartEditing,
    onChange: contextOnChange,
    onKeyDown: contextOnKeyDown,
    finishEditing: contextFinishEditing,
  } = useNodeContext();

  const updateNodeInternals = useUpdateNodeInternals();

  const nodeState = nodeStates[id];
  const editingState = editingStates[id] || { isEditing: false, tempLabel: '' };

  // Get the number of ports from parameters with better error handling
  const leftPortCount = (() => {
    if (!nodeState?.parameters?.leftPorts) return 2; // Default value
    const parsed = parseInt(nodeState.parameters.leftPorts, 10);
    return isNaN(parsed) ? 2 : Math.max(1, parsed); // Ensure minimum of 1 port
  })();

  const rightPortCount = (() => {
    if (!nodeState?.parameters?.rightPorts) return 1; // Default value
    const parsed = parseInt(nodeState.parameters.rightPorts, 10);
    return isNaN(parsed) ? 1 : Math.max(1, parsed); // Ensure minimum of 1 port
  })();

  // Generate automatic port IDs with validation
  const leftPorts = useMemo(
    () => Array.from({ length: leftPortCount }, (_, index) => `${index}`),
    [leftPortCount]
  );

  const rightPorts = useMemo(
    () => Array.from({ length: rightPortCount }, (_, index) => `${leftPortCount + index}`),
    [rightPortCount, leftPortCount]
  );

  // Effect to manage edges when port configuration changes
  useLayoutEffect(() => {
    if (!nodeState || !edges) {
      return;
    }

    try {
      let needsUpdate = false;
      const currentEdges = [...edges];

      // Get all edges connected to this node
      const nodeEdges = currentEdges.filter((edge) => edge.source === id || edge.target === id);

      // Separate edges by port side (left/target and right/source)
      const leftEdges = nodeEdges.filter((edge) => edge.target === id);
      const rightEdges = nodeEdges.filter((edge) => edge.source === id);

      // Create new edges array starting with edges not connected to this node
      const newEdges = currentEdges.filter((edge) => edge.source !== id && edge.target !== id);

      // Helper to update edge handle IDs with validation
      const createNewEdge = (edge, portId) => {
        if (!edge || !edge.id || !portId) return null;
        const newSourceHandle = edge.source === id ? `${id}-port-${portId}` : edge.sourceHandle;
        const newTargetHandle = edge.target === id ? `${id}-port-${portId}` : edge.targetHandle;

        // Only mark for update if handles actually changed
        if (newSourceHandle !== edge.sourceHandle || newTargetHandle !== edge.targetHandle) {
          needsUpdate = true;
        }

        return {
          ...edge,
          sourceHandle: newSourceHandle,
          targetHandle: newTargetHandle,
        };
      };

      // Keep as many left (target) edges as possible
      leftEdges.slice(0, leftPortCount).forEach((edge, index) => {
        const newEdge = createNewEdge(edge, leftPorts[index]);
        if (newEdge) {
          newEdges.push(newEdge);
        }
      });

      // Keep as many right (source) edges as possible
      rightEdges.slice(0, rightPortCount).forEach((edge, index) => {
        const newEdge = createNewEdge(edge, rightPorts[index]);
        if (newEdge) {
          newEdges.push(newEdge);
        }
      });

      // Update edges ONLY if actual changes were made
      if (needsUpdate) {
        setEdges(newEdges);
      }

      // Always update node internals to ensure proper rendering
      updateNodeInternals(id);
    } catch (error) {
      console.error('Error updating Junction edges:', error);
    }
  }, [
    leftPortCount,
    rightPortCount,
    leftPorts,
    rightPorts,
    id,
    nodeState,
    updateNodeInternals,
    edges,
    setEdges,
  ]);

  if (!nodeState) {
    return null;
  }

  return (
    <BaseCustomNode
      id={id}
      data={{
        label: nodeState.parameters.label,
        isEditing: editingState.isEditing,
        tempLabel: editingState.tempLabel,
        onChange: (e) => contextOnChange(id, e),
        onKeyDown: (e) => contextOnKeyDown(id, e),
        finishEditing: () => contextFinishEditing(id),
        startEditing: () => contextStartEditing(id),
      }}
      selected={selected}
      type={type}
      ports={{
        target: leftPorts,
        source: rightPorts,
      }}
    />
  );
};

export default Junction;
