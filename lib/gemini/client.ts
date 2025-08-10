import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  generateEmbedding,
  generateEmbeddings,
  chunkText,
  generateTitleEmbedding,
} from "@/lib/embeddings";

// Service role client for storage operations
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// Function declarations for Gemini
const functionDeclarations = [
  {
    name: "search_page_index",
    description:
      "Search for existing pages by semantic similarity of their title embeddings",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "The search query text",
        },
        topK: {
          type: Type.NUMBER,
          description: "Number of top results to return",
        },
        threshold: {
          type: Type.NUMBER,
          description: "Minimum similarity threshold (0-1)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "batch_resolve_page_index",
    description:
      "Batch resolve multiple terms to check if pages exist. Returns top matches including summary for model verification.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        candidates: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING },
              context: { type: Type.STRING },
            },
            required: ["term"],
          },
        },
        topK: { type: Type.NUMBER },
        threshold: { type: Type.NUMBER },
      },
      required: ["candidates"],
    },
  },
  {
    name: "search_content_index",
    description: "Search for relevant content chunks for RAG",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "The search query text",
        },
        topK: {
          type: Type.NUMBER,
          description: "Number of top results to return",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_page",
    description: "Get a specific page by slug",
    parameters: {
      type: Type.OBJECT,
      properties: {
        slug: {
          type: Type.STRING,
          description: "The page slug",
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "persist_new_page",
    description:
      "Create and persist a new wiki page. if this fails, try using a different and more specific slug.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        proposedSlug: { type: Type.STRING },
        summary: { type: Type.STRING },
        markdown: { type: Type.STRING },
      },
      required: ["title", "proposedSlug", "summary", "markdown"],
    },
  },
  {
    name: "persist_page_update",
    description: "Update an existing wiki page",
    parameters: {
      type: Type.OBJECT,
      properties: {
        slug: { type: Type.STRING },
        markdown: { type: Type.STRING },
        summary: { type: Type.STRING },
      },
      required: ["slug", "markdown"],
    },
  },
  {
    name: "redirect_to_existing",
    description: "Signal to redirect to an existing page",
    parameters: {
      type: Type.OBJECT,
      properties: {
        slug: { type: Type.STRING },
      },
      required: ["slug"],
    },
  },
  {
    name: "declare_no_existing",
    description:
      "Declare that no existing page matches the topic. Use this in decision-only turn when no suitable existing page is found.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: "finish_session",
    description:
      "Terminate the current tool-using session. Call when all required work is complete.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: { type: Type.STRING },
      },
      required: [],
    },
  },
];

// Function implementations
export async function searchPageIndex(
  query: string,
  topK: number = 5,
  threshold: number = 0.85
) {
  const supabase = await createClient();

  // Generate compact title embedding for query
  const queryEmbedding = await generateTitleEmbedding(query);

  // Search using pgvector over pages.title_embedding
  const { data, error } = await supabase.rpc("match_page_title_embeddings", {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: topK,
  });

  if (error) {
    console.error("Error searching page index:", error);
    return { matches: [] };
  }

  // data already contains summary via function; return as-is
  const matches = (data || []).map(
    (m: {
      page_id: number;
      slug: string;
      title: string;
      summary: string | null;
      score: number;
    }) => ({
      page_id: m.page_id,
      slug: m.slug,
      title: m.title,
      summary: m.summary ?? null,
      score: m.score,
    })
  );

  return { matches };
}

export async function batchResolvePageIndex(
  candidates: Array<{ term: string; context?: string }>,
  topK: number = 1,
  threshold: number = 0.85
) {
  const resolved = [] as Array<{
    term: string;
    slug: string;
    title: string;
    summary: string;
    score: number;
  }>;
  const unresolved = [] as Array<{ term: string }>;

  for (const candidate of candidates) {
    const query = candidate.context
      ? `${candidate.term} ${candidate.context}`
      : candidate.term;

    const result = await searchPageIndex(query, topK, threshold);

    if (result.matches.length > 0) {
      resolved.push({
        term: candidate.term,
        slug: result.matches[0].slug,
        title: result.matches[0].title,
        summary: result.matches[0].summary,
        score: result.matches[0].score,
      });
    } else {
      unresolved.push({ term: candidate.term });
    }
  }

  return { resolved, unresolved };
}

export async function searchContentIndex(query: string, topK: number = 10) {
  const supabase = await createClient();

  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query);

  // Search using pgvector
  const { data, error } = await supabase.rpc("match_content_embeddings", {
    query_embedding: queryEmbedding,
    match_count: topK,
  });

  if (error) {
    console.error("Error searching content index:", error);
    return { chunks: [] };
  }

  return { chunks: data || [] };
}

