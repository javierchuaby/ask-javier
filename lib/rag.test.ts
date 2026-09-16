import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatMemoriesForPrompt,
  searchSimilarChats,
  MemoryChunk,
} from "./rag";

vi.mock("./env", () => ({
  env: {
    SOCLAAS_BASE_URL: "https://soclaas-api.comp.nus.edu.sg/v1",
    SOCLAAS_API_KEY: "test-api-key",
    SOCLAAS_MODEL: "default",
    SOCLAAS_EMBEDDING_MODEL: "bge-m3",
  },
}));

vi.mock("openai", () => {
  return {
    default: class {
      embeddings = {
        create: vi.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        }),
      };
    },
  };
});

const mockAggregate = vi.fn();
vi.mock("./mongodb", () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: vi.fn().mockReturnValue({
      aggregate: (...args: unknown[]) => mockAggregate(...args),
    }),
  }),
}));

describe("lib/rag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("formatMemoriesForPrompt", () => {
    it("returns an empty string if memories array is empty", () => {
      expect(formatMemoriesForPrompt([])).toBe("");
    });

    it("formats memories correctly with dialogue and date", () => {
      const mockMemories: MemoryChunk[] = [
        {
          chunkId: "chunk-1",
          summary: "Bot and User discussing dinner plans",
          dialogueText:
            "[Bot] What do you want to eat?\n[User] Let's get ramen!",
          startDate: new Date("2024-06-15T12:00:00Z"),
          endDate: new Date("2024-06-15T12:30:00Z"),
        },
      ];

      const formatted = formatMemoriesForPrompt(mockMemories);
      expect(formatted).toContain("[Memory 1 - 15 Jun 2024]");
      expect(formatted).not.toContain("Summary:");
      expect(formatted).toContain("[Bot] What do you want to eat?");
      expect(formatted).toContain("[User] Let's get ramen!");
    });
  });

  describe("searchSimilarChats", () => {
    it("returns empty array when vector search index throws an error", async () => {
      mockAggregate.mockReturnValue({
        toArray: vi.fn().mockRejectedValue(new Error("Index not found")),
      });

      const result = await searchSimilarChats("dinner");
      expect(result).toEqual([]);
    });
  });
});
