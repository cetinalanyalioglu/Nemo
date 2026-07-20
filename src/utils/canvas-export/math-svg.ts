/**
 * TeX → SVG for the canvas export.
 *
 * On screen, formulas in text annotations are typeset by KaTeX, which lays out
 * glyphs as positioned HTML spans in its own webfonts. That cannot be harvested
 * into a standalone SVG: reading the text back gives KaTeX's *two* parallel
 * trees (the visible `.katex-html` and the hidden `.katex-mathml` meant for
 * screen readers) concatenated, one glyph per line — and the MathML uses
 * Mathematical Alphanumeric Symbols (U+1D400…), which jsPDF's WinAnsi core
 * fonts cannot encode at all, so a PDF rendered them as mojibake.
 *
 * So the export re-typesets instead of scraping. KaTeX conveniently keeps the
 * original TeX in an `<annotation encoding="application/x-tex">`, and MathJax's
 * SVG output turns that into plain `<path>` geometry. Paths need no font to be
 * embedded, which is what makes the result correct in SVG, PNG and PDF alike —
 * embedding KaTeX's webfonts would only have moved the problem.
 *
 * MathJax is loaded lazily and only when an export actually contains math; it
 * is a heavy dependency and most exports have none.
 */

/** Renders one TeX string to a detached `<svg>`. */
type TexRenderer = (tex: string, display: boolean) => SVGSVGElement | null;

let rendererPromise: Promise<TexRenderer> | null = null;

async function loadRenderer(): Promise<TexRenderer> {
  const [
    { mathjax },
    { TeX },
    { SVG },
    { browserAdaptor },
    { RegisterHTMLHandler },
    { AllPackages },
  ] = await Promise.all([
    import('mathjax-full/js/mathjax.js'),
    import('mathjax-full/js/input/tex.js'),
    import('mathjax-full/js/output/svg.js'),
    import('mathjax-full/js/adaptors/browserAdaptor.js'),
    import('mathjax-full/js/handlers/html.js'),
    import('mathjax-full/js/input/tex/AllPackages.js'),
  ]);

  RegisterHTMLHandler(browserAdaptor());
  const doc = mathjax.document('', {
    InputJax: new TeX({ packages: AllPackages }),
    // `fontCache: 'none'` writes glyph outlines inline instead of emitting
    // `<use>` references into a shared `<defs>`. Each formula is then wholly
    // self-contained — required here, because the fragments are lifted out of
    // MathJax's container and svg2pdf does not resolve cross-document `<use>`.
    OutputJax: new SVG({ fontCache: 'none' }),
  });

  return (tex, display) => {
    const container = doc.convert(tex, { display }) as unknown as Element;
    const svg = container?.querySelector?.('svg') ?? null;
    return svg as SVGSVGElement | null;
  };
}

/** The TeX source KaTeX stores alongside its rendering, or null. */
export function texSourceOf(katexEl: Element): string | null {
  const annotation = katexEl.querySelector('annotation[encoding="application/x-tex"]');
  const tex = annotation?.textContent?.trim();
  return tex ? tex : null;
}

/** True when `el` contains KaTeX-typeset math. */
export const hasMath = (el: Element): boolean => !!el.querySelector('.katex');

/** Cache key: the same formula may appear in several annotations. */
const keyOf = (tex: string, display: boolean) => `${display ? 'D' : 'I'}:${tex}`;

/**
 * Pre-renders every formula under `root` to SVG, keyed by TeX source and mode.
 *
 * Done up front, before the (synchronous) SVG build, because MathJax loads and
 * typesets asynchronously. Returns an empty map when there is no math, and
 * never rejects — a formula that fails to typeset is simply absent from the
 * map, and the caller falls back to drawing its source text.
 */
export async function prerenderMath(root: ParentNode): Promise<Map<string, SVGSVGElement>> {
  const out = new Map<string, SVGSVGElement>();
  const nodes = Array.from(root.querySelectorAll('.katex'));
  if (nodes.length === 0) return out;

  let render: TexRenderer;
  try {
    rendererPromise ??= loadRenderer();
    render = await rendererPromise;
  } catch {
    // MathJax unavailable — callers fall back to the TeX source as plain text.
    rendererPromise = null;
    return out;
  }

  for (const node of nodes) {
    const tex = texSourceOf(node);
    if (!tex) continue;
    const display = !!node.closest('.katex-display');
    const key = keyOf(tex, display);
    if (out.has(key)) continue;
    try {
      const svg = render(tex, display);
      if (svg) out.set(key, svg);
    } catch {
      // Leave it out; the source text is drawn instead.
    }
  }
  return out;
}

/** Looks up a pre-rendered formula, returning a fresh clone to place. */
export function takeMath(
  math: Map<string, SVGSVGElement> | undefined,
  tex: string,
  display: boolean
): SVGSVGElement | null {
  const found = math?.get(keyOf(tex, display));
  return found ? (found.cloneNode(true) as SVGSVGElement) : null;
}
