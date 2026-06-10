/**
 * Built-in scientific colormaps and helpers for mapping a numeric value to a
 * color. Colormaps are defined as evenly spaced RGB control points (0-255) and
 * sampled with piecewise-linear interpolation. No external dependencies.
 */
import type { ColormapId } from '../types/data';

type RGB = [number, number, number];

/**
 * Evenly spaced control points per colormap. Stops are assumed uniformly
 * distributed across [0, 1]; values sampled from matplotlib's colormaps.
 */
const COLORMAP_STOPS: Record<ColormapId, RGB[]> = {
  viridis: [
    [68, 1, 84],
    [72, 40, 120],
    [62, 74, 137],
    [49, 104, 142],
    [38, 130, 142],
    [31, 158, 137],
    [53, 183, 121],
    [109, 205, 89],
    [253, 231, 37],
  ],
  plasma: [
    [13, 8, 135],
    [75, 3, 161],
    [125, 3, 168],
    [168, 34, 150],
    [203, 70, 121],
    [229, 107, 93],
    [248, 148, 65],
    [253, 195, 40],
    [240, 249, 33],
  ],
  inferno: [
    [0, 0, 4],
    [31, 12, 72],
    [85, 15, 109],
    [136, 34, 106],
    [186, 54, 85],
    [227, 89, 51],
    [249, 140, 10],
    [249, 201, 50],
    [252, 255, 164],
  ],
  magma: [
    [0, 0, 4],
    [28, 16, 68],
    [79, 18, 123],
    [129, 37, 129],
    [181, 54, 122],
    [229, 80, 100],
    [251, 135, 97],
    [254, 194, 135],
    [252, 253, 191],
  ],
  cividis: [
    [0, 32, 76],
    [0, 42, 102],
    [47, 75, 124],
    [86, 108, 117],
    [124, 123, 120],
    [156, 140, 108],
    [192, 158, 84],
    [230, 178, 50],
    [255, 234, 70],
  ],
  coolwarm: [
    [59, 76, 192],
    [124, 159, 249],
    [221, 221, 221],
    [246, 150, 121],
    [180, 4, 38],
  ],
  grayscale: [
    [0, 0, 0],
    [255, 255, 255],
  ],
};

/** Options for colormap dropdowns, in display order. */
export const COLORMAP_OPTIONS: { value: ColormapId; label: string }[] = [
  { value: 'viridis', label: 'Viridis' },
  { value: 'plasma', label: 'Plasma' },
  { value: 'inferno', label: 'Inferno' },
  { value: 'magma', label: 'Magma' },
  { value: 'cividis', label: 'Cividis' },
  { value: 'coolwarm', label: 'Cool–Warm' },
  { value: 'grayscale', label: 'Grayscale' },
];

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/**
 * Normalizes a value into [0, 1] given a range, clamped at both ends. When
 * `max <= min` the range is degenerate and everything maps to 0.
 */
export const normalize = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value) || max <= min) return 0;
  return clamp01((value - min) / (max - min));
};

/** Samples a colormap at position `t` in [0, 1], returning an RGB triple. */
const sampleColormapRGB = (id: ColormapId, t: number): RGB => {
  const stops = COLORMAP_STOPS[id] ?? COLORMAP_STOPS.viridis;
  const clamped = clamp01(t);
  if (stops.length === 1) return stops[0];

  const scaled = clamped * (stops.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(lowerIndex + 1, stops.length - 1);
  const frac = scaled - lowerIndex;

  const lower = stops[lowerIndex];
  const upper = stops[upperIndex];

  return [
    Math.round(lower[0] + (upper[0] - lower[0]) * frac),
    Math.round(lower[1] + (upper[1] - lower[1]) * frac),
    Math.round(lower[2] + (upper[2] - lower[2]) * frac),
  ];
};

/** Samples a colormap at position `t` in [0, 1], returning a CSS `rgb()` string. */
export const sampleColormap = (id: ColormapId, t: number): string => {
  const [r, g, b] = sampleColormapRGB(id, t);
  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Maps a value to a CSS color via the given colormap and range. Returns null
 * for non-finite values so callers can skip rendering.
 */
export const colorForValue = (
  id: ColormapId,
  value: number,
  min: number,
  max: number
): string | null => {
  if (!Number.isFinite(value)) return null;
  return sampleColormap(id, normalize(value, min, max));
};

/**
 * Builds a CSS `linear-gradient(...)` string spanning a colormap, for legend
 * bars and dropdown swatches. `direction` defaults to a left-to-right gradient.
 */
export const colormapGradient = (id: ColormapId, direction = 'to right'): string => {
  const stops = COLORMAP_STOPS[id] ?? COLORMAP_STOPS.viridis;
  const segments = stops.map((stop, index) => {
    const pct = stops.length === 1 ? 100 : (index / (stops.length - 1)) * 100;
    return `rgb(${stop[0]}, ${stop[1]}, ${stop[2]}) ${pct.toFixed(1)}%`;
  });
  return `linear-gradient(${direction}, ${segments.join(', ')})`;
};
