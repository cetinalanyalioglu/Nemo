import React, { memo, useMemo } from 'react';
import { BaseEdge, type EdgeProps } from 'reactflow';
import { useAppearanceState, useLayoutState } from '../../context/AppStateContext';
import { useGraphStore } from '../../store/graphStore';
import { useDataStore, useElementDataView, formatDataValue } from '../../store/dataStore';
import EdgeMidpointMarker from './EdgeMidpointMarker';
import { computeEdgePathGeometry, EDGE_MIDPOINT_MARKER_RADIUS } from './edge-path-utils';

const BaseEdgeStyled = BaseEdge as React.ComponentType<
  React.ComponentProps<typeof BaseEdge> & { className?: string }
>;

/**
 * Base configuration object that defines common properties for all edges.
 * Generic parameters that all edges should have.
 */
export const baseEdgeInfo = {
  parameters: {
    index: {
      label: 'Index',
      type: 'number',
      defaultValue: undefined,
      category: 'Connectivity',
      description: 'Sequential index assigned to this element',
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
  const { showEdgeBadges, showIndices } = useAppearanceState();
  const edgeState = useGraphStore((s) => s.edgeStates[id]);
  const elementIndex = edgeState?.parameters?.index;
  const indexLabel = showIndices && typeof elementIndex === 'number' ? elementIndex : undefined;

  // Data visualization: color the midpoint badge by the active edge dataset and
  // optionally print the value below it.
  const dataIndex = typeof elementIndex === 'number' ? elementIndex : undefined;
  const dataView = useElementDataView('edge', dataIndex);
  const showContour = useDataStore((s) => s.showContour);
  const showValues = useDataStore((s) => s.edgeDisplay.showValues);
  const precision = useDataStore((s) => s.edgeDisplay.precision);
  const notation = useDataStore((s) => s.edgeDisplay.notation);
  const fillColor = showContour ? dataView.color : null;
  const valueLabel =
    showValues && dataView.value !== undefined
      ? formatDataValue(dataView.value, precision, notation, dataView.unit)
      : undefined;

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
      {showEdgeBadges && (
        <EdgeMidpointMarker
          labelX={labelX}
          labelY={labelY}
          selected={selected}
          indexLabel={indexLabel}
          fillColor={fillColor}
        />
      )}
      {/* Value label is independent of the badge: when the badge is shown it sits
          just below it, otherwise it sits centered on the edge midpoint. */}
      {valueLabel !== undefined && (
        <text
          className="edge-value-label"
          x={labelX}
          y={showEdgeBadges ? labelY + EDGE_MIDPOINT_MARKER_RADIUS + 4 : labelY}
          textAnchor="middle"
          dominantBaseline={showEdgeBadges ? 'hanging' : 'central'}
        >
          {valueLabel}
        </text>
      )}
    </>
  );
};

export default memo(GenericEdge);
