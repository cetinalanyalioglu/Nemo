import { beforeEach, describe, expect, it } from 'vitest';
import { figureLayout, mergeLayout, readFigurePalette, themedLayout } from './figure-theme';

/** Paints the document with a palette, as a stylesheet would. */
const setTheme = (vars: Record<string, string>) => {
  const root = document.documentElement;
  root.style.cssText = '';
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
};

const LIGHT = {
  '--color-surface': '#ffffff',
  '--color-text-body': '#333333',
  '--color-border-subtle': '#eaeaea',
  '--color-series-1': '#2563eb',
  '--color-series-2': '#ea580c',
};

const DARK = {
  '--color-surface': '#1c1c21',
  '--color-text-body': '#d4d4dc',
  '--color-border-subtle': '#34343c',
  '--color-series-1': '#60a5fa',
  '--color-series-2': '#fb923c',
};

describe('reading the palette off the page', () => {
  beforeEach(() => setTheme({}));

  it('takes the colours the interface is using', () => {
    setTheme(LIGHT);
    const palette = readFigurePalette();
    expect(palette.surface).toBe('#ffffff');
    expect(palette.body).toBe('#333333');
    expect(palette.colorway).toEqual(['#2563eb', '#ea580c']);
  });

  it('follows a theme change, because it reads rather than remembers', () => {
    setTheme(LIGHT);
    const light = readFigurePalette();
    setTheme(DARK);
    const dark = readFigurePalette();
    expect(dark.surface).not.toBe(light.surface);
    expect(dark.colorway[0]).toBe('#60a5fa');
  });

  it('still answers on a page with no stylesheet at all', () => {
    // A figure with no colours is unreadable; a fallback keeps one drawable.
    const palette = readFigurePalette();
    expect(palette.surface).toMatch(/^#/);
    expect(palette.colorway.length).toBeGreaterThan(0);
  });
});

describe('what the interface supplies', () => {
  beforeEach(() => setTheme(LIGHT));

  it('sets the background, the type and the series colours', () => {
    const layout = figureLayout(readFigurePalette());
    expect(layout.paper_bgcolor).toBe('#ffffff');
    expect(layout.plot_bgcolor).toBe('#ffffff');
    expect(layout.colorway).toEqual(['#2563eb', '#ea580c']);
  });
});

describe('what a figure asks for', () => {
  beforeEach(() => setTheme(LIGHT));

  it('wins over what the interface supplies', () => {
    const themed = themedLayout(
      { paper_bgcolor: 'black', title: { text: 'Mine' } },
      readFigurePalette()
    );
    expect(themed.paper_bgcolor).toBe('black');
    expect((themed.title as { text: string }).text).toBe('Mine');
  });

  it('keeps the styling it was silent about', () => {
    // A figure that names only its axis title must not lose the grid colour that came
    // with the rest of the axis.
    const themed = themedLayout({ xaxis: { title: { text: 'frequency' } } }, readFigurePalette());
    const xaxis = themed.xaxis as Record<string, unknown>;
    expect(xaxis.gridcolor).toBe('#eaeaea');
    expect((xaxis.title as { text: string }).text).toBe('frequency');
  });

  it('is styled on every axis it has, not only the first pair', () => {
    // A figure with three panels should not have one that matches the app and two that
    // do not.
    const themed = themedLayout(
      { xaxis2: {}, yaxis3: { title: { text: 'phase' } } },
      readFigurePalette()
    );
    expect((themed.xaxis2 as Record<string, unknown>).gridcolor).toBe('#eaeaea');
    expect((themed.yaxis3 as Record<string, unknown>).gridcolor).toBe('#eaeaea');
  });

  it('is styled even when it brought no layout of its own', () => {
    expect(themedLayout(undefined, readFigurePalette()).paper_bgcolor).toBe('#ffffff');
    expect(themedLayout('nonsense', readFigurePalette()).paper_bgcolor).toBe('#ffffff');
  });
});

describe('merging one layout into another', () => {
  it('replaces a list rather than merging into it', () => {
    // A figure naming three series colours means those three, not those three plus the
    // rest of the interface's.
    const merged = mergeLayout({ colorway: ['a', 'b', 'c'] }, { colorway: ['x'] });
    expect(merged.colorway).toEqual(['x']);
  });

  it('leaves what it was given alone', () => {
    const base = { font: { size: 12 } };
    const merged = mergeLayout(base, { font: { size: 20 } });
    expect((base.font as { size: number }).size).toBe(12);
    expect((merged.font as { size: number }).size).toBe(20);
  });
});
