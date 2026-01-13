import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getToken } from 'next-auth/jwt';

// GET /api/chats/[chatId] - Get chat with messages
export async function GET(
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
    
    if (!ObjectId.isValid(chatId)) {
      return NextResponse.json(
        { error: 'Invalid chat ID' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const chatsCollection = db.collection('chats');
    const messagesCollection = db.collection('messages');

    // Get chat
    const chat = await chatsCollection.findOne({
      _id: new ObjectId(chatId),
    });

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    // Get messages for this chat
    const messages = await messagesCollection
      .find({ chatId: new ObjectId(chatId) })
      .sort({ index: 1 })
      .toArray();

    const messagesWithId = messages.map(msg => ({
      _id: msg._id.toString(),
      role: msg.role,
      content: msg.content,
      index: msg.index,
      createdAt: msg.createdAt,
    }));

    return NextResponse.json({
      _id: chat._id.toString(),
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      messageCount: chat.messageCount || 0,
      messages: messagesWithId,
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat' },
      { status: 500 }
    );
  }
}

// DELETE /api/chats/[chatId] - Delete chat and its messages
export async function DELETE(
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
    
    if (!ObjectId.isValid(chatId)) {
      return NextResponse.json(
        { error: 'Invalid chat ID' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const chatsCollection = db.collection('chats');
    const messagesCollection = db.collection('messages');
    const objectId = new ObjectId(chatId);

    // Delete chat
    const chatResult = await chatsCollection.deleteOne({ _id: objectId });

    if (chatResult.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    // Delete all messages for this chat
    await messagesCollection.deleteMany({ chatId: objectId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat:', error);
    return NextResponse.json(
      { error: 'Failed to delete chat' },
      { status: 500 }
    );
  }
}

// PATCH /api/chats/[chatId] - Update chat title
export async function PATCH(
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
    const { title } = await request.json();
    
    if (!ObjectId.isValid(chatId)) {
      return NextResponse.json(
        { error: 'Invalid chat ID' },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const chatsCollection = db.collection('chats');

    const result = await chatsCollection.updateOne(
      { _id: new ObjectId(chatId) },
      { 
        $set: { 
          title,
          updatedAt: new Date(),
        } 
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating chat:', error);
    return NextResponse.json(
      { error: 'Failed to update chat' },
      { status: 500 }
    );
  }
}
