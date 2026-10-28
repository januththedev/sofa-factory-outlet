export type RankedItem = {
  id: number;
  rank: number;
};

export type FusedRank = {
  id: number;
  score: number;
};

export function reciprocalRankFusion(rankings: RankedItem[][], k = 60): FusedRank[] {
  const scores = new Map<number, number>();
  for (const ranking of rankings) {
    for (const item of ranking) {
      scores.set(item.id, (scores.get(item.id) ?? 0) + 1 / (k + item.rank));
    }
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((left, right) => right.score - left.score || left.id - right.id);
}
