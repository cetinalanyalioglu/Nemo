import React, { useEffect, useMemo } from 'react';
import { IoChevronUpOutline, IoTerminalOutline } from 'react-icons/io5';
import { useAppState } from '../context/AppStateContext';
import { useConsoleResize } from '../hooks/use-console-resize';
import { useConsoleStore } from '../store/consoleStore';
import ConsoleLogsTab from './console-logs-tab';
import '../styles/console-pane.css';

const ConsolePane = React.memo(() => {
  const {
    consolePane: { isOpen, height },
    actions,
  } = useAppState();

  const unreadCount = useConsoleStore((s) => s.unreadCount);
  const markRead = useConsoleStore((s) => s.markRead);

  // While the pane is open, every message is seen as it arrives, so keep the
  // unread counter cleared. Closing the pane lets the counter accumulate again.
  useEffect(() => {
    if (isOpen && unreadCount > 0) markRead();
  }, [isOpen, unreadCount, markRead]);

  const { paneRef, onResizePointerDown } = useConsoleResize(
    height,
    actions.consolePane.setHeight,
    isOpen
  );

  const paneStyle = useMemo((): React.CSSProperties | undefined => {
    if (!isOpen) return undefined;
    return { ['--console-pane-height' as string]: `${height}px` };
  }, [isOpen, height]);

  return (
    <div ref={paneRef} className={`console-pane ${isOpen ? 'open' : ''}`} style={paneStyle}>
      {isOpen && (
        <div
          className="console-pane-resize-handle"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize console"
          onPointerDown={onResizePointerDown}
        />
      )}
      <div className="console-pane-header">
        <div className="console-pane-title-group">
          <IoTerminalOutline className="console-pane-icon" aria-hidden />
          <span className="console-pane-title">CONSOLE</span>
          {!isOpen && unreadCount > 0 && (
            <span
              className="console-pane-unread-badge"
              title={`${unreadCount} new message${unreadCount === 1 ? '' : 's'}`}
              aria-label={`${unreadCount} unread console message${unreadCount === 1 ? '' : 's'}`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <IoChevronUpOutline
          className="console-pane-toggle"
          onClick={() => actions.consolePane.toggle()}
          aria-label={isOpen ? 'Collapse console' : 'Expand console'}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              actions.consolePane.toggle();
            }
          }}
        />
      </div>
      <div className="console-pane-body">
        <ConsoleLogsTab />
      </div>
    </div>
  );
});

ConsolePane.displayName = 'ConsolePane';

export default ConsolePane;
