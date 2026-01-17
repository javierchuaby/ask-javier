import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getToken } from 'next-auth/jwt';

// Determine cookie name based on environment (matches NextAuth config)
const isProduction = process.env.NODE_ENV === "production";
const cookieName = isProduction 
  ? "__Secure-next-auth.session-token" 
  : "next-auth.session-token";

// POST /api/chats - Create a new chat
export async function POST(request: NextRequest) {
  // Check authentication
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: cookieName,
  });

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title } = await request.json();
    const db = await getDb();
    const chatsCollection = db.collection('chats');

    const newChat = {
      title: title || 'New Chat',
      createdAt: new Date(),
      updatedAt: new Date(),
      messageCount: 0,
    };

    const result = await chatsCollection.insertOne(newChat);
    
    return NextResponse.json({
      _id: result.insertedId.toString(),
      ...newChat,
    }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to create chat' },
      { status: 500 }
    );
  }
}

// GET /api/chats - Get all chats
export async function GET(request: NextRequest) {
  // Check authentication
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: cookieName,
  });

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getDb();
    const chatsCollection = db.collection('chats');

    const chats = await chatsCollection
      .find({})
      .sort({ updatedAt: -1 })
      .toArray();

    const chatsWithId = chats.map(chat => ({
      _id: chat._id.toString(),
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      messageCount: chat.messageCount || 0,
    }));

    return NextResponse.json(chatsWithId);
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch chats' },
      { status: 500 }
    );
  }
}
