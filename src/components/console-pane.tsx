import React, { useMemo } from 'react';
import { IoChevronUpOutline, IoTerminalOutline } from 'react-icons/io5';
import { useAppState } from '../context/AppStateContext';
import { useConsoleResize } from '../hooks/use-console-resize';
import type { ConsoleTab } from '../types/console';
import ConsoleLogsTab from './console-logs-tab';
import ConsolePythonTab from './console-python-tab';
import '../styles/console-pane.css';

const TABS: { id: ConsoleTab; label: string; disabled?: boolean }[] = [
  { id: 'logs', label: 'Logs' },
  { id: 'python', label: 'Python' },
];

const ConsolePane = React.memo(() => {
  const {
    consolePane: { isOpen, activeTab, height },
    actions,
  } = useAppState();

  const { paneRef, onResizePointerDown } = useConsoleResize(
    height,
    actions.consolePane.setHeight,
    isOpen
  );

  const handleTabClick = (tab: ConsoleTab) => {
    if (activeTab === tab && isOpen) return;
    actions.consolePane.selectTab(tab);
  };

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
        <div className="console-pane-tabs" role="tablist" aria-label="Console views">
          {TABS.map(({ id, label, disabled }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              className={`console-pane-tab ${activeTab === id ? 'active' : ''}`}
              onClick={() => handleTabClick(id)}
              disabled={disabled}
            >
              {label}
            </button>
          ))}
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
      <div className="console-pane-body" role="tabpanel">
        {activeTab === 'logs' ? <ConsoleLogsTab /> : <ConsolePythonTab />}
      </div>
    </div>
  );
});

ConsolePane.displayName = 'ConsolePane';

export default ConsolePane;
