import { env } from "./env";

export interface RawTelegramMessage {
  _?: string;
  id: number;
  date: string;
  message?: string;
  out?: boolean;
  [key: string]: unknown;
}

export interface CleanedMessage {
  id: number;
  date: Date;
  text: string;
  sender: "bot" | "user";
}

export interface ConversationChunk {
  chunkId: string;
  firstMessageId: number;
  lastMessageId: number;
  messageCount: number;
  startDate: Date;
  endDate: Date;
  messages: CleanedMessage[];
  dialogueText: string;
}

export const CHUNK_CONFIG = {
  SESSION_GAP_MS: 60 * 60 * 1000, // 1 hour inactivity gap
  MAX_CHUNK_SIZE: 20, // Max messages per chunk
  OVERLAP_SIZE: 3, // Overlap on split
};

/**
 * Redacts Personally Identifiable Information (PII) like phone numbers, emails, and names.
 */
export function redactPII(text: string): string {
  if (!text) return text;

  // 1. Redact Emails
  let scrubbed = text.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[EMAIL]",
  );

  // 2. Redact Phone Numbers (international and local variants)
  // Matches generic formats with at least 8 digits
  scrubbed = scrubbed.replace(
    /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}/g,
    (match) => {
      const digitCount = (match.match(/\d/g) || []).length;
      if (digitCount >= 8) {
        return "[PHONE]";
      }
      return match;
    },
  );

  // 3. Redact common variations of the real names
  const namesToRedact = env.REDACT_NAMES
    ? env.REDACT_NAMES.split(",")
        .map((n) => n.trim())
        .filter(Boolean)
    : ["user", "bot"];

  for (const name of namesToRedact) {
    const regex = new RegExp(`\\b${name}\\b`, "gi");
    scrubbed = scrubbed.replace(regex, "[NAME]");
  }

  return scrubbed;
}

/**
 * Parses, cleans, and deduplicates raw messages from Telegram export.
 */
export function processRawMessages(
  rawMessages: RawTelegramMessage[],
): CleanedMessage[] {
  const map = new Map<number, CleanedMessage>();

  for (const m of rawMessages) {
    if (m._ !== "Message") continue;

    let text = "";
    if (typeof m.message === "string" && m.message.trim().length > 0) {
      text = m.message.trim();
    } else if (m.media) {
      const mediaType = (m.media as { _?: string })._ || "";
      if (mediaType === "MessageMediaPhoto") text = "[Photo]";
      else if (mediaType === "MessageMediaDocument")
        text = "[Document/Video/Voice]";
      else if (mediaType === "MessageMediaContact") text = "[Contact]";
      else if (
        mediaType === "MessageMediaGeo" ||
        mediaType === "MessageMediaVenue"
      )
        text = "[Location]";
      else if (mediaType === "MessageMediaPoll") text = "[Poll]";
      else text = "[Media]";
    }

    if (text.length > 0) {
      map.set(m.id, {
        id: m.id,
        date: new Date(m.date),
        text: redactPII(text),
        sender: m.out ? "bot" : "user",
      });
    }
  }

  // Sort ascending chronologically
  return Array.from(map.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
}

/**
 * Groups messages into sessions based on inactivity gap (default 1 hour).
 */
export function groupIntoSessions(
  messages: CleanedMessage[],
  gapMs: number = CHUNK_CONFIG.SESSION_GAP_MS,
): CleanedMessage[][] {
  if (messages.length === 0) return [];

  const sessions: CleanedMessage[][] = [];
  let currentSession: CleanedMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (currentSession.length === 0) {
      currentSession.push(msg);
    } else {
      const prev = currentSession[currentSession.length - 1];
      const diffMs = msg.date.getTime() - prev.date.getTime();

      if (diffMs > gapMs) {
        sessions.push(currentSession);
        currentSession = [msg];
      } else {
        currentSession.push(msg);
      }
    }
  }

  if (currentSession.length > 0) {
    sessions.push(currentSession);
  }

  return sessions;
}

/**
 * Splits sessions into chunks of max 20 messages with a 3-message overlap.
 */
export function createChunksFromSessions(
  sessions: CleanedMessage[][],
  maxSize: number = CHUNK_CONFIG.MAX_CHUNK_SIZE,
  overlap: number = CHUNK_CONFIG.OVERLAP_SIZE,
): ConversationChunk[] {
  const chunks: ConversationChunk[] = [];
  const step = Math.max(1, maxSize - overlap);

  for (const session of sessions) {
    if (session.length <= maxSize) {
      chunks.push(buildChunk(session));
    } else {
      for (let i = 0; i < session.length; i += step) {
        const slice = session.slice(i, i + maxSize);
        chunks.push(buildChunk(slice));
        if (i + maxSize >= session.length) break;
      }
    }
  }

  return chunks;
}

/**
 * Builds a chunk object with metadata and formatted dialogue text.
 */
function buildChunk(messages: CleanedMessage[]): ConversationChunk {
  const first = messages[0];
  const last = messages[messages.length - 1];
  const chunkId = `chunk_${first.id}_${last.id}`;

  const dialogueText = messages
    .map((m) => {
      const displayName =
        m.sender === "bot"
          ? env.NEXT_PUBLIC_BOT_NAME || "Bot"
          : env.NEXT_PUBLIC_USER_NAME || "User";
      return `[${displayName}] ${m.text}`;
    })
    .join("\n");

  return {
    chunkId,
    firstMessageId: first.id,
    lastMessageId: last.id,
    messageCount: messages.length,
    startDate: first.date,
    endDate: last.date,
    messages,
    dialogueText,
  };
}

/**
 * Formats the final text for embedding (incorporating LLM summary + dialogue).
 */
export function formatChunkForEmbedding(
  summary: string,
  chunk: ConversationChunk,
): string {
  const startStr = chunk.startDate.toISOString().replace("T", " ").slice(0, 19);
  const endStr = chunk.endDate.toISOString().replace("T", " ").slice(0, 19);

  return `[Summary]: ${summary}
[Time]: ${startStr} to ${endStr}
[Dialogue]:
${chunk.dialogueText}`;
}
