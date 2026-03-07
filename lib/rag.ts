import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
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
  const { extractText: extract } = await import("unpdf");
  const { text } = await extract(new Uint8Array(buffer));
  return Array.isArray(text) ? text.join("\n\n") : text;
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

// ─── Chunk metadata extraction ───

// Try to extract a date from the filename or early text
function extractDocumentDate(fileName: string, text: string): string | null {
  // Patterns: "2023-07", "July 2023", "07/2023", "2023_07", "2023-07-15", etc.
  const fnPatterns = [
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{4})_(\d{2})_(\d{2})/,
    /(\d{4})-(\d{2})/,
    /(\d{4})_(\d{2})/,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
  ];
  for (const pat of fnPatterns) {
    const m = fileName.match(pat);
    if (m) return m[0];
  }

  // Check first 500 chars for common date formats
  const head = text.slice(0, 500);
  const textPatterns = [
    /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
    /((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
    /(\d{4}-\d{2}-\d{2})/,
  ];
  for (const pat of textPatterns) {
    const m = head.match(pat);
    if (m) return m[1];
  }

  return null;
}

// Detect the nearest section heading above a chunk position
const HEADING_PATTERNS = [
  /^#{1,4}\s+(.+)$/m,                                    // Markdown headings
  /^(\d+\.?\s+[A-Z][A-Za-z\s,:\-–]+)$/m,                // Numbered sections: "5. Planning Matters"
  /^([A-Z][A-Z\s,:\-–]{4,})$/m,                          // ALL CAPS headings
  /^(Item\s+\d+[:\s\-–].+)$/im,                          // "Item 5 - Planning"
  /^(Agenda\s+Item\s+\d+[:\s\-–].*)$/im,                 // "Agenda Item 5: ..."
  /^(Resolution\s+\d+[:\s\-–].*)$/im,                    // "Resolution 12 - ..."
];

function detectSectionHeading(text: string, chunkStart: number): string | null {
  // Look backwards from chunkStart for the nearest heading
  const lookback = text.slice(Math.max(0, chunkStart - 2000), chunkStart);
  let lastHeading: string | null = null;

  for (const pat of HEADING_PATTERNS) {
    const matches = [...lookback.matchAll(new RegExp(pat.source, "gm"))];
    if (matches.length > 0) {
      const candidate = matches[matches.length - 1][1].trim();
      if (candidate.length > 3 && candidate.length < 120) {
        if (!lastHeading || lookback.lastIndexOf(candidate) > lookback.lastIndexOf(lastHeading)) {
          lastHeading = candidate;
        }
      }
    }
  }

  // Also check the chunk's own first line
  const chunkHead = text.slice(chunkStart, chunkStart + 200);
  for (const pat of HEADING_PATTERNS) {
    const m = chunkHead.match(pat);
    if (m && m[1].trim().length > 3 && m[1].trim().length < 120) {
      return m[1].trim();
    }
  }

  return lastHeading;
}

// ─── Chunking ───

const CHUNK_SIZE = 600; // ~600 tokens ≈ ~2400 chars — captures full agenda items
const CHUNK_OVERLAP = 100; // ~100 tokens ≈ ~400 chars — preserves cross-boundary context
const CHARS_PER_TOKEN = 4;

export interface ChunkMetadata {
  total_chunks: number;
  document_date?: string | null;
  section_heading?: string | null;
}

export interface ChunkWithMeta {
  content: string;
  metadata: ChunkMetadata;
}

export function chunkText(
  text: string,
  fileName: string,
  chunkSize = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP
): ChunkWithMeta[] {
  const maxChars = chunkSize * CHARS_PER_TOKEN;
  const overlapChars = overlap * CHARS_PER_TOKEN;

  // Clean and normalize whitespace
  const cleaned = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();

  const docDate = extractDocumentDate(fileName, cleaned);

  if (cleaned.length <= maxChars) {
    if (!cleaned) return [];
    return [{
      content: cleaned,
      metadata: {
        total_chunks: 1,
        document_date: docDate,
        section_heading: detectSectionHeading(cleaned, 0),
      },
    }];
  }

  const chunks: ChunkWithMeta[] = [];
  let start = 0;
  const positions: number[] = [];

  // First pass: determine chunk boundaries
  while (start < cleaned.length) {
    let end = start + maxChars;

    if (end < cleaned.length) {
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
      positions.push(start);
      chunks.push({
        content: chunk,
        metadata: {
          total_chunks: 0, // filled in after
          document_date: docDate,
          section_heading: detectSectionHeading(cleaned, start),
        },
      });
    }

    start = end - overlapChars;
    if (start >= cleaned.length) break;
  }

  // Fill in total_chunks
  for (const c of chunks) {
    c.metadata.total_chunks = chunks.length;
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

// ─── Query expansion ───

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return anthropicClient;
}

export async function expandQuery(query: string): Promise<string[]> {
  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: `You are a search query expander for a document retrieval system. Given a user question, produce 3-5 alternative phrasings and keyword variations that would help find relevant passages. Include synonyms, formal/informal variants, and related terms.

Output each variation on its own line. No numbering, no bullets, no explanation — just the search phrases, one per line.

Example input: "illegal camping"
Example output:
illegal camping enforcement penalties fines
unauthorised camping freedom camping prohibited camping
camping bylaw breach compliance
ranger services camping complaints patrols
camping roadmap policy review council resolution`,
      messages: [{ role: "user", content: query }],
    });
    const text =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : "";
    const variations = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    // Always include the original query
    const all = [query, ...variations];
    console.log(`[RAG] Query expanded into ${all.length} variations:`);
    for (const v of all) {
      console.log(`[RAG]   "${v}"`);
    }
    return all;
  } catch (err) {
    console.error("[RAG] Query expansion failed, using original:", err);
    return [query];
  }
}

