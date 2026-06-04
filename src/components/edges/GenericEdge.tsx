import React, { memo } from 'react';
import {
  BaseEdge,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  getSimpleBezierPath,
} from 'reactflow';
import type { EdgeProps } from 'reactflow';
import { useLayoutState } from '../../context/AppStateContext';

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
 * It provides basic edge rendering and maintains compatibility with ReactFlow.
 * The edge path style is controlled by the global layout setting.
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
  const { edgePathStyle } = useLayoutState();

  const pathArgs = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };

  let edgePath: string;
  if (edgePathStyle === 'straight') {
    [edgePath] = getStraightPath(pathArgs);
  } else if (edgePathStyle === 'smoothstep') {
    [edgePath] = getSmoothStepPath(pathArgs);
  } else if (edgePathStyle === 'simplebezier') {
    [edgePath] = getSimpleBezierPath(pathArgs);
  } else {
    [edgePath] = getBezierPath(pathArgs);
  }

  return (
    <>
      <BaseEdgeStyled id={id} path={edgePath} className="custom-edge" style={style} />
    </>
  );
};

export default memo(GenericEdge);
