import React from 'react';
import { BaseEdge, getBezierPath } from 'reactflow';
import type { EdgeProps } from 'reactflow';

const BaseEdgeStyled = BaseEdge as React.ComponentType<
  React.ComponentProps<typeof BaseEdge> & { className?: string }
>;

/**
 * Base configuration object that defines common properties for all edges.
 * Generic parameters that all edges should have.
 */
export const baseEdgeInfo = {
  parameters: {
    solverIndex: {
      label: 'Index',
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
  selected: _selected,
  style = {},
}: EdgeProps) => {
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
      <BaseEdgeStyled id={id} path={edgePath} className="custom-edge" style={style} />
    </>
  );
};

export default GenericEdge;
