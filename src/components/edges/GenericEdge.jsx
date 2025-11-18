import React from 'react';
import { BaseEdge, getBezierPath } from 'reactflow';
import PropTypes from 'prop-types';

/**
 * Base configuration object that defines common properties for all edges.
 * Generic parameters that all edges should have.
 */
export const baseEdgeInfo = {
  parameters: {
    solverIndex: {
      label: 'Solver Index',
      type: 'number',
      defaultValue: undefined,
      category: 'Connectivity',
      description: 'Index used by the network solver',
      editable: false,
      visible: true,
    },
  },
};

/**
 * GenericEdge is a universal component for all edge types in the flow diagram.
 * It provides basic edge rendering with bezier curves and maintains compatibility with ReactFlow.
 *
 * @component
 * @param {Object} props - Component props
 * @param {string} props.id - Unique identifier for the edge
 * @param {Object} props.sourceX - Source node X coordinate
 * @param {Object} props.sourceY - Source node Y coordinate
 * @param {Object} props.targetX - Target node X coordinate
 * @param {Object} props.targetY - Target node Y coordinate
 * @param {string} props.sourcePosition - Source port position ('top', 'right', 'bottom', 'left')
 * @param {string} props.targetPosition - Target port position ('top', 'right', 'bottom', 'left')
 * @param {boolean} props.selected - Whether the edge is currently selected
 * @param {Object} props.style - Custom style object for the edge
 */
const GenericEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  // eslint-disable-next-line no-unused-vars
  selected: _selected, // Intentionally unused - kept for ReactFlow API compatibility
  style = {},
}) => {
  // Get the path for the edge using ReactFlow's bezier path generator
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} className="custom-edge" style={style} />
    </>
  );
};

GenericEdge.propTypes = {
  id: PropTypes.string.isRequired,
  sourceX: PropTypes.number.isRequired,
  sourceY: PropTypes.number.isRequired,
  targetX: PropTypes.number.isRequired,
  targetY: PropTypes.number.isRequired,
  sourcePosition: PropTypes.string.isRequired,
  targetPosition: PropTypes.string.isRequired,
  selected: PropTypes.bool,
  style: PropTypes.object,
};

export default GenericEdge;
