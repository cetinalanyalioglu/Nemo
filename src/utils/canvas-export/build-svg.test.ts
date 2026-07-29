/**
 * How the export makes a clone of the canvas stand on its own.
 *
 * The drawing is harvested from the live React Flow DOM rather than re-derived, so every
 * piece of it arrives coloured by the stylesheet — `var(--…)` tokens, `currentColor`,
 * class-borne fills. None of that survives being written to a file, because the file
 * carries no stylesheet: what is not resolved into the markup before serialization is
 * whatever the SVG defaults happen to be, which for ink is black and for text is a
 * 16-pixel serif.
 *
 * So the rules checked here are the ones that decide where a resolved value is written
 * and which of two sources of it wins. Both were got wrong at least once, and neither
 * shows up as an error — only as an export that comes out the wrong colour.
 *
 * The parts that measure (`inkBounds`, `flattenTextBaselines`, and the build itself) are
 * not reachable from here: they need `getBBox` and `getScreenCTM`, which jsdom does not
 * implement. Stubbing those would test the stub's geometry rather than the code's.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  bakeDynamicColors,
  boxFrom,
  fmtTick,
  inlinePaint,
  inlineTree,
  maybeRotate,
  translateOf,
} from './build-svg';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Puts `css` in the document for the duration of one test. */
const stylesheet = (css: string): void => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
};

/**
 * An SVG element of `tag` attached to the document, so the stylesheet reaches it, paired
 * with the detached deep clone the export would have taken of it.
 */
const liveAndClone = (tag: string, attrs: Record<string, string> = {}) => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const live = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) live.setAttribute(name, value);
  svg.appendChild(live);
  document.body.appendChild(svg);
  return { live, clone: live.cloneNode(true) as Element };
};

afterEach(() => {
  document.head.querySelectorAll('style').forEach((s) => s.remove());
  document.body.innerHTML = '';
  document.body.removeAttribute('style');
});

describe('the ink a cloned piece of the canvas keeps', () => {
  it('writes paint into the inline style rather than onto an attribute', () => {
    // Glyphs author their ink as `style="fill:currentColor"`, and an inline style beats a
    // presentation attribute. Writing the resolved colour to an attribute would therefore
    // lose to the glyph's own style, leaving `currentColor` — which is black — in place.
    stylesheet('.ink { fill: rgb(10, 20, 30); }');
    const { live, clone } = liveAndClone('path', { class: 'ink' });
    inlinePaint(live, clone);
    expect(clone.getAttribute('fill')).toBeNull();
    expect((clone as SVGElement).style.getPropertyValue('fill')).toBe('rgb(10, 20, 30)');
  });

  it('takes a stroke width from the stylesheet as a bare number', () => {
    // Edge width arrives as `--edge-width` in px. One CSS pixel is one user unit in these
    // SVGs, but `stroke-width="2px"` is not a length an SVG attribute accepts.
    stylesheet('.wire { stroke-width: 2px; }');
    const { live, clone } = liveAndClone('path', { class: 'wire' });
    inlinePaint(live, clone);
    expect(clone.getAttribute('stroke-width')).toBe('2');
  });

  it('leaves a hand-authored stroke width alone', () => {
    // The node frames set their wall thickness as an attribute deliberately. The
    // stylesheet's value is the inherited default and must not overwrite it.
    stylesheet('.wire { stroke-width: 2px; }');
    const { live, clone } = liveAndClone('path', { class: 'wire', 'stroke-width': '2.64' });
    inlinePaint(live, clone);
    expect(clone.getAttribute('stroke-width')).toBe('2.64');
  });

  it('gives text the typography it was rendered with', () => {
    // The file carries no stylesheet, so a size that is not written down falls back to
    // `medium` in a serif — which on an 8px index badge is several times too large.
    stylesheet('.badge { font-family: Arial; font-size: 8px; }');
    const { live, clone } = liveAndClone('text', { class: 'badge' });
    inlinePaint(live, clone);
    const style = (clone as SVGElement).style;
    expect(style.getPropertyValue('font-size')).toBe('8px');
    expect(style.getPropertyValue('font-family')).toBe('Arial');
  });

  it('does not put typography on a shape that has no text in it', () => {
    // Every element in the drawing goes through here; carrying a font on each one would
    // bloat the file with properties that mean nothing where they sit.
    stylesheet('circle { font-family: Arial; font-size: 8px; }');
    const { live, clone } = liveAndClone('circle');
    inlinePaint(live, clone);
    expect((clone as SVGElement).style.getPropertyValue('font-size')).toBe('');
  });

  it('walks the copy in step with the original', () => {
    // The two trees are matched by position, so each clone is painted from the element it
    // was actually taken from. Pruning anything out of the clone before this runs shifts
    // every later sibling onto the wrong original — which is why the invisible hit-test
    // path an edge carries is dropped after the walk and not before it.
    stylesheet('.a { fill: rgb(1, 1, 1); } .b { fill: rgb(2, 2, 2); }');
    const svg = document.createElementNS(SVG_NS, 'svg');
    const group = document.createElementNS(SVG_NS, 'g');
    for (const cls of ['a', 'b']) {
      const child = document.createElementNS(SVG_NS, 'path');
      child.setAttribute('class', cls);
      group.appendChild(child);
    }
    svg.appendChild(group);
    document.body.appendChild(svg);

    const clone = group.cloneNode(true) as Element;
    inlineTree(group, clone);
    const painted = [...clone.children].map((c) =>
      (c as SVGElement).style.getPropertyValue('fill')
    );
    expect(painted).toEqual(['rgb(1, 1, 1)', 'rgb(2, 2, 2)']);
  });
});