// ─── Document processing pipeline ───

export async function processDocument(
  supabase: SupabaseClient,
  documentId: string,
  storagePath: string
): Promise<void> {
  try {
    // 1. Download file from storage
    console.log(`[RAG] Downloading file from storage: ${storagePath}`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Download failed: ${downloadError?.message}`);
    }
    console.log(`[RAG] Downloaded, size: ${fileData.size} bytes`);

    // Get the file name from the document record
    const { data: doc } = await supabase
      .from("documents")
      .select("file_name")
      .eq("id", documentId)
      .single();

    const fileName = doc?.file_name || storagePath;
    console.log(`[RAG] Extracting text from: ${fileName}`);

    // 2. Extract text
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const text = await extractText(buffer, fileName);

    if (!text.trim()) {
      throw new Error("No text content extracted from document");
    }
    console.log(`[RAG] Extracted ${text.length} chars`);

    // 3. Chunk with metadata
    const chunksWithMeta = chunkText(text, fileName);
    console.log(`[RAG] Created ${chunksWithMeta.length} chunks`);

    if (chunksWithMeta.length === 0) {
      throw new Error("No chunks generated from document");
    }

    // Log metadata samples
    const sample = chunksWithMeta[0].metadata;
    console.log(`[RAG] Metadata sample — date: ${sample.document_date}, heading: ${sample.section_heading}`);

    // 4. Generate embeddings
    console.log(`[RAG] Generating embeddings...`);
    const embeddings = await generateEmbeddings(chunksWithMeta.map((c) => c.content));
    console.log(`[RAG] Generated ${embeddings.length} embeddings`);

    // 5. Store chunks with embeddings
    const rows = chunksWithMeta.map((chunk, i) => ({
      document_id: documentId,
      content: chunk.content,
      embedding: JSON.stringify(embeddings[i]),
      chunk_index: i,
      metadata: chunk.metadata,
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
    console.log(`[RAG] Stored ${rows.length} chunks`);

    // 6. Mark document as ready
    const { error: updateError } = await supabase
      .from("documents")
      .update({ status: "ready" })
      .eq("id", documentId);

    if (updateError) {
      throw new Error(`Status update failed: ${updateError.message}`);
    }
    console.log(`[RAG] Document ${documentId} marked as ready`);
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

export interface RetrievedChunk {
  id: string;
  content: string;
  fileName: string;
  similarity: number;
  chunkIndex: number;
  documentId: string;
  metadata: ChunkMetadata;
}

export async function retrieveContext(
  supabase: SupabaseClient,
  agentId: string,
  query: string,
  topK = 5
): Promise<RetrievedChunk[]> {
  // 1. Expand the query into multiple phrasings
  const queryVariations = await expandQuery(query);

  // 2. Generate embeddings for all variations in one batch
  const embeddings = await generateEmbeddings(queryVariations);

  console.log(`[RAG Retrieve] agent=${agentId}, topK=${topK}, variations=${embeddings.length}`);

  // 3. Run vector search for each variation + full-text search, all in parallel
  const vectorSearches = embeddings.map((emb) =>
    supabase.rpc("match_document_chunks", {
      query_embedding: JSON.stringify(emb),
      match_agent_id: agentId,
      match_threshold: 0.15,
      match_count: topK,
    })
  );

  // Full-text search — extract keywords from all variations
  const allTerms = queryVariations
    .join(" ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter((w) => w.length > 2);
  // Deduplicate and take top terms
  const uniqueTerms = [...new Set(allTerms.map((t) => t.toLowerCase()))].slice(0, 20);
  const tsQuery = uniqueTerms.join(" | ");

  console.log(`[RAG Retrieve] Full-text query: "${tsQuery}"`);

  const textSearch = supabase.rpc("search_document_chunks_text", {
    search_query: tsQuery,
    search_agent_id: agentId,
    search_count: topK,
  });

  const [textResult, ...vectorResults] = await Promise.all([textSearch, ...vectorSearches]);

  // 4. Merge and deduplicate by chunk ID
  type RawChunk = {
    id: string;
    content: string;
    document_id: string;
    similarity: number;
    chunk_index: number;
    metadata: ChunkMetadata;
  };

  const chunkMap = new Map<string, RawChunk>();

  // Process vector results — keep highest similarity per chunk
  for (const result of vectorResults) {
    if (result.error || !result.data) continue;
    for (const chunk of result.data as RawChunk[]) {
      const existing = chunkMap.get(chunk.id);
      if (!existing || chunk.similarity > existing.similarity) {
        chunkMap.set(chunk.id, chunk);
      }
    }
  }

  // Process text search results — boost their score slightly so exact matches rank well
  if (!textResult.error && textResult.data) {
    for (const chunk of textResult.data as (RawChunk & { rank: number })[]) {
      const existing = chunkMap.get(chunk.id);
      // Text matches get a score based on their text rank, blended with any vector score
      const textScore = Math.min(0.5 + (chunk.rank || 0) * 0.1, 0.9);
      const bestScore = existing
        ? Math.max(existing.similarity, textScore)
        : textScore;
      chunkMap.set(chunk.id, {
        ...chunk,
        similarity: bestScore,
      });
    }
  }

  console.log(`[RAG Retrieve] Merged unique chunks: ${chunkMap.size}`);

  // 5. Sort by similarity and take topK
  const sorted = [...chunkMap.values()]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  // 6. Enrich with file names
  const docIds = [...new Set(sorted.map((d) => d.document_id))];
  const { data: docs } = await supabase
    .from("documents")
    .select("id, file_name")
    .in("id", docIds);

  const docNameMap = new Map(
    (docs || []).map((d: { id: string; file_name: string }) => [d.id, d.file_name])
  );

  const results: RetrievedChunk[] = sorted.map((chunk) => ({
    id: chunk.id,
    content: chunk.content,
    fileName: docNameMap.get(chunk.document_id) || "unknown",
    similarity: chunk.similarity,
    chunkIndex: chunk.chunk_index,
    documentId: chunk.document_id,
    metadata: chunk.metadata || {},
  }));

  return results;
}
