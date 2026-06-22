import React, { memo, useMemo } from 'react';
import { BaseEdge, type EdgeProps } from 'reactflow';
import { useAppearanceState, useLayoutState } from '../../context/AppStateContext';
import { useGraphStore } from '../../store/graphStore';
import { useDataStore, useElementDataView, formatDataValue } from '../../store/dataStore';
import EdgeMidpointMarker from './EdgeMidpointMarker';
import { computeEdgePathGeometry, EDGE_MIDPOINT_MARKER_RADIUS } from './edge-path-utils';

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
  // Boolean selector (stable) — re-renders only when this edge's validity
  // highlight flips. Set by the verify/save checks; cleared on next selection.
  const isHighlighted = useGraphStore((s) => s.highlightedEdgeIds.includes(id));
  const elementIndex = edgeState?.parameters?.index;
  const indexLabel = showIndices && typeof elementIndex === 'number' ? elementIndex : undefined;

  // Data visualization: color the midpoint badge by the active edge dataset and
  // optionally print the value below it.
  const dataIndex = typeof elementIndex === 'number' ? elementIndex : undefined;
  const dataView = useElementDataView('edge', dataIndex);
  const showContour = useDataStore((s) => s.edgeDisplay.showContour);
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

  // reactflow's BaseEdge hardcodes the path className and drops any we pass, so
  // the validity-highlight class goes on a wrapping <g> and the CSS targets the
  // descendant path (`.custom-edge-issue .react-flow__edge-path`).
  return (
    <g className={`custom-edge${isHighlighted ? ' custom-edge-issue' : ''}`}>
      <BaseEdge id={id} path={edgePath} style={style} />
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
    </g>
  );
};

export default memo(GenericEdge);
