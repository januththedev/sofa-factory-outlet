import { decodeHTML } from 'entities';

// Converts the captured WooCommerce descriptions (simple HTML pasted from AI
// chat tools, with class/data-* noise) into clean Markdown. Only the handful
// of tags those descriptions use are mapped; everything else is stripped.

const stripInnerBlocks = (s: string) => s.replace(/<\/?(p|div|span)\b[^>]*>/gi, ' ');

export function htmlToMarkdown(html: string | null | undefined): string {
  if (!html) return '';
  let s = html.replace(/\r\n?/g, '\n');

  // Inline WhatsApp "enquiry" buttons pasted into descriptions: the site has its own CTA.
  s = s.replace(/<a\b[^>]*href="[^"]*(?:wa\.me|wa\.link|whatsapp)[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '');
  s = s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');

  // Inline formatting first, so it survives the tag strip below.
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _t, inner: string) => `**${stripInnerBlocks(inner).trim()}**`);
  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _t, inner: string) => `*${stripInnerBlocks(inner).trim()}*`);
  s = s.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, inner: string) => {
    const text = stripInnerBlocks(inner).replace(/<[^>]+>/g, '').trim();
    if (!text) return '';
    return /^(https?:\/\/|\/)/.test(href) ? `[${text}](${href})` : text;
  });

  // Blocks.
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, inner: string) => `\n- ${stripInnerBlocks(inner).replace(/\s+/g, ' ').trim()}`);
  s = s.replace(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, inner: string) => `\n\n### ${stripInnerBlocks(inner).replace(/\s+/g, ' ').trim()}\n\n`);
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_, inner: string) => `\n\n${inner.trim()}\n\n`);
  s = s.replace(/<\/?(ul|ol|div|section|article|blockquote)\b[^>]*>/gi, '\n\n');
  s = s.replace(/<[^>]+>/g, '');

  s = decodeHTML(s);

  // A pasted em dash was lost as "NBSP + space"; restore it, then normalise any other NBSP.
  s = s.replace(/  |  /g, ' — ').replace(/ /g, ' ');

  // Tidy emphasis markers and whitespace.
  s = s.replace(/\*\*\s*\*\*/g, '').replace(/\*\*\s+([^*]+?)\s*\*\*/g, '**$1**');
  const lines = s
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line !== '-' && line !== '- ');
  // Keep list items together: drop blank lines that sit between two bullets.
  const compact = lines.filter((line, i) => {
    if (line !== '') return true;
    const prev = lines.slice(0, i).reverse().find((l) => l !== '');
    const next = lines.slice(i + 1).find((l) => l !== '');
    return !(prev?.startsWith('- ') && next?.startsWith('- '));
  });
  return compact
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '')
    .replace(/ +([,.;:!?])/g, '$1');
}

/** Plain text (no Markdown markers) for search indexes and meta descriptions. */
export function markdownToPlain(md: string): string {
  return md
    .replace(/^###\s+/gm, '')
    .replace(/^-\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The first bullet list in a Markdown description, used as selling points. */
export function firstBulletList(md: string): string | null {
  const match = md.match(/(?:^|\n)((?:- .+(?:\n|$))+)/);
  return match ? match[1].trim() : null;
}
