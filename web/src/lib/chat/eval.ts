import { notImplemented } from '../not-implemented';

// CONTRACT STUB. Owner: "chat-pipeline" agent. Keep these exports and signatures.

export type GoldenFailure = { id: string; question: string; reason: string };

export type GoldenResult = {
  total: number;
  /** share (0–1) of questions whose expected facts appear in the top 3 retrieved chunks / FAQ answer */
  hitAt3: number;
  intentAccuracy: number;
  /** share (0–1) answered without a model call */
  answeredWithoutModel: number;
  failures: GoldenFailure[];
};

/** Runs `content/golden/golden.json` through retrieval (no model calls) and scores it. */
export const runGoldenSet: () => Promise<GoldenResult> = async () => notImplemented('runGoldenSet');
