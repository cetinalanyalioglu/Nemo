/**
 * The theme an export is built in.
 *
 * An export is a document. It is opened in a viewer, dropped into a paper, printed —
 * all of which put it on white. The dark theme is the opposite arrangement: pale ink,
 * because there is a dark surface behind it. Harvested as-is, a dark session exports
 * pale ink onto a page that has no dark surface, and the labels all but vanish.
 *
 * So the drawing is built in the light theme whatever the session is using. This is not
 * a recolouring: it switches the attribute the whole stylesheet already keys on, so
 * every token, and every model theme layered on top of them, resolves to the light
 * values it was written to have. Nothing here has to know what any of them are.
 *
 * The switch lasts only as long as the harvest, and the harvest is synchronous, so the
 * browser never paints an intermediate frame and the canvas on screen does not flicker
 * — the same arrangement `monochrome.ts` relies on for the same reason.
 */

/** The attribute the stylesheet keys its palettes on. */
const THEME_ATTRIBUTE = 'data-theme';
const LIGHT = 'light';

/**
 * Builds in the light theme, and returns a function restoring whatever was there.
 *
 * A session already in the light theme is left alone: there is nothing to switch, and
 * suppressing transitions for no reason is a cost with no return.
 */
export function applyPrintTheme(): () => void {
  const root = document.documentElement;
  const previous = root.getAttribute(THEME_ATTRIBUTE);
  if (previous === LIGHT || previous === null) return () => {};

  // Colour transitions would still be running while the harvest reads the result, so
  // `getComputedStyle` would report a value part-way between the two themes.
  const freeze = document.createElement('style');
  freeze.textContent = '*, *::before, *::after { transition: none !important; }';
  document.head.appendChild(freeze);

  root.setAttribute(THEME_ATTRIBUTE, LIGHT);
  // Force a style recalc so the new values are what the harvest reads.
  void document.body.offsetHeight;

  return () => {
    root.setAttribute(THEME_ATTRIBUTE, previous);
    freeze.remove();
  };
}
