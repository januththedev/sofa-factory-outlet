import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extractDetails } from './extract';
import { findFaq } from './faq';
import { classifyIntent } from './intent';
import { normalise } from './normalise';
import { retrieve } from './retrieve';
import { templateFor } from './templates';

export type GoldenFailure = { id: string; question: string; reason: string };

export type GoldenResult = {
  total: number;
  hitAt3: number;
  intentAccuracy: number;
  answeredWithoutModel: number;
  failures: GoldenFailure[];
};

type GoldenCase = {
  id: string;
  question: string;
  expect: {
    intent?: string;
    products?: string[];
    facts?: string[];
    handoff?: boolean;
  };
};

export const runGoldenSet: () => Promise<GoldenResult> = async () => {
  let cases: GoldenCase[];
  try {
    const file = await readFile(join(process.cwd(), 'content/golden/golden.json'), 'utf8');
    cases = JSON.parse(file) as GoldenCase[];
  } catch {
    return { total: 0, hitAt3: 0, intentAccuracy: 0, answeredWithoutModel: 0, failures: [] };
  }

  let retrievalHits = 0;
  let correctIntents = 0;
  let answersWithoutModel = 0;
  const failures: GoldenFailure[] = [];
  for (const item of cases) {
    const query = normalise(item.question);
    const intent = classifyIntent(query);
    const faq = await findFaq(query);
    const result = await retrieve(query, intent, extractDetails(query));
    const facts = (faq?.answer ?? result.chunks
      .map((chunk) => `${chunk.headingPath} ${chunk.body}`)
      .join(' ')).toLowerCase();
    const products = result.products.map((product) =>
      `${product.slug} ${product.name}`.toLowerCase(),
    );
    const factsMatch = !item.expect.facts?.length
      || item.expect.facts.every((fact) => facts.includes(fact.toLowerCase()));
    const productsMatch = !item.expect.products?.length
      || item.expect.products.every((expected) =>
        products.some((product) => product.includes(expected.toLowerCase())),
      );
    const intentMatches = !item.expect.intent || item.expect.intent === intent;
    const template = templateFor(intent, result.products, result.pairReasons);
    const handoff = !faq && !template && result.chunks.length === 0;

    if (factsMatch && productsMatch) {
      retrievalHits += 1;
    }
    if (intentMatches) {
      correctIntents += 1;
    }
    if (faq || template || handoff) {
      answersWithoutModel += 1;
    }

    const reasons: string[] = [];
    if (!factsMatch) reasons.push('expected fact missing');
    if (!productsMatch) reasons.push('expected product missing');
    if (!intentMatches) reasons.push(`intent ${intent}`);
    if (item.expect.handoff !== undefined && item.expect.handoff !== handoff) {
      reasons.push('handoff mismatch');
    }
    if (reasons.length > 0) {
      failures.push({ id: item.id, question: item.question, reason: reasons.join('; ') });
    }
  }

  const total = cases.length;
  return {
    total,
    hitAt3: total === 0 ? 0 : retrievalHits / total,
    intentAccuracy: total === 0 ? 0 : correctIntents / total,
    answeredWithoutModel: total === 0 ? 0 : answersWithoutModel / total,
    failures,
  };
};
