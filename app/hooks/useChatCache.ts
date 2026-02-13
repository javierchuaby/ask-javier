import { useRef, useCallback } from "react";

interface ChatMessage {
  role: "aiden" | "javier";
  content: string;
}

interface CacheEntry {
  messages: ChatMessage[];
  timestamp: number;
}

const MAX_CACHE_SIZE = 5;

export function useChatCache() {
  // Use ref to persist cache across renders without causing re-renders
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  /**
   * Get cached messages for a chat ID
   * Updates access time by moving entry to end (LRU)
   */
  const get = useCallback((chatId: string): ChatMessage[] | null => {
    const cache = cacheRef.current;
    const entry = cache.get(chatId);

    if (entry) {
      // Move to end to mark as most recently used
      cache.delete(chatId);
      cache.set(chatId, {
        ...entry,
        timestamp: Date.now(),
      });
      return entry.messages;
    }

    return null;
  }, []);

  /**
   * Store messages in cache
   * Evicts LRU entry if cache size exceeds MAX_CACHE_SIZE
   */
  const set = useCallback((chatId: string, messages: ChatMessage[]): void => {
    const cache = cacheRef.current;

    // Remove existing entry if present (will re-add at end)
    if (cache.has(chatId)) {
      cache.delete(chatId);
    }

    // Evict LRU entry if cache is full
    if (cache.size >= MAX_CACHE_SIZE) {
      // First entry is least recently used
      const firstKey = cache.keys().next().value;
      if (firstKey) {
        cache.delete(firstKey);
      }
    }

    // Add new entry at end (most recently used)
    cache.set(chatId, {
      messages,
      timestamp: Date.now(),
    });
  }, []);

  /**
   * Invalidate cache entry for a specific chat
   */
  const invalidate = useCallback((chatId: string): void => {
    cacheRef.current.delete(chatId);
  }, []);

  /**
   * Clear entire cache
   */
  const clear = useCallback((): void => {
    cacheRef.current.clear();
  }, []);

  return {
    get,
    set,
    invalidate,
    clear,
  };
}
