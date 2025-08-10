import { EmbedContentParameters, GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. Load env (e.g., dotenv) before calling embedding functions."
      );
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

function l2Normalize(values: number[]): number[] {
  let sumSquares = 0;
  for (const v of values) sumSquares += v * v;
  const norm = Math.sqrt(sumSquares);
  if (!isFinite(norm) || norm === 0) return values;
  return values.map((v) => v / norm);
}

// Content/query embeddings for RAG (1536 dims)
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const params: EmbedContentParameters = {
      model: "gemini-embedding-001",
      contents: text,
      config: {
        outputDimensionality: 1536,
        taskType: "SEMANTIC_SIMILARITY",
      },
    };
    const response = (await getAi().models.embedContent(params)) as unknown as {
      embeddings?: Array<{ values: number[] }>;
      embedding?: { values: number[] };
    };

    const values =
      response.embeddings?.[0]?.values || response.embedding?.values;
    if (!values) throw new Error("No embedding values returned");
    return l2Normalize(values);
  } catch (error) {
    console.error("Error generating embedding (Gemini):", error);
    throw new Error("Failed to generate embedding");
  }
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const params: EmbedContentParameters = {
      model: "gemini-embedding-001",
      contents: texts,
      config: {
        outputDimensionality: 1536,
        taskType: "SEMANTIC_SIMILARITY",
      },
    };
    const response = (await getAi().models.embedContent(params)) as unknown as {
      embeddings?: Array<{ values: number[] }>;
    };

    const embeddings = (response.embeddings || []).map((e) =>
      l2Normalize(e.values)
    );
    if (embeddings.length !== texts.length) {
      console.warn(
        `Embeddings count (${embeddings.length}) does not match input count (${texts.length})`
      );
    }
    return embeddings;
  } catch (error) {
    console.error("Error generating embeddings (Gemini):", error);
    throw new Error("Failed to generate embeddings");
  }
}

export function chunkText(text: string, maxChunkSize: number = 1000): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split("\n\n");

  let currentChunk = "";

  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the max size, save current chunk
    if (
      currentChunk &&
      currentChunk.length + paragraph.length + 2 > maxChunkSize
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      // Add paragraph to current chunk
      currentChunk = currentChunk
        ? `${currentChunk}\n\n${paragraph}`
        : paragraph;
    }

    // If a single paragraph is too long, split it
    if (paragraph.length > maxChunkSize) {
      if (currentChunk !== paragraph) {
        chunks.push(currentChunk.trim());
      }

      const sentences = paragraph.split(". ");
      currentChunk = "";

      for (const sentence of sentences) {
        if (
          currentChunk &&
          currentChunk.length + sentence.length + 2 > maxChunkSize
        ) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          currentChunk = currentChunk
            ? `${currentChunk}. ${sentence}`
            : sentence;
        }
      }
    }
  }

  // Don't forget the last chunk
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Title embeddings are smaller; store as 512-dim vectors on pages.title_embedding
export async function generateTitleEmbedding(text: string): Promise<number[]> {
  try {
    const params: EmbedContentParameters = {
      model: "gemini-embedding-001",
      contents: text,
      config: {
        outputDimensionality: 512,
        taskType: "SEMANTIC_SIMILARITY",
      },
    };
    const response = (await getAi().models.embedContent(params)) as unknown as {
      embeddings?: Array<{ values: number[] }>;
      embedding?: { values: number[] };
    };
    const values =
      response.embeddings?.[0]?.values || response.embedding?.values;
    if (!values) throw new Error("No title embedding values returned");
    return l2Normalize(values);
  } catch (error) {
    console.error("Error generating title embedding (Gemini):", error);
    throw new Error("Failed to generate title embedding");
  }
}
