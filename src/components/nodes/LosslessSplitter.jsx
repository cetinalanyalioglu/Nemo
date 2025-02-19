import React, { useLayoutEffect, useMemo } from 'react';
import { useNodeContext } from '../../context/NodeContext';
import BaseCustomNode from './BaseCustomNode';
import { BsDiagram2 } from 'react-icons/bs';
import { createElementInfo } from './nodeUtils';
import { useUpdateNodeInternals } from 'reactflow';
import { debugLog } from '../../utils/debug';

export const elementIcon = BsDiagram2;

/**
 * Configuration object for the LosslessSplitter element.
 * Defines a component that splits a flow into two outputs without energy losses.
 * Contains fixed configuration of one input port and two output ports.
 */
export const elementInfo = createElementInfo({
  type: 'LosslessSplitter',
  displayName: 'Lossless Splitter',
  category: 'Dynamic Port Elements',
  ports: {
    target: ['0'], // Fixed single input port
    source: [], // Dynamic output ports
  },
  parameters: {
    label: {
      defaultValue: 'LosslessSplitter',
    },
    rightPorts: {
      label: 'Output Ports',
      type: 'number',
      defaultValue: 2,
      min: 2,
      step: 1,
      category: 'Ports',
      description: 'Number of output ports',
    },
  },
});

/**
 * LosslessSplitter component representing a flow splitter with no energy losses.
 * Splits an input flow into two output flows while maintaining conservation laws.
 *
 * @param {string} id - Unique identifier for the node
 * @param {Object} data - Node data containing parameters and state
 * @param {boolean} selected - Whether the node is currently selected
 * @param {string} type - Type of the node
 * @returns {React.Component} LosslessSplitter node component
 */
const LosslessSplitter = ({ id, selected, type }) => {
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

  // Get the number of right ports from parameters with better error handling
  const rightPortCount = (() => {
    if (!nodeState?.parameters?.rightPorts) {
      debugLog(`[${id}] Using default port count: 2`);
      return 2; // Default value
    }
    const parsed = parseInt(nodeState.parameters.rightPorts, 10);
    const finalCount = isNaN(parsed) ? 2 : Math.max(2, parsed);
    if (finalCount !== parsed) {
      debugLog(`[${id}] Adjusted port count from ${parsed} to ${finalCount}`);
    }
    return finalCount; // Ensure minimum of 2 ports
  })();

  // Generate automatic port IDs for the right side with validation
  const rightPorts = useMemo(() => {
    const ports = Array.from({ length: rightPortCount }, (_, index) => `${index + 1}`);
    return ports;
  }, [rightPortCount]);

  /**
   * Effect hook to manage edge connections when port configuration changes.
   * This handles:
   * 1. Removing edges for ports that no longer exist
   * 2. Maintaining existing edge connections for remaining ports
   * 3. Updating React Flow's internal node state
   */
  useLayoutEffect(() => {
    if (!nodeState || !edges) return;

    try {
      let needsUpdate = false;
      let edgesRemoved = 0;
      const currentEdges = [...edges];

      // Step 1: Filter out edges connected to ports that will no longer exist
      const newEdges = currentEdges.filter((edge) => {
        // Keep edges not connected to this node
        if (edge.source !== id) return true;

        const portMatch = edge.sourceHandle?.match(/-port-(\d+)$/);
        if (!portMatch) {
          // Only log invalid handles that belong to this node
          debugLog(`[${id}] Invalid handle format: ${edge.sourceHandle}`);
          return true;
        }

        // Check if the port number is within the new port count
        const portNumber = parseInt(portMatch[1], 10);
        const keepEdge = portNumber <= rightPortCount;
        if (!keepEdge) {
          edgesRemoved++;
          needsUpdate = true;
        }
        return keepEdge;
      });

      // Step 2: Update remaining edges if their handles need to change
      const remainingRightEdges = newEdges.filter((edge) => edge.source === id);
      let handlesUpdated = 0;

      remainingRightEdges.forEach((edge) => {
        const portMatch = edge.sourceHandle?.match(/-port-(\d+)$/);
        if (!portMatch) return;

        const portNumber = portMatch[1];
        const newSourceHandle = `${id}-port-${portNumber}`;

        if (newSourceHandle !== edge.sourceHandle) {
          handlesUpdated++;
          needsUpdate = true;
          const edgeIndex = newEdges.findIndex((e) => e.id === edge.id);
          if (edgeIndex !== -1) {
            newEdges[edgeIndex] = {
              ...edge,
              sourceHandle: newSourceHandle,
            };
          }
        }
      });

      // Step 3: Update edge state and node internals
      if (needsUpdate) {
        // Only log when actual changes occur
        if (edgesRemoved > 0) {
          debugLog(`[${id}] Removed ${edgesRemoved} edges due to port reduction`);
        }
        if (handlesUpdated > 0) {
          debugLog(`[${id}] Updated ${handlesUpdated} edge handles`);
        }
        setEdges(newEdges);
      }
      updateNodeInternals(id);
    } catch (error) {
      debugLog(`[${id}] Error in edge management: ${error.message}`);
      console.error('Error updating LosslessSplitter edges:', error);
    }
  }, [rightPortCount, rightPorts, id, nodeState, updateNodeInternals, edges, setEdges]);

  // If the node state is not available, render nothing. This triggers during deletion.
  if (!nodeState) return null;

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
        target: ['0'],
        source: rightPorts,
      }}
    />
  );
};

export default LosslessSplitter;
