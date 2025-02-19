import React, { useLayoutEffect, useMemo } from 'react';
import { useNodeContext } from '../../context/NodeContext';
import BaseCustomNode from './BaseCustomNode';
import { BsLightningFill } from 'react-icons/bs';
import { createElementInfo } from './nodeUtils';
import { useUpdateNodeInternals } from 'reactflow';
import { debugLog } from '../../utils/debug';

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
    if (!nodeState?.parameters?.leftPorts) {
      debugLog(`[${id}] Using default left port count: 2`);
      return 2; // Default value
    }
    const parsed = parseInt(nodeState.parameters.leftPorts, 10);
    const finalCount = isNaN(parsed) ? 2 : Math.max(1, parsed);
    if (finalCount !== parsed) {
      debugLog(`[${id}] Adjusted left port count from ${parsed} to ${finalCount}`);
    }
    return finalCount;
  })();

  const rightPortCount = (() => {
    if (!nodeState?.parameters?.rightPorts) {
      debugLog(`[${id}] Using default right port count: 1`);
      return 1; // Default value
    }
    const parsed = parseInt(nodeState.parameters.rightPorts, 10);
    const finalCount = isNaN(parsed) ? 1 : Math.max(1, parsed);
    if (finalCount !== parsed) {
      debugLog(`[${id}] Adjusted right port count from ${parsed} to ${finalCount}`);
    }
    return finalCount;
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
      let handlesUpdated = 0;
      const currentEdges = [...edges];

      // Step 1: Filter out edges connected to ports that will no longer exist
      const newEdges = currentEdges.filter((edge) => {
        // Skip edges not connected to this node
        if (edge.source !== id && edge.target !== id) return true;

        let portMatch;
        let portNumber;
        let keepEdge = true;

        // Check source (right) port
        if (edge.source === id) {
          portMatch = edge.sourceHandle?.match(/-port-(\d+)$/);
          if (!portMatch) {
            debugLog(`[${id}] Invalid source handle format: ${edge.sourceHandle}`);
            return true;
          }
          portNumber = parseInt(portMatch[1], 10);
          // Port number should be in the right port range
          keepEdge = portNumber >= leftPortCount && portNumber < leftPortCount + rightPortCount;
        }
        // Check target (left) port
        else if (edge.target === id) {
          portMatch = edge.targetHandle?.match(/-port-(\d+)$/);
          if (!portMatch) {
            debugLog(`[${id}] Invalid target handle format: ${edge.targetHandle}`);
            return true;
          }
          portNumber = parseInt(portMatch[1], 10);
          // Port number should be in the left port range
          keepEdge = portNumber < leftPortCount;
        }

        if (!keepEdge) {
          edgesRemoved++;
          needsUpdate = true;
        }
        return keepEdge;
      });

      // Step 2: Update remaining edges if their handles need to change
      newEdges.forEach((edge) => {
        let updated = false;
        let newEdge = { ...edge };

        // Update source (right) port handle if needed
        if (edge.source === id) {
          const portMatch = edge.sourceHandle?.match(/-port-(\d+)$/);
          if (portMatch) {
            const portNumber = parseInt(portMatch[1], 10);
            const newSourceHandle = `${id}-port-${portNumber}`;
            if (newSourceHandle !== edge.sourceHandle) {
              newEdge.sourceHandle = newSourceHandle;
              updated = true;
            }
          }
        }
        // Update target (left) port handle if needed
        else if (edge.target === id) {
          const portMatch = edge.targetHandle?.match(/-port-(\d+)$/);
          if (portMatch) {
            const portNumber = parseInt(portMatch[1], 10);
            const newTargetHandle = `${id}-port-${portNumber}`;
            if (newTargetHandle !== edge.targetHandle) {
              newEdge.targetHandle = newTargetHandle;
              updated = true;
            }
          }
        }

        if (updated) {
          handlesUpdated++;
          needsUpdate = true;
          const edgeIndex = newEdges.findIndex((e) => e.id === edge.id);
          if (edgeIndex !== -1) {
            newEdges[edgeIndex] = newEdge;
          }
        }
      });

      // Step 3: Update edge state and node internals
      if (needsUpdate) {
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
      console.error('Error updating Junction edges:', error);
    }
  }, [leftPortCount, rightPortCount, id, nodeState, updateNodeInternals, edges, setEdges]);

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
        target: leftPorts,
        source: rightPorts,
      }}
    />
  );
};

export default Junction;
