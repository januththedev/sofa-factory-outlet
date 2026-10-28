import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import type { Token } from 'markdown-it';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { TAGS } from './revalidate';

// Buying guides live as Markdown files in content/guides. This module parses
// the front matter, renders the body to safe HTML (raw HTML in the source is
// escaped, never executed) and keeps a table of contents. A file that fails
// validation is skipped with a clear reason instead of breaking the site.

export const GUIDES_DIR = path.join(process.cwd(), 'content/guides');

const WORDS_PER_MINUTE = 200;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type GuideTocItem = { id: string; text: string; depth: 2 | 3 };

export type Guide = {
  title: string;
  description: string;
  slug: string;
  /** Calendar day in ISO form, e.g. '2026-10-27'. */
  datePublished: string;
  dateModified: string | null;
  author: string;
  image: string | null;
  tags: string[];
  /** Slugs of related guides. */
  related: string[];
  /** Body Markdown, front matter removed. */
  markdown: string;
  /** Body as safe HTML, with an `id` on every heading. */
  html: string;
  toc: GuideTocItem[];
  readingMinutes: number;
};

/** A guide file that could not be used; the reason names the field at fault. */
export type SkippedGuide = { file: string; reason: string };

/** Thrown by parseGuide; the directory loaders turn it into a skipped entry. */
export class GuideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GuideError';
  }
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** YAML dates arrive as Date objects; strings must be 'YYYY-MM-DD'. */
function isoDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

// One transform instead of z.union([z.string(), z.date()]): a union reports a
// failing branch as "Invalid input" and buries the reason, and the reason is
// what an editor needs to fix the file.
const dateField = z.unknown().transform((value, ctx): string => {
  if (value === undefined || value === null) {
    ctx.addIssue({ code: 'custom', message: 'is required' });
    return z.NEVER;
  }
  const iso = isoDate(value);
  if (!iso) {
    ctx.addIssue({ code: 'custom', message: 'must be a date in the form YYYY-MM-DD' });
    return z.NEVER;
  }
  return iso;
});

// The `error` param makes a missing key read "title is required" rather than
// "expected string, received undefined".
const requiredText = z.string({ error: 'is required' }).trim().min(1, 'is required');

const frontMatter = z.object({
  title: requiredText,
  description: requiredText,
  slug: requiredText.regex(SLUG_PATTERN, 'must be lowercase words joined by hyphens'),
  datePublished: dateField,
  dateModified: dateField.optional(),
  author: requiredText,
  image: requiredText.optional(),
  tags: z.array(requiredText).default([]),
  related: z.array(requiredText).default([]),
});

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'section';
}

/** Visible text of an inline token: the words of a heading, entities decoded. */
function inlineText(token: Token): string {
  return (token.children ?? [])
    .filter((child) => child.type === 'text' || child.type === 'code_inline')
    .map((child) => child.content)
    .join('')
    .trim();
}

/** Renders Markdown to HTML and collects the h2/h3 table of contents; the ids in the TOC are the ids in the HTML. */
export function renderGuideMarkdown(markdown: string): { html: string; toc: GuideTocItem[] } {
  // html: false escapes anything that looks like HTML in the source.
  const md = new MarkdownIt({ html: false, linkify: true, typographer: false });
  const tokens = md.parse(markdown, {});
  const toc: GuideTocItem[] = [];
  const used = new Map<string, number>();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== 'heading_open') continue;
    const text = inlineText(tokens[index + 1]);
    const base = slugify(text);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    const id = seen === 0 ? base : `${base}-${seen + 1}`;
    token.attrSet('id', id);
    const depth = Number(token.tag.slice(1));
    if (depth === 2 || depth === 3) toc.push({ id, text, depth });
  }
  return { html: md.renderer.render(tokens, md.options, {}), toc };
}

