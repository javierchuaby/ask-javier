import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatRetryTime,
  isValentinePeriod,
  getTimeUntilValentineEnd,
} from "./dateUtils";

describe("dateUtils", () => {
  describe("formatRetryTime", () => {
    it("formats seconds as hrs, mins, secs", () => {
      expect(formatRetryTime(3661)).toBe("1 hr 1 min 1 sec");
      expect(formatRetryTime(125)).toBe("2 mins 5 secs");
      expect(formatRetryTime(45)).toBe("45 secs");
      expect(formatRetryTime(1)).toBe("1 sec");
    });

    it("returns Ready to try again when <= 0", () => {
      expect(formatRetryTime(0)).toBe("Ready to try again.");
      expect(formatRetryTime(-1)).toBe("Ready to try again.");
    });
  });

  describe("isValentinePeriod", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns true when date is within Valentine period (Jan 28 - Feb 15 GMT+8)", () => {
      // Feb 14, 2026 12:00 GMT+8
      vi.setSystemTime(new Date("2026-02-14T04:00:00.000Z"));
      expect(isValentinePeriod()).toBe(true);
    });

    it("returns true on first day of Valentine period", () => {
      // Jan 28, 2026 00:00 GMT+8 = Jan 27, 2026 16:00 UTC
      vi.setSystemTime(new Date("2026-01-27T16:00:00.000Z"));
      expect(isValentinePeriod()).toBe(true);
    });

    it("returns false before Valentine period starts", () => {
      // Jan 27, 2026 23:59 GMT+8
      vi.setSystemTime(new Date("2026-01-27T15:59:00.000Z"));
      expect(isValentinePeriod()).toBe(false);
    });

    it("returns false after Valentine period ends", () => {
      // Feb 15, 2026 00:00 GMT+8 (first moment after period)
      vi.setSystemTime(new Date("2026-02-14T16:00:00.000Z"));
      expect(isValentinePeriod()).toBe(false);
    });
  });

  describe("getTimeUntilValentineEnd", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns null when not in Valentine period", () => {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      expect(getTimeUntilValentineEnd()).toBeNull();
    });

    it("returns null when past Valentine's Day target (Feb 14 start)", () => {
      // Feb 14, 2026 12:00 GMT+8 - already past the "target" (midnight Feb 14)
      vi.setSystemTime(new Date("2026-02-14T04:00:00.000Z"));
      // Target is Feb 14 00:00 GMT+8, we're past it so diffMs <= 0
      expect(getTimeUntilValentineEnd()).toBeNull();
    });

    it("returns days and hours when before Valentine's Day target", () => {
      // Jan 28, 2026 00:00 GMT+8 - 17 days before Feb 14 00:00 GMT+8
      vi.setSystemTime(new Date("2026-01-27T16:00:00.000Z"));
      const result = getTimeUntilValentineEnd();
      expect(result).not.toBeNull();
      expect(result!.days).toBe(17);
      expect(typeof result!.hours).toBe("number");
    });
  });
});
