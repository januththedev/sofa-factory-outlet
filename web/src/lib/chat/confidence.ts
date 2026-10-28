export type ConfidenceInput = {
  faq?: boolean;
  productScores?: number[];
  chunkScores?: number[];
};

export function assessConfidence(input: ConfidenceInput, minimum = 0.2) {
  const score = Math.max(
    input.faq ? 1 : 0,
    ...(input.productScores ?? []),
    ...(input.chunkScores ?? []),
    0,
  );
  return { score, sufficient: score >= minimum };
}
