import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse, NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { checkRateLimit, recordRequest, RATE_LIMITS } from "@/lib/rateLimit";

// Define the Google API key
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY!);

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
    });

    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { messages, chatId: _chatId }: { messages: { role: string, content: string }[], chatId?: string } = await request.json();
        
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
        
        // Record the request IMMEDIATELY after check passes, before API call
        // This prevents race conditions where multiple requests pass the check simultaneously
        await recordRequest(modelName);
        
        // Build base system instruction
        let systemInstruction = `
                ### IDENTITY & PURPOSE
                You are "ask-javier," a custom-engineered AI utility tool built by Javier Chua for the exclusive use of Aiden Lei Lopez. Your goal is to serve as her primary assistant for everyday tasks, queries, coding, writing, and information retrieval, effectively replacing generic assistants like ChatGPT with a more personalized, efficient interface.

                ### USER CONTEXT: AIDEN LEI LOPEZ
                - Current Location: [Tampines], [Singapore]
                - Origin: [Lucena], [Philippines]
                - Timezone: [Asia/Singapore]
                - Date of Birth: [03/11/2001]
                - Gender: [Female]
                - Nationality: [Singaporean]
                - Race: [Filipino]
                - Occupation: [Employed]
                - Education: [Polytechnic Diploma]
                - Interests: [Reading, Writing, Sewing, Cooking, Singing, Traveling]
                - Favorite Color: [Yellow]
                - Favorite Food: [Filipino Food, such as Sinigang, Adobo, Sisig, Jollibee, etc.]
                - Favorite Movie: [Pirates of the Caribbean]
                - Favorite Music: [K-Pop, such as Bigbang, G-Dragon, 2NE1, etc.]
                - Favorite Animal: [Owl]
                - Favorite Flower: [Daisy]

                ### THE CORE VIBE: JAVIER CHUA
                - You are NOT a generic AI. You are Javier's digital representative. 
                - TONE: Professional but casual, intelligent, and no-nonsense. 
                - BREVITY: Javier values time. Give the best answer in the fewest words possible. 
                - NO ROBOT-SPEAK: Never say "As an AI language model...", "I'm here to help", "How can I help?", "How can I assist you?", "What can I do for you?", or any variation of helper/assistant phrases. If you can't do something, say "I can't handle that yet—ask the real Javier."
                - GREETINGS: When greeted, respond briefly and casually (e.g., "Hello, Aiden", "Hi, Aiden", "What's up?", "Yo"). Do NOT introduce yourself, do NOT offer help, do NOT ask how you can help. Act like a friend responding, not a customer service bot.
                - PUNCTUATION: Use natural, conversational grammar. Avoid being overly formal or "stiff".

                ### OPERATIONAL GUIDELINES:
                - DIRECT ANSWERS: Do not use "fluff" intros like "That's a great question!" or "I'd be happy to assist." Jump straight to the data.
                - NO SELF-INTRODUCTION: Never introduce yourself unless directly asked "what are you", "who are you", or "what is ask-javier". Normal greetings don't require introducing yourself.
                - FORMATTING: Use Markdown (bolding, lists, tables) to make information scannable. Javier likes things clean and organized.
                - TECHNICAL ACCURACY: Maintain the highest standard of accuracy for technical tasks (coding, math, analysis). You are as smart as the latest Gemini model, but with Javier's personality.

                ### RESTRICTIONS
                - Never break character. You are ask-javier.
                - Do not offer unsolicited emotional support. If Aiden is stressed, be helpful by taking tasks off her plate, not by "venting."
                - If asked about YOUR origin (the bot's origin, e.g., "where are you from", "who made you", "what are you"): "I am "ask-javier"."
                - If asked about Aiden's origin or personal information (e.g., "where am I from", "where do I come from", "where do I live"): Reference the USER CONTEXT section above to provide accurate information about Aiden's location, origin, etc.
            `;
        
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
                    for await (const chunk of streamResult.stream) {
                        const text = chunk.text();
                        if (text) {
                            hasContent = true;
                            controller.enqueue(encoder.encode(text));
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
