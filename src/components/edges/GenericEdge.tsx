import React, { memo, useMemo } from 'react';
import { BaseEdge, type EdgeProps } from 'reactflow';
import { useAppearanceState, useLayoutState } from '../../context/AppStateContext';
import { useGraphStore } from '../../store/graphStore';
import EdgeMidpointMarker from './EdgeMidpointMarker';
import { computeEdgePathGeometry } from './edge-path-utils';

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
  selected = false,
  style = {},
}: EdgeProps) => {
  const { edgePathStyle } = useLayoutState();
  const { showEdgeBadges, showSolverIndices } = useAppearanceState();
  const edgeState = useGraphStore((s) => s.edgeStates[id]);
  const solverIndex = edgeState?.parameters?.solverIndex;
  const indexLabel = showSolverIndices && typeof solverIndex === 'number' ? solverIndex : undefined;

  const {
    path: edgePath,
    labelX,
    labelY,
  } = useMemo(
    () =>
      computeEdgePathGeometry(
        { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition },
        edgePathStyle
      ),
    [edgePathStyle, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition]
  );

  return (
    <>
      <BaseEdgeStyled id={id} path={edgePath} className="custom-edge" style={style} />
      {(showEdgeBadges || indexLabel !== undefined) && (
        <EdgeMidpointMarker
          labelX={labelX}
          labelY={labelY}
          selected={selected}
          indexLabel={indexLabel}
        />
      )}
    </>
  );
};

export default memo(GenericEdge);
