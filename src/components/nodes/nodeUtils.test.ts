/**
 * What every element gets for free, and what a model may say instead.
 *
 * A model file describes only what is particular about each element. The label, the size,
 * the index and the rest are the same everywhere, and come from one base description that
 * every element is folded into. The fold has to leave that base exactly as it found it:
 * it runs once per element type at load, against the same object each time, so anything
 * written through to the base would follow into every element declared after it — and
 * would look like a bug in whichever element happened to be next.
 */

import { describe, expect, it } from 'vitest';
import { createElementInfo, mergeWithBaseElementInfo } from './nodeUtils';
import { baseElementInfo } from './GenericNode';
import type { ElementInfoEntry } from '../../types/flow';

/** An element declaring only `parameters`/`ports` overrides. */
const element = (partial: Partial<ElementInfoEntry>): ElementInfoEntry =>
  ({ parameters: {}, ports: { target: [], source: [] }, ...partial }) as ElementInfoEntry;

describe('what an element inherits', () => {
  it('keeps the parameters every element has', () => {
    const merged = mergeWithBaseElementInfo(element({}));
    expect(merged.parameters.label).toMatchObject({ label: 'Label', defaultValue: 'Node' });
  });

  it('adds a parameter the element alone declares', () => {
    const merged = mergeWithBaseElementInfo(
      element({ parameters: { area: { label: 'Area', type: 'number' } } as never })
    );
    expect(merged.parameters.area).toMatchObject({ label: 'Area' });
    expect(merged.parameters.label).toBeDefined();
  });

  it('takes the element at its word where the two disagree', () => {
    const merged = mergeWithBaseElementInfo(
      element({ parameters: { label: { defaultValue: 'Duct' } } as never })
    );
    expect(merged.parameters.label.defaultValue).toBe('Duct');
  });

  it('keeps the rest of a parameter the element only partly redescribes', () => {
    // A model that renames a parameter is not also saying it has no type and no category.
    const merged = mergeWithBaseElementInfo(
      element({ parameters: { label: { label: 'Name' } } as never })
    );
    expect(merged.parameters.label).toMatchObject({
      label: 'Name',
      type: 'string',
      category: 'General',
    });
  });

  it('hangs the element ports after the ones every element has', () => {
    const merged = mergeWithBaseElementInfo(
      element({ ports: { target: ['in'], source: ['out'] } })
    );
    expect(merged.ports.target).toContain('in');
    expect(merged.ports.source).toContain('out');
  });
});

describe('what the fold must not touch', () => {
  it('leaves the shared base alone when the result is changed afterwards', () => {
    // The base is one object shared by every element type. A parameter map handed out by
    // reference would let a change to one element's defaults rewrite the defaults of
    // every element loaded after it.
    const before = baseElementInfo.parameters.label.defaultValue;
    const merged = mergeWithBaseElementInfo(element({}));
    merged.parameters.label.defaultValue = 'rewritten';
    expect(baseElementInfo.parameters.label.defaultValue).toBe(before);
  });

  it('leaves the shared ports alone when the result is added to afterwards', () => {
    const before = baseElementInfo.ports.target.length;
    const merged = mergeWithBaseElementInfo(element({}));
    merged.ports.target.push('extra');
    expect(baseElementInfo.ports.target).toHaveLength(before);
  });

  it('gives each element its own parameters rather than a shared set', () => {
    const first = mergeWithBaseElementInfo(element({}));
    const second = mergeWithBaseElementInfo(element({}));
    first.parameters.label.defaultValue = 'first';
    expect(second.parameters.label.defaultValue).not.toBe('first');
  });
});

describe('building an element description', () => {
  it('is the fold, under a name that says what it is for', () => {
    expect(createElementInfo(element({}))).toEqual(mergeWithBaseElementInfo(element({})));
  });
});
