import React, { useEffect, useMemo } from 'react';
import { IoChevronUpOutline, IoTerminalOutline } from 'react-icons/io5';
import { useAppState } from '../context/AppStateContext';
import { useConsoleResize } from '../hooks/use-console-resize';
import { useConsoleStore } from '../store/consoleStore';
import type { ConsoleTab } from '../types/console';
import ConsoleLogsTab from './console-logs-tab';
import ConsolePythonTab from './console-python-tab';
import ConsoleVariablesTab from './console-variables-tab';
import '../styles/console-pane.css';

const TABS: { id: ConsoleTab; label: string }[] = [
  { id: 'logs', label: 'Messages' },
  { id: 'python', label: 'Python' },
  { id: 'variables', label: 'Variables' },
];

/** A tab and the panel it opens each need a name the other can point at. */
const tabId = (tab: ConsoleTab): string => `console-tab-${tab}`;
const panelId = (tab: ConsoleTab): string => `console-panel-${tab}`;

/**
 * What clicking a name in the header does.
 *
 * Clicking the name that is already showing puts the pane away, so the name that opened
 * the console also closes it and the chevron is not the only way back out. Clicking any
 * other name moves to it, and never closes.
 */
export const clickOnTab = (
  isOpen: boolean,
  activeTab: ConsoleTab,
  clicked: ConsoleTab
): 'collapse' | 'show' => (isOpen && activeTab === clicked ? 'collapse' : 'show');

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
            {TABS.map((tab) => {
              const showing = isOpen && activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={tabId(tab.id)}
                  aria-controls={panelId(tab.id)}
                  aria-selected={showing}
                  aria-expanded={showing}
                  className={`console-pane-tab ${showing ? 'active' : ''}`}
                  title={showing ? `Collapse ${tab.label}` : tab.label}
                  onClick={() =>
                    clickOnTab(isOpen, activeTab, tab.id) === 'collapse'
                      ? actions.consolePane.toggle()
                      : actions.consolePane.selectTab(tab.id)
                  }
                >
                  {tab.label}
                  {tab.id === 'logs' && !showing && unreadCount > 0 && (
                    <span
                      className="console-pane-unread-badge"
                      title={`${unreadCount} new message${unreadCount === 1 ? '' : 's'}`}
                      aria-label={`${unreadCount} unread console message${unreadCount === 1 ? '' : 's'}`}
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
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
            position, and neither should be lost by looking at the messages.

            Each panel names the tab it belongs to, so a panel reached on its own —
            which is how anything reading the page by other means arrives at one — is
            announced as the thing that tab opens rather than as an unnamed region. */}
        <div
          className="console-pane-tab-panel"
          hidden={activeTab !== 'logs'}
          role="tabpanel"
          id={panelId('logs')}
          aria-labelledby={tabId('logs')}
        >
          <ConsoleLogsTab />
        </div>
        <div
          className="console-pane-tab-panel"
          hidden={activeTab !== 'python'}
          role="tabpanel"
          id={panelId('python')}
          aria-labelledby={tabId('python')}
        >
          <ConsolePythonTab />
        </div>
        <div
          className="console-pane-tab-panel"
          hidden={activeTab !== 'variables'}
          role="tabpanel"
          id={panelId('variables')}
          aria-labelledby={tabId('variables')}
        >
          <ConsoleVariablesTab active={isOpen && activeTab === 'variables'} />
        </div>
      </div>
    </div>
  );
});

ConsolePane.displayName = 'ConsolePane';

export default ConsolePane;
