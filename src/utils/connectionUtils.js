import { debugLog } from '../utils/debug';

/**
 * For a given node, validates if all edges connected to it have the same area as the proposed connection.
 *
 * @param {string} nodeId - ID of the node to check
 * @param {number} connectionArea - Area value of the proposed connection
 * @param {Object} connection - The connection to validate (can be a new connection or existing edge)
 * @param {Array} edges - Array of all edges in the flow
 * @param {Object} edgeStates - States of all edges
 * @returns {Object} Validation result with isValid and reason properties
 */
const validateNodeAreaChange = (
  nodeId,
  connection,
  connectionArea,
  edges = [],
  edgeStates = {}
) => {
  // Ensure edges is an array
  const edgesArray = Array.isArray(edges) ? edges : [];

  // Find all edges connected to the node
  const connectedEdges = edgesArray.filter(
    (edge) => edge.source === nodeId || edge.target === nodeId
  );

  // If node has no other connected edges, validation always passes
  if (connectedEdges.length === 0) {
    debugLog(`Node ${nodeId} has no connected edges, validation passes`);
    return {
      isValid: true,
      reason: null,
    };
  }

  // For existing edges (during parameter change), we need to exclude the current edge
  // For new connections (during connection validation), we include all edges
  const referenceEdges = connection.id
    ? connectedEdges.filter((edge) => edge.id !== connection.id) // Existing edge case
    : connectedEdges; // New connection case

  // If we're validating an existing edge and it's the only connection, validation passes
  if (connection.id && referenceEdges.length === 0) {
    debugLog(`Node ${nodeId} has only the current edge connected, validation passes`);
    return {
      isValid: true,
      reason: null,
    };
  }

  // Get the areas of the reference edges from the edge states
  const connectedEdgeAreas = referenceEdges.map((edge) => edgeStates[edge.id]?.parameters?.area);

  // Display an error message if connectedEdgeAreas already contains different values
  if (connectedEdgeAreas.some((edgeArea) => edgeArea !== connectedEdgeAreas[0])) {
    debugLog(
      `Connected edge areas ${connectedEdgeAreas} are different from each other for node ${nodeId}`
    );
  }

  // Check if any connected edge has a different area
  if (connectedEdgeAreas.some((edgeArea) => edgeArea !== connectionArea)) {
    debugLog(
      `Area constraint validation failed for node ${nodeId}: connected edges have different areas`
    );
    return {
      isValid: false,
      reason: `Node ${nodeId} does not allow area change`,
    };
  }

  debugLog(`Area constraint validation passed for node ${nodeId}`);
  return {
    isValid: true,
    reason: null,
  };
};

/**
 * For a given connection, validates if all edges connected to the source and target nodes have the same
 * area as the proposed connection.
 *
 * @param {Object} connection - Connection parameters
 * @param {Object} sourceNode - Source node
 * @param {Object} targetNode - Target node
 * @param {Object} sourceNodeState - State of source node
 * @param {Object} targetNodeState - State of target node
 * @param {Object} connectionContext - Context for the connection
 * @param {Array} edges - Array of all edges
 * @param {Object} edgeStates - States of all edges
 * @returns {Object} Validation result with isValid and reason properties
 */
