import { describe, expect, it } from 'vitest';
import { sortCategories } from './category-order';

describe('sortCategories', () => {
  it('sorts alphabetically (case-insensitive) when no precedence is given', () => {
    expect(sortCategories(['Ports', 'numeric', 'Options', 'Text'])).toEqual([
      'numeric',
      'Options',
      'Ports',
      'Text',
    ]);
  });

  it('pins categories with a precedence to the front in ascending order', () => {
    const order = sortCategories(['Text', 'Numeric', 'Options', 'Ports'], {
      Numeric: 1,
      Options: 2,
    });
    expect(order).toEqual(['Numeric', 'Options', 'Ports', 'Text']);
  });

  it('places unlisted categories alphabetically after pinned ones', () => {
    const order = sortCategories(['Zeta', 'Alpha', 'Pinned'], { Pinned: 5 });
    expect(order).toEqual(['Pinned', 'Alpha', 'Zeta']);
  });

  it('breaks equal precedence ties alphabetically', () => {
    const order = sortCategories(['Beta', 'Alpha'], { Alpha: 1, Beta: 1 });
    expect(order).toEqual(['Alpha', 'Beta']);
  });

  it('does not mutate the input array', () => {
    const input = ['B', 'A'];
    sortCategories(input);
    expect(input).toEqual(['B', 'A']);
  });

  it('ignores non-finite precedence values, falling back to alphabetical', () => {
    const order = sortCategories(['B', 'A'], { A: NaN as unknown as number });
    expect(order).toEqual(['A', 'B']);
  });
});
