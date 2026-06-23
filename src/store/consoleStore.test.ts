import { beforeEach, describe, expect, it } from 'vitest';
import { useConsoleStore } from './consoleStore';

describe('consoleStore unread tracking', () => {
  beforeEach(() => {
    useConsoleStore.getState().clear();
  });

  it('increments unreadCount on every append', () => {
    const { append } = useConsoleStore.getState();
    expect(useConsoleStore.getState().unreadCount).toBe(0);
    append('info', 'one');
    append('warn', 'two');
    expect(useConsoleStore.getState().unreadCount).toBe(2);
  });

  it('resets unreadCount when marked read', () => {
    const { append, markRead } = useConsoleStore.getState();
    append('info', 'one');
    append('error', 'two');
    markRead();
    expect(useConsoleStore.getState().unreadCount).toBe(0);
  });

  it('keeps the same state reference when marking an already-read console', () => {
    const before = useConsoleStore.getState();
    before.markRead();
    // No spurious update: unreadCount was already zero.
    expect(useConsoleStore.getState().unreadCount).toBe(0);
    expect(useConsoleStore.getState().entries).toBe(before.entries);
  });

  it('clears unreadCount along with the entries', () => {
    const { append, clear } = useConsoleStore.getState();
    append('info', 'one');
    clear();
    expect(useConsoleStore.getState().entries).toHaveLength(0);
    expect(useConsoleStore.getState().unreadCount).toBe(0);
  });
});
