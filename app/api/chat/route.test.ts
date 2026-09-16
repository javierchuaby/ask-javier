import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

// ─── MongoDB ────────────────────────────────────────────────────────────────
const mockInsertOne = vi.hoisted(() => vi.fn().mockResolvedValue({ insertedId: "abc" }));
const mockCountDocuments = vi.hoisted(() => vi.fn().mockResolvedValue(0));
const mockFindOne = vi.hoisted(() => vi.fn().mockResolvedValue({ title: "New Chat" }));
const mockUpdateOne = vi.hoisted(() => vi.fn().mockResolvedValue({ modifiedCount: 1 }));

vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: vi.fn().mockReturnValue({
      insertOne: mockInsertOne,
      countDocuments: mockCountDocuments,
      findOne: mockFindOne,
      updateOne: mockUpdateOne,
    }),
  }),
}));

// ─── Auth ────────────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ user: { email: "test@example.com", id: "user-123" } }),
);
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

// ─── Rate limit ──────────────────────────────────────────────────────────────
const mockCheckRateLimit = vi.fn().mockResolvedValue({ allowed: true });
const mockRecordRequest = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  recordRequest: (...args: unknown[]) => mockRecordRequest(...args),
  RATE_LIMITS: {},
}));

// ─── System prompt ───────────────────────────────────────────────────────────
vi.mock("@/lib/prompt", () => ({
  getSystemPrompt: vi.fn().mockReturnValue("### BOT FIRST PERSON PROMPT"),
}));

// ─── RAG ─────────────────────────────────────────────────────────────────────
const mockSearchSimilarChats = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock("@/lib/rag", () => ({
  searchSimilarChats: (...args: unknown[]) => mockSearchSimilarChats(...args),
}));

// ─── Vercel AI SDK: `ai` ─────────────────────────────────────────────────────
// We mock streamText to return a fake result object with toDataStreamResponse()
// so we can verify what was passed in without making real API calls.
const mockOnFinish = vi.hoisted(() => vi.fn());
const mockStreamTextCall = vi.hoisted(() => vi.fn());

vi.mock("ai", () => ({
  streamText: (...args: unknown[]) => mockStreamTextCall(...args),
  generateText: vi.fn().mockResolvedValue({ text: "Test Chat" }),
}));

