import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "./route";

const { mockInsertOne, mockToArray, mockChatsCollection } = vi.hoisted(() => {
  const mockInsertOne = vi.fn();
  const mockToArray = vi.fn();
  const mockChatsCollection = {
    insertOne: mockInsertOne,
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({ toArray: mockToArray }),
    }),
  };
  return { mockInsertOne, mockToArray, mockChatsCollection };
});

const mockDb = vi.hoisted(() => ({
  collection: vi.fn((name: string) => {
    if (name === "chats") return mockChatsCollection;
    throw new Error(`Unknown collection: ${name}`);
  }),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

const mockGetToken = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ email: "test@example.com" }),
);
vi.mock("next-auth/jwt", () => ({
  getToken: (opts: unknown) => mockGetToken(opts),
}));

describe("POST /api/chats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue({ email: "test@example.com" });
    mockInsertOne.mockResolvedValue({
      insertedId: { toString: () => "507f1f77bcf86cd799439011" },
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetToken.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/chats", {
      method: "POST",
      body: JSON.stringify({ title: "Test Chat" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toEqual({ error: "Unauthorized" });
  });

  it("creates a new chat with provided title", async () => {
    const request = new NextRequest("http://localhost/api/chats", {
      method: "POST",
      body: JSON.stringify({ title: "My Test Chat" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.title).toBe("My Test Chat");
    expect(json._id).toBe("507f1f77bcf86cd799439011");
    expect(mockInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "My Test Chat",
      }),
    );
  });

  it("creates a new chat with default title when none provided", async () => {
    const request = new NextRequest("http://localhost/api/chats", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.title).toBe("New Chat");
  });
});

describe("GET /api/chats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue({ email: "test@example.com" });
    mockToArray.mockResolvedValue([
      {
        _id: { toString: () => "507f1f77bcf86cd799439011" },
        title: "Chat 1",
        createdAt: new Date("2026-02-13T10:00:00Z"),
        updatedAt: new Date("2026-02-13T12:00:00Z"),
        messageCount: 5,
      },
    ]);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetToken.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/chats", {
      method: "GET",
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toEqual({ error: "Unauthorized" });
  });

  it("returns all chats for authenticated user", async () => {
    const request = new NextRequest("http://localhost/api/chats", {
      method: "GET",
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toHaveLength(1);
    expect(json[0]).toEqual({
      _id: "507f1f77bcf86cd799439011",
      title: "Chat 1",
      createdAt: "2026-02-13T10:00:00.000Z",
      updatedAt: "2026-02-13T12:00:00.000Z",
      messageCount: 5,
    });
    expect(mockChatsCollection.find).toHaveBeenCalled();
  });
});
