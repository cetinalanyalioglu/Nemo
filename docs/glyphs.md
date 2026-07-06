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