describe('an HTML box redrawn as a rectangle', () => {
  /** A div carrying `css`, attached so its computed style resolves. */
  const boxWith = (css: string): HTMLElement => {
    const div = document.createElement('div');
    div.setAttribute('style', css);
    document.body.appendChild(div);
    return div;
  };

  it('is nothing at all when there is nothing to see', () => {
    // A node's outer wrapper is usually an unpainted box. An empty rect for each one
    // would enlarge the measured bounds and pad the crop with whitespace.
    expect(boxFrom(boxWith('border: none'), 0, 0, 10, 10)).toBeNull();
  });

  it('carries the fill and the corner radius across', () => {
    // Written as a longhand because jsdom does not expand the `border-radius` shorthand
    // into the corner it is read from; a browser does.
    const rect = boxFrom(
      boxWith('background-color: rgb(9, 9, 9); border-top-left-radius: 6px'),
      1,
      2,
      3,
      4
    );
    expect(rect!.getAttribute('fill')).toBe('rgb(9, 9, 9)');
    expect(rect!.getAttribute('rx')).toBe('6');
    expect(rect!.getAttribute('x')).toBe('1');
    expect(rect!.getAttribute('y')).toBe('2');
    expect(rect!.getAttribute('width')).toBe('3');
    expect(rect!.getAttribute('height')).toBe('4');
  });

  it('carries a border across as a stroke', () => {
    const rect = boxFrom(boxWith('border: 2px solid rgb(4, 5, 6)'), 0, 0, 10, 10);
    expect(rect!.getAttribute('stroke')).toBe('rgb(4, 5, 6)');
    expect(rect!.getAttribute('stroke-width')).toBe('2');
  });

  it('fills an outlined box with nothing rather than with black', () => {
    // An SVG rect with no `fill` is filled black by default, which would blot out
    // whatever the box was drawn around.
    const rect = boxFrom(boxWith('border: 1px solid rgb(4, 5, 6)'), 0, 0, 10, 10);
    expect(rect!.getAttribute('fill')).toBe('none');
  });

  it('is still drawn for a box that is only a border', () => {
    expect(boxFrom(boxWith('border: 1px solid rgb(4, 5, 6)'), 0, 0, 10, 10)).not.toBeNull();
  });
});

