import { getDb } from "./mongodb";
import { AI_MODELS } from "./constants";

// Flag to track if indexes have been initialized
let indexesInitialized = false;

// Rate limit configurations for each model
export const RATE_LIMITS = {
  [AI_MODELS.CHAT]: {
    perMinute: 9,
    perDay: 19,
  },
  [AI_MODELS.TITLE]: {
    perMinute: 4,
    perDay: 19,
  },
} as const;

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // seconds until next available slot
  reason?: "perMinute" | "perDay";
}

interface RateLimitRequest {
  timestamp: Date | string;
}

interface RateLimitDocument {
  model: string;
  requests: RateLimitRequest[];
  dailyCount: number;
  lastResetDate: string;
}

/**
 * Check if a request is allowed based on rate limits
 * @param model - The Gemini model name
 * @param limits - Rate limit configuration
 * @returns RateLimitResult indicating if request is allowed
 */
export async function checkRateLimit(
  model: string,
  limits: { perMinute: number; perDay: number },
): Promise<RateLimitResult> {
  const db = await getDb();
  const rateLimitsCollection = db.collection("rateLimits");

  // Lazy initialization of indexes (only once)
  if (!indexesInitialized) {
    try {
      await rateLimitsCollection.createIndex({ model: 1 }, { unique: true });
      indexesInitialized = true;
    } catch {
      // Index might already exist, ignore error
      indexesInitialized = true;
    }
  }

  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

  // Use Pacific Time (UTC-8) for daily resets to match Google AI Studio
  const pacificFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = pacificFormatter.formatToParts(now);
  const year = parseInt(parts.find((p) => p.type === "year")!.value);
  const month = parseInt(parts.find((p) => p.type === "month")!.value) - 1;
  const day = parseInt(parts.find((p) => p.type === "day")!.value);
  const todayString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Use findOneAndUpdate with atomic operations to prevent race conditions
  const result = await rateLimitsCollection.findOneAndUpdate(
    { model },
    {
      $setOnInsert: {
        model,
        requests: [],
        dailyCount: 0,
        lastResetDate: todayString,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    },
  );

  let rateLimitDoc = result as RateLimitDocument | null;
  if (!rateLimitDoc) {
    // If still null after upsert, fetch it
    const fetchedDoc = await rateLimitsCollection.findOne({ model });
    if (!fetchedDoc) {
      // Create a default document structure
      rateLimitDoc = {
        model,
        requests: [],
        dailyCount: 0,
        lastResetDate: todayString,
      };
    } else {
      rateLimitDoc = fetchedDoc as unknown as RateLimitDocument;
    }
  }

  // Ensure we have the required fields
  if (!rateLimitDoc.requests) rateLimitDoc.requests = [];
  if (typeof rateLimitDoc.dailyCount !== "number") rateLimitDoc.dailyCount = 0;
  if (!rateLimitDoc.lastResetDate) rateLimitDoc.lastResetDate = todayString;

  // Reset daily count if it's a new day (atomic update)
  if (rateLimitDoc.lastResetDate !== todayString) {
    await rateLimitsCollection.updateOne(
      { model, lastResetDate: { $ne: todayString } },
      {
        $set: {
          dailyCount: 0,
          lastResetDate: todayString,
        },
      },
    );
    rateLimitDoc.dailyCount = 0;
    rateLimitDoc.lastResetDate = todayString;
  }

  // Clean up old requests (older than 1 minute) for per-minute tracking
  const recentRequests = (rateLimitDoc.requests || []).filter(
    (req: RateLimitRequest) => {
      const reqTime = new Date(req.timestamp);
      return reqTime >= oneMinuteAgo;
    },
  );

  // Check per-minute limit
  if (recentRequests.length >= limits.perMinute) {
    // Calculate retry after time (seconds until oldest request expires)
    // Find the oldest request timestamp
    const oldestTime = Math.min(
      ...recentRequests.map((req: RateLimitRequest) =>
        new Date(req.timestamp).getTime(),
      ),
    );
    const retryAfter = Math.ceil(
      (oldestTime + 60 * 1000 - now.getTime()) / 1000,
    );

    return {
      allowed: false,
      retryAfter: Math.max(1, retryAfter),
      reason: "perMinute",
    };
  }

  // Check per-day limit
  if (rateLimitDoc.dailyCount >= limits.perDay) {
    // Calculate retry after time (seconds until midnight Pacific Time)
    // Get current time components in Pacific timezone
    const pacificTimeFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const pacificParts = pacificTimeFormatter.formatToParts(now);
    const pacificHour = parseInt(
      pacificParts.find((p) => p.type === "hour")!.value,
    );
    const pacificMinute = parseInt(
      pacificParts.find((p) => p.type === "minute")!.value,
    );
    const pacificSecond = parseInt(
      pacificParts.find((p) => p.type === "second")!.value,
    );

    // Calculate seconds until next midnight Pacific Time
    const secondsUntilMidnight =
      24 * 60 * 60 -
      (pacificHour * 60 * 60 + pacificMinute * 60 + pacificSecond);
    const retryAfter = Math.ceil(secondsUntilMidnight);

    return {
      allowed: false,
      retryAfter: Math.max(1, retryAfter),
      reason: "perDay",
    };
  }

  return { allowed: true };
}

/**
 * Record a new request in the rate limit tracking
 * @param model - The Gemini model name
 */
export async function recordRequest(model: string): Promise<void> {
  const db = await getDb();
  const rateLimitsCollection = db.collection("rateLimits");

  const now = new Date();
  // Use Pacific Time (UTC-8) for daily resets to match Google AI Studio
  const pacificFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = pacificFormatter.formatToParts(now);
  const year = parseInt(parts.find((p) => p.type === "year")!.value);
  const month = parseInt(parts.find((p) => p.type === "month")!.value) - 1;
  const day = parseInt(parts.find((p) => p.type === "day")!.value);
  const todayString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Update rate limit document
  const newRequest: RateLimitRequest = { timestamp: now };
  await rateLimitsCollection.updateOne(
    { model },
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $push: { requests: newRequest } as any,
      $inc: {
        dailyCount: 1,
      },
      $set: {
        lastResetDate: todayString,
      },
    },
    { upsert: true },
  );

  // Clean up old requests periodically (keep only last 100 to avoid document bloat)
  const rateLimitDoc = (await rateLimitsCollection.findOne({
    model,
  })) as RateLimitDocument | null;
  if (
    rateLimitDoc &&
    rateLimitDoc.requests &&
    rateLimitDoc.requests.length > 100
  ) {
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const recentRequests = rateLimitDoc.requests.filter(
      (req: RateLimitRequest) => {
        const reqTime = new Date(req.timestamp);
        return reqTime >= oneMinuteAgo;
      },
    );

    await rateLimitsCollection.updateOne(
      { model },
      {
        $set: {
          requests: recentRequests,
        },
      },
    );
  }
}

/**
 * Initialize indexes for the rateLimits collection
 * This should be called once during app startup
 */
export async function initializeRateLimitIndexes(): Promise<void> {
  const db = await getDb();
  const rateLimitsCollection = db.collection("rateLimits");

  // Create index on model field for fast lookups
  await rateLimitsCollection.createIndex({ model: 1 }, { unique: true });
}
