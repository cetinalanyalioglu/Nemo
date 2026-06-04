import { memo } from 'react';
import { EDGE_MIDPOINT_MARKER_RADIUS } from './edge-path-utils';

interface EdgeMidpointMarkerProps {
  labelX: number;
  labelY: number;
  selected?: boolean;
}

const EdgeMidpointMarker = ({ labelX, labelY, selected = false }: EdgeMidpointMarkerProps) => {
  const r = EDGE_MIDPOINT_MARKER_RADIUS;
  const className = selected
    ? 'edge-midpoint-marker edge-midpoint-marker--selected'
    : 'edge-midpoint-marker';

  return (
    <g className={className} pointerEvents="none" aria-hidden>
      <circle className="edge-midpoint-marker__halo" cx={labelX} cy={labelY} r={r + 1.5} />
      <circle className="edge-midpoint-marker__ring" cx={labelX} cy={labelY} r={r} />
    </g>
  );
};

export default memo(EdgeMidpointMarker);
