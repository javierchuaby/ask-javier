import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: vi.fn().mockReturnValue({
      insertOne: vi.fn().mockResolvedValue(undefined),
      countDocuments: vi.fn().mockResolvedValue(0),
      findOne: vi.fn().mockResolvedValue({ title: "New Chat" }),
      updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    }),
  }),
}));

const mockGetTokenChat = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ email: "test@example.com" }),
);
vi.mock("next-auth/jwt", () => ({
  getToken: (opts: unknown) => mockGetTokenChat(opts),
}));

const mockCheckRateLimit = vi.fn();
const mockRecordRequest = vi.fn();
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  recordRequest: (...args: unknown[]) => mockRecordRequest(...args),
  RATE_LIMITS: {},
}));

const mockGetGenerativeModel = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prompt", () => ({
  getSystemPrompt: vi.fn().mockReturnValue("### JAVIER FIRST PERSON PROMPT"),
}));

// Mock Google Generative AI - use class for constructor
vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel = mockGetGenerativeModel;
    },
  };
});

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTokenChat.mockResolvedValue({ email: "test@example.com" });
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockRecordRequest.mockResolvedValue(undefined);

    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield { text: () => "Hi Aiden, love you too!" };
      },
    };

    mockGetGenerativeModel.mockReturnValue({
      startChat: vi.fn().mockReturnValue({
        sendMessageStream: vi.fn().mockResolvedValue({ stream: mockStream }),
      }),
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetTokenChat.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello" }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when no messages provided", async () => {
    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({ error: "No messages provided" });
  });

  it("returns 400 when messages is undefined", async () => {
    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when last message is empty", async () => {
    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "   " }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({ error: "Empty message" });
  });

  it("returns 400 when message exceeds max length", async () => {
    const longMessage = "a".repeat(100001);
    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: longMessage }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("Message too long");
  });

  it("returns 429 when rate limit exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfter: 60,
      reason: "perMinute",
    });

    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello" }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
    const json = await response.json();
    expect(json).toEqual(
      expect.objectContaining({
        error: "Rate limit exceeded",
        message: "Too many requests. Please try again later.",
        retryAfter: 60,
      }),
    );
    expect(response.headers.get("Retry-After")).toBe("60");
  });

  it("passes system instruction from getSystemPrompt() to the generative model", async () => {
    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "What is your favorite color?" }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8",
    );

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        systemInstruction: expect.stringContaining(
          "### JAVIER FIRST PERSON PROMPT",
        ),
      }),
    );
  });

  it("successfully handles affectionate messages without regex errors", async () => {
    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "I love you and miss you Javier" }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        systemInstruction: expect.stringContaining(
          "### JAVIER FIRST PERSON PROMPT",
        ),
      }),
    );
  });
});
