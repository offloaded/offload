import mammoth from "mammoth";

export interface TemplateSection {
  heading: string;
  description: string;
}

/**
 * Extract section headings from a .docx file buffer.
 * Returns an array of {heading, description} pairs.
 */
export async function parseDocxTemplate(buffer: Buffer): Promise<TemplateSection[]> {
  const result = await mammoth.convertToHtml({ buffer }, {
    styleMap: [
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
    ],
  });

  const html = result.value;
  const sections: TemplateSection[] = [];

  // Match headings and capture content until next heading
  const headingRegex = /<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi;
  const matches = [...html.matchAll(headingRegex)];

  for (let i = 0; i < matches.length; i++) {
    const heading = stripHtml(matches[i][1]);
    if (!heading.trim()) continue;

    // Get content between this heading and the next
    const startIdx = matches[i].index! + matches[i][0].length;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index! : html.length;
    const content = html.slice(startIdx, endIdx);
    const description = stripHtml(content).trim();

    sections.push({
      heading,
      description: description.slice(0, 500), // Cap description length
    });
  }

  // If no headings found, try to extract from bold text or paragraphs
  if (sections.length === 0) {
    const boldRegex = /<strong>(.*?)<\/strong>/gi;
    const boldMatches = [...html.matchAll(boldRegex)];
    for (const match of boldMatches) {
      const heading = stripHtml(match[1]).trim();
      if (heading && heading.length > 2 && heading.length < 200) {
        sections.push({ heading, description: "" });
      }
    }
  }

  return sections;
}

/**
 * Extract sections from plain text / markdown.
 * Looks for # headings, bold lines, or ALL-CAPS lines.
 */
export function parseTextTemplate(text: string): TemplateSection[] {
  const lines = text.split("\n");
  const sections: TemplateSection[] = [];
  let currentHeading: string | null = null;
  let currentDesc: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Markdown heading
    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)/);
    // ALL CAPS line (at least 3 chars, no lowercase)
    const isCapsHeading = trimmed.length >= 3 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);

    if (headingMatch || isCapsHeading) {
      // Save previous section
      if (currentHeading) {
        sections.push({
          heading: currentHeading,
          description: currentDesc.join(" ").trim().slice(0, 500),
        });
      }
      currentHeading = headingMatch ? headingMatch[1] : trimmed;
      currentDesc = [];
    } else if (currentHeading && trimmed) {
      currentDesc.push(trimmed);
    }
  }

  // Save last section
  if (currentHeading) {
    sections.push({
      heading: currentHeading,
      description: currentDesc.join(" ").trim().slice(0, 500),
    });
  }

  return sections;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}
