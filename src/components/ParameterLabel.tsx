import React, { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IoInformationCircleOutline, IoClose } from 'react-icons/io5';
import MathLabel from './MathLabel';
import '../styles/parameter-info.css';

// Markdown (and its dependency tree) is only needed for the modal style, so it
// is code-split and pulled in the first time a modal description is opened.
const MarkdownContent = React.lazy(() => import('./MarkdownContent'));

interface ParameterLabelProps {
  /** Resolved label text (may contain inline `$...$` math). */
  label: string;
  /** Optional description authored in the model YAML. */
  description?: string;
  /** Opt-in: render the info icon revealing `description`. */
  displayInfoTag?: boolean;
  /** Presentation when the info icon is clicked. Defaults to `popover`. */
  infoStyle?: 'popover' | 'modal';
  /** When true, appends the required `*` marker after the label. */
  required?: boolean;
}

const POPOVER_MAX_WIDTH = 260;

/**
 * A parameter label shared by the properties panel and the model parameter
 * form. Renders the (math-capable) label, an optional required marker, and —
 * when the parameter carries a description — an info icon that reveals it.
 *
 * The popover style shows the description as a small anchored card typeset with
 * KaTeX; the modal style opens a centered dialog rendering the description as
 * Markdown for richer content (images, lists, links).
 */
const ParameterLabel: React.FC<ParameterLabelProps> = ({
  label,
  description,
  displayInfoTag,
  infoStyle,
  required,
}) => {
  const hasDescription = typeof description === 'string' && description.trim().length > 0;
  const showInfo = !!displayInfoTag && hasDescription;
  const style = infoStyle === 'modal' ? 'modal' : 'popover';

  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Anchor the popover to the trigger, clamping it into the viewport (the
  // properties panel sits at the right edge, so a naive left-align overflows).
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const width = popoverRef.current?.offsetWidth ?? POPOVER_MAX_WIDTH;
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    setPopoverPos({ left, top: rect.bottom + 6 });
  }, []);

  // Keep the popover anchored as the panel scrolls or the window resizes.
  useLayoutEffect(() => {
    if (!open || style !== 'popover') return;
    updatePosition();
    const handle = () => updatePosition();
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [open, style, updatePosition]);

  // Escape closes either presentation.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Click outside the trigger and the popover dismisses it (the modal uses its
  // own backdrop instead).
  useEffect(() => {
    if (!open || style !== 'popover') return;
    const handle = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open, style, close]);

  return (
    <label className={`parameter-label${showInfo ? ' parameter-label--with-info' : ''}`}>
      <span className="parameter-label-text">
        <MathLabel text={label} />
        {required && (
          <span className="parameter-required-marker" title="Required">
            {' '}
            *
          </span>
        )}
      </span>
      {showInfo && (
        <button
          ref={triggerRef}
          type="button"
          className="parameter-info-button"
          aria-label="Show parameter description"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={(event) => {
            // Inside a <label>; stop the click from forwarding to a control.
            event.preventDefault();
            setOpen((prev) => !prev);
          }}
        >
          <IoInformationCircleOutline />
        </button>
      )}

      {showInfo &&
        open &&
        style === 'popover' &&
        popoverPos &&
        createPortal(
          <div
            ref={popoverRef}
            className="parameter-info-popover"
            role="dialog"
            style={{ left: popoverPos.left, top: popoverPos.top }}
          >
            <MathLabel text={description!} />
          </div>,
          document.body
        )}

      {showInfo &&
        open &&
        style === 'modal' &&
        createPortal(
          <div
            className="parameter-info-overlay"
            role="dialog"
            aria-modal="true"
            onMouseDown={close}
          >
            <div className="parameter-info-modal" onMouseDown={(event) => event.stopPropagation()}>
              <div className="parameter-info-modal-header">
                <h2 className="parameter-info-modal-title">
                  <MathLabel text={label} />
                </h2>
                <button
                  type="button"
                  className="parameter-info-modal-close"
                  aria-label="Close"
                  onClick={close}
                >
                  <IoClose />
                </button>
              </div>
              <div className="parameter-info-modal-body">
                <Suspense fallback={<p className="parameter-info-loading">Loading…</p>}>
                  <MarkdownContent text={description!} />
                </Suspense>
              </div>
            </div>
          </div>,
          document.body
        )}
    </label>
  );
};

export default ParameterLabel;
