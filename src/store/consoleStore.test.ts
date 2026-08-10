import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('opens keeping everything that answers something the user did', () => {
    // The rule the levels encode, and the one that decides which level a call site
    // should use: a message reporting the outcome of an action someone took survives
    // the default, and only the app's account of its own progress is left out. A site
    // that explains why a click did nothing is `warn` or `success` for this reason.
    useConsoleStore.getState().setVerbosity(CONSOLE_VERBOSITY_DEFAULT);
    useConsoleStore.getState().clear();

    const { append } = useConsoleStore.getState();
    (['success', 'warn', 'error'] as const).forEach((level) => append(level, level));
    (['info', 'debug'] as const).forEach((level) => append(level, level));

    expect(useConsoleStore.getState().entries.map((e) => e.level)).toEqual([
      'success',
      'warn',
      'error',
    ]);
  });

  it('remembers the choice between sessions', () => {
    useConsoleStore.getState().setVerbosity('warn');
    expect(localStorage.getItem(VERBOSITY_KEY)).toBe('warn');
  });
});

describe('the verbosity remembered between sessions', () => {
  it('refuses a stored value that is a level but not a choice', () => {
    // `error` is a level a message can have; it is not one of the choices offered, and
    // taken as one it would drop the warnings too. Nothing here writes it — a later
    // version or a hand-edited store might.
    localStorage.setItem(VERBOSITY_KEY, 'error');
    vi.resetModules();
    return import('./consoleStore').then(({ useConsoleStore: fresh }) => {
      expect(fresh.getState().verbosity).toBe(CONSOLE_VERBOSITY_DEFAULT);
      localStorage.removeItem(VERBOSITY_KEY);
    });
  });

  it('keeps a stored value that is one of the choices', () => {
    localStorage.setItem(VERBOSITY_KEY, 'warn');
    vi.resetModules();
    return import('./consoleStore').then(({ useConsoleStore: fresh }) => {
      expect(fresh.getState().verbosity).toBe('warn');
      localStorage.removeItem(VERBOSITY_KEY);
    });
  });
});
