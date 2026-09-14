import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse, NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { checkRateLimit, recordRequest, RATE_LIMITS } from "@/lib/rateLimit";
import { getDb } from "@/lib/mongodb";
import { AI_MODELS } from "@/lib/constants";
import { env } from "@/lib/env";
import { getSystemPrompt } from "@/lib/prompt";
import { ObjectId } from "mongodb";

// Determine cookie name based on environment (matches NextAuth config)
const isProduction = env.NODE_ENV === "production";
const cookieName = isProduction
  ? "__Secure-next-auth.session-token"
  : "next-auth.session-token";

// Define the Google API key
const genAI = new GoogleGenerativeAI(env.GOOGLE_GENAI_API_KEY);

/**
 * Generate a concise chat title from the first user message using Gemini AI
 * @param firstMessage - The first user message content
 * @param chatId - The chat ID to update
 * @returns Promise that resolves when title is updated
 */
async function generateChatTitle(
  firstMessage: string,
  chatId: string,
): Promise<void> {
  try {
    const db = await getDb();
    const chatsCollection = db.collection("chats");
    const objectId = new ObjectId(chatId);

    // Check rate limit before making API call
    const modelName = AI_MODELS.TITLE;
    const rateLimitResult = await checkRateLimit(
      modelName,
      RATE_LIMITS[modelName],
    );

    if (!rateLimitResult.allowed) {
      return;
    }

    await recordRequest(modelName);

    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction:
        env.TITLE_GENERATOR_SYSTEM_PROMPT ||
        `You are a title generator. Generate a concise, descriptive title (3-5 words, maximum 50 characters) that captures the main topic or essence of the user's query. Return only the title text - no quotes, no explanations, no additional text. Make it specific and meaningful, avoiding generic phrases.`,
    });

    const prompt = `Generate a short title (3-5 words, max 50 characters) for this query:\n\n${firstMessage}`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedTitle = response.text().trim();

    // Clean up the title: remove quotes if present, limit to 50 chars
    let cleanTitle = generatedTitle.replace(/^["']|["']$/g, "").trim();
    if (cleanTitle.length > 50) {
      cleanTitle = cleanTitle.slice(0, 50).trim();
    }

    // Only update if we got a valid title
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
  // Check authentication
  const token = await getToken({
    req: request,
    secret: env.NEXTAUTH_SECRET,
    cookieName: cookieName,
  });

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const {
      messages,
      chatId,
    }: { messages: { role: string; content: string }[]; chatId?: string } =
      await request.json();

    // Validate input
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

    // Validate message length (Gemini has token limits, roughly 1 token = 4 characters)
    // Setting a conservative limit of 100k characters (~25k tokens)
    const MAX_MESSAGE_LENGTH = 100000;
    if (lastMessage.content.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        {
          error: `Message too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.`,
        },
        { status: 400 },
      );
    }

    // Save user message to database if chatId is provided
    if (chatId && ObjectId.isValid(chatId)) {
      try {
        const db = await getDb();
        const messagesCollection = db.collection("messages");
        const chatsCollection = db.collection("chats");
        const objectId = new ObjectId(chatId);

        // Get current message count to determine if this is the first message
        const messageCount = await messagesCollection.countDocuments({
          chatId: objectId,
        });

        // Fetch chat document to check current title
        const chat = await chatsCollection.findOne({ _id: objectId });

        // Save user message
        const userMessage = {
          chatId: objectId,
          role: "aiden",
          content: lastMessage.content,
          index: messageCount,
          createdAt: new Date(),
        };

        await messagesCollection.insertOne(userMessage);

        // Update chat's messageCount and updatedAt
        await chatsCollection.updateOne(
          { _id: objectId },
          {
            $set: {
              messageCount: messageCount + 1,
              updatedAt: new Date(),
            },
          },
        );

        // If this is the first message AND title is still "New Chat", generate proper title
        if (messageCount === 0 && chat?.title === "New Chat") {
          const tempTitle = lastMessage.content.slice(0, 50).trim();
          await chatsCollection.updateOne(
            { _id: objectId },
            { $set: { title: tempTitle } },
          );
          // Generate proper title asynchronously
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

    // Check rate limit before making API call
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

    // Build base system instruction
    let systemInstruction = getSystemPrompt();

    // Add current date and time to system instruction
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

    systemInstruction += `\n\n### CURRENT DATE AND TIME\n- Today's date is: ${currentDate}\n- Current time is: ${currentTime}\n- When answering questions about dates, times, or current events, use this information.`;

    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction.trim(),
    });

    // Map custom roles to Gemini's required roles
    const history = messages.slice(0, -1).map((msg) => ({
      role: msg.role === "aiden" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    // Start a chat session with history
    const chat = model.startChat({ history });

    // Use streaming API
    const streamResult = await chat.sendMessageStream(lastMessage.content);

    // Create a ReadableStream to send chunks to the client
    const encoder = new TextEncoder();
    let hasContent = false;

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          let accumulatedText = "";

          for await (const chunk of streamResult.stream) {
            const text = chunk.text();
            if (text) {
              hasContent = true;
              accumulatedText += text;
              controller.enqueue(encoder.encode(text));
            }
          }

          // Save AI response after streaming completes if chatId is provided
          if (
            chatId &&
            ObjectId.isValid(chatId) &&
            accumulatedText.trim().length > 0
          ) {
            try {
              const db = await getDb();
              const messagesCollection = db.collection("messages");
              const chatsCollection = db.collection("chats");
              const objectId = new ObjectId(chatId);

              // Get current message count (includes the user message we just saved)
              const messageCount = await messagesCollection.countDocuments({
                chatId: objectId,
              });

              // Save AI response
              const aiMessage = {
                chatId: objectId,
                role: "javier",
                content: accumulatedText.trim(),
                index: messageCount,
                createdAt: new Date(),
              };

              await messagesCollection.insertOne(aiMessage);

              // Update chat's messageCount and updatedAt
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

          // If no content was received, send an error message
          if (!hasContent) {
            const errorText = encoder.encode(
              "Something went wrong on my end. Try asking me again in a moment.",
            );
            controller.enqueue(errorText);
          }

          controller.close();
        } catch {
          const errorText = encoder.encode(
            "Something went wrong on my end. Try asking me again in a moment.",
          );
          controller.enqueue(errorText);
          controller.close();
        }
      },
    });

    // Return streaming response
    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
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
