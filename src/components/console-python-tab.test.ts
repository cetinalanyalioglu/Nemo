import { describe, expect, it } from 'vitest';
import { fitToContent, listedNames, sharedPrefix, wantsOpening } from './console-python-tab';

describe('the opening message', () => {
  it('waits for the model, whose example it offers', () => {
    expect(wantsOpening(false, 0)).toBe(false);
  });

  it('is written into an empty transcript', () => {
    expect(wantsOpening(true, 0)).toBe(true);
  });

  it('is not written over a session already in progress', () => {
    expect(wantsOpening(true, 3)).toBe(false);
  });

  it('comes round again once a switch has emptied the transcript', () => {
    // Which is what makes the example the model's own rather than whichever model
    // happened to be loaded first. See `startFresh`.
    expect(wantsOpening(true, 12)).toBe(false);
    expect(wantsOpening(true, 0)).toBe(true);
  });
});

/** A textarea whose content height is `scrollHeight`, as the browser would report it. */
const promptWith = (scrollHeight: number): HTMLTextAreaElement => {
  const input = document.createElement('textarea');
  Object.defineProperty(input, 'scrollHeight', { get: () => scrollHeight });
  return input;
};

describe('the growing prompt', () => {
  it('takes the height of what is in it', () => {
    const input = promptWith(64);
    fitToContent(input);
    expect(input.style.height).toBe('64px');
  });

  it('leaves the height to the stylesheet when there is nothing to measure', () => {
    // Both console tabs stay mounted, so this runs on a prompt with no layout whenever
    // the other tab is showing. A height set from that measurement is zero, and zero
    // does not correct itself: nothing measures again until a keystroke, and a prompt
    // of no height cannot be typed into.
    const input = promptWith(0);
    input.style.height = '64px';
    fitToContent(input);
    expect(input.style.height).toBe('auto');
  });

  it('does nothing when there is no prompt yet', () => {
    expect(() => fitToContent(null)).not.toThrow();
  });
});

describe('what Tab can write in without choosing', () => {
  it('writes the whole name when only one was offered', () => {
    expect(sharedPrefix(['solve'])).toBe('solve');
  });

  it('writes as far as the names agree', () => {
    expect(sharedPrefix(['field', 'fields', 'field_names'])).toBe('field');
  });

  it('writes nothing when they agree nowhere', () => {
    expect(sharedPrefix(['area', 'length'])).toBe('');
  });

  it('has nothing to write when nothing was offered', () => {
    expect(sharedPrefix([])).toBe('');
  });
});

describe('the names Tab lists when it cannot choose', () => {
  it('puts them on one line', () => {
    expect(listedNames(['area', 'length'])).toBe('area  length');
  });

  it('says how many it left out rather than running down the pane', () => {
    const many = Array.from({ length: 75 }, (_, i) => `name${i}`);
    const listed = listedNames(many);
    expect(listed).toContain('… and 15 more');
    expect(listed).not.toContain('name60');
  });
});
