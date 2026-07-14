import React, { memo } from 'react';
import { BaseEdge, useStore, type EdgeProps } from 'reactflow';
import { useAppearanceState, useLayoutState } from '../../context/AppStateContext';
import { useModel } from '../../context/ModelContext';
import { useGraphStore } from '../../store/graphStore';
import {
  useDataStore,
  useElementDataView,
  useEdgeThicknessWidth,
  formatDataValue,
} from '../../store/dataStore';
import EdgeMidpointMarker from './EdgeMidpointMarker';
import {
  computeEdgePathGeometry,
  computeRotatedEdgePathGeometry,
  EDGE_MIDPOINT_MARKER_RADIUS,
  measuredPortAnchor,
} from './edge-path-utils';

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
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  targetHandleId,
  selected = false,
  style = {},
}: EdgeProps) => {
  const { edgePathStyle } = useLayoutState();
  const { model } = useModel();

  // Endpoint nodes straight from the store: their measured handle geometry (not
  // React Flow's reported endpoint props) is the source of truth for where the
  // edge attaches, so rotated elements keep their edges exactly on the ports.
  const sourceNode = useStore((s) => s.nodeInternals.get(source));
  const targetNode = useStore((s) => s.nodeInternals.get(target));
  const isCircle = (nodeType: string | undefined): boolean =>
    model?.nodeConfig[nodeType ?? '']?.shape === 'circle';
  const sourceAnchor = measuredPortAnchor(
    sourceNode,
    sourceHandleId,
    'source',
    isCircle(sourceNode?.type)
  );
  const targetAnchor = measuredPortAnchor(
    targetNode,
    targetHandleId,
    'target',
    isCircle(targetNode?.type)
  );
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

  // Data-driven stroke width: when thickness mapping is on, an inline
  // strokeWidth overrides the uniform `--edge-width` CSS rule; otherwise the
  // edge keeps the default width. Merged into the forwarded style so canvas
  // export (which reads the computed stroke width) picks it up automatically.
  const thicknessWidth = useEdgeThicknessWidth(dataIndex);
  const edgeStyle = thicknessWidth != null ? { ...style, strokeWidth: thicknessWidth } : style;

  // Anchors resolved from the measured handles: the edge starts and ends at the
  // exact port points and departs along each port's true outward normal,
  // whatever the elements' rotation. Before the first handle measurement, fall
  // back to React Flow's reported endpoints so a freshly-mounted graph still
  // paints its edges. (Cheap enough to recompute per render — no memo.)
  const {
    path: edgePath,
    labelX,
    labelY,
  } = sourceAnchor && targetAnchor
    ? computeRotatedEdgePathGeometry(
        {
          sourceX: sourceAnchor.x,
          sourceY: sourceAnchor.y,
          targetX: targetAnchor.x,
          targetY: targetAnchor.y,
          sourceNormal: sourceAnchor.normal,
          targetNormal: targetAnchor.normal,
        },
        edgePathStyle
      )
    : computeEdgePathGeometry(
        { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition },
        edgePathStyle
      );

  // reactflow's BaseEdge hardcodes the path className and drops any we pass, so
  // the validity-highlight class goes on a wrapping <g> and the CSS targets the
  // descendant path (`.custom-edge-issue .react-flow__edge-path`).
  return (
    <g className={`custom-edge${isHighlighted ? ' custom-edge-issue' : ''}`}>
      <BaseEdge id={id} path={edgePath} style={edgeStyle} />
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
