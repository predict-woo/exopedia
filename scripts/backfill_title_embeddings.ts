import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

import { generateTitleEmbedding } from "../lib/embeddings";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function backfillTitleEmbeddings() {
  const BATCH_SIZE = 50;
  let totalProcessed = 0;
  let cycle = 0;

  while (true) {
    cycle++;
    console.log(`Fetching batch ${cycle} (size=${BATCH_SIZE})...`);

    const { data: pages, error } = await supabase
      .from("pages")
      .select("id, title")
      .is("title_embedding", null)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      console.error("Failed to fetch pages:", error);
      process.exit(1);
    }

    if (!pages || pages.length === 0) {
      console.log("No more pages to backfill. Done.");
      break;
    }

    console.log(`Processing ${pages.length} pages...`);
    for (const page of pages as Array<{ id: number; title: string }>) {
      try {
        const vector = await generateTitleEmbedding(page.title);
        const { error: updateError } = await supabase
          .from("pages")
          .update({ title_embedding: vector })
          .eq("id", page.id);

        if (updateError) {
          console.warn(
            `Failed to update title_embedding for page ${page.id} (${page.title}):`,
            updateError
          );
          continue;
        }

        totalProcessed++;
        if (totalProcessed % 25 === 0) {
          console.log(`Processed ${totalProcessed} pages so far...`);
        }
      } catch (e) {
        console.warn(
          `Embedding generation failed for page ${page.id} (${page.title}):`,
          e
        );
      }
    }
  }

  console.log(`Backfill complete. Total processed: ${totalProcessed}`);
}

backfillTitleEmbeddings().catch((e) => {
  console.error("Backfill error:", e);
  process.exit(1);
});
