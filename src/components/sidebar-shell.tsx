import React, { useCallback, useEffect, useRef, useState } from 'react';
import '../styles/sidebar.css';
import { useAppState } from '../context/AppStateContext';

/** Shortest the overlay thumb is allowed to get, so it stays grabbable. */
const MIN_THUMB_HEIGHT = 32;

type Thumb = { height: number; offset: number };

type Drag = { startY: number; startScrollTop: number; scrollPerPixel: number };

/**
 * Shared frame for every left-rail pane: the scrolling pane surface plus an
 * overlay scrollbar.
 *
 * A classic scrollbar carves its gutter out of the scrollport, so full-bleed
 * pane furniture — section headers, divider rules — would stop short of the
 * right border and leave a pale strip against the canvas seam. The native
 * scrollbar is therefore hidden (see sidebar.css) and this thumb is drawn on
 * top of the content, flush to the pane's right edge.
 */
const SidebarShell = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  const {
    sidebar: { isOpen },
  } = useAppState();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [thumb, setThumb] = useState<Thumb | null>(null);

  const measure = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const { clientHeight, scrollHeight, scrollTop } = scroller;
    const overflow = scrollHeight - clientHeight;
    // Sub-pixel content heights round up to a 1px overflow that cannot be
    // scrolled; treat that as "fits" so the thumb does not flicker in.
    if (overflow <= 1) {
      setThumb(null);
      return;
    }
    const height = Math.max(
      MIN_THUMB_HEIGHT,
      Math.round((clientHeight / scrollHeight) * clientHeight)
    );
    const travel = Math.max(clientHeight - height, 1);
    setThumb({ height, offset: Math.round((travel * scrollTop) / overflow) });
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    measure();
    scroller.addEventListener('scroll', measure, { passive: true });
    // Watch the content box as well as the scrollport: collapsing a group
    // animates `max-height`, which changes the scroll height every frame
    // without emitting a scroll event.
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [measure]);

  // Drag scrolling runs on the thumb itself under pointer capture rather than on
  // window listeners: the pointer stays retargeted to the thumb even once it
  // leaves the pane, and React tears the handlers down with the node if the pane
  // unmounts mid-drag.
  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const scroller = scrollerRef.current;
    if (!scroller || !thumb) return;
    // Keep the press from selecting pane text while the thumb is dragged.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const overflow = scroller.scrollHeight - scroller.clientHeight;
    const travel = Math.max(scroller.clientHeight - thumb.height, 1);
    dragRef.current = {
      startY: event.clientY,
      startScrollTop: scroller.scrollTop,
      scrollPerPixel: overflow / travel,
    };
  };

  const onDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const scroller = scrollerRef.current;
    if (!drag || !scroller) return;
    scroller.scrollTop = drag.startScrollTop + (event.clientY - drag.startY) * drag.scrollPerPixel;
  };

  const classes = ['sidebar', className, isOpen ? 'open' : ''].filter(Boolean).join(' ');

  return (
    <div ref={scrollerRef} className={classes}>
      <div className="sidebar-scrollbar" aria-hidden>
        {thumb && (
          <div
            className="sidebar-scrollbar-thumb"
            style={{ height: thumb.height, transform: `translateY(${thumb.offset}px)` }}
            onPointerDown={startDrag}
            onPointerMove={onDragMove}
            // Implicit release on pointerup/cancel fires this — the only place
            // the drag needs to be cleared.
            onLostPointerCapture={() => {
              dragRef.current = null;
            }}
          />
        )}
      </div>
      <div ref={contentRef} className="sidebar-scroll-content">
        {children}
      </div>
    </div>
  );
};

export default SidebarShell;
