import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error("Failed to generate embedding");
  }
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });

    return response.data.map((item) => item.embedding);
  } catch (error) {
    console.error("Error generating embeddings:", error);
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