describe('the shift a piece of a node was laid out with', () => {
  /** A div reporting `transform` as a browser would, in resolved matrix form. */
  const shifted = (transform: string): HTMLElement => {
    const div = document.createElement('div');
    div.style.transform = transform;
    document.body.appendChild(div);
    return div;
  };

  it('is nothing where the element was not shifted', () => {
    expect(translateOf(shifted('none'))).toEqual({ x: 0, y: 0 });
  });

  it('recovers the centring a caption is placed by', () => {
    // Node captions are centred with `translate(-50%, …)`, which resolves to px in the
    // computed matrix. Layout offsets ignore transforms, so without this the caption sits
    // half its own width to the right of the element.
    expect(translateOf(shifted('matrix(1, 0, 0, 1, -24, 6)'))).toEqual({ x: -24, y: 6 });
  });

  it('ignores a transform that turns or scales the element', () => {
    // The export re-applies a node's rotation itself, around the node centre. Reading it
    // here as well would turn the piece twice.
    expect(translateOf(shifted('matrix(0, 1, -1, 0, 5, 5)'))).toEqual({ x: 0, y: 0 });
    expect(translateOf(shifted('matrix(2, 0, 0, 2, 5, 5)'))).toEqual({ x: 0, y: 0 });
  });
});

describe('turning a node that was drawn turned', () => {
  const parts = () => [document.createElementNS(SVG_NS, 'rect') as SVGElement];

  it('adds nothing to a node standing upright', () => {
    // Which keeps the markup of the overwhelming majority of nodes free of a transform
    // that would do nothing.
    expect(maybeRotate(parts(), 0, 50, 50).getAttribute('transform')).toBeNull();
  });

  it('turns the whole node about its centre, once', () => {
    expect(maybeRotate(parts(), 90, 50, 60).getAttribute('transform')).toBe('rotate(90 50 60)');
  });

  it('takes the pieces in with it', () => {
    const group = maybeRotate(parts(), 45, 0, 0);
    expect(group.children).toHaveLength(1);
  });
});

describe('the theme values baked onto the finished drawing', () => {
  /** An `<svg>` whose single child paints with `token`. */
  const svgUsing = (token: string): SVGSVGElement => {
    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('style', `fill: var(${token})`);
    svg.appendChild(path);
    return svg;
  };

  it('anchors glyph ink, which is authored as currentColor', () => {
    // Nothing in a glyph names a colour; they all inherit one. With no colour on the root
    // `currentColor` resolves to black, and the whole drawing comes out in black.
    document.body.style.setProperty('--color-text-secondary', 'rgb(7, 8, 9)');
    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    bakeDynamicColors(svg);
    expect(svg.style.color).toBe('rgb(7, 8, 9)');
  });

  it('defines every token the drawing still refers to', () => {
    // Tokens inside <defs>, <pattern> and <marker> cannot be resolved per element — those
    // subtrees are never rendered, so there is no computed value to read. Defining them
    // once on the root lets them resolve by inheritance instead.
    document.body.style.setProperty('--flow-fill', 'rgb(3, 4, 5)');
    const svg = svgUsing('--flow-fill');
    bakeDynamicColors(svg);
    expect(svg.style.getPropertyValue('--flow-fill')).toBe('rgb(3, 4, 5)');
  });

  it('leaves alone a token the theme does not define', () => {
    const svg = svgUsing('--not-a-token');
    bakeDynamicColors(svg);
    expect(svg.style.getPropertyValue('--not-a-token')).toBe('');
  });
});

describe('the numbers written along the legend bar', () => {
  it('writes a whole number as it stands', () => {
    expect(fmtTick(42)).toBe('42');
    expect(fmtTick(-7)).toBe('-7');
    expect(fmtTick(0)).toBe('0');
  });

  it('cuts a measured value down to three figures', () => {
    // Ticks sit under a 166-unit bar in 9px type; a full double would run into its
    // neighbour.
    expect(fmtTick(1 / 3)).toBe('0.333');
    expect(fmtTick(101325.7)).toBe('1.01e+5');
  });

  it('writes a dash where there is no number to write', () => {
    // An empty dataset leaves the range as ±Infinity, and `NaN` on the bar reads as a
    // value rather than as its absence.
    expect(fmtTick(NaN)).toBe('—');
    expect(fmtTick(Infinity)).toBe('—');
  });
});
