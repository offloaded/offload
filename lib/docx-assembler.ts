/**
 * Assemble a filled .docx document from a template and placeholder data.
 * Uses docxtemplater to inject content while preserving all formatting.
 */

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

export interface AssemblyResult {
  buffer: Buffer;
  missingPlaceholders: string[];
}

/**
 * Fill a .docx template with the provided data.
 * Preserves all formatting, styles, logos, headers, footers from the original template.
 *
 * @param templateBuffer - The original .docx file as a Buffer
 * @param data - Key-value pairs where keys are placeholder names and values are content strings
 * @param expectedPlaceholders - Optional list of expected placeholder names for validation
 * @returns The assembled document buffer and any missing placeholders
 */
export function assembleDocument(
  templateBuffer: Buffer,
  data: Record<string, string>,
  expectedPlaceholders?: string[]
): AssemblyResult {
  const zip = new PizZip(templateBuffer);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // Replace missing placeholders with empty string rather than throwing
    nullGetter: () => "",
  });

  // Set the data — docxtemplater will replace {tag} and {{tag}} patterns
  doc.setData(data);

  // Render the document
  doc.render();

  // Check for missing placeholders
  const missingPlaceholders: string[] = [];
  if (expectedPlaceholders) {
    for (const ph of expectedPlaceholders) {
      if (!(ph in data) || !data[ph]) {
        missingPlaceholders.push(ph);
      }
    }
  }

  // Generate the output
  const outputBuffer = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  return {
    buffer: outputBuffer,
    missingPlaceholders,
  };
}
