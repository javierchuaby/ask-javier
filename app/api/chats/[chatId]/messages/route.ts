import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getToken } from 'next-auth/jwt';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkRateLimit, recordRequest, RATE_LIMITS } from '@/lib/rateLimit';

// Initialize Google Generative AI
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
    const modelName = 'gemini-3-flash';
    const rateLimitResult = await checkRateLimit(modelName, RATE_LIMITS[modelName]);
    
    if (!rateLimitResult.allowed) {
      // Rate limit exceeded - return early (keep truncated title)
      return;
    }

    // Record the request IMMEDIATELY after check passes, before API call
    // This prevents race conditions where multiple requests pass the check simultaneously
    await recordRequest(modelName);

    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: `You are a title generator. Generate a concise, descriptive title (3-5 words, maximum 50 characters) that captures the main topic or essence of the user's query. Return only the title text - no quotes, no explanations, no additional text. Make it specific and meaningful, avoiding generic phrases.`,
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
  } catch {
    // Error but don't throw - we'll keep the truncated title
  }
}

// POST /api/chats/[chatId]/messages - Add a message to a chat
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  // Check authentication
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { chatId } = await params;
    const { role, content } = await request.json();

    if (!ObjectId.isValid(chatId)) {
      return NextResponse.json(
        { error: 'Invalid chat ID' },
        { status: 400 }
      );
    }

    if (!role || !content) {
      return NextResponse.json(
        { error: 'Role and content are required' },
        { status: 400 }
      );
    }

    if (role !== 'aiden' && role !== 'javier') {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const chatsCollection = db.collection('chats');
    const messagesCollection = db.collection('messages');
    const objectId = new ObjectId(chatId);

    // Verify chat exists
    const chat = await chatsCollection.findOne({ _id: objectId });
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    // Get current message count to set index
    const messageCount = await messagesCollection.countDocuments({ chatId: objectId });

    // Insert message
    const newMessage = {
      chatId: objectId,
      role,
      content,
      index: messageCount,
      createdAt: new Date(),
    };

    const result = await messagesCollection.insertOne(newMessage);

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

    // Update chat title if this is the first message and title is "New Chat"
    if (messageCount === 0 && chat.title === 'New Chat' && role === 'aiden') {
      // Set temporary title immediately for instant UI feedback
      const tempTitle = content.slice(0, 50).trim();
      await chatsCollection.updateOne(
        { _id: objectId },
        { $set: { title: tempTitle } }
      );

      // Generate and update title asynchronously (fire and forget)
      generateChatTitle(content, chatId).catch(() => {});
    }

    return NextResponse.json({
      _id: result.insertedId.toString(),
      ...newMessage,
      chatId: chatId,
    }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to save message' },
      { status: 500 }
    );
  }
}
