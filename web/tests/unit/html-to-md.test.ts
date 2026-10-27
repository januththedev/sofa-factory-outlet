import { describe, expect, it } from 'vitest';
import { loadCapture } from '@/lib/seed/capture';
import { firstBulletList, htmlToMarkdown, markdownToPlain } from '@/lib/seed/html-to-md';

describe('htmlToMarkdown', () => {
  it('converts paragraphs, lists and emphasis and drops pasted chat-UI attributes', () => {
    const html =
      '<p class="font-claude-response-body break-words">First <strong data-start="1">bold</strong> line.</p>\n<ul>\n<li class="x">\n<p data-path-to-node="9,0">One</p>\n</li>\n<li>Two &amp; three</li>\n</ul>';
    expect(htmlToMarkdown(html)).toBe('First **bold** line.\n\n- One\n- Two & three');
  });

  it('restores an em dash lost as NBSP + space and decodes entities', () => {
    expect(htmlToMarkdown('<p>the same problem  a regular sofa &#8217;s</p>')).toBe('the same problem — a regular sofa ’s');
  });

  it('removes inline WhatsApp enquiry buttons', () => {
    const html = '<p><a href="https://wa.me/94766711711?text=Hi"><br />\n\t\t WhatsApp Enquiry<br /></a></p>\n<p>Real copy.</p>';
    expect(htmlToMarkdown(html)).toBe('Real copy.');
  });

  it('turns headings into ### and drops empty nbsp paragraphs', () => {
    expect(htmlToMarkdown('<h2>Title – here</h2><p>Body</p><p>&nbsp;</p>')).toBe('### Title – here\n\nBody');
  });

  it('cleans every captured description', () => {
    const { products } = loadCapture();
    for (const p of products) {
      const md = htmlToMarkdown(p.description);
      expect(md, `product ${p.id}`).not.toMatch(/<[a-z/][^>]*>/i);
      expect(md, `product ${p.id}`).not.toMatch(/data-|font-claude|class=/);
      expect(md, `product ${p.id}`).not.toContain(' ');
      expect(md, `product ${p.id}`).not.toMatch(/WhatsApp Enquiry/i);
    }
  });
});

describe('markdown helpers', () => {
  it('produces plain text and finds the first bullet list', () => {
    const md = '### Heading\n\nSome **bold** text.\n\n- One\n- Two\n\nMore.';
    expect(markdownToPlain(md)).toBe('Heading Some bold text. One Two More.');
    expect(firstBulletList(md)).toBe('- One\n- Two');
  });
});
