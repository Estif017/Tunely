/**
 * Stream Extractor — resolves a YouTube videoId to a direct audio URL.
 *
 * WHY A BACKEND?
 * All public Invidious instances have disabled their API endpoints (403).
 * Piped and Cobalt are also blocked by Cloudflare. The only reliable solution
 * is a small backend that uses yt-dlp to extract the stream URL.
 *
 * The backend lives in /backend/index.js — start it with:
 *   cd backend && node index.js
 *
 * The URL is configured in src/config.ts:
 *   STREAM_BACKEND_URL = 'http://localhost:3002'   (dev / Expo web)
 *   STREAM_BACKEND_URL = 'http://192.168.x.x:3002' (Expo Go on phone)
 *   STREAM_BACKEND_URL = 'https://your-app.railway.app' (production)
 */

import { STREAM_BACKEND_URL } from '../config';

const TIMEOUT_MS = 30_000; // yt-dlp can take a few seconds

function makeSignal(ms: number): AbortSignal {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

interface BackendResponse {
  url: string;
  ext?: string;
  abr?: number;
  title?: string;
}

/**
 * Calls the local stream backend to get a playable audio/video URL
 * for the given YouTube videoId.
 *
 * Returns null if the backend is unreachable or extraction fails.
 */
export async function extractStreamUrl(videoId: string): Promise<string | null> {
  if (!STREAM_BACKEND_URL) {
    console.warn('[streamExtractor] STREAM_BACKEND_URL not set in config');
    return null;
  }

  const endpoint = `${STREAM_BACKEND_URL}/audio/${videoId}`;

  try {
    const res = await fetch(endpoint, {
      signal: makeSignal(TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[streamExtractor] backend returned ${res.status}:`, body.substring(0, 200));
      return null;
    }

    const data: BackendResponse = await res.json();

    if (!data.url) {
      console.warn('[streamExtractor] backend returned no URL for', videoId);
      return null;
    }

    console.log(
      `[streamExtractor] ✅ resolved ${videoId}`,
      data.ext ? `(${data.ext} ${data.abr ?? '?'}kbps)` : '',
    );
    return data.url;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.error('[streamExtractor] backend timed out after', TIMEOUT_MS, 'ms');
    } else {
      console.error('[streamExtractor] fetch error:', err?.message ?? err);
    }
    return null;
  }
}
