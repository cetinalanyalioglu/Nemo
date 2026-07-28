import React, { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import MarkdownContent from '../MarkdownContent';
import {
  hasData,
  joinLines,
  type CellOutput,
  type MimeBundle,
  type MultilineString,
} from '../../types/notebook';

/**
 * Showing one output.
 *
 * An output offers itself in several forms at once and the richest one that can be
 * drawn here is the one shown — a figure as a figure, a table as a table, and anything
 * else as the text every value can always fall back to. The order below is that
 * preference, and it is the only place in the app that decides what a media type means.
 */

/** Media types this can draw, richest first. */
const PREFERRED = [
  'application/vnd.plotly.v1+json',
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'text/markdown',
  'text/latex',
  'text/html',
  'text/plain',
] as const;

type Renderable = (typeof PREFERRED)[number];

/** The richest form of `data` that can be drawn, and nothing when there is none. */
export const chooseMime = (data: MimeBundle): Renderable | null =>
  PREFERRED.find((mime) => data[mime] !== undefined) ?? null;

/** Whether an output can be pinned to the canvas: it has to be something to look at. */
export const isPinnable = (output: CellOutput): boolean => {
  if (!hasData(output)) return false;
  const mime = chooseMime(output.data);
  return (
    mime === 'application/vnd.plotly.v1+json' || mime === 'image/svg+xml' || mime === 'image/png'
  );
};

/**
 * Escape codes a terminal would colour with; nothing here reads them, so they go.
 *
 * Anchored on the escape character rather than on the bracket. A traceback is full of
 * ordinary bracketed text -- indices, list reprs -- and a pattern that began at the
 * bracket would eat pieces of what it is meant to be showing.
 */
// eslint-disable-next-line no-control-regex -- the escape character is what is matched
const ANSI = /\u001b\[[0-9;]*[a-zA-Z]/g;

const stripAnsi = (text: string): string => text.replace(ANSI, '');

/**
 * Plotly's drawing code, fetched the first time a figure is shown and not before.
 *
 * It is several megabytes, and a session that draws no figure should never pay for it.
 */
type PlotlyModule = (typeof import('plotly.js-dist-min'))['default'];

let plotlyPromise: Promise<PlotlyModule> | null = null;
export const loadPlotly = (): Promise<PlotlyModule> => {
  if (!plotlyPromise) plotlyPromise = import('plotly.js-dist-min').then((m) => m.default);
  return plotlyPromise;
};

/** A figure, drawn from the description the interpreter sent. */
const PlotlyFigure = React.memo(({ spec }: { spec: Record<string, unknown> }) => {
  const holder = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    let drawn: HTMLDivElement | null = null;
    loadPlotly()
      .then((Plotly) => {
        if (!live || !holder.current) return;
        drawn = holder.current;
        const layout = { autosize: true, ...((spec.layout as object) ?? {}) };
        return Plotly.newPlot(drawn, (spec.data ?? []) as never, layout as never, {
          responsive: true,
          displaylogo: false,
        });
      })
      .catch((error) => live && setFailed(String(error)));
    return () => {
      live = false;
      // Plotly attaches listeners and a WebGL context to the element it drew into;
      // React removing the node is not enough to let go of either.
      if (drawn) void loadPlotly().then((Plotly) => Plotly.purge(drawn!));
    };
  }, [spec]);

  if (failed)
    return <pre className="cell-output-text error">could not draw the figure: {failed}</pre>;
  return <div className="cell-output-figure" ref={holder} data-figure />;
});

PlotlyFigure.displayName = 'PlotlyFigure';

/** HTML an interpreter produced, with anything that could act stripped out of it. */
const SafeHtml = React.memo(({ html }: { html: string }) => (
  <div
    className="cell-output-html"
    // The interpreter is the user's own, but its output is not: a table from a library,
    // a page scraped into a DataFrame. Nothing here needs script, so nothing gets it.
    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
  />
));

SafeHtml.displayName = 'SafeHtml';

const text = (value: unknown): string => joinLines(value as MultilineString | undefined);

/** One output's chosen form, drawn. */
const Rendered = React.memo(({ mime, data }: { mime: Renderable; data: MimeBundle }) => {
  switch (mime) {
    case 'application/vnd.plotly.v1+json':
      return <PlotlyFigure spec={data[mime] as Record<string, unknown>} />;
    case 'image/svg+xml':
      return <SafeHtml html={text(data[mime])} />;
    case 'image/png':
    case 'image/jpeg': {
      // Images arrive base64-encoded, as the format stores them.
      const encoded = text(data[mime]).replace(/\s/g, '');
      return <img className="cell-output-image" src={`data:${mime};base64,${encoded}`} alt="" />;
    }
    case 'text/markdown':
      return <MarkdownContent text={text(data[mime])} />;
    case 'text/latex':
      // Display maths, which the markdown pipeline already typesets.
      return <MarkdownContent text={text(data[mime])} />;
    case 'text/html':
      return <SafeHtml html={text(data[mime])} />;
    case 'text/plain':
    default:
      return <pre className="cell-output-text">{stripAnsi(text(data[mime]))}</pre>;
  }
});

Rendered.displayName = 'Rendered';

const CellOutputView = React.memo(({ output }: { output: CellOutput }) => {
  if (output.output_type === 'stream') {
    return (
      <pre className={`cell-output-text ${output.name === 'stderr' ? 'error' : ''}`}>
        {stripAnsi(joinLines(output.text))}
      </pre>
    );
  }
  if (output.output_type === 'error') {
    return <pre className="cell-output-text error">{stripAnsi(output.traceback.join('\n'))}</pre>;
  }
  const mime = chooseMime(output.data);
  if (!mime) return null;
  return <Rendered mime={mime} data={output.data} />;
});

CellOutputView.displayName = 'CellOutputView';

export default CellOutputView;
