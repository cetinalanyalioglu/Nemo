import { memo } from 'react';
import { EDGE_MIDPOINT_MARKER_RADIUS } from './edge-path-utils';

interface EdgeMidpointMarkerProps {
  labelX: number;
  labelY: number;
  selected?: boolean;
  indexLabel?: number;
}

const EdgeMidpointMarker = ({
  labelX,
  labelY,
  selected = false,
  indexLabel,
}: EdgeMidpointMarkerProps) => {
  const r = EDGE_MIDPOINT_MARKER_RADIUS;
  const className = selected
    ? 'edge-midpoint-marker edge-midpoint-marker--selected'
    : 'edge-midpoint-marker';

  return (
    <g className={className} pointerEvents="none" aria-hidden>
      <circle className="edge-midpoint-marker__halo" cx={labelX} cy={labelY} r={r + 1.5} />
      <circle className="edge-midpoint-marker__ring" cx={labelX} cy={labelY} r={r} />
      {indexLabel !== undefined && (
        <text
          className="edge-midpoint-marker__index"
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {indexLabel}
        </text>
      )}
    </g>
  );
};

export default memo(EdgeMidpointMarker);
