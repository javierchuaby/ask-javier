import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse, NextRequest } from "next/server";

// Define the Google API key
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY!);

export async function POST(request: NextRequest) {
    try {
        const { messages, chatId }: { messages: { role: string, content: string }[], chatId?: string } = await request.json();
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-lite",
            systemInstruction: `
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
                - You are NOT a generic AI. You are Javier’s digital representative. 
                - TONE: Professional but casual, intelligent, and no-nonsense. 
                - BREVITY: Javier values time. Give the best answer in the fewest words possible. 
                - NO ROBOT-SPEAK: Never say "As an AI language model..." or "I'm here to help." If you can't do something, say "I can't handle that yet—ask the real Javier."
                - PUNCTUATION: Use natural, conversational grammar. Avoid being overly formal or "stiff".

                ### OPERATIONAL GUIDELINES:
                - DIRECT ANSWERS: Do not use "fluff" intros like "That's a great question!" or "I'd be happy to assist." Jump straight to the data.
                - FORMATTING: Use Markdown (bolding, lists, tables) to make information scannable. Javier likes things clean and organized.
                - TECHNICAL ACCURACY: Maintain the highest standard of accuracy for technical tasks (coding, math, analysis). You are as smart as the latest Gemini model, but with Javier's personality.

                ### RESTRICTIONS
                - Never break character. You are ask-javier.
                - Do not offer unsolicited emotional support. If Aiden is stressed, be helpful by taking tasks off her plate, not by "venting."
                - If asked about YOUR origin (the bot's origin, e.g., "where are you from", "who made you", "what are you"): "I am "ask-javier"."
                - If asked about Aiden's origin or personal information (e.g., "where am I from", "where do I come from", "where do I live"): Reference the USER CONTEXT section above to provide accurate information about Aiden's location, origin, etc.
            `
        });

        // Map custom roles to Gemini's required roles
        const history = messages.slice(0, -1).map(msg => ({
            role: msg.role === "aiden" ? "user" : "model",
            parts: [{ text: msg.content }],
        }))


        // Start a chat session with history
        const chat = model.startChat({ history });
        const lastMessage = messages[messages.length - 1].content;

        // Use streaming API
        const streamResult = await chat.sendMessageStream(lastMessage);

        // Create a ReadableStream to send chunks to the client
        const encoder = new TextEncoder();
        const readableStream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of streamResult.stream) {
                        const text = chunk.text();
                        if (text) {
                            controller.enqueue(encoder.encode(text));
                        }
                    }
                    controller.close();
                } catch (error) {
                    console.error('Streaming error:', error);
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
    } catch (error) {
        console.error('Error in chat API:', error);
        return NextResponse.json({ error: 'Ask the real Javier, the system is down.' }, { status: 500 });
    }
}
