/**
 * Convert HTML content to readable plain text that preserves structure.
 * Agents prefer markdown-like formatting, so we convert:
 *   <h1> → # Heading
 *   <h2> → ## Heading
 *   <strong> → **bold**
 *   <em> → *italic*
 *   <ul><li> → - item
 *   <ol><li> → 1. item
 *   <blockquote> → > quote
 *   <a href> → [text](url)
 *   <br> → newline
 *   <p> → double newline
 */
export function htmlToReadableText(html: string): string {
  if (!html) return "";

  // If it doesn't look like HTML, return as-is
  if (!html.includes("<")) return html;

  let text = html;

  // Headings → markdown
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
  text = text.replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, "\n#### $1\n");

  // Bold and italic
  text = text.replace(/<(strong|b)>([\s\S]*?)<\/(strong|b)>/gi, "**$2**");
  text = text.replace(/<(em|i)>([\s\S]*?)<\/(em|i)>/gi, "*$2*");
  text = text.replace(/<u>([\s\S]*?)<\/u>/gi, "$1");

  // Links
  text = text.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

  // Lists — handle ordered and unordered
  // First, convert <li> inside <ol> to numbered items
  text = text.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
    let idx = 0;
    return inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_: string, content: string) => {
      idx++;
      return `${idx}. ${content.trim()}\n`;
    });
  });

  // Then convert <li> inside <ul> to bullet items
  text = text.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => {
    return inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  });

  // Blockquotes
  text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    return content
      .trim()
      .split("\n")
      .map((line: string) => `> ${line}`)
      .join("\n");
  });

  // Line breaks and paragraphs
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>\s*<p[^>]*>/gi, "\n\n");
  text = text.replace(/<p[^>]*>/gi, "");
  text = text.replace(/<\/p>/gi, "\n");

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Clean up excessive whitespace
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return text;
}
