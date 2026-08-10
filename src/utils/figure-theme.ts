/**
 * Making a figure look like the rest of the app.
 *
 * A figure arrives as a description of what to draw, and plotly's own idea of how to
 * draw it: its type, its greys, its gridlines. Left alone that is a picture from another
 * program sitting in this one — and in dark mode it is a white slab.
 *
 * So the interface supplies the styling and the figure supplies the data. The colours,
 * the type and the weights below are read from the stylesheet at the moment of drawing,
 * which means they are the same ones the pane around the figure is using and they follow
 * a theme change without anything here knowing that themes exist.
 *
 * **What a figure asks for, a figure gets.** These are applied under whatever its own
 * `layout` sets, so `fig.update_layout(paper_bgcolor="black")` still comes out black.
 * What they do override is a *template* — the styling a plotting library applies on the
 * figure's behalf — because that is the thing most likely to disagree with the interface
 * about which mode it is in.
 */

/** Series colours, in draw order. Beyond these plotly wraps, as it always has. */
const SERIES_COUNT = 8;

/** Reads one custom property off the document, with a fallback for a bare test DOM. */
const cssVar = (styles: CSSStyleDeclaration, name: string, fallback: string): string =>
  styles.getPropertyValue(name).trim() || fallback;

/** The current theme's colours and type, as plotly wants them named. */
export interface FigurePalette {
  surface: string;
  surfaceRaised: string;
  ink: string;
  body: string;
  muted: string;
  grid: string;
  axis: string;
  accent: string;
  colorway: string[];
  font: string;
}

/** Reads the palette from the stylesheet as it stands right now. */
export const readFigurePalette = (root: HTMLElement = document.documentElement): FigurePalette => {
  const styles = getComputedStyle(root);
  const colorway: string[] = [];
  for (let i = 1; i <= SERIES_COUNT; i++) {
    const colour = cssVar(styles, `--color-series-${i}`, '');
    if (colour) colorway.push(colour);
  }
  return {
    surface: cssVar(styles, '--color-surface', '#ffffff'),
    surfaceRaised: cssVar(styles, '--color-surface-subtle', '#fafafa'),
    ink: cssVar(styles, '--color-text-primary', '#212529'),
    body: cssVar(styles, '--color-text-body', '#333333'),
    muted: cssVar(styles, '--color-text-secondary', '#6c757d'),
    grid: cssVar(styles, '--color-border-subtle', '#eaeaea'),
    axis: cssVar(styles, '--color-border', '#dee2e6'),
    accent: cssVar(styles, '--color-accent', '#d4a72c'),
    colorway: colorway.length > 0 ? colorway : ['#2563eb'],
    font: cssVar(styles, '--font-sans', 'Arial, sans-serif'),
  };
};

/** Type sizes, a step down from plotly's defaults to sit with the interface. */
const TITLE_SIZE = 15;
const BODY_SIZE = 12;
/** Plotly's default margins leave a figure floating; these bring it back to its box. */
const MARGIN = { l: 60, r: 24, t: 44, b: 48 };

/** How an axis is drawn: a light grid, a visible baseline, and labels in the muted ink. */
const axis = (p: FigurePalette) => ({
  gridcolor: p.grid,
  zerolinecolor: p.axis,
  zerolinewidth: 1,
  linecolor: p.axis,
  tickcolor: p.axis,
  tickfont: { color: p.muted, size: BODY_SIZE },
  title: { font: { color: p.body, size: BODY_SIZE }, standoff: 8 },
  automargin: true,
});

/**
 * The layout the interface supplies for every figure.
 *
 * Returned as a plain layout rather than as a plotly template on purpose: a template
 * loses to anything a figure sets, including the template a plotting library installed,
 * and it is exactly that library's template — light, when the app may be dark — that
 * this has to win against.
 */
export const figureLayout = (palette: FigurePalette): Record<string, unknown> => {
  const p = palette;
  return {
    paper_bgcolor: p.surface,
    plot_bgcolor: p.surface,
    colorway: p.colorway,
    font: { family: p.font, size: BODY_SIZE, color: p.body },
    title: { font: { family: p.font, size: TITLE_SIZE, color: p.ink }, x: 0.02, xanchor: 'left' },
    margin: MARGIN,
    xaxis: axis(p),
    yaxis: axis(p),
    legend: {
      bgcolor: 'rgba(0,0,0,0)',
      bordercolor: p.grid,
      borderwidth: 0,
      font: { color: p.body, size: BODY_SIZE },
    },
    hoverlabel: {
      bgcolor: p.surfaceRaised,
      bordercolor: p.axis,
      font: { family: p.font, color: p.body, size: BODY_SIZE },
    },
    modebar: {
      bgcolor: 'rgba(0,0,0,0)',
      color: p.muted,
      activecolor: p.accent,
    },
  };
};

/** Whether a value is a plain object worth merging into rather than replacing. */
const isPlain = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * `base` with `over` on top: what `over` says wins, and what it is silent about is kept.
 *
 * Deep, because a figure that sets only `xaxis.title` must not lose the grid colour that
 * came with the rest of the axis.
 */
export const mergeLayout = (
  base: Record<string, unknown>,
  over: Record<string, unknown>
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(over)) {
    out[key] =
      isPlain(value) && isPlain(out[key])
        ? mergeLayout(out[key] as Record<string, unknown>, value)
        : value;
  }
  return out;
};

/**
 * A figure's layout, styled by the interface.
 *
 * Any axis the figure names beyond the first pair — `xaxis2`, `yaxis3`, the axes of a
 * subplot grid — is styled the same way, since a figure with three panels should not
 * have one that matches the app and two that do not.
 */
export const themedLayout = (
  figureLayoutOwn: unknown,
  palette: FigurePalette
): Record<string, unknown> => {
  const own = isPlain(figureLayoutOwn) ? figureLayoutOwn : {};
  const base = figureLayout(palette);
  for (const key of Object.keys(own)) {
    if (/^[xy]axis\d+$/.test(key)) base[key] = axis(palette);
  }
  return mergeLayout(base, own);
};
