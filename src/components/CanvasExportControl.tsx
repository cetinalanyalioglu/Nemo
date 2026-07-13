import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ControlButton } from 'reactflow';
import { IoCameraOutline } from 'react-icons/io5';
import { useReactFlow } from '../context/ReactFlowContext';
import { exportCanvas } from '../utils/canvas-export';
import type { ExportFormat } from '../utils/canvas-export';
import { logger } from '../utils/logger';
import '../styles/canvas-export.css';

const FORMATS: { id: ExportFormat; label: string; hint: string }[] = [
  { id: 'svg', label: 'SVG', hint: 'Vector' },
  { id: 'png', label: 'PNG', hint: 'Image' },
  { id: 'pdf', label: 'PDF', hint: 'Vector' },
];

/**
 * Canvas control that exports the current flow network as vector graphics.
 * A small popover offers SVG / PNG / PDF; the export captures only the graph
 * content (nodes, edges, visible annotations, active legend) with a transparent
 * background — never the surrounding UI chrome.
 */
const CanvasExportControl = memo(() => {
  const { reactFlowInstance } = useReactFlow();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const run = useCallback(
    async (format: ExportFormat) => {
      if (!reactFlowInstance || busy) return;
      setOpen(false);
      setBusy(format);
      try {
        const ok = await exportCanvas(format, reactFlowInstance);
        if (!ok) logger.info('Nothing to export — the canvas is empty.');
      } catch {
        window.alert(
          `Sorry, the ${format.toUpperCase()} export failed. See the console for details.`
        );
      } finally {
        setBusy(null);
      }
    },
    [reactFlowInstance, busy]
  );

  return (
    <div className="canvas-export" ref={wrapRef}>
      <ControlButton
        type="button"
        className={`react-flow__controls-export ${open ? 'active' : ''}`}
        title="Export canvas (SVG, PNG, PDF)"
        aria-label="Export canvas"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!reactFlowInstance || !!busy}
        onClick={() => setOpen((o) => !o)}
      >
        <IoCameraOutline />
      </ControlButton>
      {open && (
        <div className="canvas-export-menu" role="menu">
          <span className="canvas-export-menu-title">Export as</span>
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="menuitem"
              className="canvas-export-menu-item"
              onClick={() => run(f.id)}
            >
              <span className="canvas-export-menu-label">{f.label}</span>
              <span className="canvas-export-menu-hint">{f.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

CanvasExportControl.displayName = 'CanvasExportControl';

export default CanvasExportControl;
