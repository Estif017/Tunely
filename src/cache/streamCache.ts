/**
 * Brick 5 — Stream Cache
 *
 * Caches resolved audio stream URLs in AsyncStorage with a 6-hour TTL.
 * Stream URLs from Invidious expire after a few hours, so we don't keep
 * them longer than that.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const KEY_PREFIX = 'stream_v3:'; // bump version to invalidate old cached CDN URLs

interface CacheEntry {
  url: string;
  cachedAt: number;
}

/** Returns the cached URL if it exists and is less than 6 hours old. */
export async function getCachedStream(trackId: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + trackId);
    if (!raw) return null;

    const { url, cachedAt }: CacheEntry = JSON.parse(raw);
    if (Date.now() - cachedAt > TTL_MS) {
      // Expired — remove it so we don't accumulate stale entries
      await AsyncStorage.removeItem(KEY_PREFIX + trackId);
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/** Stores a stream URL with the current timestamp. */
export async function setCachedStream(trackId: string, url: string): Promise<void> {
  try {
    const entry: CacheEntry = { url, cachedAt: Date.now() };
    await AsyncStorage.setItem(KEY_PREFIX + trackId, JSON.stringify(entry));
  } catch (err) {
    console.warn('[streamCache] write failed:', err);
  }
}

/**
 * Scans all cached entries and removes any older than 6 hours.
 * Call once at app startup to keep storage clean.
 */
export async function clearExpiredCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const streamKeys = allKeys.filter((k) => k.startsWith(KEY_PREFIX));
    if (streamKeys.length === 0) return;

    const entries = await AsyncStorage.multiGet(streamKeys);
    const toRemove: string[] = [];

    for (const [key, raw] of entries) {
      if (!raw) {
        toRemove.push(key);
        continue;
      }
      try {
        const { cachedAt }: CacheEntry = JSON.parse(raw);
        if (Date.now() - cachedAt > TTL_MS) toRemove.push(key);
      } catch {
        toRemove.push(key); // corrupt entry — remove it
      }
    }

    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
      console.log(`[streamCache] cleared ${toRemove.length} expired entries`);
    }
  } catch (err) {
    console.warn('[streamCache] clearExpiredCache failed:', err);
  }
}
