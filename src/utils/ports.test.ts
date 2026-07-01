import { describe, expect, it } from 'vitest';
import { groupPortsBySide } from './ports';
import type { NodePorts } from '../types/flow';

describe('groupPortsBySide', () => {
  // A junction with 2 targets (0,1) and 2 sources (2,3).
  const layout: NodePorts = { target: ['0', '1'], source: ['2', '3'] };

  it('defaults targets to the left and sources to the right', () => {
    const buckets = groupPortsBySide(layout, undefined);
    expect(buckets.left.map((p) => p.suffix)).toEqual(['0', '1']);
    expect(buckets.right.map((p) => p.suffix)).toEqual(['2', '3']);
    expect(buckets.top).toEqual([]);
    expect(buckets.bottom).toEqual([]);
  });

  it('numbers sources positionally as targetCount + idx regardless of raw ids', () => {
    // Raw source ids are ignored; suffixes come from the positional numbering so
    // handle ids stay `{nodeId}-port-{n}` with targets first.
    const buckets = groupPortsBySide({ target: ['0'], source: ['0', '0'] }, undefined);
    expect(buckets.right.map((p) => p.suffix)).toEqual(['1', '2']);
  });

  it('preserves the port direction independent of the assigned side', () => {
    const buckets = groupPortsBySide(layout, { '2': 'bottom' });
    expect(buckets.bottom).toEqual([{ suffix: '2', direction: 'source', side: 'bottom' }]);
    // Port 2 left the right bucket but is still a source.
    expect(buckets.right.map((p) => p.suffix)).toEqual(['3']);
  });

  it('redirects ports to any edge and keeps ascending order within a bucket', () => {
    const buckets = groupPortsBySide(layout, {
      '0': 'top',
      '1': 'bottom',
      '2': 'bottom',
      '3': 'top',
    });
    expect(buckets.left).toEqual([]);
    expect(buckets.right).toEqual([]);
    expect(buckets.top.map((p) => p.suffix)).toEqual(['0', '3']);
    expect(buckets.bottom.map((p) => p.suffix)).toEqual(['1', '2']);
  });

  it('can stack every port on a single edge', () => {
    const buckets = groupPortsBySide(layout, {
      '0': 'right',
      '1': 'right',
      '2': 'right',
      '3': 'right',
    });
    expect(buckets.right.map((p) => p.suffix)).toEqual(['0', '1', '2', '3']);
    expect(buckets.right.map((p) => p.direction)).toEqual(['target', 'target', 'source', 'source']);
  });
});
