/// <reference types="vite/client" />

/**
 * Plotly ships no types for its prebuilt bundle. Only the three calls the output
 * renderer makes are declared, so a fourth is a type error rather than an `any`.
 */
declare module 'plotly.js-dist-min' {
  const Plotly: {
    newPlot: (
      el: HTMLElement,
      data: unknown[],
      layout?: unknown,
      config?: unknown
    ) => Promise<HTMLElement>;
    purge: (el: HTMLElement) => void;
    toImage: (
      el: HTMLElement,
      opts: { format: 'svg' | 'png'; width?: number; height?: number }
    ) => Promise<string>;
  };
  export default Plotly;
}
