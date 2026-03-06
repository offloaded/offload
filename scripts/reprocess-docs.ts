import { createClient } from "@supabase/supabase-js";
import { processDocument } from "../lib/rag";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Find all stuck documents
  const { data: docs, error } = await supabase
    .from("documents")
    .select("id, file_name, storage_path, status")
    .in("status", ["processing", "error"]);

  if (error) {
    console.error("Failed to fetch documents:", error);
    process.exit(1);
  }

  if (!docs || docs.length === 0) {
    console.log("No stuck documents found.");
    return;
  }

  console.log(`Found ${docs.length} document(s) to reprocess:`);
  for (const doc of docs) {
    console.log(`  - ${doc.file_name} (${doc.status})`);
  }

  for (const doc of docs) {
    console.log(`\nProcessing: ${doc.file_name}...`);
    try {
      // Clear any existing chunks first
      await supabase
        .from("document_chunks")
        .delete()
        .eq("document_id", doc.id);

      // Reset status to processing
      await supabase
        .from("documents")
        .update({ status: "processing" })
        .eq("id", doc.id);

      await processDocument(supabase, doc.id, doc.storage_path);
      console.log(`  ✓ Done`);
    } catch (err) {
      console.error(`  ✗ Failed:`, err);
    }
  }
}

main();
