/**
 * What every connection gets for free, and what a model may say instead.
 *
 * The same fold as an element's, over a smaller base — a connection has parameters but no
 * ports. It carries the same obligation not to write through to the shared base, for the
 * same reason: it runs once per edge type at load, against one object.
 */

import { describe, expect, it } from 'vitest';
import { createEdgeInfo, mergeWithBaseEdgeInfo } from './edgeUtils';
import { baseEdgeInfo } from './GenericEdge';
import type { EdgeInfoEntry } from '../../types/flow';

/** A connection declaring only `parameters` overrides. */
const connection = (parameters: Record<string, unknown> = {}): EdgeInfoEntry =>
  ({ parameters }) as EdgeInfoEntry;

describe('what a connection inherits', () => {
  it('keeps the parameters every connection has', () => {
    expect(mergeWithBaseEdgeInfo(connection()).parameters.index).toMatchObject({
      label: 'Index',
      editable: false,
    });
  });

  it('adds a parameter the connection alone declares', () => {
    const merged = mergeWithBaseEdgeInfo(connection({ area: { label: 'Area', type: 'number' } }));
    expect(merged.parameters.area).toMatchObject({ label: 'Area' });
    expect(merged.parameters.index).toBeDefined();
  });

  it('keeps the rest of a parameter the connection only partly redescribes', () => {
    const merged = mergeWithBaseEdgeInfo(connection({ index: { label: 'Number' } }));
    expect(merged.parameters.index).toMatchObject({
      label: 'Number',
      category: 'Connectivity',
      editable: false,
    });
  });
});

describe('what the fold must not touch', () => {
  it('leaves the shared base alone when the result is changed afterwards', () => {
    const before = baseEdgeInfo.parameters.index.label;
    const merged = mergeWithBaseEdgeInfo(connection());
    merged.parameters.index.label = 'rewritten';
    expect(baseEdgeInfo.parameters.index.label).toBe(before);
  });

  it('gives each connection its own parameters rather than a shared set', () => {
    const first = mergeWithBaseEdgeInfo(connection());
    const second = mergeWithBaseEdgeInfo(connection());
    first.parameters.index.label = 'first';
    expect(second.parameters.index.label).not.toBe('first');
  });
});

describe('building a connection description', () => {
  it('is the fold, under a name that says what it is for', () => {
    expect(createEdgeInfo(connection())).toEqual(mergeWithBaseEdgeInfo(connection()));
  });
});
