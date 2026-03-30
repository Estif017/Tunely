/**
 * Brick 6 — Playback Resolver
 *
 * The single function the player calls to get a streamable audio URL.
 *
 * Flow:
 *   1. Check AsyncStorage cache (6-hour TTL)         — instant if hit
 *   2. Match track → YouTube videoId                 — YouTube Data API v3
 *   3. Extract audio stream URL                      — backend (/audio+proxy on web, /stream on native)
 *   4. Write result to cache
 *   5. Fall back to iTunes 30-second preview if anything fails
 *
 * This function NEVER throws — it always returns a string or null.
 */

import { Track } from '../models';
import { matchTrackToYouTube } from '../adapters/youtube';
import { extractStreamUrl } from '../adapters/streamExtractor';
import { getCachedStream, setCachedStream } from '../cache/streamCache';

export async function resolveTrackStream(track: Track): Promise<string | null> {
  try {
    // ── Step 1: cache hit? ────────────────────────────────────────────────────
    const cached = await getCachedStream(track.id);
    if (cached) {
      console.log('[resolver] 🟢 cache hit →', track.title);
      return cached;
    }

    // ── Step 2: find YouTube video ────────────────────────────────────────────
    const videoId = await matchTrackToYouTube(track);
    if (!videoId) {
      console.warn('[resolver] 🟡 no YouTube match — falling back to preview');
      return track.streamUrl ?? null;
    }

    // ── Step 3: build stream URL (async — web uses /audio+proxy, native /stream) ──
    const streamUrl = await extractStreamUrl(videoId);
    if (!streamUrl) {
      console.warn('[resolver] 🟡 stream extraction failed — falling back to preview');
      return track.streamUrl ?? null;
    }

    // ── Step 4: cache and return ──────────────────────────────────────────────
    await setCachedStream(track.id, streamUrl);
    console.log('[resolver] 🎵 resolved:', track.title, '→', videoId);
    return streamUrl;
  } catch (err) {
    console.error('[resolver] 🔴 unexpected error:', err);
    return track.streamUrl ?? null;
  }
}
