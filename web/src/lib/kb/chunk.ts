import type { ParsedDocument } from './parse';

export type KnowledgeChunk = {
  headingPath: string;
  body: string;
  tags: string[];
  priority: 'high' | 'normal' | 'low';
  tokens: number;
  sortOrder: number;
};

const TARGET_TOKENS = 350;
const OVERLAP_TOKENS = 50;
const CONTENT_TOKENS = TARGET_TOKENS - OVERLAP_TOKENS;

export function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.3);
}

function wordsForTokens(tokens: number): number {
  return Math.max(1, Math.floor(tokens / 1.3));
}

function units(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  return paragraphs.flatMap((paragraph) => {
    if (estimateTokens(paragraph) <= CONTENT_TOKENS) return [paragraph];
    return paragraph.match(/[^.!?]+(?:[.!?]+|$)/g)?.map((sentence) => sentence.trim()).filter(Boolean)
      ?? [paragraph];
  });
}

function splitUnit(unit: string): string[] {
  if (estimateTokens(unit) <= CONTENT_TOKENS) return [unit];
  const words = unit.split(/\s+/).filter(Boolean);
  const size = wordsForTokens(CONTENT_TOKENS);
  return Array.from({ length: Math.ceil(words.length / size) }, (_, index) =>
    words.slice(index * size, (index + 1) * size).join(' '));
}

function tailWords(text: string, tokenCount: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  return words.slice(-wordsForTokens(tokenCount)).join(' ');
}

function splitLongBody(text: string): string[] {
  if (estimateTokens(text) <= TARGET_TOKENS) return [text.trim()];
  const cores: string[] = [];
  let core = '';
  for (const unit of units(text).flatMap(splitUnit)) {
    const candidate = core ? `${core}\n\n${unit}` : unit;
    if (core && estimateTokens(candidate) > CONTENT_TOKENS) {
      cores.push(core.trim());
      core = unit;
    } else {
      core = candidate;
    }
  }
  if (core.trim()) cores.push(core.trim());
  return cores.map((value, index) => {
    if (index === 0) return value;
    return `${tailWords(cores[index - 1], OVERLAP_TOKENS)}\n\n${value}`;
  });
}

function markdownSections(body: string): Array<{ heading?: string; body: string }> {
  const lines = body.split(/\r?\n/);
  const sections: Array<{ heading?: string; lines: string[] }> = [{ lines: [] }];
  for (const line of lines) {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      sections.push({ heading: match[1], lines: [] });
    } else {
      sections[sections.length - 1].lines.push(line);
    }
  }
  return sections
    .map((section) => ({ heading: section.heading, body: section.lines.join('\n').trim() }))
    .filter((section) => section.body.length > 0);
}

export function chunkDocument(document: ParsedDocument): KnowledgeChunk[] {
  const drafts: Array<Omit<KnowledgeChunk, 'tokens' | 'sortOrder'>> = [];
  if (document.kind === 'md') {
    for (const section of markdownSections(document.body)) {
      const headingPath = section.heading ? `${document.title} › ${section.heading}` : document.title;
      for (const body of splitLongBody(section.body)) {
        drafts.push({ headingPath, body, tags: [...document.tags], priority: document.priority });
      }
    }
  } else if (document.kind === 'faq') {
    for (const entry of document.entries) {
      const alternatives = entry.alt.length ? `\n\nAlso asked as: ${entry.alt.join('; ')}` : '';
      drafts.push({
        headingPath: `${document.title} › ${entry.q}`,
        body: `${entry.a}${alternatives}`,
        tags: [...entry.tags],
        priority: 'normal',
      });
    }
  } else {
    for (const [term, variants] of Object.entries(document.entries)) {
      drafts.push({
        headingPath: `${document.title} › ${term}`,
        body: `${term}: ${variants.join(', ')}`,
        tags: ['synonyms'],
        priority: 'normal',
      });
    }
  }
  return drafts.map((chunk, sortOrder) => ({
    ...chunk,
    tokens: estimateTokens(chunk.body),
    sortOrder,
  }));
}
