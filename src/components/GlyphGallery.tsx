import glyphRegistry from './nodes/glyphs';
import '../styles/glyph-gallery.css';

/**
 * Design-review sheet for the schematic glyph set, reachable at `/?glyphs`.
 * Every registered glyph is rendered on the gray box tile it gets on the
 * canvas — its flow passage painted `var(--color-surface)` — side by side in
 * the light and dark themes, at canvas size and enlarged. Purely a dev tool;
 * not linked from the app chrome.
 */

const ThemeSheet = ({ theme }: { theme: 'light' | 'dark' }) => (
  <section className="glyph-sheet" data-theme={theme}>
    <h2>{theme}</h2>
    <div className="glyph-grid">
      {Object.entries(glyphRegistry).map(([key, glyph]) => (
        <figure key={key} className="glyph-cell">
          <div className="glyph-tiles">
            <svg
              className="glyph-tile glyph-tile-large"
              viewBox={glyph.viewBox}
              preserveAspectRatio="xMidYMid meet"
            >
              {glyph.render(`gallery-${theme}-lg-${key}`)}
            </svg>
            <svg
              className="glyph-tile glyph-tile-small"
              viewBox={glyph.viewBox}
              preserveAspectRatio="xMidYMid meet"
            >
              {glyph.render(`gallery-${theme}-sm-${key}`)}
            </svg>
          </div>
          <figcaption>{key}</figcaption>
        </figure>
      ))}
    </div>
  </section>
);

const GlyphGallery = () => (
  <div className="glyph-gallery">
    <h1>Glyph gallery</h1>
    <p>
      Authoring rules: <code>docs/glyphs.md</code>. Ink is <code>currentColor</code>, flow passages
      are <code>var(--color-surface)</code>; the gray behind is the box-node fill.
    </p>
    <div className="glyph-sheets">
      <ThemeSheet theme="light" />
      <ThemeSheet theme="dark" />
    </div>
  </div>
);

export default GlyphGallery;
