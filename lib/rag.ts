import OpenAI from "openai";
import { env } from "./env";
import { getDb } from "./mongodb";

// Initialize OpenAI client pointing to SoCLaaS gateway
let clientInstance: OpenAI | null = null;

export function getSoCLaaSClient(): OpenAI {
  if (!clientInstance) {
    clientInstance = new OpenAI({
      baseURL: env.SOCLAAS_BASE_URL,
      apiKey: env.SOCLAAS_API_KEY || "dummy-key",
    });
  }
  return clientInstance;
}

export interface MemoryChunk {
  chunkId: string;
  startDate?: string | Date;
  endDate?: string | Date;
  dialogueText: string;
  summary?: string;
  score?: number;
}

/**
 * Generates an embedding vector for a single string using SoCLaaS (bge-m3).
 */
export async function getEmbedding(text: string): Promise<number[]> {
  if (!env.SOCLAAS_API_KEY) {
    throw new Error("SOCLAAS_API_KEY is not configured.");
  }
  const client = getSoCLaaSClient();
  const response = await client.embeddings.create({
    model: env.SOCLAAS_EMBEDDING_MODEL || "bge-m3",
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * Generates embeddings for a batch of strings using SoCLaaS (bge-m3).
 */
export async function getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (!env.SOCLAAS_API_KEY) {
    throw new Error("SOCLAAS_API_KEY is not configured.");
  }
  if (texts.length === 0) return [];

  const client = getSoCLaaSClient();
  const response = await client.embeddings.create({
    model: env.SOCLAAS_EMBEDDING_MODEL || "bge-m3",
    input: texts,
  });

  return response.data.map((item) => item.embedding);
}

/**
 * Searches MongoDB Atlas vector index for chat chunks most semantically similar to the query.
 * Falls back gracefully if Atlas vector search index has not been created yet.
 */
export async function searchSimilarChats(
  query: string,
  limit: number = 4,
  filter?: Record<string, string | number | boolean>,
): Promise<MemoryChunk[]> {
  if (!env.SOCLAAS_API_KEY) {
    return [];
  }

  try {
    const queryEmbedding = await getEmbedding(query);
    const db = await getDb();
    const collection = db.collection("chat_history");

    const CANDIDATE_LIMIT = Math.max(limit * 5, 20);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vectorSearchStage: any = {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: Math.max(limit * 10, 50),
        limit: CANDIDATE_LIMIT,
      },
    };

    if (filter) {
      vectorSearchStage.$vectorSearch.filter = filter;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textSearchConfig: any = {
      index: "hybrid_index",
      compound: {
        must: [
          {
            text: {
              query: query,
              path: ["dialogueText", "text", "summary"],
            },
          },
        ],
      },
    };

    if (filter) {
      textSearchConfig.compound.filter = Object.entries(filter).map(
        ([key, value]) => {
          // Requires the field to be indexed as a 'token' (for strings)
          // or boolean/number in the Atlas Search index mapping.
          return { equals: { path: key, value: value } };
        },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textSearchPipeline: any[] = [
      { $search: textSearchConfig },
      { $limit: CANDIDATE_LIMIT },
    ];
    const pipeline = [
      {
        $rankFusion: {
          input: {
            pipelines: {
              vectorSearchPipeline: [vectorSearchStage],
              textSearchPipeline: textSearchPipeline,
            },
          },
        },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          _id: 0,
          chunkId: 1,
          summary: 1,
          dialogueText: { $ifNull: ["$dialogueText", "$text"] },
          startDate: 1,
          endDate: 1,
          score: { $meta: "searchScore" },
        },
      },
    ];

    const rawResults = (await collection
      .aggregate(pipeline)
      .toArray()) as unknown as MemoryChunk[];

    const results = rawResults.filter(
      (r) => r.score !== undefined && r.score >= 0.015,
    );



    return results;
  } catch (error) {
    console.error("[searchSimilarChats] Hybrid search query failed:", error);
    return [];
  }
}

/**
 * Formats retrieved chat memory chunks into a prompt-friendly markdown block.
 */
export function formatMemoriesForPrompt(memories: MemoryChunk[]): string {
  if (!memories || memories.length === 0) {
    return "";
  }

  const formattedBlocks = memories.map((mem, index) => {
    // Format the date cleanly (e.g., "14 Oct 2024")
    const dateStr = mem.startDate
      ? new Date(mem.startDate).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "Unknown Date";

    // Inject only the date and the speaker-attributed dialogue
    return `[Memory ${index + 1} - ${dateStr}]\n${(mem.dialogueText ?? "").trim()}`;
  });

  return formattedBlocks.join("\n\n---\n\n");
}
