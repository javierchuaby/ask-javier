/**
 * Format seconds into a human-readable string (e.g. "1 hr 2 mins 5 secs")
 */
export function formatRetryTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return "Ready to try again.";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hr${hours !== 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} min${minutes !== 1 ? "s" : ""}`);
  if (seconds > 0 || parts.length === 0)
    parts.push(`${seconds} sec${seconds !== 1 ? "s" : ""}`);

  return parts.join(" ");
}

export function isValentinePeriod(): boolean {
  const now = new Date(); // Current timestamp (UTC-based)

  // Start: Jan 28, 2026 00:00:00 GMT+8
  // ISO string with timezone offset ensures it's interpreted correctly regardless of local system time
  const start = new Date("2026-01-28T00:00:00+08:00");

  // End: Feb 15, 2026 00:00:00 GMT+8 (Midnight after Feb 14)
  const end = new Date("2026-02-15T00:00:00+08:00");

  return now >= start && now < end;
}

export function getTimeUntilValentineEnd(): {
  days: number;
  hours: number;
} | null {
  if (!isValentinePeriod()) return null;

  const now = new Date();

  // Target: Feb 14, 2026 00:00:00 GMT+8 (Start of Valentine's Day)
  const target = new Date("2026-02-14T00:00:00+08:00");

  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return null;

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return { days, hours };
}
