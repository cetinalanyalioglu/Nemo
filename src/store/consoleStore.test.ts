import { beforeEach, describe, expect, it } from 'vitest';
import { useConsoleStore, VERBOSITY_KEY } from './consoleStore';
import { CONSOLE_VERBOSITY_DEFAULT } from '../types/console';

describe('consoleStore unread tracking', () => {
  beforeEach(() => {
    // Said rather than assumed: these are about counting messages, not about which
    // of them are worth recording, so they record all of them.
    useConsoleStore.getState().setVerbosity('debug');
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

describe('consoleStore verbosity', () => {
  beforeEach(() => {
    useConsoleStore.getState().setVerbosity('success');
    useConsoleStore.getState().clear();
  });

  it('records a message at the set level and above', () => {
    const { append } = useConsoleStore.getState();
    append('success', 'done');
    append('warn', 'careful');
    append('error', 'broken');
    expect(useConsoleStore.getState().entries.map((e) => e.message)).toEqual([
      'done',
      'careful',
      'broken',
    ]);
  });

  it('drops a message below the set level, and does not count it as unread', () => {
    const { append } = useConsoleStore.getState();
    append('debug', 'tracing');
    append('info', 'progress');
    expect(useConsoleStore.getState().entries).toHaveLength(0);
    expect(useConsoleStore.getState().unreadCount).toBe(0);
  });

  it('leaves what is already listed alone when the level is raised', () => {
    const { append } = useConsoleStore.getState();
    append('success', 'done');
    useConsoleStore.getState().setVerbosity('warn');
    expect(useConsoleStore.getState().entries).toHaveLength(1);
  });

  it('opens quiet enough to leave out the running commentary', () => {
    // The point of the default: an outcome is worth a line, a step taken towards one
    // is not. Pinned because it is the whole of what "less verbose" means here.
    const rank = { debug: 0, info: 1, success: 2, warn: 3, error: 4 };
    expect(rank[CONSOLE_VERBOSITY_DEFAULT]).toBeGreaterThan(rank.info);
  });

  it('remembers the choice between sessions', () => {
    useConsoleStore.getState().setVerbosity('warn');
    expect(localStorage.getItem(VERBOSITY_KEY)).toBe('warn');
  });
});
