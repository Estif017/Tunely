/**
 * Stream Extractor — resolves a YouTube videoId to a playable audio URL.
 *
 * Strategy:
 *   Return http://localhost:3002/stream/<videoId>
 *
 *   The backend downloads the audio via yt-dlp, caches it locally, and
 *   serves it with proper Content-Length + Range support so the browser
 *   <audio> element can seek.
 *
 *   Because the URL is always localhost the browser never hits a
 *   cross-origin restriction — no CORS issues at all.
 *
 * The backend lives in /backend/index.js — start it with:
 *   cd backend && node index.js
 *
 * The URL is configured in src/config.ts:
 *   STREAM_BACKEND_URL = 'http://localhost:3002'          (dev / Expo web)
 *   STREAM_BACKEND_URL = 'http://192.168.x.x:3002'       (Expo Go on phone)
 *   STREAM_BACKEND_URL = 'https://your-app.railway.app'  (production)
 */

import { STREAM_BACKEND_URL } from '../config';

/**
 * Returns a direct streaming URL for the given YouTube videoId.
 *
 * The URL points to the local backend's /stream/:videoId endpoint which
 * handles yt-dlp extraction and serves the audio as a seekable file.
 *
 * Returns null if STREAM_BACKEND_URL is not configured.
 */
export function extractStreamUrl(videoId: string): string | null {
  if (!STREAM_BACKEND_URL) {
    console.warn('[streamExtractor] STREAM_BACKEND_URL not set in config');
    return null;
  }
  const url = `${STREAM_BACKEND_URL}/stream/${videoId}`;
  console.log(`[streamExtractor] stream URL → ${url}`);
  return url;
}
