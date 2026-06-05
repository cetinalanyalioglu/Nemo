import React, { useMemo } from 'react';
import { IoChevronUpOutline, IoTerminalOutline } from 'react-icons/io5';
import { useAppState } from '../context/AppStateContext';
import { useConsoleResize } from '../hooks/use-console-resize';
import ConsoleLogsTab from './console-logs-tab';
import '../styles/console-pane.css';

const ConsolePane = React.memo(() => {
  const {
    consolePane: { isOpen, height },
    actions,
  } = useAppState();

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
