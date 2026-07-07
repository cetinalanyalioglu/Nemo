import React, { useState, useRef, useEffect, useMemo, useLayoutEffect, memo } from 'react';
import { Handle, useReactFlow, useUpdateNodeInternals, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { IoChevronForward } from 'react-icons/io5';
import '../../styles/custom-node.css';
import { useGraphStore } from '../../store/graphStore';
import { useDataStore, useElementDataView, formatDataValue } from '../../store/dataStore';
import { buildIncidentEdgesSignature } from '../../store/graph-selectors';
import { useAppearanceState, useGridState, useRotationState } from '../../context/AppStateContext';
import { useModel } from '../../context/ModelContext';
import { debugLog } from '../../utils/debug';
import { computePortLayout, groupPortsBySide, computeRadialPorts } from '../../utils/ports';
import type { PlacedPort, RadialPort } from '../../utils/ports';
import CircularNodeFrame, { portHandlePoint } from './CircularNodeFrame';
import type { FramePort } from './CircularNodeFrame';
import RectNodeFrame, { boxLayout } from './RectNodeFrame';
import type { BoxPort } from './RectNodeFrame';
import RailNodeFrame, { railLayout } from './RailNodeFrame';
import type { RailPort } from './RailNodeFrame';
import { resolveGlyph } from './glyphs';
import type {
  ParameterChangeHandler,
  ElementInfoEntry,
  NodePorts,
  NodeShape,
  PortAngles,
  PortPlacements,
  PortSide,
} from '../../types/flow';

type ResizeSession = {
  startX?: number;
  startY?: number;
  startWidth?: number;
  startHeight?: number;
  pendingWidth?: number;
  pendingHeight?: number;
  updateTimer?: ReturnType<typeof setTimeout>;
  rafId?: number;
  cleanup?: () => void;
};

/**
 * Base configuration object that defines common properties for all nodes.
 */
export const baseElementInfo: ElementInfoEntry = {
  parameters: {
    label: {
      label: 'Label',
      type: 'string',
      defaultValue: 'Node',
      category: 'General',
      description: 'Display name of the node',
    },
    width: {
      label: 'Width',
      type: 'number',
      defaultValue: undefined,
      category: 'Appearance',
      description: 'Width of the node in pixels',
      min: 10,
      step: 1,
      unit: 'px',
    },
    height: {
      label: 'Height',
      type: 'number',
      defaultValue: undefined,
      category: 'Appearance',
      description: 'Height of the node in pixels',
      min: 10,
      step: 1,
      unit: 'px',
    },
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
  ports: {
    target: [],
    source: [],
  },
  onParameterChange: {
    '*': ((_nodeId, _paramName, _value, _oldValue, _tempNodeStates, _edges, _edgeStates) => {
      return { isValid: true };
    }) as ParameterChangeHandler,
  },
};

/** Maps a port's presentational side to the React Flow handle position. */
const SIDE_POSITION: Record<PortSide, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

/** Sides offered as drop targets while a port is in move-mode. */
const ALL_SIDES: PortSide[] = ['top', 'right', 'bottom', 'left'];

/**
 * Default on-canvas height (px) of a `box` element before any resize. The
 * default fixes the height (width follows the frame aspect) so box elements
 * share a common vertical size along a flow line regardless of glyph aspect.
 */
const DEFAULT_BOX_HEIGHT = 52;

/**
 * Default on-canvas size (px) of a static circular element; must match the
 * `--circular-node-size` CSS variable. The reference disc for the library-wide
 * port-triangle pixel size: a disc at exactly this size renders its ports at
 * scale 1.
 */
const REF_CIRCLE_PX = 40;

/** Arrow key → destination edge, so a moving port can be sent with the keyboard. */
const ARROW_KEY_SIDE: Record<string, PortSide> = {
  ArrowUp: 'top',
  ArrowDown: 'bottom',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

const GenericNode = ({ id, selected, type, data }: NodeProps) => {
  // Per-node selectors: re-render when this node's state, editing state, or
  // incident edges change — not on unrelated edge updates or node drags.
  const nodeState = useGraphStore((s) => s.nodeStates[id]);
  const editingState = useGraphStore((s) => s.editingStates[id]);
  // Boolean selector (stable) — re-renders only when this node's highlight flips.
  const isHighlighted = useGraphStore((s) => s.highlightedNodeIds.includes(id));
  // Subscribe to the edges array reference (O(1)) and derive the incident-edge
  // signature with useMemo so the scan only runs when edges actually change,
  // not on every store update (e.g. each node-drag tick).
  const edges = useGraphStore((s) => s.edges);
  const incidentEdgesSignature = useMemo(() => buildIncidentEdgesSignature(edges, id), [edges, id]);
  const updateNodeParameter = useGraphStore((s) => s.updateNodeParameter);
  const setNodeDimensions = useGraphStore((s) => s.setNodeDimensions);
  const setNodeRotation = useGraphStore((s) => s.setNodeRotation);
  const updateEdges = useGraphStore((s) => s.updateEdges);
  const contextStartEditing = useGraphStore((s) => s.startEditing);
  const contextOnChange = useGraphStore((s) => s.onChange);
  const contextOnKeyDown = useGraphStore((s) => s.onKeyDown);
  const contextFinishEditing = useGraphStore((s) => s.finishEditing);
  const recordHistory = useGraphStore((s) => s.recordHistory);
  const setPortPlacement = useGraphStore((s) => s.setPortPlacement);
  const setPortAngle = useGraphStore((s) => s.setPortAngle);
  const setActivePort = useGraphStore((s) => s.setActivePort);
  // The suffix of this node's port currently in move-mode, or null. A primitive
  // selector so a change to the active port only re-renders the two nodes it
  // moves between, not the whole canvas.
  const activePortSuffix = useGraphStore((s) =>
    s.activePort && s.activePort.nodeId === id ? s.activePort.port : null
  );
  const { getNode, getZoom } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const { model } = useModel();
  const { snapToGrid, size: gridSize } = useGridState();
  const { snap: rotationSnap, increment: rotationIncrement } = useRotationState();
  const { showIndices } = useAppearanceState();

  // Data visualization: color this node by the active node dataset (keyed on
  // the generated index) and optionally print its value below the node.
  const rawIndex = nodeState?.parameters?.index;
  const dataIndex = typeof rawIndex === 'number' ? rawIndex : undefined;
  const dataView = useElementDataView('node', dataIndex);
  const showContour = useDataStore((s) => s.nodeDisplay.showContour);
  const showValues = useDataStore((s) => s.nodeDisplay.showValues);
  const precision = useDataStore((s) => s.nodeDisplay.precision);
  const notation = useDataStore((s) => s.nodeDisplay.notation);

  const nodeRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<ResizeSession>({});
  const [isResizing, setIsResizing] = useState(false);
  // True while the pointer hovers the element with Alt held: the cursor turns
  // into a rotate arrow and a drag rotates instead of moving the node.
  const [rotateIntent, setRotateIntent] = useState(false);

  const config = type && model ? model.nodeConfig[type] : undefined;
  const editingStateValue = editingState || { isEditing: false, tempLabel: '' };

  /**
   * Computes the ports rendered for this node. For dynamic-port nodes the
   * counts are derived from parameters via `dynamicPortConfig`. Ports are
   * numbered sequentially: targets are `0..(T-1)` and sources `T..(T+S-1)`,
   * matching the positional handle ids used throughout the canvas.
   */
  const calculatedPorts = useMemo<NodePorts>(() => {
    if (!config) {
      return { target: [], source: [] };
    }
    return computePortLayout(
      config.ports,
      config.dynamicPorts,
      config.dynamicPortConfig,
      nodeState?.parameters
    );
  }, [config, nodeState]);

  // Per-port edge overrides live in the node's UI data. Defaults (targets left,
  // sources right) apply to any port without an entry, so this is undefined for
  // untouched nodes and rendering matches the pre-placement behavior exactly.
  const portPlacements = (data as { portPlacements?: PortPlacements } | undefined)?.portPlacements;

  // On-canvas rotation is presentation-only and lives in `node.data` (the UI
  // section), so it round-trips through save/load and history without ever
  // reaching the solver model.
  const rotation =
    typeof (data as { rotation?: unknown } | undefined)?.rotation === 'number'
      ? (data as { rotation: number }).rotation
      : 0;

  // Buckets every port onto the edge it renders on, preserving port numbering.
  const portBuckets = useMemo(
    () => groupPortsBySide(calculatedPorts, portPlacements),
    [calculatedPorts, portPlacements]
  );

  // Frame shape: `rect` keeps the four-edge rails; `circle` draws a bordered disc
  // with radial ports; `box` draws a bordered rectangle with a schematic glyph
  // and triangle ports on the four edges.
  const shape: NodeShape = config?.shape ?? 'rect';
  const isCircle = shape === 'circle';
  const isBox = shape === 'box';
  const isRail = shape === 'rail';
  // Dynamic-port circular elements (the junction node-dot) fan their ports evenly
  // around the full circle rather than clustering them on the left/right arcs.
  const isDynamicCircle = isCircle && !!config?.dynamicPorts;
  // Rail and dynamic-circle elements derive their on-canvas size from the port
  // count instead of being freely resized, so they skip the resize grip and the
  // auto-measure pass.
  const isAutoSized = isRail || isDynamicCircle;
  const portsLocked = config?.lockPorts ?? false;
  // Per-element switch for the corner resize grip; hidden unless the model
  // definition opts in (auto-sized elements never show it).
  const resizable = (config?.resizable ?? false) && !isAutoSized;

  // Per-instance manual port angles (circle only) live in the node's UI data, so
  // rotating a port around the border round-trips through save/load and history.
  const portAngles = (data as { portAngles?: PortAngles } | undefined)?.portAngles;

  // Circle ports resolved to outward angles on the border: manual angle wins,
  // else automatic radial distribution. Only computed for circular frames.
  const radialPorts = useMemo(
    () =>
      isCircle ? computeRadialPorts(calculatedPorts, portAngles, { even: isDynamicCircle }) : [],
    [isCircle, isDynamicCircle, calculatedPorts, portAngles]
  );

  // Auto-sized elements grow with their port count. The junction disc grows a
  // little per extra port for visual weight and handle room; the rail's height
  // is driven entirely by its port stack (see railLayout).
  const circleSizePx = useMemo(() => {
    if (!isDynamicCircle) return null;
    const n = radialPorts.length;
    return Math.min(96, 40 + Math.max(0, n - 3) * 7);
  }, [isDynamicCircle, radialPorts.length]);

  // The disc's SVG (and its unit-space port triangles) scales with the node's
  // on-canvas size, so normalize by the reference disc to keep ports at the
  // library-wide pixel size on discs of any size. Dynamic discs additionally
  // shrink their ports once the chord spacing between many fanned neighbours
  // drops below the triangle base.
  const circleWidthParam = nodeState?.parameters?.width;
  const circlePortScale = useMemo(() => {
    if (!isCircle) return 1;
    const sizePx = isDynamicCircle
      ? (circleSizePx ?? REF_CIRCLE_PX)
      : typeof circleWidthParam === 'number'
        ? circleWidthParam
        : REF_CIRCLE_PX;
    // Cap the upscale on very small discs so port tips don't outgrow the frame.
    const sizeNorm = Math.min(1.15, REF_CIRCLE_PX / sizePx);
    if (!isDynamicCircle) return sizeNorm;
    const n = radialPorts.length;
    if (n < 2) return sizeNorm;
    const RC = 41 - (0.085 * 41) / 2; // frame ring centreline (see CircularNodeFrame)
    const base = 0.6 * 41; // frame port base
    const spacing = 2 * RC * Math.sin(Math.PI / n);
    return Math.min(sizeNorm, spacing / (base * 1.06));
  }, [isCircle, isDynamicCircle, circleSizePx, circleWidthParam, radialPorts.length]);

  // Rotating a port to a new angle moves its handle, so React Flow must re-measure
  // this node's handle geometry for incident edges to re-route.
  const anglesSignature = useMemo(() => JSON.stringify(portAngles ?? {}), [portAngles]);
  useEffect(() => {
    if (isCircle) updateNodeInternals(id);
  }, [anglesSignature, isCircle, id, updateNodeInternals]);

  // Box frame: ports keep their edge buckets (respecting any placement overrides)
  // and are distributed evenly along each edge; the glyph aspect + whitespace
  // insets fix the frame geometry (and the node's locked aspect).
  const boxInsetX = config?.glyphInsetX ?? 0;
  const boxInsetY = config?.glyphInsetY ?? 0;
  const boxGlyph = isBox ? resolveGlyph(config?.glyph) : undefined;
  const boxGlyphAspect = boxGlyph?.aspect ?? 1.6;
  const boxL = useMemo(
    () => (isBox ? boxLayout(boxGlyphAspect, boxInsetX, boxInsetY) : null),
    [isBox, boxGlyphAspect, boxInsetX, boxInsetY]
  );
  // Left/right ports anchor to the glyph's flow-passage centerline rather than
  // the frame's mid-height, so off-axis glyphs (resonator cavity, injector stub)
  // meet their ports on the main line. Mapped from glyph-height fraction to the
  // interior-height fraction the port anchors use; top/bottom ports keep the
  // plain even spread.
  const boxPassageFrac = (boxInsetY + (boxGlyph?.portCenterY ?? 0.5)) / (1 + 2 * boxInsetY);
  // The frame's on-canvas height (px), mirroring the sizing in `style` below, so
  // the frame can draw its port triangles at the library-wide pixel size.
  const boxWidthParam = nodeState?.parameters?.width;
  const boxHeightPx =
    isBox && boxL
      ? (typeof boxWidthParam === 'number' ? boxWidthParam : DEFAULT_BOX_HEIGHT * boxL.aspect) /
        boxL.aspect
      : undefined;
  const boxPorts = useMemo<BoxPort[]>(() => {
    if (!isBox) return [];
    const out: BoxPort[] = [];
    ALL_SIDES.forEach((side) => {
      const bucket = portBuckets[side];
      const onFlowAxis = side === 'left' || side === 'right';
      bucket.forEach((p, i) => {
        const spread = (i + 1) / (bucket.length + 1);
        const offset = onFlowAxis
          ? Math.min(1, Math.max(0, boxPassageFrac + spread - 0.5))
          : spread;
        out.push({
          suffix: p.suffix,
          side,
          offset,
          direction: p.direction,
        });
      });
    });
    return out;
  }, [isBox, portBuckets, boxPassageFrac]);

  // Rail frame: targets stack on the left, sources on the right, each side
  // vertically centred. Height follows the busier side; the label is fixed-size.
  const railGlyphAspect = resolveGlyph(isRail ? config?.glyph : undefined)?.aspect ?? 0.25;
  const maxSidePorts = Math.max(calculatedPorts.target.length, calculatedPorts.source.length);
  const railL = useMemo(
    () => (isRail ? railLayout(maxSidePorts, railGlyphAspect) : null),
    [isRail, maxSidePorts, railGlyphAspect]
  );
  const railPorts = useMemo<RailPort[]>(() => {
    if (!isRail) return [];
    const targetCount = calculatedPorts.target.length;
    const sourceCount = calculatedPorts.source.length;
    return [
      ...calculatedPorts.target.map(
        (suffix, i): RailPort => ({
          suffix,
          side: 'left',
          index: i,
          count: targetCount,
          direction: 'target',
        })
      ),
      ...calculatedPorts.source.map(
        (suffix, i): RailPort => ({
          suffix,
          side: 'right',
          index: i,
          count: sourceCount,
          direction: 'source',
        })
      ),
    ];
  }, [isRail, calculatedPorts]);

  // Moving a port changes which side its handle sits on, so React Flow must
  // re-measure the node's handle geometry for edges to re-route to the new edge.
  const placementSignature = useMemo(() => JSON.stringify(portPlacements ?? {}), [portPlacements]);
  useEffect(() => {
    updateNodeInternals(id);
  }, [placementSignature, id, updateNodeInternals]);

  // The edge the port in move-mode currently sits on (null when nothing is
  // active), so its own ghost target can be shown as the current, inert one.
  const activePortSide = useMemo<PortSide | null>(() => {
    if (activePortSuffix == null) return null;
    return (
      ALL_SIDES.find((side) => portBuckets[side].some((p) => p.suffix === activePortSuffix)) ?? null
    );
  }, [activePortSuffix, portBuckets]);

  // While a port is in move-mode, arrow keys send it to an edge and Escape
  // cancels. Capture phase + stopPropagation so React Flow doesn't also nudge
  // the selected node on the same key press.
  useEffect(() => {
    if (activePortSuffix == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setActivePort(null);
        return;
      }
      const side = ARROW_KEY_SIDE[e.key];
      if (side) {
        e.preventDefault();
        e.stopPropagation();
        setPortPlacement(id, activePortSuffix, side);
        setActivePort(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [activePortSuffix, id, setPortPlacement, setActivePort]);

  // When a dynamic-port count shrinks, prune any edges connected to ports that
  // no longer exist. Handle ids are positional, so no renumbering is required.
  useLayoutEffect(() => {
    if (!config?.dynamicPorts || !config.dynamicPortConfig || !nodeState) return;

    try {
      const edges = useGraphStore.getState().edges;
      const targetCount = calculatedPorts.target.length;
      const sourceCount = calculatedPorts.source.length;
      const removedEdgeIds: string[] = [];

      const newEdges = edges.filter((edge) => {
        if (edge.source !== id && edge.target !== id) return true;

        let keepEdge = true;

        if (edge.source === id) {
          const portMatch = edge.sourceHandle?.match(/-port-(\d+)$/);
          if (!portMatch) {
            debugLog(`[${id}] Invalid source handle format: ${edge.sourceHandle}`);
            return true;
          }
          const portNumber = parseInt(portMatch[1], 10);
          keepEdge = portNumber >= targetCount && portNumber < targetCount + sourceCount;
        } else if (edge.target === id) {
          const portMatch = edge.targetHandle?.match(/-port-(\d+)$/);
          if (!portMatch) {
            debugLog(`[${id}] Invalid target handle format: ${edge.targetHandle}`);
            return true;
          }
          const portNumber = parseInt(portMatch[1], 10);
          keepEdge = portNumber < targetCount;
        }

        if (!keepEdge) {
          removedEdgeIds.push(edge.id);
        }
        return keepEdge;
      });

      if (removedEdgeIds.length > 0) {
        debugLog(`[${id}] Removed ${removedEdgeIds.length} edges due to port reduction`);
        updateEdges(newEdges, removedEdgeIds);
      }

      updateNodeInternals(id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      debugLog(`[${id}] Error in edge management: ${message}`);
      console.error('Error updating dynamic port edges:', error);
    }
  }, [
    config,
    id,
    nodeState,
    calculatedPorts.target.length,
    calculatedPorts.source.length,
    incidentEdgesSignature,
    updateEdges,
    updateNodeInternals,
  ]);

  const snapToGridSize = (value: number) => {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  };

  const style = useMemo((): React.CSSProperties => {
    // Rotate about the element centre (the default transform-origin), keeping
    // the node's React Flow position/anchor unchanged.
    const base: React.CSSProperties = rotation ? { transform: `rotate(${rotation}deg)` } : {};
    if (!nodeState?.parameters) return base;
    const width = nodeState.parameters.width;
    const height = nodeState.parameters.height;

    // Rail frames lock to their computed geometry (width fixed, height from the
    // port count), so the label never stretches and nothing distorts.
    if (isRail && railL) {
      return { ...base, width: `${railL.vw}px`, height: `${railL.vh}px`, boxSizing: 'border-box' };
    }

    // Dynamic-port discs (junction) size from their port count, ignoring any
    // stored width/height — they are auto-sized, not user-resized.
    if (isDynamicCircle && circleSizePx != null) {
      return {
        ...base,
        width: `${circleSizePx}px`,
        height: `${circleSizePx}px`,
        boxSizing: 'border-box',
      };
    }

    // Box frames are aspect-locked: an explicit width drives, height follows the
    // frame aspect (glyph aspect + insets), so the SVG never letterboxes and
    // resize stays true. The default size is height-driven instead, so unsized
    // box elements share a common vertical size.
    if (isBox && boxL) {
      const w = typeof width === 'number' ? width : DEFAULT_BOX_HEIGHT * boxL.aspect;
      return { ...base, width: `${w}px`, height: `${w / boxL.aspect}px`, boxSizing: 'border-box' };
    }

    if (width || height) {
      return {
        ...base,
        ...(width ? { width: `${width}px` } : {}),
        ...(height ? { height: `${height}px` } : {}),
        boxSizing: 'content-box',
      };
    }
    return base;
  }, [nodeState, rotation, isBox, boxL, isRail, railL, isDynamicCircle, circleSizePx]);

  // Rotation changes where the handles sit, so React Flow must re-measure this
  // node's handle geometry for incident edges to re-route to the rotated ports.
  useEffect(() => {
    updateNodeInternals(id);
  }, [rotation, id, updateNodeInternals]);

  const { hasLeftPort, hasRightPort, hasTopPort, hasBottomPort } = useMemo(
    () => ({
      hasLeftPort: portBuckets.left.length > 0,
      hasRightPort: portBuckets.right.length > 0,
      hasTopPort: portBuckets.top.length > 0,
      hasBottomPort: portBuckets.bottom.length > 0,
    }),
    [portBuckets]
  );

  const nodeClasses = [
    'custom-node',
    type,
    `shape-${shape}`,
    selected ? 'custom-node-selected' : '',
    isHighlighted ? 'custom-node-issue' : '',
    hasLeftPort ? 'has-left-port' : '',
    hasRightPort ? 'has-right-port' : '',
    hasTopPort ? 'has-top-port' : '',
    hasBottomPort ? 'has-bottom-port' : '',
    activePortSuffix != null ? 'custom-node--port-move' : '',
    isResizing ? 'resizing' : '',
    rotateIntent ? 'custom-node--rotate' : '',
  ].join(' ');

  // Tracks the Alt-hover combination that arms rotate-mode. The key listeners
  // are attached only while the pointer is over this element, so a canvas full
  // of nodes doesn't stack window-level handlers.
  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => setRotateIntent(e.altKey);
    const onEnter = (e: MouseEvent) => {
      setRotateIntent(e.altKey);
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKey);
    };
    const onLeave = () => {
      setRotateIntent(false);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, []);

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();

    setIsResizing(true);

    const node = getNode(id);
    if (!node || !nodeRef.current) return;

    // Records the pre-resize size once, on the first actual movement, so the
    // whole gesture is a single undo step (and a plain click adds nothing).
    let hasRecorded = false;

    const initialWidth = node.style?.width
      ? parseInt(String(node.style.width), 10)
      : nodeRef.current.offsetWidth;
    const initialHeight = node.style?.height
      ? parseInt(String(node.style.height), 10)
      : nodeRef.current.offsetHeight;

    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: initialWidth,
      startHeight: initialHeight,
    };

    const onPointerMove = (eMove: PointerEvent) => {
      const r = resizeRef.current;
      if (r.startX === undefined || r.startY === undefined) return;

      if (!hasRecorded) {
        recordHistory();
        hasRecorded = true;
      }

      const screenDx = eMove.clientX - r.startX;
      const screenDy = eMove.clientY - r.startY;

      // Project the screen-space drag onto the node's local (possibly rotated)
      // axes so the bottom-right grip still grows width/height along the
      // element's own orientation after it has been rotated.
      const rad = (rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const deltaX = screenDx * cos + screenDy * sin;
      const deltaY = -screenDx * sin + screenDy * cos;

      const sw = r.startWidth ?? 0;
      const sh = r.startHeight ?? 0;

      const newWidth = Math.max(snapToGridSize(sw + deltaX), gridSize);
      const newHeight = Math.max(snapToGridSize(sh + deltaY), gridSize);

      const roundedWidth = Math.round(newWidth);
      const roundedHeight = Math.round(newHeight);

      if (nodeRef.current) {
        nodeRef.current.style.width = `${roundedWidth}px`;
        nodeRef.current.style.height = `${roundedHeight}px`;
      }

      resizeRef.current.pendingWidth = roundedWidth;
      resizeRef.current.pendingHeight = roundedHeight;

      if (resizeRef.current.updateTimer) {
        clearTimeout(resizeRef.current.updateTimer);
      }

      resizeRef.current.updateTimer = setTimeout(() => {
        setNodeDimensions(id, roundedWidth, roundedHeight);
      }, 16);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    const onPointerUp = () => {
      setIsResizing(false);

      if (resizeRef.current.updateTimer) {
        clearTimeout(resizeRef.current.updateTimer);
        resizeRef.current.updateTimer = undefined;
      }

      if (
        resizeRef.current.pendingWidth !== undefined ||
        resizeRef.current.pendingHeight !== undefined
      ) {
        const finalWidth =
          resizeRef.current.pendingWidth ?? resizeRef.current.startWidth ?? initialWidth;
        const finalHeight =
          resizeRef.current.pendingHeight ?? resizeRef.current.startHeight ?? initialHeight;
        setNodeDimensions(id, finalWidth, finalHeight);
        resizeRef.current.pendingWidth = undefined;
        resizeRef.current.pendingHeight = undefined;
      }

      cleanup();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const autoResize = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();

    if (resizeRef.current.rafId) {
      cancelAnimationFrame(resizeRef.current.rafId);
    }

    // One undo step for the reset; the two writes below are applied silently.
    recordHistory();

    resizeRef.current.rafId = requestAnimationFrame(() => {
      updateNodeParameter(id, 'width', undefined, { recordHistory: false });
      updateNodeParameter(id, 'height', undefined, { recordHistory: false });
    });
  };

  const handleRotateStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();

    const rect = nodeRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Rotation pivots on the node centre, which is invariant under the rotation
    // itself, so the centre captured here stays valid for the whole gesture.
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startPointerAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
    const startRotation = rotation;

    // Record the pre-rotation state once, on the first actual movement, so the
    // whole drag is a single undo step (and a plain click adds nothing).
    let hasRecorded = false;

    const onPointerMove = (ev: PointerEvent) => {
      if (!hasRecorded) {
        recordHistory();
        hasRecorded = true;
      }
      const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      let degrees = startRotation + ((angle - startPointerAngle) * 180) / Math.PI;
      // The settings pane sets whether angles snap and to what increment; holding
      // Shift inverts that choice for the duration of the drag.
      const shouldSnap = rotationSnap !== ev.shiftKey;
      if (shouldSnap && rotationIncrement > 0) {
        degrees = Math.round(degrees / rotationIncrement) * rotationIncrement;
      }
      setNodeRotation(id, degrees, { recordHistory: false });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Alt-double-clicking the corner grip restores the upright orientation.
  const resetRotation = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setNodeRotation(id, 0);
  };

  // The single bottom-right grip drives both gestures: a plain drag resizes,
  // while holding Alt turns the same drag into a rotate-about-centre. Reset is
  // symmetric: plain double-click auto-fits the size, Alt double-click uprights.
  const handleGripPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.altKey) {
      handleRotateStart(e);
      return;
    }
    handleResizeStart(e);
  };

  const handleGripDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.altKey) {
      resetRotation(e);
      return;
    }
    autoResize(e);
  };

  /** True when the event originated on a child that owns its own gestures. */
  const isGestureExempt = (target: EventTarget | null) =>
    target instanceof Element &&
    !!target.closest(
      '.framed-port, .port-wrapper, .resize-handle, .react-flow__handle, .custom-node-label, input'
    );

  // Alt-drag anywhere on the element rotates it about its centre (the corner
  // grip is hidden unless the element opts into resizing). Runs in the capture
  // phase and swallows the event so React Flow doesn't also start a node drag;
  // ports, handles, the grip, and the label keep their own gestures.
  const handleNodePointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.altKey || isGestureExempt(e.target)) return;
    handleRotateStart(e);
  };

  // Alt-double-click restores the upright orientation.
  const handleNodeDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!e.altKey || isGestureExempt(e.target)) return;
    resetRotation(e);
  };

  // Alt-drag a circular element's port to move it around the border; Alt-click
  // (no drag) clears the manual angle, restoring the automatic placement. Runs on
  // mousedown-capture with a modifier so a plain press still falls through to the
  // React Flow handle (which starts an edge on `onMouseDown`). Angle snapping
  // reuses the rotation-snap settings, with Shift inverting the choice.
  const handlePortAngleMouseDown = (e: React.MouseEvent<HTMLDivElement>, suffix: string) => {
    if (!e.altKey) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = nodeRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let moved = false;
    let hasRecorded = false;

    const onMove = (ev: MouseEvent) => {
      moved = true;
      if (!hasRecorded) {
        recordHistory();
        hasRecorded = true;
      }
      // Math convention: 0° = right, 90° = up; screen y grows down, so negate.
      let deg = (Math.atan2(-(ev.clientY - cy), ev.clientX - cx) * 180) / Math.PI;
      const shouldSnap = rotationSnap !== ev.shiftKey;
      if (shouldSnap && rotationIncrement > 0) {
        deg = Math.round(deg / rotationIncrement) * rotationIncrement;
      }
      setPortAngle(id, suffix, deg, { recordHistory: false });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (!moved) setPortAngle(id, suffix, undefined);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Renders one circular-element port: an absolutely-positioned hit area on the
  // border (at the port's angle) carrying the invisible React Flow handle. The
  // visible triangle is drawn by CircularNodeFrame; this only handles connection
  // and Alt-drag rotation. `position` follows the nearest cardinal so the edge
  // exit vector stays clean.
  const renderRadialPort = (port: RadialPort) => {
    const { xPct, yPct } = portHandlePoint(port.exitAngle);
    return (
      <div
        key={port.suffix}
        className={`circular-port framed-port nodrag port-side-${port.side} port-dir-${port.direction}`}
        style={{ left: `${xPct}%`, top: `${yPct}%` }}
        title="Alt-drag to move this port around the border; Alt-click to reset (Shift toggles snapping)"
        onMouseDownCapture={(e) => handlePortAngleMouseDown(e, port.suffix)}
      >
        <Handle
          type={port.direction}
          position={SIDE_POSITION[port.side]}
          id={`${id}-port-${port.suffix}`}
          className="react-flow__handle custom-handle circular-handle"
        />
        <span className="port-index">{port.suffix}</span>
      </div>
    );
  };

  // Renders one box-element port: an absolutely-positioned hit area on the border
  // edge carrying the invisible handle (the visible triangle is drawn by
  // RectNodeFrame). Unless the element locks its ports, clicking the port toggles
  // move-mode so it can be re-homed to another edge via the ghost targets.
  const renderBoxPort = (port: BoxPort) => {
    if (!boxL) return null;
    const a = boxL.portAnchor(port.side, port.offset);
    const isActive = activePortSuffix === port.suffix;
    return (
      <div
        key={port.suffix}
        className={`box-port framed-port nodrag port-side-${port.side}${
          isActive ? ' port-wrapper--active' : ''
        }`}
        style={{ left: `${(a.x / boxL.vw) * 100}%`, top: `${(a.y / boxL.vh) * 100}%` }}
        onClick={
          portsLocked
            ? undefined
            : (e) => {
                e.stopPropagation();
                setActivePort(isActive ? null : { nodeId: id, port: port.suffix });
              }
        }
      >
        <Handle
          type={port.direction}
          position={SIDE_POSITION[port.side]}
          id={`${id}-port-${port.suffix}`}
          className="react-flow__handle custom-handle box-handle"
        />
        <span className="port-index">{port.suffix}</span>
      </div>
    );
  };

  // Renders one rail-element port: an absolutely-positioned hit area on the left
  // or right border, stacked at its index (the visible triangle is drawn by
  // RailNodeFrame). Rail ports are fixed to their side, so there is no move-mode.
  const renderRailPort = (port: RailPort) => {
    if (!railL) return null;
    const a = railL.portAnchor(port.side, port.index, port.count);
    return (
      <div
        key={port.suffix}
        className={`rail-port framed-port nodrag port-side-${port.side}`}
        style={{ left: `${(a.x / railL.vw) * 100}%`, top: `${(a.y / railL.vh) * 100}%` }}
      >
        <Handle
          type={port.direction}
          position={SIDE_POSITION[port.side]}
          id={`${id}-port-${port.suffix}`}
          className="react-flow__handle custom-handle rail-handle"
        />
        <span className="port-index">{port.suffix}</span>
      </div>
    );
  };

  // Renders one port. The React Flow handle `type` is fixed by the port's
  // direction (its physics role), while `position` follows its presentational
  // side — the two are deliberately decoupled. The handle id keeps the port's
  // positional number so connectivity survives any re-placement. Clicking the
  // chip (not the handle dot, which still drags out edges) toggles move-mode;
  // `nodrag` keeps that click from dragging the whole node.
  const renderPort = (port: PlacedPort) => {
    const isActive = activePortSuffix === port.suffix;
    return (
      <div
        key={port.suffix}
        className={`port-wrapper nodrag port-side-${port.side} port-dir-${port.direction}${
          isActive ? ' port-wrapper--active' : ''
        }`}
        onClick={(e) => {
          e.stopPropagation();
          setActivePort(isActive ? null : { nodeId: id, port: port.suffix });
        }}
      >
        <IoChevronForward className="port-icon" />
        <span className="port-index">{port.suffix}</span>
        <Handle
          type={port.direction}
          position={SIDE_POSITION[port.side]}
          id={`${id}-port-${port.suffix}`}
          className={`react-flow__handle custom-handle custom-handle-${port.side}`}
        />
      </div>
    );
  };

  // The four drop targets shown around the node while a port is in move-mode.
  const renderGhostTargets = () => {
    if (activePortSuffix == null) return null;
    return (
      <div className="port-ghost-layer">
        {ALL_SIDES.map((side) => {
          const isCurrent = side === activePortSide;
          return (
            <button
              key={side}
              type="button"
              disabled={isCurrent}
              className={`port-ghost port-ghost-${side}${isCurrent ? ' port-ghost--current' : ''}`}
              title={`Move port ${activePortSuffix} to ${side}`}
              onClick={(e) => {
                e.stopPropagation();
                setPortPlacement(id, activePortSuffix, side);
                setActivePort(null);
              }}
            >
              <IoChevronForward className={`port-ghost-icon port-ghost-icon-${side}`} />
            </button>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    if (isResizing) {
      return () => {
        if (resizeRef.current.cleanup) {
          resizeRef.current.cleanup();
        }
      };
    }
  }, [isResizing]);

  useEffect(() => {
    // Auto-sized elements (rail, dynamic disc) derive their size from the port
    // count via `style`; never overwrite that with a DOM measurement.
    if (isAutoSized) return;
    if (nodeRef.current && (!nodeState?.parameters?.width || !nodeState?.parameters?.height)) {
      const computedStyle = window.getComputedStyle(nodeRef.current);
      const rect = nodeRef.current.getBoundingClientRect();

      try {
        const paddingValues = computedStyle.padding.split(' ');
        const [paddingTop, paddingRight, paddingBottom, paddingLeft] =
          paddingValues.length === 1
            ? [paddingValues[0], paddingValues[0], paddingValues[0], paddingValues[0]]
            : paddingValues;

        const borderWidth = parseFloat(computedStyle.borderWidth || '0');

        const safeParseFloat = (val: string) => {
          const parsed = parseFloat(val);
          return isNaN(parsed) ? 0 : parsed;
        };

        const pTop = safeParseFloat(paddingTop ?? '0');
        const pRight = safeParseFloat(paddingRight ?? '0');
        const pBottom = safeParseFloat(paddingBottom ?? '0');
        const pLeft = safeParseFloat(paddingLeft ?? '0');
        const bWidth = safeParseFloat(String(borderWidth));

        const zoom = getZoom();
        const unscaledWidth = rect.width / zoom;
        const unscaledHeight = rect.height / zoom;

        const contentWidth = Math.max(0, unscaledWidth - pLeft - pRight - bWidth * 2);
        const contentHeight = Math.max(0, unscaledHeight - pTop - pBottom - bWidth * 2);

        if (contentWidth > 0 && contentHeight > 0) {
          // Initial auto-measured size is derived state, not a user action, so
          // it must not create undo steps (otherwise undoing an add/move would
          // first revert these silent size writes). Written as a single store
          // update so a freshly-mounted graph doesn't pay two render passes per
          // node.
          setNodeDimensions(id, Math.round(contentWidth), Math.round(contentHeight));
        }
      } catch (error) {
        console.error('Error calculating node dimensions:', error);
      }
    }
  }, [nodeState, id, setNodeDimensions, getZoom, isAutoSized]);

  // Auto-sized elements change dimensions when their port count changes, so React
  // Flow must re-measure the handle geometry for incident edges to re-route.
  const autoSizeSignature = isRail
    ? `rail:${railL?.vw ?? 0}x${railL?.vh ?? 0}`
    : isDynamicCircle
      ? `disc:${circleSizePx ?? 0}`
      : '';
  useEffect(() => {
    if (autoSizeSignature) updateNodeInternals(id);
  }, [autoSizeSignature, id, updateNodeInternals]);

  if (!config) {
    console.error(`No configuration found for node type: ${type}`);
    return null;
  }

  if (!nodeState || !nodeState.parameters || !nodeState.parameters.label) {
    return null;
  }

  const TypeIcon = config.icon;
  const elementIndex = nodeState.parameters.index;
  const elementIndexLabel =
    showIndices && typeof elementIndex === 'number' ? elementIndex : undefined;

  // Circular elements render as a single SVG frame (disc + glyph + clipped port
  // triangles + border) with radial handles overlaid, and the label as a caption
  // beneath the disc. The four-edge rect layout below is bypassed entirely.
  if (isCircle) {
    const framePorts: FramePort[] = radialPorts.map((p) => ({
      suffix: p.suffix,
      angleDeg: p.exitAngle,
      direction: p.direction,
    }));
    return (
      <div
        className={nodeClasses}
        ref={nodeRef}
        style={style}
        onPointerDownCapture={handleNodePointerDownCapture}
        onDoubleClick={handleNodeDoubleClick}
      >
        {showContour && dataView.color && (
          <div
            className="custom-node-data-strip"
            style={{ background: dataView.color }}
            aria-hidden
          />
        )}
        {elementIndexLabel !== undefined && (
          <span className="element-index-label port-index">{elementIndexLabel}</span>
        )}

        <CircularNodeFrame
          glyphKey={config.glyph}
          glyphScale={config.glyphScale}
          portScale={circlePortScale}
          ports={framePorts}
        />
        {radialPorts.map(renderRadialPort)}

        <div className="circular-node-caption">
          {editingStateValue.isEditing ? (
            <input
              value={editingStateValue.tempLabel}
              onChange={(e) => contextOnChange(id, e)}
              onBlur={() => contextFinishEditing(id, { fromBlur: true })}
              onKeyDown={(e) => contextOnKeyDown(id, e)}
              autoFocus
              className="custom-node-input nodrag"
              spellCheck={false}
              size={Math.max(editingStateValue.tempLabel.length, 1)}
            />
          ) : (
            <div className="custom-node-label" onDoubleClick={() => contextStartEditing(id)}>
              {String(nodeState.parameters.label)}
            </div>
          )}
          {showValues && dataView.value !== undefined && (
            <span className="custom-node-data-value">
              {formatDataValue(dataView.value, precision, notation, dataView.unit)}
            </span>
          )}
        </div>

        {selected && resizable && (
          <div
            className="resize-handle"
            onPointerDown={handleGripPointerDown}
            onDoubleClick={handleGripDoubleClick}
            title={
              'Drag to resize • Alt-drag to rotate (Shift toggles angle snapping)\n' +
              'Double-click resets size • Alt-double-click resets rotation'
            }
          />
        )}
      </div>
    );
  }

  // Manifold-rail elements (dynamic-port splitter/junction family): a tall
  // rounded bar whose height follows the busier port side, with a fixed-size
  // vertical label. Ports are fixed to their side (no move-mode) and the element
  // is auto-sized (no resize grip).
  if (isRail) {
    return (
      <div
        className={nodeClasses}
        ref={nodeRef}
        style={style}
        onPointerDownCapture={handleNodePointerDownCapture}
        onDoubleClick={handleNodeDoubleClick}
      >
        {showContour && dataView.color && (
          <div
            className="custom-node-data-strip"
            style={{ background: dataView.color }}
            aria-hidden
          />
        )}
        {elementIndexLabel !== undefined && (
          <span className="element-index-label port-index">{elementIndexLabel}</span>
        )}

        <RailNodeFrame
          glyphKey={config.glyph}
          idPrefix={id}
          maxPorts={maxSidePorts}
          ports={railPorts}
        />
        {railPorts.map(renderRailPort)}

        <div className="rail-node-caption">
          {editingStateValue.isEditing ? (
            <input
              value={editingStateValue.tempLabel}
              onChange={(e) => contextOnChange(id, e)}
              onBlur={() => contextFinishEditing(id, { fromBlur: true })}
              onKeyDown={(e) => contextOnKeyDown(id, e)}
              autoFocus
              className="custom-node-input nodrag"
              spellCheck={false}
              size={Math.max(editingStateValue.tempLabel.length, 1)}
            />
          ) : (
            <div className="custom-node-label" onDoubleClick={() => contextStartEditing(id)}>
              {String(nodeState.parameters.label)}
            </div>
          )}
          {showValues && dataView.value !== undefined && (
            <span className="custom-node-data-value">
              {formatDataValue(dataView.value, precision, notation, dataView.unit)}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Rectangular ("box") elements: a single SVG frame (gray fill + schematic glyph
  // + clipped triangle edge-ports + border) with radial handles overlaid and the
  // label beneath. Ports re-home via move-mode unless the element locks them.
  if (isBox) {
    return (
      <div
        className={nodeClasses}
        ref={nodeRef}
        style={style}
        onPointerDownCapture={handleNodePointerDownCapture}
        onDoubleClick={handleNodeDoubleClick}
      >
        {showContour && dataView.color && (
          <div
            className="custom-node-data-strip"
            style={{ background: dataView.color }}
            aria-hidden
          />
        )}
        {elementIndexLabel !== undefined && (
          <span className="element-index-label port-index">{elementIndexLabel}</span>
        )}

        <RectNodeFrame
          glyphKey={config.glyph}
          idPrefix={id}
          insetX={boxInsetX}
          insetY={boxInsetY}
          ports={boxPorts}
          heightPx={boxHeightPx}
        />
        {boxPorts.map(renderBoxPort)}
        {!portsLocked && renderGhostTargets()}

        <div className="box-node-caption">
          {editingStateValue.isEditing ? (
            <input
              value={editingStateValue.tempLabel}
              onChange={(e) => contextOnChange(id, e)}
              onBlur={() => contextFinishEditing(id, { fromBlur: true })}
              onKeyDown={(e) => contextOnKeyDown(id, e)}
              autoFocus
              className="custom-node-input nodrag"
              spellCheck={false}
              size={Math.max(editingStateValue.tempLabel.length, 1)}
            />
          ) : (
            <div className="custom-node-label" onDoubleClick={() => contextStartEditing(id)}>
              {String(nodeState.parameters.label)}
            </div>
          )}
          {showValues && dataView.value !== undefined && (
            <span className="custom-node-data-value">
              {formatDataValue(dataView.value, precision, notation, dataView.unit)}
            </span>
          )}
        </div>

        {selected && resizable && (
          <div
            className="resize-handle"
            onPointerDown={handleGripPointerDown}
            onDoubleClick={handleGripDoubleClick}
            title={
              'Drag to resize • Alt-drag to rotate (Shift toggles angle snapping)\n' +
              'Double-click resets size • Alt-double-click resets rotation'
            }
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={nodeClasses}
      ref={nodeRef}
      style={style}
      onPointerDownCapture={handleNodePointerDownCapture}
      onDoubleClick={handleNodeDoubleClick}
    >
      {showContour && dataView.color && (
        <div
          className="custom-node-data-strip"
          style={{ background: dataView.color }}
          aria-hidden
        />
      )}
      {elementIndexLabel !== undefined && (
        <span className="element-index-label port-index">{elementIndexLabel}</span>
      )}
      {showValues && dataView.value !== undefined && (
        <span className="custom-node-data-value">
          {formatDataValue(dataView.value, precision, notation, dataView.unit)}
        </span>
      )}
      {hasTopPort && (
        <div className="custom-port-container custom-port-top">
          {portBuckets.top.map(renderPort)}
        </div>
      )}
      <div className="custom-port-container custom-port-left">
        {portBuckets.left.map(renderPort)}
      </div>

      <div className="middle-section">
        {TypeIcon && <TypeIcon className="node-type-icon" />}
        <div className="custom-node-content">
          {editingStateValue.isEditing ? (
            <input
              value={editingStateValue.tempLabel}
              onChange={(e) => contextOnChange(id, e)}
              onBlur={() => contextFinishEditing(id, { fromBlur: true })}
              onKeyDown={(e) => contextOnKeyDown(id, e)}
              autoFocus
              className="custom-node-input"
              spellCheck={false}
              // Size the field to its text so swapping the label for the input
              // doesn't abruptly resize the node (the default ~20-char width
              // would overflow a short label).
              size={Math.max(editingStateValue.tempLabel.length, 1)}
            />
          ) : (
            <div className="custom-node-label" onDoubleClick={() => contextStartEditing(id)}>
              {String(nodeState.parameters.label)}
            </div>
          )}
          <div className="custom-node-type">{type}</div>
        </div>
      </div>

      <div className="custom-port-container custom-port-right">
        {portBuckets.right.map(renderPort)}
      </div>
      {hasBottomPort && (
        <div className="custom-port-container custom-port-bottom">
          {portBuckets.bottom.map(renderPort)}
        </div>
      )}

      {renderGhostTargets()}

      {selected && resizable && (
        <div
          className="resize-handle"
          onPointerDown={handleGripPointerDown}
          onDoubleClick={handleGripDoubleClick}
          title={
            'Drag to resize • Alt-drag to rotate (Shift toggles angle snapping)\n' +
            'Double-click resets size • Alt-double-click resets rotation'
          }
        />
      )}
    </div>
  );
};

export default memo(GenericNode);
