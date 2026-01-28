import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse, NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { checkRateLimit, recordRequest, RATE_LIMITS } from "@/lib/rateLimit";
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Determine cookie name based on environment (matches NextAuth config)
const isProduction = process.env.NODE_ENV === "production";
const cookieName = isProduction
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

// Define the Google API key
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY!);

/**
 * Generate a concise chat title from the first user message using Gemini AI
 * @param firstMessage - The first user message content
 * @param chatId - The chat ID to update
 * @returns Promise that resolves when title is updated
 */
async function generateChatTitle(firstMessage: string, chatId: string): Promise<void> {
    try {
        const db = await getDb();
        const chatsCollection = db.collection('chats');
        const objectId = new ObjectId(chatId);

        // Check rate limit before making API call
        const modelName = 'gemini-2.5-flash';
        const rateLimitResult = await checkRateLimit(modelName, RATE_LIMITS[modelName]);

        if (!rateLimitResult.allowed) {
            return;
        }

        await recordRequest(modelName);

        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: process.env.TITLE_GENERATOR_SYSTEM_PROMPT || `You are a title generator. Generate a concise, descriptive title (3-5 words, maximum 50 characters) that captures the main topic or essence of the user's query. Return only the title text - no quotes, no explanations, no additional text. Make it specific and meaningful, avoiding generic phrases.`,
        });

        const prompt = `Generate a short title (3-5 words, max 50 characters) for this query:\n\n${firstMessage}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const generatedTitle = response.text().trim();

        // Clean up the title: remove quotes if present, limit to 50 chars
        let cleanTitle = generatedTitle.replace(/^["']|["']$/g, '').trim();
        if (cleanTitle.length > 50) {
            cleanTitle = cleanTitle.slice(0, 50).trim();
        }

        // Only update if we got a valid title
        if (cleanTitle && cleanTitle.length > 0) {
            await chatsCollection.updateOne(
                { _id: objectId },
                { $set: { title: cleanTitle } }
            );
        }
    } catch (error) {
        console.error(`[generateChatTitle] Failed to generate chat title for chat ${chatId}:`, error);
    }
}

/**
 * Detects if the user message contains affection directed at ask-javier
 * @param message - The user's message content
 * @returns The detected affection phrase or null if no affection detected
 */
function detectAffection(message: string): string | null {
    if (!message || !message.trim()) {
        return null;
    }

    // Normalize the message: lowercase, remove extra spaces
    const normalized = message.toLowerCase().replace(/\s+/g, ' ').trim();

    // Affection keywords to look for
    const affectionKeywords = [
        'love',
        'like',
        'adore',
        'appreciate',
        'cherish',
        'treasure',
        'fond of',
        'care about',
        'care for',
        'miss you'
    ];

    // Bot references (contextual "you" is assumed when affection keywords are present)
    const botReferences = [
        'you',
        'javier',
        'ask-javier',
        'ask javier'
    ];

    // Check for affection keywords
    for (const keyword of affectionKeywords) {
        // Special handling for keywords that already contain "you" (like "miss you")
        const keywordContainsYou = keyword.includes(' you');

        if (keywordContainsYou) {
            // For phrases like "miss you", check if "i miss you" or "miss you" appears
            const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
            const patterns = [
                new RegExp(`i\\s+${escapedKeyword}`, 'i'),
                new RegExp(`${escapedKeyword}`, 'i'),
            ];

            for (const pattern of patterns) {
                const match = normalized.match(pattern);
                if (match) {
                    return match[0];
                }
            }
            continue;
        }

        // For other keywords, check if keyword exists in the message
        const keywordIndex = normalized.indexOf(keyword);
        if (keywordIndex === -1) continue;

        // Extract a window around the keyword to check for bot references
        const start = Math.max(0, keywordIndex - 50);
        const end = Math.min(normalized.length, keywordIndex + keyword.length + 50);
        const context = normalized.substring(start, end);

        // Check if any bot reference appears near the affection keyword
        // Or if the keyword is used in a way that suggests it's directed at the bot
        // (e.g., "i love u", "love you", "i like you", etc.)
        const hasBotReference = botReferences.some(ref => {
            const refIndex = context.indexOf(ref);
            // Check if reference is within reasonable distance (30 chars) of the keyword
            if (refIndex !== -1) {
                const distance = Math.abs(refIndex - (keywordIndex - start));
                return distance <= 30;
            }
            return false;
        });

        // Also check for common patterns like "i love u", "i love you", "love you"
        // These patterns suggest the affection is directed at the bot
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
        const commonPatterns = [
            new RegExp(`i\\s+${escapedKeyword}\\s+(u|you|javier|ask[-\\s]?javier)`, 'i'),
            new RegExp(`${escapedKeyword}\\s+(u|you|javier|ask[-\\s]?javier)`, 'i'),
            new RegExp(`(u|you|javier|ask[-\\s]?javier).*${escapedKeyword}`, 'i'),
        ];

        const matchesPattern = commonPatterns.some(pattern => pattern.test(normalized));

        // If we found an affection keyword with a bot reference or matching a common pattern
        if (hasBotReference || matchesPattern) {
            // Extract the core affection phrase
            // Try to find the most relevant phrase
            const phraseMatch = normalized.match(new RegExp(`(i\\s+)?${escapedKeyword}\\s+(u|you)`, 'i'));
            if (phraseMatch) {
                return phraseMatch[0];
            }
            return keyword;
        }
    }

    return null;
}

export async function POST(request: NextRequest) {
    // Check authentication
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
        cookieName: cookieName,
    });

    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { messages, chatId }: { messages: { role: string, content: string }[], chatId?: string } = await request.json();

        // Validate input
        if (!messages || messages.length === 0) {
            return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
        }

        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || !lastMessage.content || !lastMessage.content.trim()) {
            return NextResponse.json({ error: 'Empty message' }, { status: 400 });
        }

        // Validate message length (Gemini has token limits, roughly 1 token = 4 characters)
        // Setting a conservative limit of 100k characters (~25k tokens)
        const MAX_MESSAGE_LENGTH = 100000;
        if (lastMessage.content.length > MAX_MESSAGE_LENGTH) {
            return NextResponse.json({
                error: `Message too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.`
            }, { status: 400 });
        }

        // Save user message to database if chatId is provided
        let savedUserMessageIndex: number | null = null;
        let isFirstMessage = false;
        if (chatId && ObjectId.isValid(chatId)) {
            try {
                const db = await getDb();
                const messagesCollection = db.collection('messages');
                const chatsCollection = db.collection('chats');
                const objectId = new ObjectId(chatId);

                // Get current message count to determine if this is the first message
                const messageCount = await messagesCollection.countDocuments({ chatId: objectId });
                isFirstMessage = messageCount === 0;

                // Fetch chat document to check current title
                const chat = await chatsCollection.findOne({ _id: objectId });

                // Save user message
                const userMessage = {
                    chatId: objectId,
                    role: 'aiden',
                    content: lastMessage.content,
                    index: messageCount,
                    createdAt: new Date(),
                };

                const userResult = await messagesCollection.insertOne(userMessage);
                savedUserMessageIndex = messageCount;

                // Update chat's messageCount and updatedAt
                await chatsCollection.updateOne(
                    { _id: objectId },
                    {
                        $set: {
                            messageCount: messageCount + 1,
                            updatedAt: new Date(),
                        },
                    }
                );

                // If this is the first message AND title is still "New Chat", generate proper title
                if (messageCount === 0 && chat?.title === 'New Chat') {
                    const tempTitle = lastMessage.content.slice(0, 50).trim();
                    await chatsCollection.updateOne(
                        { _id: objectId },
                        { $set: { title: tempTitle } }
                    );
                    // Generate proper title asynchronously
                    generateChatTitle(lastMessage.content, chatId).catch((error) => {
                        console.error(`[POST /api/chat] Error in generateChatTitle promise for chat ${chatId}:`, error);
                    });
                }
            } catch (error) {
                console.error('Failed to save user message:', error);
            }
        }

        // Detect affection in the last user message
        const detectedAffection = detectAffection(lastMessage.content);

        // Check rate limit before making API call
        const modelName = "gemini-2.5-flash-lite";
        const rateLimitResult = await checkRateLimit(modelName, RATE_LIMITS[modelName]);

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
                }
            );
        }

        await recordRequest(modelName);

        // Build base system instruction
        let systemInstruction = process.env.JAVIER_SYSTEM_PROMPT || "";

        // Add affection mirroring instruction if affection is detected
        if (detectedAffection) {
            systemInstruction += `
                ### AFFECTION MIRRORING
                - The user has expressed affection toward you (ask-javier) in their message.
                - You MUST mirror this affection naturally in your response.
                - Mirror the exact phrase they used. For example, if they said "${detectedAffection}", respond with "${detectedAffection} too" (e.g., "i love u" → "I love you too", "love you" → "Love you too").
                - Keep it brief and natural - don't overthink it. Just mirror the affection at the end of your response if it fits naturally, or incorporate it naturally into your response.
            `;
        }

        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemInstruction.trim()
        });

        // Map custom roles to Gemini's required roles
        const history = messages.slice(0, -1).map(msg => ({
            role: msg.role === "aiden" ? "user" : "model",
            parts: [{ text: msg.content }],
        }))


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
                    if (chatId && ObjectId.isValid(chatId) && accumulatedText.trim().length > 0) {
                        try {
                            const db = await getDb();
                            const messagesCollection = db.collection('messages');
                            const chatsCollection = db.collection('chats');
                            const objectId = new ObjectId(chatId);

                            // Get current message count (includes the user message we just saved)
                            const messageCount = await messagesCollection.countDocuments({ chatId: objectId });

                            // Save AI response
                            const aiMessage = {
                                chatId: objectId,
                                role: 'javier',
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
                                }
                            );
                        } catch (error) {
                            console.error('Failed to save AI message:', error);
                        }
                    }

                    // If no content was received, send an error message
                    if (!hasContent) {
                        const errorText = encoder.encode('I can\'t handle that yet—ask the real Javier.');
                        controller.enqueue(errorText);
                    }

                    controller.close();
                } catch {
                    const errorText = encoder.encode('I can\'t handle that yet—ask the real Javier.');
                    controller.enqueue(errorText);
                    controller.close();
                }
            },
        });

        // Return streaming response
        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch {
        return NextResponse.json({ error: 'Ask the real Javier, the system is down.' }, { status: 500 });
    }
}
