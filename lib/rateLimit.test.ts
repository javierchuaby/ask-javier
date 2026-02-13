import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AI_MODELS } from "./constants";
import { checkRateLimit, recordRequest, RATE_LIMITS } from "./rateLimit";

// Helper to get Pacific date string (rateLimit uses America/Los_Angeles)
function getPacificDateString(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

const mockCollection = vi.hoisted(() => ({
  createIndex: vi.fn().mockResolvedValue(undefined),
  findOneAndUpdate: vi.fn(),
  findOne: vi.fn(),
  updateOne: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({
  collection: vi.fn().mockReturnValue(mockCollection),
}));

vi.mock("./mongodb", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-02-13T18:00:00.000Z")); // Fixed time for consistent Pacific date
  mockCollection.createIndex.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  describe("checkRateLimit", () => {
    it("allows request when no previous requests exist", async () => {
      const now = new Date();
      const todayString = getPacificDateString(now);

      mockCollection.findOneAndUpdate.mockResolvedValue({
        model: "test-model",
        requests: [],
        dailyCount: 0,
        lastResetDate: todayString,
      });

      const result = await checkRateLimit("test-model", {
        perMinute: 9,
        perDay: 19,
      });

      expect(result).toEqual({ allowed: true });
    });

    it("allows request when under per-minute limit", async () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 30 * 1000);
      const todayString = getPacificDateString(now);

      mockCollection.findOneAndUpdate.mockResolvedValue({
        model: "test-model",
        requests: [
          { timestamp: oneMinuteAgo },
          { timestamp: new Date(oneMinuteAgo.getTime() + 10000) },
        ],
        dailyCount: 2,
        lastResetDate: todayString,
      });

      const result = await checkRateLimit("test-model", {
        perMinute: 9,
        perDay: 19,
      });

      expect(result).toEqual({ allowed: true });
    });

    it("denies request when at per-minute limit", async () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 30 * 1000);
      const todayString = getPacificDateString(now);

      const timestamps = Array.from({ length: 9 }, (_, i) => ({
        timestamp: new Date(oneMinuteAgo.getTime() + i * 1000),
      }));

      mockCollection.findOneAndUpdate.mockResolvedValue({
        model: "test-model",
        requests: timestamps,
        dailyCount: 9,
        lastResetDate: todayString,
      });

      const result = await checkRateLimit("test-model", {
        perMinute: 9,
        perDay: 19,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("perMinute");
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThanOrEqual(1);
    });

    it("denies request when at per-day limit", async () => {
      const now = new Date();
      const todayString = getPacificDateString(now);

      mockCollection.findOneAndUpdate.mockResolvedValue({
        model: "test-model",
        requests: [],
        dailyCount: 19,
        lastResetDate: todayString,
      });

      const result = await checkRateLimit("test-model", {
        perMinute: 9,
        perDay: 19,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("perDay");
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThanOrEqual(1);
    });

    it("filters out requests older than 1 minute for per-minute check", async () => {
      const now = new Date();
      const twoMinutesAgo = new Date(now.getTime() - 120 * 1000);
      const todayString = getPacificDateString(now);

      mockCollection.findOneAndUpdate.mockResolvedValue({
        model: "test-model",
        requests: Array.from({ length: 20 }, (_, i) => ({
          timestamp: new Date(twoMinutesAgo.getTime() + i * 1000),
        })),
        dailyCount: 5,
        lastResetDate: todayString,
      });

      const result = await checkRateLimit("test-model", {
        perMinute: 9,
        perDay: 19,
      });

      expect(result).toEqual({ allowed: true });
    });
  });

  describe("recordRequest", () => {
    it("calls updateOne to record the request", async () => {
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
      mockCollection.findOne.mockResolvedValue({
        model: "test-model",
        requests: [],
        dailyCount: 0,
        lastResetDate: "2026-02-13",
      });

      await recordRequest("test-model");

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { model: "test-model" },
        expect.objectContaining({
          $inc: { dailyCount: 1 },
          $set: { lastResetDate: expect.any(String) },
        }),
        { upsert: true },
      );
    });
  });

  describe("RATE_LIMITS", () => {
    it("exports correct rate limit config for CHAT and TITLE models", () => {
      expect(RATE_LIMITS).toBeDefined();
      expect(RATE_LIMITS[AI_MODELS.CHAT]).toEqual({
        perMinute: 9,
        perDay: 19,
      });
      expect(RATE_LIMITS[AI_MODELS.TITLE]).toEqual({
        perMinute: 4,
        perDay: 19,
      });
    });
  });
});
