import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// POST /api/chats/[chatId]/messages - Add a message to a chat
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
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
      const title = content.slice(0, 50).trim();
      await chatsCollection.updateOne(
        { _id: objectId },
        { $set: { title } }
      );
    }

    return NextResponse.json({
      _id: result.insertedId.toString(),
      ...newMessage,
      chatId: chatId,
    }, { status: 201 });
  } catch (error) {
    console.error('Error saving message:', error);
    return NextResponse.json(
      { error: 'Failed to save message' },
      { status: 500 }
    );
  }
}
