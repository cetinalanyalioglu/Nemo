# Schematic glyph spec

The canvas draws each element's schematic from an SVG in `src/assets/glyphs/`.
The registry (`src/components/nodes/glyphs/index.ts`) is built from that folder automatically: a file `foo-bar.svg` registers under the key `foo-bar`, which node definitions reference via the model YAML `glyph` field.
Adding a glyph is dropping a file in the folder; no wrapper module is needed.
Review the whole set (light and dark, canvas size and enlarged) at `/?glyphs`.

## Rendering context

A box node paints, in order: a gray tile (`--box-node-fill`), the glyph, the port triangles, and the border ring.
The glyph therefore draws on gray, and the visual language is:

- **Flow passage** — a closed path filled `var(--color-surface)` (white in the light theme). The interior of the machine is always the surface color.
- **Outside** — unpainted. The gray tile shows through wherever there is solid material or empty margin.
- **Walls and features** — `currentColor` strokes (the frame sets `--box-node-ink`). Never hard-code a color.

## Geometry

- viewBox is `0 0 100 H` with `H` free (55–70 typical). The frame preserves the aspect and derives the node's locked aspect from it.
- The viewBox width may deviate to control the node's on-canvas length: the duct and pipe glyphs use `0 0 80 48` so they render as long as the compact two-port elements while keeping the same pixel scale (stroke widths, hatch density) as the Fanno pipe's `0 0 100 48`.
- Duct walls run to `x=0` and `x=100`; the model YAML's `glyphInsetX: -0.02` slides the passage under the side borders so it meets the port triangles.
- Leave headroom above/below the walls for the gray margin; `glyphInsetY` adds more if needed.

## Strokes

Widths are in viewBox units (the viewBox is 100 wide, see below).
The thick width matches the hand-drawn Sudden Area Change exactly: its Inkscape source strokes at 0.132292 under a ×19.9398 transform, i.e. 2.64 effective.

| Use                                   | Width | Style                                                      |
| ------------------------------------- | ----- | ---------------------------------------------------------- |
| Walls, primary features               | 2.64  | solid, `stroke-linecap="square"`                           |
| Secondary marks (ticks, arrows)       | 2     | solid                                                      |
| Centerlines, stations, vena contracta | 1.3   | `stroke-dasharray="2 5"` (sparse; never denser than `2 4`) |

Filled marks (arrowheads, matrix dots, the equilibrium flame body) use `fill="currentColor"`; a cut-out inside a filled mark uses `fill="var(--color-surface)"`.

## Wall hatching

Distributed pipe-like elements (duct, pipe, Fanno pipe) show the wall material as diagonally hatched bands; compact restriction elements keep plain wall lines.
The standard geometry in a `0 0 100 48` viewBox: bore `y = 10..38`, hatch bands `y = 0..10` and `y = 38..48` running to the very glyph edge, and thin (1.3) flow-side wall lines.
There is no outer boundary line in the glyph: the negative insets tuck the bands under the node's border ring, which is the canvas-facing border.
The two bands mirror their hatch direction about the centerline:

```svg
<pattern id="__IDP__-hatch-t" patternUnits="userSpaceOnUse" width="3.6" height="3.6"
         patternTransform="rotate(45)"><rect width="1.1" height="3.6" fill="currentColor"/></pattern>
<pattern id="__IDP__-hatch-b" patternUnits="userSpaceOnUse" width="3.6" height="3.6"
         patternTransform="rotate(-45)"><rect width="1.1" height="3.6" fill="currentColor"/></pattern>
```

Use this pattern for any future wall-material marking instead of ad-hoc ticks.

## Rail glyphs

The manifold family (junction, lossless splitter, ideal mixer, forced splitter) carries a math mark rather than a schematic, and the rail frame reads the glyph's _viewBox_ aspect — not its ink — to set the bar width (`RailNodeFrame.railLayout`).
Two shapes exist:

- **Tall** (aspect below 0.7) — the mark fills the bar and runs along it. The equation glyphs are set with LaTeX and converted to paths (`latex` then `dvisvgm --no-fonts --exact-bbox`), then rotated −90° so the text reads along the rail.
- **Bead** (aspect at or above 0.7, e.g. the junction's centre dot) — the mark is drawn at a fixed 17.7-unit box centred on a thin bar, so it keeps the same on-canvas size whether the element is shown as a rail or a circle.

A single-symbol mark stays upright (the forced splitter's `\bm{\beta}`, its outflow fractions).
To keep such an element the same width as the lossless splitter, give it that glyph's viewBox (`0 0 100 458.459`) and scale the symbol to span the full 100-unit width, centred on the long axis.
Ink outside the viewBox is clipped: the frame draws the glyph in a nested `<svg>` viewport, so the symbol's width is capped by the bar it sits on.

## Editing in Inkscape

Every glyph is a plain standalone SVG (`xmlns` + `viewBox`), so the files open directly in Inkscape.
Two conventions survive a round trip but render unstyled there: `var(--color-surface)` fills (the app resolves them to the theme surface color) and `currentColor` strokes (resolved to the node ink).
Hand-drawn glyphs may keep their Inkscape structure (layers, transforms, markers); authored geometric glyphs write coordinates directly in the 100-wide viewBox.

## Internal ids

Any `id` (e.g. arrowhead `<marker>` defs) must be written as `__IDP__-<name>`; the loader namespaces it per node instance so ids never collide across nodes.
Prefer plain filled polygons over markers when possible.

## Optical centre

Circular-frame glyphs (math symbols like `mdot`, `p`) that are not optically centred at half height get an entry in the `OPTICAL_CENTER_Y` table in `src/components/nodes/glyphs/index.ts`.
Box-frame glyphs ignore it.

## Passage centerline

Left/right ports of a box frame anchor to the glyph's flow-passage centerline (the dashed line in the artwork), not to the frame's mid-height.
A glyph whose passage is not vertically centred (e.g. the Helmholtz resonator's main line under its cavity, the mass source's line under the injector stub) gets an entry in the `PORT_CENTER_Y` table in `src/components/nodes/glyphs/index.ts`: the fraction down the viewBox where the centerline runs.
Unlisted glyphs anchor at 0.5.
