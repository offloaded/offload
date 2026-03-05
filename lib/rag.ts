import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Text extraction ───

export async function extractText(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop();

  switch (ext) {
    case "pdf":
      return extractPdf(buffer);
    case "docx":
      return extractDocx(buffer);
    case "xlsx":
    case "xls":
      return extractXlsx(buffer);
    case "txt":
    case "md":
    case "csv":
      return buffer.toString("utf-8");
    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parser = new PDFParse({}) as any;
  await parser.load(buffer);
  const text = await parser.getText();
  return text;
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractXlsx(buffer: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    lines.push(`--- Sheet: ${sheetName} ---\n${csv}`);
  }
  return lines.join("\n\n");
}

// ─── Chunking ───

const CHUNK_SIZE = 500; // ~500 tokens ≈ ~2000 chars
const CHUNK_OVERLAP = 50; // ~50 tokens ≈ ~200 chars
const CHARS_PER_TOKEN = 4;

export function chunkText(
  text: string,
  chunkSize = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP
): string[] {
  const maxChars = chunkSize * CHARS_PER_TOKEN;
  const overlapChars = overlap * CHARS_PER_TOKEN;

  // Clean and normalize whitespace
  const cleaned = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();

  if (cleaned.length <= maxChars) {
    return cleaned ? [cleaned] : [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = start + maxChars;

    if (end < cleaned.length) {
      // Try to break at paragraph, then sentence, then word boundary
      const slice = cleaned.slice(start, end);
      const paraBreak = slice.lastIndexOf("\n\n");
      const sentenceBreak = slice.lastIndexOf(". ");
      const wordBreak = slice.lastIndexOf(" ");

      if (paraBreak > maxChars * 0.5) {
        end = start + paraBreak + 2;
      } else if (sentenceBreak > maxChars * 0.5) {
        end = start + sentenceBreak + 2;
      } else if (wordBreak > 0) {
        end = start + wordBreak + 1;
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    start = end - overlapChars;
    if (start >= cleaned.length) break;
  }

  return chunks;
}

// ─── Embeddings ───

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return openaiClient;
}

export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const openai = getOpenAI();

  // OpenAI supports batching up to 2048 inputs
  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });
    for (const item of response.data) {
      allEmbeddings.push(item.embedding);
    }
  }

  return allEmbeddings;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([text]);
  return embedding;
}

// ─── Document processing pipeline ───

export async function processDocument(
  supabase: SupabaseClient,
  documentId: string,
  storagePath: string
): Promise<void> {
  try {
    // 1. Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Download failed: ${downloadError?.message}`);
    }

    // Get the file name from the document record
    const { data: doc } = await supabase
      .from("documents")
      .select("file_name")
      .eq("id", documentId)
      .single();

    const fileName = doc?.file_name || storagePath;

    // 2. Extract text
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const text = await extractText(buffer, fileName);

    if (!text.trim()) {
      throw new Error("No text content extracted from document");
    }

    // 3. Chunk
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error("No chunks generated from document");
    }

    // 4. Generate embeddings
    const embeddings = await generateEmbeddings(chunks);

    // 5. Store chunks with embeddings
    const rows = chunks.map((content, i) => ({
      document_id: documentId,
      content,
      embedding: JSON.stringify(embeddings[i]),
      chunk_index: i,
      metadata: { total_chunks: chunks.length },
    }));

    // Insert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error: insertError } = await supabase
        .from("document_chunks")
        .insert(batch);

      if (insertError) {
        throw new Error(`Chunk insert failed: ${insertError.message}`);
      }
    }

    // 6. Mark document as ready
    await supabase
      .from("documents")
      .update({ status: "ready" })
      .eq("id", documentId);
  } catch (err) {
    console.error(`Document processing failed for ${documentId}:`, err);

    // Mark document as errored
    await supabase
      .from("documents")
      .update({ status: "error" })
      .eq("id", documentId);

    throw err;
  }
}

// ─── Retrieval ───

export async function retrieveContext(
  supabase: SupabaseClient,
  agentId: string,
  query: string,
  topK = 5
): Promise<{ content: string; fileName: string }[]> {
  const embedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: JSON.stringify(embedding),
    match_agent_id: agentId,
    match_threshold: 0.3,
    match_count: topK,
  });

  if (error || !data) {
    console.error("Similarity search failed:", error);
    return [];
  }

  // Enrich with file names
  const docIds = [...new Set(data.map((d: { document_id: string }) => d.document_id))];
  const { data: docs } = await supabase
    .from("documents")
    .select("id, file_name")
    .in("id", docIds);

  const docNameMap = new Map(
    (docs || []).map((d: { id: string; file_name: string }) => [d.id, d.file_name])
  );

  return data.map((chunk: { content: string; document_id: string }) => ({
    content: chunk.content,
    fileName: docNameMap.get(chunk.document_id) || "unknown",
  }));
}
