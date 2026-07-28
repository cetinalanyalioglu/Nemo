import React, { useEffect, useMemo } from 'react';
import { IoChevronUpOutline, IoTerminalOutline } from 'react-icons/io5';
import { useAppState } from '../context/AppStateContext';
import { useConsoleResize } from '../hooks/use-console-resize';
import { useConsoleStore } from '../store/consoleStore';
import type { ConsoleTab } from '../types/console';
import ConsoleLogsTab from './console-logs-tab';
import ConsolePythonTab from './console-python-tab';
import '../styles/console-pane.css';

const TABS: { id: ConsoleTab; label: string }[] = [
  { id: 'logs', label: 'Messages' },
  { id: 'python', label: 'Python' },
];

const ConsolePane = React.memo(() => {
  const {
    consolePane: { isOpen, height, activeTab },
    actions,
  } = useAppState();

  const unreadCount = useConsoleStore((s) => s.unreadCount);
  const markRead = useConsoleStore((s) => s.markRead);

  // While the messages tab is open, every message is seen as it arrives, so keep the
  // unread counter cleared. Closing the pane — or moving to Python — lets it
  // accumulate again.
  const watchingLogs = isOpen && activeTab === 'logs';
  useEffect(() => {
    if (watchingLogs && unreadCount > 0) markRead();
  }, [watchingLogs, unreadCount, markRead]);

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
          <div className="console-pane-tabs" role="tablist" aria-label="Console">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isOpen && activeTab === tab.id}
                className={`console-pane-tab ${isOpen && activeTab === tab.id ? 'active' : ''}`}
                onClick={() => actions.consolePane.selectTab(tab.id)}
              >
                {tab.label}
                {tab.id === 'logs' && (!isOpen || activeTab !== 'logs') && unreadCount > 0 && (
                  <span
                    className="console-pane-unread-badge"
                    title={`${unreadCount} new message${unreadCount === 1 ? '' : 's'}`}
                    aria-label={`${unreadCount} unread console message${unreadCount === 1 ? '' : 's'}`}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
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
        {/* Both tabs stay mounted: the Python prompt holds a draft and a scroll
            position, and neither should be lost by looking at the messages. */}
        <div className="console-pane-tab-panel" hidden={activeTab !== 'logs'} role="tabpanel">
          <ConsoleLogsTab />
        </div>
        <div className="console-pane-tab-panel" hidden={activeTab !== 'python'} role="tabpanel">
          <ConsolePythonTab />
        </div>
      </div>
    </div>
  );
});

ConsolePane.displayName = 'ConsolePane';

export default ConsolePane;
