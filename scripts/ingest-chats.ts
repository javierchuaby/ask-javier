#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import type { ConversationChunk } from "../lib/chunker";

// 1. Ensure .env.local is loaded in Node environments
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

// Dynamic imports after env file is loaded
async function main() {
  const { env } = await import("../lib/env");
  const { getDb } = await import("../lib/mongodb");
  const { getEmbeddingsBatch, getSoCLaaSClient } = await import("../lib/rag");
  const {
    processRawMessages,
    groupIntoSessions,
    createChunksFromSessions,
    formatChunkForEmbedding,
  } = await import("../lib/chunker");

  // CLI Arguments
  const args = process.argv.slice(2);
  const skipDownload = args.includes("--skip-download");
  const dryRun = args.includes("--dry-run");

  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : null;

  const concIdx = args.indexOf("--concurrency");
  const concurrency = concIdx !== -1 ? parseInt(args[concIdx + 1], 10) : 4;

  const chatIdx = args.indexOf("--chat");
  const targetChat =
    chatIdx !== -1 ? args[chatIdx + 1] : env.TELEGRAM_TARGET_CHAT || "";

  const fileIdx = args.indexOf("--file");
  const defaultOutputDir = path.join(process.cwd(), ".data");
  if (!fs.existsSync(defaultOutputDir)) {
    fs.mkdirSync(defaultOutputDir, { recursive: true });
  }
  const defaultPath = path.join(defaultOutputDir, "messages.json");
  const messagesFilePath = fileIdx !== -1 ? args[fileIdx + 1] : defaultPath;

  console.log("==================================================");
  console.log("  🚀 ask-javier Telegram RAG Ingestion Pipeline");
  console.log("==================================================");
  console.log(`• SoCLaaS Endpoint : ${env.SOCLAAS_BASE_URL}`);
  console.log(`• Summary Model    : ${env.SOCLAAS_MODEL}`);
  console.log(`• Embedding Model  : ${env.SOCLAAS_EMBEDDING_MODEL}`);
  console.log(`• Concurrency      : ${concurrency}`);
  if (limit) console.log(`• Limit            : ${limit} chunks`);
  console.log("");

  // Step 1: Download latest messages from Telegram
  if (!skipDownload) {
    console.log(
      `📥 Step 1: Downloading latest chat history with ${targetChat}...`,
    );
    const cliPath = env.TELEGRAM_CLI_PATH.replace(/^~/, process.env.HOME || "");
    const downloadBin = fs.existsSync(cliPath)
      ? cliPath
      : "telegram-download-chat";

    const customEnv = {
      ...process.env,
      HOME: path.join(process.cwd(), ".data", "home"),
    };

    const result = spawnSync(
      downloadBin,
      [targetChat, "-o", messagesFilePath],
      {
        stdio: "inherit",
        shell: false,
        env: customEnv,
      },
    );

    if (result.status !== 0) {
      console.warn(
        `⚠️  telegram-download-chat exited with code ${result.status}. Attempting to use existing messages file...`,
      );
    } else {
      console.log("✅ Download completed successfully.\n");
    }
  } else {
    console.log("⏭️  Step 1: Skipped download (--skip-download passed).\n");
  }

  // Step 2: Read and parse messages
  console.log(`📂 Step 2: Reading messages from: ${messagesFilePath}...`);
  if (!fs.existsSync(messagesFilePath)) {
    console.error(`❌ Messages file not found at: ${messagesFilePath}`);
    process.exit(1);
  }

  let rawData;
  if (messagesFilePath.endsWith(".jsonl")) {
    const fileContent = fs.readFileSync(messagesFilePath, "utf-8");
    const lines = fileContent
      .split("\n")
      .filter((line) => line.trim().length > 0);
    rawData = lines.map((line) => {
      const parsed = JSON.parse(line);
      // telegram-download-chat .part.jsonl format wraps messages in {"m": {...}}
      return parsed.m ? parsed.m : parsed;
    });
  } else {
    rawData = JSON.parse(fs.readFileSync(messagesFilePath, "utf-8"));
  }

  console.log(`• Loaded ${rawData.length} raw message records.`);

  const cleanedMessages = processRawMessages(rawData);
  console.log(
    `• Cleaned & deduplicated: ${cleanedMessages.length} valid text messages.`,
  );

  // Step 3: Group into sessions & generate chunks
  console.log(
    "\n🧩 Step 3: Chunking messages (< 1hr session gap, max 20 msgs, 3 overlap)...",
  );
  const sessions = groupIntoSessions(cleanedMessages);
  console.log(`• Formed ${sessions.length} conversation sessions.`);

  const allChunks = createChunksFromSessions(sessions);
  console.log(`• Generated ${allChunks.length} total conversation chunks.`);

  if (dryRun) {
    console.log("\n🧪 Dry run enabled. Sample chunk metadata:");
    console.log(JSON.stringify(allChunks[0], null, 2));
    console.log("\nDone dry run.");
    process.exit(0);
  }

  // Step 4: Check existing chunks in MongoDB
  console.log("\n🔍 Step 4: Checking existing chunks in MongoDB Atlas...");
  const db = await getDb();
  const collection = db.collection("chat_history");

  const existingIds = (await collection.distinct("chunkId")) as string[];
  const existingSet = new Set(existingIds);
  console.log(
    `• Found ${existingSet.size} previously ingested chunks in MongoDB.`,
  );

  let pendingChunks = allChunks.filter((c) => !existingSet.has(c.chunkId));
  console.log(`• Pending new chunks to ingest: ${pendingChunks.length}`);

  if (limit && pendingChunks.length > limit) {
    console.log(
      `• Applying --limit ${limit}: processing latest ${limit} chunks.`,
    );
    // Take the most recent pending chunks
    pendingChunks = pendingChunks.slice(-limit);
  }

  if (pendingChunks.length === 0) {
    console.log(
      "\n✨ All chunks are already up-to-date in MongoDB! Nothing to do.",
    );
    process.exit(0);
  }

  // Step 5 & 6: Micro-Batch Summarization, Embedding & Ingestion
  console.log(
    `\n🤖 Step 5: Processing ${pendingChunks.length} chunks in micro-batches (Summarize -> Embed -> Ingest)...`,
  );
  const client = getSoCLaaSClient();
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  async function summarizeChunk(
    chunk: ConversationChunk,
    retries = 5,
  ): Promise<string> {
    const prompt = `You are an AI assistant analyzing a conversation between a couple, ${env.NEXT_PUBLIC_BOT_NAME} and ${env.NEXT_PUBLIC_USER_NAME}.
Dialogue:
${chunk.dialogueText}

Provide a concise 1 to 2 sentence summary of what they are talking about, doing, deciding, or experiencing. Focus on key details (plans, foods, places, emotions, inside jokes).
Return ONLY the summary, no other text.`;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const completion = await client.chat.completions.create({
          model: env.SOCLAAS_MODEL || "default",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 120,
        });

        return (
          completion.choices[0]?.message?.content?.trim() ||
          `Conversation between ${env.NEXT_PUBLIC_BOT_NAME} and ${env.NEXT_PUBLIC_USER_NAME}.`
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const isRateLimit =
          errorMsg.toLowerCase().includes("429") ||
          errorMsg.toLowerCase().includes("rate limit");
        const isServerError = errorMsg.match(/50[0234]/);

        if (isRateLimit || isServerError) {
          if (attempt < retries) {
            // Exponential backoff: 1s, 2s, 4s, 8s...
            const waitTime = Math.pow(2, attempt - 1) * 1000;
            await delay(waitTime);
            continue;
          }
        }
        console.warn(
          `\n⚠️ Failed to summarize chunk ${chunk.chunkId} after ${retries} attempts:`,
          errorMsg,
        );
        return `Conversation between ${env.NEXT_PUBLIC_BOT_NAME} and ${env.NEXT_PUBLIC_USER_NAME}.`;
      }
    }
    return `Conversation between ${env.NEXT_PUBLIC_BOT_NAME} and ${env.NEXT_PUBLIC_USER_NAME}.`;
  }

  const BATCH_SIZE = 20;
  let completedCount = 0;

  for (let i = 0; i < pendingChunks.length; i += BATCH_SIZE) {
    const chunkBatch = pendingChunks.slice(i, i + BATCH_SIZE);
    const summaries: string[] = new Array(chunkBatch.length);

    // 1. Summarize the batch concurrently
    let batchIndex = 0;
    async function worker() {
      while (batchIndex < chunkBatch.length) {
        const idx = batchIndex++;
        summaries[idx] = await summarizeChunk(chunkBatch[idx]);
        await delay(500); // Mandatory delay to ease rate limits
      }
    }
    const workers = Array.from(
      { length: Math.min(concurrency, chunkBatch.length) },
      () => worker(),
    );
    await Promise.all(workers);

    // 2. Generate embeddings for the batch
    const formattedTexts = chunkBatch.map((chunk, bIdx) =>
      formatChunkForEmbedding(summaries[bIdx], chunk),
    );
    let embeddings: number[][] = [];
    const embedRetries = 5;
    for (let attempt = 1; attempt <= embedRetries; attempt++) {
      try {
        embeddings = await getEmbeddingsBatch(formattedTexts);
        break;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (
          errorMsg.includes("429") ||
          errorMsg.includes("rate limit") ||
          errorMsg.match(/50[0234]/)
        ) {
          if (attempt < embedRetries) {
            const waitTime = Math.pow(2, attempt - 1) * 2000;
            console.warn(
              `\n⚠️ Rate limited on embeddings batch. Retrying in ${waitTime / 1000}s...`,
            );
            await delay(waitTime);
            continue;
          }
        }
        throw err;
      }
    }
    // 3. Immediately commit the batch to MongoDB
    const writeOps = chunkBatch.map((chunk, bIdx) => {
      const doc = {
        chunkId: chunk.chunkId,
        summary: summaries[bIdx],
        text: chunk.dialogueText,
        formattedEmbeddingText: formattedTexts[bIdx],
        firstMessageId: chunk.firstMessageId,
        lastMessageId: chunk.lastMessageId,
        messageCount: chunk.messageCount,
        startDate: chunk.startDate,
        endDate: chunk.endDate,
        embedding: embeddings[bIdx],
        updatedAt: new Date(),
      };

      return {
        updateOne: {
          filter: { chunkId: chunk.chunkId },
          update: { $set: doc },
          upsert: true,
        },
      };
    });

    await collection.bulkWrite(writeOps);

    // 4. Log progress
    completedCount += chunkBatch.length;
    process.stdout.write(
      `\r• Saved batch: [${completedCount}/${pendingChunks.length}] chunks completed...`,
    );
  }

  console.log("\n\n🎉 Ingestion finished successfully!");
  console.log("==================================================");
  console.log("  📌 Next Step: MongoDB Atlas Search Indexes (Hybrid + Vector)");
  console.log("==================================================");
  console.log("Because this app uses $rankFusion, you must create TWO separate indexes in Atlas:");
  console.log("\n1️⃣ ATLAS SEARCH INDEX (Text Search)");
  console.log("In MongoDB Atlas UI -> Atlas Search -> Create Search Index (Visual or JSON Editor):");
  console.log("• Database   : ask-javier-db");
  console.log("• Collection : chat_history");
  console.log("• Index Name : hybrid_index");
  console.log("• Definition (JSON):");
  console.log(
    JSON.stringify(
      {
        mappings: {
          dynamic: false,
          fields: {
            dialogueText: {
              analyzer: "lucene.standard",
              type: "string"
            },
            summary: {
              analyzer: "lucene.standard",
              type: "string"
            },
            text: {
              analyzer: "lucene.standard",
              type: "string"
            },
            userId: {
              type: "token"
            }
          }
        }
      },
      null,
      2,
    ),
  );
  console.log("\n2️⃣ ATLAS VECTOR SEARCH INDEX (Vector Search)");
  console.log("In MongoDB Atlas UI -> Atlas Search -> Create Vector Search Index (JSON Editor):");
  console.log("• Database   : ask-javier-db");
  console.log("• Collection : chat_history");
  console.log("• Index Name : vector_index");
  console.log("• Definition (JSON):");
  console.log(
    JSON.stringify(
      {
        fields: [
          {
            numDimensions: 1024,
            path: "embedding",
            similarity: "cosine",
            type: "vector"
          },
          {
            path: "userId",
            type: "filter"
          },
          {
            path: "chunkId",
            type: "filter"
          },
          {
            path: "startDate",
            type: "filter"
          }
        ]
      },
      null,
      2,
    ),
  );
  console.log("==================================================");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fatal ingestion error:", err);
  process.exit(1);
});