/** Reading time: one minute per 200 words, never less than a minute. */
export function readingMinutes(markdown: string): number {
  const words = markdown.replace(/```[\s\S]*?```/g, ' ').match(/[\p{L}\p{N}'’-]+/gu)?.length ?? 0;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** Parses one guide file. Throws GuideError with the field at fault when the front matter is not usable. */
export function parseGuide(source: string, file = 'guide.md'): Guide {
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(source);
  } catch (error) {
    throw new GuideError(`${file}: the front matter could not be read (${message(error)})`);
  }
  const result = frontMatter.safeParse(parsed.data);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'front matter'} ${issue.message}`)
      .join('; ');
    throw new GuideError(`${file}: the front matter is invalid: ${issues}`);
  }
  const markdown = parsed.content.trim();
  if (!markdown) throw new GuideError(`${file}: the guide has no content below the front matter`);
  const { html, toc } = renderGuideMarkdown(markdown);
  return {
    title: result.data.title,
    description: result.data.description,
    slug: result.data.slug,
    author: result.data.author,
    datePublished: result.data.datePublished,
    dateModified: result.data.dateModified ?? null,
    image: result.data.image ?? null,
    tags: result.data.tags,
    related: result.data.related,
    markdown,
    html,
    toc,
    readingMinutes: readingMinutes(markdown),
  };
}

function byNewestFirst(a: Guide, b: Guide): number {
  if (a.datePublished !== b.datePublished) return a.datePublished < b.datePublished ? 1 : -1;
  return a.slug.localeCompare(b.slug);
}

/** Every valid guide in a directory, newest first, plus the files that were skipped and why. */
export async function loadGuidesReport(
  dir: string = GUIDES_DIR,
): Promise<{ guides: Guide[]; skipped: SkippedGuide[] }> {
  // The directory is injectable for tests. Production Markdown files are included explicitly in next.config.ts.
  const entries = await readdir(/* turbopackIgnore: true */ dir, { withFileTypes: true });
  // Read in name order so a duplicate slug is always taken by the same file.
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const guides: Guide[] = [];
  const skipped: SkippedGuide[] = [];
  const slugs = new Set<string>();
  for (const entry of entries) {
    // Files starting with an underscore are notes for editors, not guides.
    if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name.startsWith('_')) continue;
    try {
      const file = path.join(/* turbopackIgnore: true */ dir, entry.name);
      const guide = parseGuide(await readFile(/* turbopackIgnore: true */ file, 'utf8'), entry.name);
      if (slugs.has(guide.slug)) {
        skipped.push({ file: entry.name, reason: `duplicate slug "${guide.slug}" already belongs to another guide` });
        continue;
      }
      slugs.add(guide.slug);
      guides.push(guide);
    } catch (error) {
      skipped.push({ file: entry.name, reason: message(error) });
    }
  }
  guides.sort(byNewestFirst);
  return { guides, skipped };
}

/** Every valid guide, newest first. */
export async function loadGuides(dir: string = GUIDES_DIR): Promise<Guide[]> {
  return (await loadGuidesReport(dir)).guides;
}

/** One guide by its URL slug, or null when there is no such guide. */
export async function loadGuideBySlug(slug: string, dir: string = GUIDES_DIR): Promise<Guide | null> {
  const guides = await loadGuides(dir);
  return guides.find((guide) => guide.slug === slug) ?? null;
}

/** Related guides in the order they are listed; unknown slugs and the guide itself are dropped. */
export function pickRelated(guide: Guide, all: Guide[]): Guide[] {
  return guide.related.flatMap((slug) => {
    const match = all.find((candidate) => candidate.slug === slug);
    return match && match.slug !== guide.slug ? [match] : [];
  });
}

/** Public URL of a guide. */
export const guidePath = (slug: string): string => `/guides/${slug}/`;

/** Cached readers for pages; publishing or editing a guide revalidates the `guides` tag. */
export const getAllGuides = unstable_cache(() => loadGuides(), ['guides-all-v1'], {
  tags: [TAGS.guides],
  revalidate: 3600,
});

export const getGuideBySlug = unstable_cache((slug: string) => loadGuideBySlug(slug), ['guide-by-slug-v1'], {
  tags: [TAGS.guides],
  revalidate: 3600,
});