export const validateConnectionAreaChange = (
  connection,
  sourceNode,
  targetNode,
  sourceNodeState,
  targetNodeState,
  connectionContext,
  edges,
  edgeStates
) => {
  // Check if the connection has an area value
  if (!connectionContext.parameters.area) {
    debugLog('Connection validation failed: No area value assigned to the connection');
    return {
      isValid: false,
      reason: connectionContext.metadata.error || 'No area value assigned to the connection',
    };
  }

  // Check source node's area constraints if it doesn't allow area change
  if (!sourceNodeState.parameters.allowsAreaChange) {
    const sourceValidation = validateNodeAreaChange(
      sourceNode.id,
      connection,
      connectionContext.parameters.area,
      edges,
      edgeStates
    );
    if (!sourceValidation.isValid) {
      return sourceValidation;
    }
  }

  // Check target node's area constraints if it doesn't allow area change
  if (!targetNodeState.parameters.allowsAreaChange) {
    const targetValidation = validateNodeAreaChange(
      targetNode.id,
      connection,
      connectionContext.parameters.area,
      edges,
      edgeStates
    );
    if (!targetValidation.isValid) {
      return targetValidation;
    }
  }

  // If the source node has "minimumAreaRatio" and "maximumAreaRatio" parameters set, we need to check if the new edge has an area ratio within the allowed range
  if (sourceNodeState.parameters.minimumAreaRatio && sourceNodeState.parameters.maximumAreaRatio) {
    // Find the edge where this node is the target if exists
    const otherEdge = edges.find(
      (edge) => edge.target === sourceNode.id && edge.id !== connection.id
    );
    if (otherEdge) {
      const areaRatio =
        connectionContext.parameters.area / edgeStates[otherEdge.id].parameters.area;
      debugLog(`Area ratio is ${sourceNode.id}: ${areaRatio}`);
      if (
        areaRatio < sourceNodeState.parameters.minimumAreaRatio ||
        areaRatio > sourceNodeState.parameters.maximumAreaRatio
      ) {
        return {
          isValid: false,
          reason: `Area ratio is outside the allowed range (${sourceNodeState.parameters.minimumAreaRatio} - ${sourceNodeState.parameters.maximumAreaRatio})`,
        };
      }
    }
  }

  // If SuddenExpansion is the source node, we need to check if the new edge has a larger area than the other edge
  if (targetNodeState.parameters.minimumAreaRatio && targetNodeState.parameters.maximumAreaRatio) {
    // Find the edge where this node is the source if exists
    const otherEdge = edges.find(
      (edge) => edge.source === targetNode.id && edge.id !== connection.id
    );
    if (otherEdge) {
      const areaRatio =
        edgeStates[otherEdge.id].parameters.area / connectionContext.parameters.area;
      debugLog(`Area ratio is ${targetNode.id}: ${areaRatio}`);
      if (
        areaRatio < targetNodeState.parameters.minimumAreaRatio ||
        areaRatio > targetNodeState.parameters.maximumAreaRatio
      ) {
        return {
          isValid: false,
          reason: `Area ratio is outside the allowed range (${targetNodeState.parameters.minimumAreaRatio} - ${targetNodeState.parameters.maximumAreaRatio})`,
        };
      }
    }
  }

  debugLog('New edge satisfies area change constraints');
  return {
    isValid: true,
    reason: null,
  };
};

/**
 * Assigns area values to a connection based on source and target node properties.
 *
 * @param {Object} connection - Connection parameters
 * @param {Object} sourceNode - Source node
 * @param {Object} targetNode - Target node
 * @param {Object} sourceNodeState - State of source node
 * @param {Object} targetNodeState - State of target node
 * @param {Object} connectionContext - Context for the connection
 */

/**
 * Assigns area values to a connection if any of the source or target nodes provide an area value.
 *
 * @param {Object} connection - Connection parameters
 * @param {Object} sourceNode - Source node
 * @param {Object} targetNode - Target node
 * @param {Object} sourceNodeState - State of source node
 * @param {Object} targetNodeState - State of target node
 * @param {Object} connectionContext - Context for the connection
 */
export const assignConnectionArea = (
  _connection,
  sourceNode,
  targetNode,
  sourceNodeState,
  targetNodeState,
  connectionContext
) => {
  const sourceArea = sourceNodeState.parameters.area;
  const targetArea = targetNodeState.parameters.area;
  const sourceProvidesArea = sourceNodeState.parameters.providesArea;
  const targetProvidesArea = targetNodeState.parameters.providesArea;

  // Case 1: Target node provides area but source node does not
  if (targetProvidesArea && !sourceProvidesArea) {
    connectionContext.parameters.area = targetArea;
    debugLog(
      `Assigned area value ${targetArea} from target node ${targetNode.id} to connection context`
    );
    return;
  }

  // Case 2: Source node provides area but target node does not
  if (sourceProvidesArea && !targetProvidesArea) {
    connectionContext.parameters.area = sourceArea;
    debugLog(
      `Assigned area value ${sourceArea} from source node ${sourceNode.id} to connection context`
    );
    return;
  }

  // Case 3: Both nodes provide area values
  if (targetProvidesArea && sourceProvidesArea) {
    if (sourceArea !== targetArea) {
      debugLog(
        `Multiple nodes are providing mismatching area values: ${sourceArea} !== ${targetArea}`
      );
      connectionContext.metadata.error = 'Mismatching area values from both nodes providing area';
    } else {
      connectionContext.parameters.area = sourceArea;
      debugLog(`Assigned matching area value ${sourceArea} from both nodes to connection context`);
    }
    return;
  }

  // Case 4: None of them is providing an area value
  debugLog('No node is providing an area value for connection');
  connectionContext.metadata.error = 'No node is providing an area value for connection';
};
