import { afterEach, describe, expect, it } from 'vitest';
import { applyPrintTheme } from './print-theme';

const root = document.documentElement;

afterEach(() => {
  root.removeAttribute('data-theme');
  document.head.querySelectorAll('style').forEach((s) => s.remove());
});

describe('the theme an export is built in', () => {
  it('builds in the light theme when the session is dark', () => {
    // An export is read on white. Pale ink is pale because there is a dark surface
    // behind it, and a page has none.
    root.setAttribute('data-theme', 'dark');
    const restore = applyPrintTheme();
    expect(root.getAttribute('data-theme')).toBe('light');
    restore();
  });

  it('puts the session theme back afterwards', () => {
    root.setAttribute('data-theme', 'dark');
    const restore = applyPrintTheme();
    restore();
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('does nothing at all to a session already in the light theme', () => {
    // Nothing to switch, so nothing is frozen and nothing is restored.
    root.setAttribute('data-theme', 'light');
    const before = document.head.querySelectorAll('style').length;
    const restore = applyPrintTheme();
    expect(document.head.querySelectorAll('style').length).toBe(before);
    restore();
    expect(root.getAttribute('data-theme')).toBe('light');
  });

  it('suppresses transitions while it is switched, and only while', () => {
    // A colour transition would still be running while the drawing is read, so what is
    // harvested would be a value part-way between the two themes.
    root.setAttribute('data-theme', 'dark');
    const restore = applyPrintTheme();
    const frozen = [...document.head.querySelectorAll('style')].some((s) =>
      s.textContent?.includes('transition: none')
    );
    expect(frozen).toBe(true);
    restore();
    const stillFrozen = [...document.head.querySelectorAll('style')].some((s) =>
      s.textContent?.includes('transition: none')
    );
    expect(stillFrozen).toBe(false);
  });
});