// ─── Vercel AI SDK: `@ai-sdk/google` ─────────────────────────────────────────
vi.mock("@ai-sdk/google", () => ({
  google: vi.fn().mockReturnValue("mock-google-model"),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeDataStreamResponse() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('0:"Hello there"\n'));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { email: "test@example.com" } });
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockRecordRequest.mockResolvedValue(undefined);
    mockSearchSimilarChats.mockResolvedValue([]);
    mockInsertOne.mockResolvedValue({ insertedId: "abc" });
    mockCountDocuments.mockResolvedValue(2); // simulate existing messages
    mockFindOne.mockResolvedValue({ title: "New Chat" });
    mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

    // Default: streamText succeeds and returns a data stream response
    mockStreamTextCall.mockReturnValue({
      toDataStreamResponse: () => makeDataStreamResponse(),
    });
  });

  // ── Input validation ────────────────────────────────────────────────────────

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Hello" }] }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when messages is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when messages array is empty", async () => {
    const res = await POST(makeRequest({ messages: [] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "No messages provided" });
  });

  it("returns 400 when last message content is blank", async () => {
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "   " }] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Empty message" });
  });

  it("returns 400 when message exceeds max length", async () => {
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "a".repeat(100001) }] }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Message too long");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfter: 60 });
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Hello" }] }));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Rate limit exceeded");
    expect(json.retryAfter).toBe(60);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  // ── Feature 1: Vercel AI SDK streaming ─────────────────────────────────────

  it("[FEATURE 1] returns a 200 streaming response via streamText + toDataStreamResponse", async () => {
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Hello" }] }));

    expect(res.status).toBe(200);
    // The AI SDK data stream uses text/plain content-type
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(mockStreamTextCall).toHaveBeenCalledOnce();
  });

  it("[FEATURE 1] passes the system prompt and current date to streamText", async () => {
    await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }));

    const callArgs = mockStreamTextCall.mock.calls[0][0];
    expect(callArgs.system).toContain("### BOT FIRST PERSON PROMPT");
    expect(callArgs.system).toContain("CURRENT DATE");
    expect(callArgs.model).toBe("mock-google-model");
  });

  it("[FEATURE 1] correctly remaps bot role to assistant for the SDK", async () => {
    await POST(makeRequest({
      messages: [
        { role: "user", content: "Hi" },
        { role: "bot", content: "Hey love" },
        { role: "user", content: "Miss you" },
      ],
    }));

    const callArgs = mockStreamTextCall.mock.calls[0][0];
    expect(callArgs.messages[1].role).toBe("assistant");
    expect(callArgs.messages[0].role).toBe("user");
  });

  // ── Feature 2: Autonomous tool calling ─────────────────────────────────────

  it("[FEATURE 2] defines a search_memories tool with the correct description", async () => {
    await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }));

    const callArgs = mockStreamTextCall.mock.calls[0][0];
    expect(callArgs.tools).toBeDefined();
    expect(callArgs.tools.search_memories).toBeDefined();
    expect(callArgs.tools.search_memories.description).toContain("Search for past Telegram conversations");
    expect(callArgs.tools.search_memories.execute).toBeTypeOf("function");
  });

  it("[FEATURE 2] search_memories tool calls searchSimilarChats with the query", async () => {
    await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }));

    const { execute } = mockStreamTextCall.mock.calls[0][0].tools.search_memories;

    mockSearchSimilarChats.mockResolvedValueOnce([
      {
        chunkId: "chunk-1",
        dialogueText: "We had ramen in Tanjong Pagar",
        startDate: new Date("2024-05-14"),
      },
    ]);

    const result = await execute({ query: "ramen together" });

    expect(mockSearchSimilarChats).toHaveBeenCalledWith("ramen together", 4);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("We had ramen in Tanjong Pagar");
    expect(result[0]).toContain("14 May 2024");
  });

  it("[FEATURE 2] search_memories tool returns empty array when no memories found", async () => {
    await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }));

    const { execute } = mockStreamTextCall.mock.calls[0][0].tools.search_memories;
    mockSearchSimilarChats.mockResolvedValueOnce([]);

    const result = await execute({ query: "some query" });
    expect(result).toHaveLength(0);
  });

  it("[FEATURE 2] search_memories tool returns error string on failure, does not throw", async () => {
    await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }));

    const { execute } = mockStreamTextCall.mock.calls[0][0].tools.search_memories;
    mockSearchSimilarChats.mockRejectedValueOnce(new Error("DB error"));

    const result = await execute({ query: "anything" });
    expect(result).toEqual(["Search failed"]);
  });

  it("[FEATURE 2] system prompt does NOT inject XML memory tags (no hallucination trigger)", async () => {
    await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }));

    const callArgs = mockStreamTextCall.mock.calls[0][0];
    expect(callArgs.system).not.toContain("<retrieved_memories>");
    expect(callArgs.system).not.toContain("</retrieved_memories>");
    expect(callArgs.system).not.toContain("<memories>");
  });

  // ── Feature 3: Background-decoupled persistence ─────────────────────────────

  it("[FEATURE 3] saves user message to DB before streaming", async () => {
    const chatId = "507f1f77bcf86cd799439011";
    await POST(makeRequest({
      chatId,
      messages: [{ role: "user", content: "Hello there" }],
    }));

    // insertOne called for user message (synchronously, before stream)
    expect(mockInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({ role: "user", content: "Hello there" }),
    );
  });

  it("[FEATURE 3] onFinish callback saves the AI message to DB asynchronously", async () => {
    const chatId = "507f1f77bcf86cd799439011";

    let capturedOnFinish: ((args: { text: string }) => Promise<void>) | undefined;

    mockStreamTextCall.mockImplementationOnce((args) => {
      capturedOnFinish = args.onFinish;
      return { toDataStreamResponse: () => makeDataStreamResponse() };
    });

    await POST(makeRequest({
      chatId,
      messages: [{ role: "user", content: "Hello" }],
    }));

    expect(capturedOnFinish).toBeTypeOf("function");

    // Simulate the SDK calling onFinish after the stream completes
    mockInsertOne.mockClear();
    mockUpdateOne.mockClear();
    await capturedOnFinish!({ text: "Hi love, I'm good!" });

    // AI message must be saved
    expect(mockInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({ role: "bot", content: "Hi love, I'm good!" }),
    );
    // Chat record must be updated
    expect(mockUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: expect.any(Object) }),
      expect.objectContaining({ $set: expect.objectContaining({ messageCount: expect.any(Number) }) }),
    );
  });

  it("[FEATURE 3] onFinish does NOT save to DB if chatId is absent", async () => {
    let capturedOnFinish: ((args: { text: string }) => Promise<void>) | undefined;

    mockStreamTextCall.mockImplementationOnce((args) => {
      capturedOnFinish = args.onFinish;
      return { toDataStreamResponse: () => makeDataStreamResponse() };
    });

    // No chatId in the request body
    await POST(makeRequest({ messages: [{ role: "user", content: "Hello" }] }));

    mockInsertOne.mockClear();
    await capturedOnFinish!({ text: "Hi love!" });

    expect(mockInsertOne).not.toHaveBeenCalled();
  });

  it("[FEATURE 3] onFinish does NOT save to DB if response text is empty", async () => {
    const chatId = "507f1f77bcf86cd799439011";
    let capturedOnFinish: ((args: { text: string }) => Promise<void>) | undefined;

    mockStreamTextCall.mockImplementationOnce((args) => {
      capturedOnFinish = args.onFinish;
      return { toDataStreamResponse: () => makeDataStreamResponse() };
    });

    await POST(makeRequest({ chatId, messages: [{ role: "user", content: "Hello" }] }));

    mockInsertOne.mockClear();
    await capturedOnFinish!({ text: "   " }); // blank/whitespace only

    expect(mockInsertOne).not.toHaveBeenCalled();
  });
});
