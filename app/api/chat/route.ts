import { streamText, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { checkRateLimit, recordRequest, RATE_LIMITS } from "@/lib/rateLimit";
import { getDb } from "@/lib/mongodb";
import { AI_MODELS } from "@/lib/constants";
import { env } from "@/lib/env";
import { getSystemPrompt } from "@/lib/prompt";
import { ObjectId } from "mongodb";
import { searchSimilarChats } from "@/lib/rag";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Generate a concise chat title from the first user message using Gemini AI
 */
async function generateChatTitle(
  firstMessage: string,
  chatId: string,
): Promise<void> {
  try {
    const db = await getDb();
    const chatsCollection = db.collection("chats");
    const objectId = new ObjectId(chatId);

    const modelName = AI_MODELS.TITLE;
    const rateLimitResult = await checkRateLimit(
      modelName,
      RATE_LIMITS[modelName],
    );

    if (!rateLimitResult.allowed) {
      return;
    }

    await recordRequest(modelName);
    
    const { text } = await generateText({
      model: google(modelName),
      system: env.TITLE_GENERATOR_SYSTEM_PROMPT ||
        `You are a title generator. Generate a concise, descriptive title (3-5 words, maximum 50 characters) that captures the main topic or essence of the user's query. Return only the title text - no quotes, no explanations, no additional text. Make it specific and meaningful, avoiding generic phrases.`,
      prompt: `Generate a short title (3-5 words, max 50 characters) for this query:\n\n${firstMessage}`,
    });

    let cleanTitle = text.replace(/^["']|["']$/g, "").trim();
    if (cleanTitle.length > 50) {
      cleanTitle = cleanTitle.slice(0, 50).trim();
    }

    if (cleanTitle && cleanTitle.length > 0) {
      await chatsCollection.updateOne(
        { _id: objectId },
        { $set: { title: cleanTitle } },
      );
    }
  } catch (error) {
    console.error(
      `[generateChatTitle] Failed to generate chat title for chat ${chatId}:`,
      error,
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { messages, chatId } = await request.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided" },
        { status: 400 },
      );
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || !lastMessage.content || !lastMessage.content.trim()) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    const MAX_MESSAGE_LENGTH = 100000;
    if (lastMessage.content.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        {
          error: `Message too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.`,
        },
        { status: 400 },
      );
    }

    if (chatId && ObjectId.isValid(chatId)) {
      try {
        const db = await getDb();
        const messagesCollection = db.collection("messages");
        const chatsCollection = db.collection("chats");
        const objectId = new ObjectId(chatId);

        const messageCount = await messagesCollection.countDocuments({
          chatId: objectId,
        });

        const chat = await chatsCollection.findOne({ _id: objectId });

        const userMessage = {
          chatId: objectId,
          role: "user",
          content: lastMessage.content,
          index: messageCount,
          createdAt: new Date(),
        };

        await messagesCollection.insertOne(userMessage);

        await chatsCollection.updateOne(
          { _id: objectId },
          {
            $set: {
              messageCount: messageCount + 1,
              updatedAt: new Date(),
            },
          },
        );

        if (messageCount === 0 && chat?.title === "New Chat") {
          const tempTitle = lastMessage.content.slice(0, 50).trim();
          await chatsCollection.updateOne(
            { _id: objectId },
            { $set: { title: tempTitle } },
          );
          
          generateChatTitle(lastMessage.content, chatId).catch((error) => {
            console.error(
              `[POST /api/chat] Error in generateChatTitle promise for chat ${chatId}:`,
              error,
            );
          });
        }
      } catch (error) {
        console.error("Failed to save user message:", error);
      }
    }

    const modelName = AI_MODELS.CHAT;
    const rateLimitResult = await checkRateLimit(
      modelName,
      RATE_LIMITS[modelName],
    );

    if (!rateLimitResult.allowed) {
      const retryAfter = rateLimitResult.retryAfter || 60;
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "Too many requests. Please try again later.",
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
          },
        },
      );
    }

    await recordRequest(modelName);

    let systemInstruction = getSystemPrompt();

    const now = new Date();
    const currentDate = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Singapore",
    });
    const currentTime = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: "Asia/Singapore",
    });

    systemInstruction += `\n\n### CURRENT DATE\n- Today's date is: ${currentDate}\n- The current time is: ${currentTime}\n- When answering questions about dates or current events, use this information.`;
    
    // Remap user/bot roles for AI SDK if necessary (usually AI SDK expects user, assistant, system)
    const sdkMessages = messages.map((m: any) => ({
      role: m.role === 'bot' ? 'assistant' : m.role,
      content: m.content
    }));

    const result = await streamText({
      model: google(modelName),
      messages: sdkMessages,
      system: systemInstruction,
      tools: {
        search_memories: {
          description: "Search for past Telegram conversations. Use this when the user asks about past events, memories, inside jokes, or shared experiences.",
          parameters: z.object({
            query: z.string().describe("A fully resolved search query combining current intent and past context."),
          }),
          execute: async ({ query }: { query: string }) => {
            try {
              const results = await searchSimilarChats(query, 4);
              return results.map(r => {
                const dateStr = r.startDate
                  ? new Date(r.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                  : "Unknown Date";
                return `[${dateStr}]\n${(r.dialogueText ?? "").trim()}`;
              });
            } catch (error) {
              console.error("Error searching chats:", error);
              return ["Search failed"];
            }
          },
        },
      },
      async onFinish({ text }) {
        if (chatId && ObjectId.isValid(chatId) && text.trim().length > 0) {
          try {
            const db = await getDb();
            const messagesCollection = db.collection("messages");
            const chatsCollection = db.collection("chats");
            const objectId = new ObjectId(chatId);

            const messageCount = await messagesCollection.countDocuments({
              chatId: objectId,
            });

            const aiMessage = {
              chatId: objectId,
              role: "bot", // keeping original role format for DB consistency
              content: text.trim(),
              index: messageCount,
              createdAt: new Date(),
            };

            await messagesCollection.insertOne(aiMessage);

            await chatsCollection.updateOne(
              { _id: objectId },
              {
                $set: {
                  messageCount: messageCount + 1,
                  updatedAt: new Date(),
                },
              },
            );
          } catch (error) {
            console.error("Failed to save AI message:", error);
          }
        }
      },
    });

    return result.toDataStreamResponse();
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    const msg = e.message;
    const isGeminiQuota =
      msg.includes("429") ||
      msg.includes("Quota exceeded") ||
      msg.includes("Too Many Requests");
    if (isGeminiQuota) {
      const retryMatch = msg.match(/retry in (\d+(?:\.\d+)?)s/);
      const retryAfter = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 60;
      return NextResponse.json(
        {
          error: "AI service quota exceeded",
          message:
            "The AI service is temporarily at capacity. Please try again in a minute.",
          retryAfter,
        },
        {
          status: 429,
          headers: { "Retry-After": retryAfter.toString() },
        },
      );
    }
    return NextResponse.json(
      { error: "Something went wrong on my end. The system is down." },
      { status: 500 },
    );
  }
}
