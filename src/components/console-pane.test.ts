/** What clicking a name in the console header does. */

import { describe, expect, it } from 'vitest';
import { clickOnTab } from './console-pane';

describe('clicking a name in the console header', () => {
  it('opens the console on the name that was clicked', () => {
    expect(clickOnTab(false, 'logs', 'python')).toBe('show');
  });

  it('opens it on the name that was showing when it was last closed', () => {
    // Closing on Python and clicking Python is an opening, not a second collapse.
    expect(clickOnTab(false, 'python', 'python')).toBe('show');
  });

  it('puts the console away when the name showing is clicked again', () => {
    expect(clickOnTab(true, 'python', 'python')).toBe('collapse');
  });

  it('moves between names without closing', () => {
    expect(clickOnTab(true, 'python', 'variables')).toBe('show');
    expect(clickOnTab(true, 'variables', 'logs')).toBe('show');
  });
});
