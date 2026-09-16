import { describe, it, expect } from "vitest";
import {
  processRawMessages,
  groupIntoSessions,
  createChunksFromSessions,
  formatChunkForEmbedding,
  RawTelegramMessage,
  CleanedMessage,
  redactPII,
} from "./chunker";

describe("lib/chunker", () => {
  it("processes, filters, deduplicates and sorts raw messages", () => {
    const raw: RawTelegramMessage[] = [
      {
        _: "Message",
        id: 2,
        date: "2024-01-01T10:05:00Z",
        message: "Second message",
        out: false,
      },
      {
        _: "Message",
        id: 1,
        date: "2024-01-01T10:00:00Z",
        message: "First message",
        out: true,
      },
      {
        _: "Message",
        id: 1, // Duplicate ID
        date: "2024-01-01T10:00:00Z",
        message: "First message duplicate",
        out: true,
      },
      {
        _: "Message",
        id: 3,
        date: "2024-01-01T10:10:00Z",
        message: "   ", // Empty text
        out: true,
      },
      {
        _: "OtherType",
        id: 4,
        date: "2024-01-01T10:15:00Z",
        message: "Non-message",
        out: false,
      },
    ];

    const cleaned = processRawMessages(raw);
    expect(cleaned).toHaveLength(2);
    expect(cleaned[0].id).toBe(1);
    expect(cleaned[0].sender).toBe("bot");
    expect(cleaned[0].text).toBe("First message duplicate"); // Map overwrote with same ID
    expect(cleaned[1].id).toBe(2);
    expect(cleaned[1].sender).toBe("user");
    expect(cleaned[1].text).toBe("Second message");
  });

  it("extracts media types for messages without text", () => {
    const raw: RawTelegramMessage[] = [
      {
        _: "Message",
        id: 1,
        date: "2024-01-01T10:00:00Z",
        message: "",
        out: false,
        media: { _: "MessageMediaPhoto" },
      },
      {
        _: "Message",
        id: 2,
        date: "2024-01-01T10:01:00Z",
        message: "   ",
        out: true,
        media: { _: "MessageMediaDocument" },
      },
      {
        _: "Message",
        id: 3,
        date: "2024-01-01T10:02:00Z",
        message: "",
        out: true,
        media: { _: "MessageMediaGeo" },
      },
    ];

    const cleaned = processRawMessages(raw);
    expect(cleaned).toHaveLength(3);
    expect(cleaned[0].text).toBe("[Photo]");
    expect(cleaned[1].text).toBe("[Document/Video/Voice]");
    expect(cleaned[2].text).toBe("[Location]");
  });

  describe("redactPII", () => {
    it("redacts email addresses", () => {
      expect(redactPII("Contact me at test@example.com please.")).toBe(
        "Contact me at [EMAIL] please.",
      );
      expect(redactPII("Email johndoe@example.com")).toBe("Email [EMAIL]");
    });

    it("redacts phone numbers", () => {
      expect(redactPII("Call me at +65 9119 5880")).toBe("Call me at [PHONE]");
      expect(redactPII("My number is 91195880")).toBe("My number is [PHONE]");
      expect(redactPII("Dial 1800-111-2222")).toBe("Dial [PHONE]");
    });

    it("redacts specific names", () => {
      expect(redactPII("I love you bot")).toBe("I love you [NAME]");
      expect(redactPII("Hi user, how are you?")).toBe(
        "Hi [NAME], how are you?",
      );
      expect(redactPII("User is here")).toBe("[NAME] is here");
    });

    it("does not redact normal text", () => {
      expect(redactPII("I love you 3000")).toBe("I love you 3000"); // 4 digits, not 8
      expect(redactPII("Let's go eat chicken rice")).toBe(
        "Let's go eat chicken rice",
      );
    });
  });

  it("groups messages into sessions by 1-hour inactivity gap", () => {
    const baseTime = new Date("2024-01-01T10:00:00Z").getTime();
    const messages: CleanedMessage[] = [
      {
        id: 1,
        date: new Date(baseTime),
        text: "Msg 1",
        sender: "bot",
      },
      {
        id: 2,
        date: new Date(baseTime + 30 * 60 * 1000), // +30 mins
        text: "Msg 2",
        sender: "user",
      },
      {
        id: 3,
        date: new Date(baseTime + 100 * 60 * 1000), // +70 mins after Msg 2 (> 1 hr)
        text: "Msg 3",
        sender: "bot",
      },
    ];

    const sessions = groupIntoSessions(messages);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toHaveLength(2); // Msg 1, Msg 2
    expect(sessions[1]).toHaveLength(1); // Msg 3
  });

  it("enforces max 20 messages per chunk with 3-message overlap", () => {
    // Create a single session of 25 messages
    const baseTime = new Date("2024-01-01T10:00:00Z").getTime();
    const session: CleanedMessage[] = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      date: new Date(baseTime + i * 60 * 1000), // 1 min apart
      text: `Msg ${i + 1}`,
      sender: i % 2 === 0 ? "bot" : "user",
    }));

    const chunks = createChunksFromSessions([session], 20, 3);
    expect(chunks).toHaveLength(2);

    // Chunk 1: 0 to 19 (length 20, ids 1 to 20)
    expect(chunks[0].messages).toHaveLength(20);
    expect(chunks[0].firstMessageId).toBe(1);
    expect(chunks[0].lastMessageId).toBe(20);

    // Chunk 2: step = 17, starts at index 17 (ids 18 to 25, length 8)
    expect(chunks[1].messages).toHaveLength(8);
    expect(chunks[1].firstMessageId).toBe(18);
    expect(chunks[1].lastMessageId).toBe(25);

    // Verify 3-message overlap: messages with id 18, 19, 20 are in both chunks
    const chunk1Ids = chunks[0].messages.map((m) => m.id);
    const chunk2Ids = chunks[1].messages.map((m) => m.id);
    expect(chunk1Ids).toContain(18);
    expect(chunk1Ids).toContain(19);
    expect(chunk1Ids).toContain(20);
    expect(chunk2Ids).toContain(18);
    expect(chunk2Ids).toContain(19);
    expect(chunk2Ids).toContain(20);
  });

  it("formats chunk for embedding correctly", () => {
    const chunk = {
      chunkId: "chunk_1_2",
      firstMessageId: 1,
      lastMessageId: 2,
      messageCount: 2,
      startDate: new Date("2024-01-01T10:00:00Z"),
      endDate: new Date("2024-01-01T10:05:00Z"),
      messages: [],
      dialogueText: "[Bot] Hello\n[User] Hi",
    };

    const formatted = formatChunkForEmbedding(
      "Discussing morning greeting",
      chunk,
    );
    expect(formatted).toContain("[Summary]: Discussing morning greeting");
    expect(formatted).toContain(
      "[Time]: 2024-01-01 10:00:00 to 2024-01-01 10:05:00",
    );
    expect(formatted).toContain("[Dialogue]:\n[Bot] Hello\n[User] Hi");
  });
});
