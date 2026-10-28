import matter from 'gray-matter';
import { z } from 'zod';

export type ParseError = {
  line?: number;
  message: string;
};

export type MarkdownDocument = {
  kind: 'md';
  slug: string;
  title: string;
  tags: string[];
  priority: 'high' | 'normal' | 'low';
  body: string;
};

export type FaqEntry = {
  q: string;
  alt: string[];
  a: string;
  tags: string[];
};

export type FaqDocument = {
  kind: 'faq';
  slug: string;
  title: string;
  entries: FaqEntry[];
};

export type SynonymDocument = {
  kind: 'synonyms';
  slug: string;
  title: string;
  entries: Record<string, string[]>;
};

export type ParsedDocument = MarkdownDocument | FaqDocument | SynonymDocument;
export type ParseResult =
  | { ok: true; document: ParsedDocument }
  | { ok: false; errors: ParseError[] };

const frontMatterSchema = z.object({
  title: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1)),
  priority: z.enum(['high', 'normal', 'low']),
});

const faqSchema = z.array(z.object({
  q: z.string().trim().min(1),
  alt: z.array(z.string().trim().min(1)).optional().default([]),
  a: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1)).optional().default([]),
}));

const synonymSchema = z.record(z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1));

function lineForFrontMatter(text: string, field: PropertyKey): number | undefined {
  if (typeof field !== 'string') return undefined;
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((line, position) => position > 0 && new RegExp(`^\\s*${field}\\s*:`).test(line));
  return index >= 0 ? index + 1 : 1;
}

function titleFromSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`)
    .join(' ');
}

export function parseMarkdown(slug: string, text: string): ParseResult {
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid front matter.';
    const match = message.match(/line\s+(\d+)/i);
    return { ok: false, errors: [{ line: match ? Number(match[1]) : 1, message }] };
  }
  const validated = frontMatterSchema.safeParse(parsed.data);
  if (!validated.success) {
    return {
      ok: false,
      errors: validated.error.issues.map((issue) => ({
        line: lineForFrontMatter(text, issue.path[0] ?? ''),
        message: `${issue.path.join('.') || 'front matter'}: ${issue.message}`,
      })),
    };
  }
  return {
    ok: true,
    document: {
      kind: 'md',
      slug,
      title: validated.data.title,
      tags: validated.data.tags,
      priority: validated.data.priority,
      body: parsed.content.trim(),
    },
  };
}

export function parseJson(slug: string, text: string, title?: string): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON.';
    const position = message.match(/position\s+(\d+)/i);
    const reportedLine = message.match(/line\s+(\d+)/i);
    const offset = position ? Number(position[1]) : undefined;
    const line = reportedLine
      ? Number(reportedLine[1])
      : text.slice(0, offset ?? 0).split(/\r?\n/).length;
    return { ok: false, errors: [{ line, message }] };
  }
  const resolvedTitle = title?.trim() || titleFromSlug(slug);
  if (Array.isArray(value)) {
    const validated = faqSchema.safeParse(value);
    if (!validated.success) {
      return {
        ok: false,
        errors: validated.error.issues.map((issue) => ({
          message: `${issue.path.join('.') || 'FAQ array'}: ${issue.message}`,
        })),
      };
    }
    return { ok: true, document: { kind: 'faq', slug, title: resolvedTitle, entries: validated.data } };
  }
  const validated = synonymSchema.safeParse(value);
  if (!validated.success) {
    return {
      ok: false,
      errors: validated.error.issues.map((issue) => ({
        message: `${issue.path.join('.') || 'synonyms object'}: ${issue.message}`,
      })),
    };
  }
  return { ok: true, document: { kind: 'synonyms', slug, title: resolvedTitle, entries: validated.data } };
}

export function parseDocument(input: {
  slug: string;
  title?: string;
  kind: 'md' | 'json';
  text: string;
}): ParseResult {
  return input.kind === 'md'
    ? parseMarkdown(input.slug, input.text)
    : parseJson(input.slug, input.text, input.title);
}
