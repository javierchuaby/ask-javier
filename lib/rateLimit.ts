import { getDb } from './mongodb';

// Flag to track if indexes have been initialized
let indexesInitialized = false;

// Rate limit configurations for each model
export const RATE_LIMITS = {
  'gemini-2.5-flash-lite': {
    perMinute: 9,
    perDay: 19,
  },
  'gemini-3-flash': {
    perMinute: 4,
    perDay: 19,
  },
} as const;

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // seconds until next available slot
  reason?: 'perMinute' | 'perDay';
}

/**
 * Check if a request is allowed based on rate limits
 * @param model - The Gemini model name
 * @param limits - Rate limit configuration
 * @returns RateLimitResult indicating if request is allowed
 */
export async function checkRateLimit(
  model: string,
  limits: { perMinute: number; perDay: number }
): Promise<RateLimitResult> {
  const db = await getDb();
  const rateLimitsCollection = db.collection('rateLimits');

  // Lazy initialization of indexes (only once)
  if (!indexesInitialized) {
    try {
      await rateLimitsCollection.createIndex({ model: 1 }, { unique: true });
      indexesInitialized = true;
    } catch (error) {
      // Index might already exist, ignore error
      indexesInitialized = true;
    }
  }

  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayString = now.toISOString().split('T')[0]; // YYYY-MM-DD format

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
      returnDocument: 'after',
    }
  );

  let rateLimitDoc: any = result;
  if (!rateLimitDoc) {
    // If still null after upsert, fetch it
    rateLimitDoc = await rateLimitsCollection.findOne({ model });
    if (!rateLimitDoc) {
      // Create a default document structure
      rateLimitDoc = {
        model,
        requests: [],
        dailyCount: 0,
        lastResetDate: todayString,
      };
    }
  }

  // Ensure we have the required fields
  if (!rateLimitDoc.requests) rateLimitDoc.requests = [];
  if (typeof rateLimitDoc.dailyCount !== 'number') rateLimitDoc.dailyCount = 0;
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
      }
    );
    rateLimitDoc.dailyCount = 0;
    rateLimitDoc.lastResetDate = todayString;
  }

  // Clean up old requests (older than 1 minute) for per-minute tracking
  const recentRequests = (rateLimitDoc.requests || []).filter(
    (req: any) => {
      const reqTime = new Date(req.timestamp);
      return reqTime >= oneMinuteAgo;
    }
  );

  // Check per-minute limit
  if (recentRequests.length >= limits.perMinute) {
    // Calculate retry after time (seconds until oldest request expires)
    // Find the oldest request timestamp
    const oldestTime = Math.min(
      ...recentRequests.map((req: any) => new Date(req.timestamp).getTime())
    );
    const retryAfter = Math.ceil(
      (oldestTime + 60 * 1000 - now.getTime()) / 1000
    );

    return {
      allowed: false,
      retryAfter: Math.max(1, retryAfter),
      reason: 'perMinute',
    };
  }

  // Check per-day limit
  if (rateLimitDoc.dailyCount >= limits.perDay) {
    // Calculate retry after time (seconds until midnight)
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const retryAfter = Math.ceil((tomorrow.getTime() - now.getTime()) / 1000);

    return {
      allowed: false,
      retryAfter: Math.max(1, retryAfter),
      reason: 'perDay',
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
  const rateLimitsCollection = db.collection('rateLimits');

  const now = new Date();
  const todayString = now.toISOString().split('T')[0];

  // Update rate limit document
  await rateLimitsCollection.updateOne(
    { model },
    {
      $push: {
        requests: {
          timestamp: now,
        } as any,
      },
      $inc: {
        dailyCount: 1,
      },
      $set: {
        lastResetDate: todayString,
      },
    },
    { upsert: true }
  );

  // Clean up old requests periodically (keep only last 100 to avoid document bloat)
  const rateLimitDoc: any = await rateLimitsCollection.findOne({ model });
  if (rateLimitDoc && rateLimitDoc.requests && rateLimitDoc.requests.length > 100) {
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const recentRequests = rateLimitDoc.requests.filter(
      (req: any) => {
        const reqTime = new Date(req.timestamp);
        return reqTime >= oneMinuteAgo;
      }
    );

    await rateLimitsCollection.updateOne(
      { model },
      {
        $set: {
          requests: recentRequests,
        },
      }
    );
  }
}

/**
 * Initialize indexes for the rateLimits collection
 * This should be called once during app startup
 */
export async function initializeRateLimitIndexes(): Promise<void> {
  const db = await getDb();
  const rateLimitsCollection = db.collection('rateLimits');

  // Create index on model field for fast lookups
  await rateLimitsCollection.createIndex({ model: 1 }, { unique: true });
}
