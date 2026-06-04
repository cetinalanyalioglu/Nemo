import React, { useEffect, useRef } from 'react';
import { IoTrashOutline } from 'react-icons/io5';
import { useConsoleStore } from '../store/consoleStore';
import { appendConsoleMessage } from '../utils/console-log';
import type { ConsoleLogEntry } from '../types/console';

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const ConsoleLogRow = React.memo(({ entry }: { entry: ConsoleLogEntry }) => (
  <div className="console-log-entry">
    <span className="console-log-time">{formatTime(entry.timestamp)}</span>
    <span className={`console-log-level ${entry.level}`}>{entry.level}</span>
    <span className="console-log-message">{entry.message}</span>
  </div>
));

ConsoleLogRow.displayName = 'ConsoleLogRow';

const ConsoleLogsTab = React.memo(() => {
  const entries = useConsoleStore((s) => s.entries);
  const clear = useConsoleStore((s) => s.clear);
  const listRef = useRef<HTMLDivElement>(null);
  const didSeedRef = useRef(false);

  useEffect(() => {
    if (didSeedRef.current) return;
    didSeedRef.current = true;
    if (entries.length === 0) {
      appendConsoleMessage('Console ready. Application messages will appear here.', 'info');
    }
  }, [entries.length]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [entries]);

  return (
    <div className="console-logs-tab">
      <div className="console-logs-toolbar">
        <button
          type="button"
          className="console-logs-clear"
          onClick={clear}
          disabled={entries.length === 0}
          aria-label="Clear log messages"
        >
          <IoTrashOutline aria-hidden />
          <span>Clear</span>
        </button>
      </div>
      <div className="console-logs-list" ref={listRef} role="log" aria-live="polite">
        {entries.length === 0 ? (
          <p className="console-logs-empty">No messages yet.</p>
        ) : (
          entries.map((entry) => <ConsoleLogRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
});

ConsoleLogsTab.displayName = 'ConsoleLogsTab';

export default ConsoleLogsTab;