export async function getPage(slug: string) {
  const supabase = await createClient();
  const serviceSupabase = getServiceClient();

  // Get page metadata
  const { data: page, error } = await supabase
    .from("pages")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !page) {
    return null;
  }

  // Get markdown from storage using service client
  const { data: storageData } = await serviceSupabase.storage
    .from("pages")
    .download(page.storage_object_path);

  if (!storageData) {
    return null;
  }

  const markdown = await storageData.text();

  return {
    pageId: page.id,
    slug: page.slug,
    title: page.title,
    markdown: markdown,
  };
}

export async function persistNewPage(params: {
  title: string;
  proposedSlug: string;
  summary: string;
  markdown: string;
}) {
  const supabase = await createClient();

  // Check for slug conflicts and canonicalize
  let canonicalSlug = params.proposedSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");

  // Check if slug exists
  const { data: existing } = await supabase
    .from("pages")
    .select("slug")
    .eq("slug", canonicalSlug)
    .single();

  if (existing) {
    // Add number suffix if slug exists
    let counter = 1;
    while (true) {
      const testSlug = `${canonicalSlug}-${counter}`;
      const { data: exists } = await supabase
        .from("pages")
        .select("slug")
        .eq("slug", testSlug)
        .single();

      if (!exists) {
        canonicalSlug = testSlug;
        break;
      }
      counter++;
    }
  }

  // Upload markdown to storage using service client
  const storageObjectPath = `pages/${canonicalSlug}.md`;
  const serviceSupabase = getServiceClient();
  const { error: uploadError } = await serviceSupabase.storage
    .from("pages")
    .upload(storageObjectPath, params.markdown, {
      contentType: "text/markdown",
      upsert: true,
    });

  if (uploadError) {
    console.error("Error uploading to storage:", uploadError);
    throw new Error("Failed to upload page content");
  }

  // Pre-compute title embedding (best-effort; optional)
  let titleEmbedding: number[] | null = null;
  try {
    titleEmbedding = await generateTitleEmbedding(params.title);
  } catch (e) {
    console.warn(
      "Failed to generate title embedding; proceeding without it",
      e
    );
  }

  // Insert page metadata (including optional title_embedding)
  const { data: page, error: insertError } = await supabase
    .from("pages")
    .insert({
      slug: canonicalSlug,
      title: params.title,
      storage_object_path: storageObjectPath,
      summary: params.summary,
      ...(titleEmbedding ? { title_embedding: titleEmbedding } : {}),
    })
    .select()
    .single();

  if (insertError) {
    console.error("Error inserting page:", insertError);
    throw new Error("Failed to create page");
  }

  // Generate and store content embeddings for RAG

  // Chunk content and generate embeddings
  const chunks = chunkText(params.markdown);
  const chunkEmbeddings = await generateEmbeddings(chunks);

  const contentEmbeddingRecords = chunks.map((chunk, index) => ({
    page_id: page.id,
    chunk_index: index,
    content: chunk,
    embedding: chunkEmbeddings[index],
  }));

  await supabase.from("content_embeddings").insert(contentEmbeddingRecords);

  return {
    pageId: page.id,
    canonicalSlug: canonicalSlug,
    storageObjectPath: storageObjectPath,
  };
}

export async function persistPageUpdate(params: {
  slug: string;
  markdown: string;
  summary?: string;
}) {
  const supabase = await createClient();
  const serviceSupabase = getServiceClient();

  // Get page
  const { data: page, error } = await supabase
    .from("pages")
    .select("*")
    .eq("slug", params.slug)
    .single();

  if (error || !page) {
    throw new Error("Page not found");
  }

  // Update markdown in storage using service client
  const { error: uploadError } = await serviceSupabase.storage
    .from("pages")
    .update(page.storage_object_path, params.markdown, {
      contentType: "text/markdown",
      upsert: true,
    });

  if (uploadError) {
    console.error("Error updating storage:", uploadError);
    throw new Error("Failed to update page content");
  }

  // Update page metadata
  const updateData: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof params.summary === "string") {
    updateData.summary = params.summary;
  }

  await supabase.from("pages").update(updateData).eq("id", page.id);

  // No summary embedding to update anymore; title embedding remains unchanged here

  // Delete old content embeddings and insert new ones
  await supabase.from("content_embeddings").delete().eq("page_id", page.id);

  const chunks = chunkText(params.markdown);
  const chunkEmbeddings = await generateEmbeddings(chunks);

  const contentEmbeddingRecords = chunks.map((chunk, index) => ({
    page_id: page.id,
    chunk_index: index,
    content: chunk,
    embedding: chunkEmbeddings[index],
  }));

  await supabase.from("content_embeddings").insert(contentEmbeddingRecords);

  return { ok: true };
}

export function getGeminiClient() {
  return ai;
}

export function getFunctionDeclarations(): FunctionDeclaration[] {
  // The SDK expects FunctionDeclaration[], but TS inference across heterogenous
  // object literals can be overly strict. Cast to precise type to satisfy config.tools.
  return functionDeclarations as unknown as FunctionDeclaration[];
}
