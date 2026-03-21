/**
 * Parse a .docx file to extract {{placeholder}} tags using docxtemplater.
 * Returns structured placeholder data that can be stored with the template.
 */

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

export interface ParsedPlaceholder {
  name: string;
  label: string;
  description: string;
}

export interface ParsedTemplate {
  placeholders: ParsedPlaceholder[];
  sections: Record<string, { heading: string; description: string }>;
}

/**
 * Convert snake_case or camelCase placeholder names to human-readable labels.
 * e.g. "executive_summary" → "Executive Summary"
 *      "clientName" → "Client Name"
 */
function toLabel(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Infer a brief description for a placeholder based on its name.
 */
function inferDescription(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("summary") || lower.includes("overview")) {
    return "High-level summary paragraph(s)";
  }
  if (lower.includes("finding") || lower.includes("result")) {
    return "Key findings or results";
  }
  if (lower.includes("recommendation")) {
    return "Recommendations or action items";
  }
  if (lower.includes("date")) {
    return "Date value (e.g. 2026-03-21)";
  }
  if (lower.includes("name") || lower.includes("author")) {
    return "Name or identifier";
  }
  if (lower.includes("title")) {
    return "Title text";
  }
  if (lower.includes("conclusion")) {
    return "Concluding remarks";
  }
  if (lower.includes("introduction") || lower.includes("intro")) {
    return "Introductory text";
  }
  return `Content for the ${toLabel(name).toLowerCase()} section`;
}

/**
 * Parse a .docx file buffer and extract all {{placeholder}} tags.
 * Uses docxtemplater's internal parser to find tags reliably.
 */
export function parseDocxTemplate(buffer: Buffer): ParsedTemplate {
  const zip = new PizZip(buffer);

  // Create a docxtemplater instance in "collect tags" mode
  // We use a custom parser that collects tags without requiring data
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // Don't throw on missing data — we're just extracting tags
    nullGetter: () => "",
  });

  // Get all tags from the template
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tags: string[] = [];
  const fullText = doc.getFullText();

  // Also extract tags via regex from the raw XML for reliability
  const xmlFiles = ["word/document.xml", "word/header1.xml", "word/header2.xml", "word/header3.xml", "word/footer1.xml", "word/footer2.xml", "word/footer3.xml"];
  for (const xmlFile of xmlFiles) {
    try {
      const xml = zip.file(xmlFile)?.asText();
      if (xml) {
        // Match {tag} and {{tag}} patterns (docxtemplater uses single braces internally)
        const matches = xml.matchAll(/\{([^{}]+)\}/g);
        for (const match of matches) {
          const tag = match[1].trim();
          // Skip internal XML tags and loop markers
          if (tag.startsWith("/") || tag.startsWith("#") || tag.startsWith("@") || tag.includes("<") || tag.includes(">")) continue;
          if (!tags.includes(tag)) {
            tags.push(tag);
          }
        }
      }
    } catch {
      // File might not exist in the zip
    }
  }

  // Also scan the full text for {{placeholder}} patterns (double-brace user convention)
  const textMatches = fullText.matchAll(/\{\{([^{}]+)\}\}/g);
  for (const match of textMatches) {
    const tag = match[1].trim();
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }

  // Build structured output
  const placeholders: ParsedPlaceholder[] = tags.map((name) => ({
    name,
    label: toLabel(name),
    description: inferDescription(name),
  }));

  const sections: Record<string, { heading: string; description: string }> = {};
  for (const ph of placeholders) {
    sections[ph.name] = {
      heading: ph.label,
      description: ph.description,
    };
  }

  return { placeholders, sections };
}

/**
 * Validate that a buffer is a valid .docx file (ZIP with expected structure).
 */
export function isValidDocx(buffer: Buffer): boolean {
  try {
    const zip = new PizZip(buffer);
    return !!zip.file("word/document.xml");
  } catch {
    return false;
  }
}
