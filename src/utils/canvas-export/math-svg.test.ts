/**
 * The formulas an export carries, and the form they are carried in.
 *
 * A note's math is KaTeX on screen — positioned spans in KaTeX's own webfonts, plus a
 * hidden MathML twin for screen readers. Neither survives being lifted into a standalone
 * file: the fonts are not there to embed, and the MathML is written in Mathematical
 * Alphanumeric Symbols, which the PDF's core fonts cannot encode at all. So the export
 * re-typesets from the TeX source instead, to plain path geometry that needs no font.
 *
 * What is checked here is that pipeline end to end — the source is found, the geometry
 * comes out as paths, and a formula placed twice is placed twice rather than moved.
 */

import { describe, expect, it, vi } from 'vitest';
import { hasMath, prerenderMath, takeMath, texSourceOf } from './math-svg';

/**
 * A `.katex` element as KaTeX leaves it: the visible rendering, the hidden MathML twin,
 * and the original TeX kept in an annotation. Returned wrapped, so `display` can sit on
 * an ancestor the way `.katex-display` does.
 */
const katex = (tex: string, display = false): HTMLElement => {
  const host = document.createElement('div');
  const wrap = document.createElement('span');
  if (display) wrap.className = 'katex-display';
  const node = document.createElement('span');
  node.className = 'katex';
  const mathml = document.createElement('span');
  mathml.className = 'katex-mathml';
  const annotation = document.createElement('annotation');
  annotation.setAttribute('encoding', 'application/x-tex');
  annotation.textContent = tex;
  mathml.appendChild(annotation);
  node.appendChild(mathml);
  host.appendChild(wrap);
  wrap.appendChild(node);
  return host;
};

/** The `.katex` element inside a host built by {@link katex}. */
const only = (host: HTMLElement): Element => host.querySelector('.katex')!;

describe('the TeX kept beside a rendering', () => {
  it('is read back off the annotation KaTeX writes', () => {
    expect(texSourceOf(only(katex('x^2')))).toBe('x^2');
  });

  it('comes back trimmed', () => {
    // KaTeX indents the annotation with the rest of its markup, so the source arrives
    // with the surrounding whitespace attached. It is used as a cache key and handed to
    // MathJax, and both want the formula alone.
    const host = katex('x^2');
    only(host).querySelector('annotation')!.textContent = '\n      x^2\n    ';
    expect(texSourceOf(only(host))).toBe('x^2');
  });

  it('is null where there is no annotation to read', () => {
    const bare = document.createElement('span');
    bare.className = 'katex';
    expect(texSourceOf(bare)).toBeNull();
  });

  it('is null rather than empty when the annotation holds nothing', () => {
    // An empty string would key the cache and be handed to MathJax as a formula. Null
    // is what the callers test for before either happens.
    const host = katex('   ');
    expect(texSourceOf(only(host))).toBeNull();
  });
});

describe('whether a note has math in it at all', () => {
  it('finds a formula nested anywhere inside', () => {
    expect(hasMath(katex('x^2'))).toBe(true);
  });

  it('says no for a note that is only prose', () => {
    // This is what keeps MathJax — a heavy, lazily loaded dependency — out of the great
    // majority of exports, which carry no math.
    const plain = document.createElement('div');
    plain.textContent = 'no math here';
    expect(hasMath(plain)).toBe(false);
  });
});

describe('the formulas prepared before a build', () => {
  it('typesets to path geometry rather than to glyphs in a font', async () => {
    // The whole reason the export re-typesets instead of scraping the canvas: paths need
    // no font to be embedded, so the same output is correct in SVG, PNG and PDF alike.
    const math = await prerenderMath(katex('x^2'));
    const svg = takeMath(math, 'x^2', false);
    expect(svg).not.toBeNull();
    expect(svg!.querySelectorAll('path').length).toBeGreaterThan(0);
    expect(svg!.querySelector('text')).toBeNull();
  });

  it('is empty, and never loads MathJax, when there is no math', async () => {
    const plain = document.createElement('div');
    plain.textContent = 'no math here';
    await expect(prerenderMath(plain)).resolves.toEqual(new Map());
  });

  it('typesets a repeated formula once', async () => {
    // Notes repeat each other's symbols constantly, and typesetting is the slow part of
    // an export. The cache is keyed by source, so the second occurrence is free.
    const root = document.createElement('div');
    root.appendChild(katex('x^2'));
    root.appendChild(katex('x^2'));
    const math = await prerenderMath(root);
    expect(math.size).toBe(1);
  });

  it('keeps a displayed formula apart from the same one written inline', async () => {
    // Display and inline are different renderings of one source — different sizing, and
    // limits set above and below rather than beside. One entry would serve the wrong one.
    const root = document.createElement('div');
    root.appendChild(katex('\\sum_{i=1}^{n} i', false));
    root.appendChild(katex('\\sum_{i=1}^{n} i', true));
    const math = await prerenderMath(root);
    expect(math.size).toBe(2);
  });

  it('skips a rendering that carries no source', async () => {
    const bare = document.createElement('div');
    const node = document.createElement('span');
    node.className = 'katex';
    bare.appendChild(node);
    await expect(prerenderMath(bare)).resolves.toEqual(new Map());
  });

  it('resolves empty rather than rejecting when MathJax cannot be loaded', async () => {
    // An export that contains math must still produce a file when the typesetter is
    // unreachable; the caller draws the TeX source as plain text instead. A rejection
    // here would take the whole export down with it.
    vi.resetModules();
    vi.doMock('mathjax-full/js/mathjax.js', () => {
      throw new Error('unavailable');
    });
    const fresh = await import('./math-svg');
    await expect(fresh.prerenderMath(katex('x^2'))).resolves.toEqual(new Map());
    vi.doUnmock('mathjax-full/js/mathjax.js');
    vi.resetModules();
  });
});

describe('placing a prepared formula', () => {
  it('hands back a copy, so the same formula can be placed twice', async () => {
    // The caller appends what it is given into the export, which moves that element out
    // of wherever it was. Handing back the stored one would empty the cache on first use
    // and leave every later occurrence of the formula blank.
    const math = await prerenderMath(katex('x^2'));
    const first = takeMath(math, 'x^2', false);
    const second = takeMath(math, 'x^2', false);
    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
    expect(second!.innerHTML).toBe(first!.innerHTML);
  });

  it('will not serve an inline formula where a displayed one was asked for', async () => {
    const math = await prerenderMath(katex('x^2', false));
    expect(takeMath(math, 'x^2', true)).toBeNull();
  });

  it('is null for a formula that was never prepared', async () => {
    const math = await prerenderMath(katex('x^2'));
    expect(takeMath(math, 'y^2', false)).toBeNull();
  });

  it('is null when nothing was prepared at all', () => {
    // The build runs with no map whenever the canvas has no math, and every annotation
    // still goes through this path.
    expect(takeMath(undefined, 'x^2', false)).toBeNull();
  });
});
