import { describe, expect, it } from 'vitest';
import { reciprocalRankFusion } from '@/lib/kb/rank';

describe('reciprocal rank fusion', () => {
  it('merges rankings with k=60 and rewards results present in both lists', () => {
    const result = reciprocalRankFusion([
      [{ id: 1, rank: 1 }, { id: 2, rank: 2 }],
      [{ id: 2, rank: 1 }, { id: 3, rank: 2 }],
    ]);
    expect(result.map((item) => item.id)).toEqual([2, 1, 3]);
    expect(result[0].score).toBeCloseTo(1 / 62 + 1 / 61);
  });

  it('uses the id for deterministic ties', () => {
    expect(reciprocalRankFusion([[{ id: 9, rank: 1 }], [{ id: 4, rank: 1 }]]).map((item) => item.id))
      .toEqual([4, 9]);
  });
});
