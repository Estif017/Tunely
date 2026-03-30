/**
 * Stream Extractor — resolves a YouTube videoId to a playable audio URL.
 *
 * Strategy differs by platform:
 *
 *   Web browser
 *   ───────────
 *   1. Call GET /audio/:videoId  — backend runs yt-dlp to extract the CDN URL
 *      (fast: just a URL extraction, no file download)
 *   2. Return /proxy?url=<encoded CDN URL>  — backend pipes the CDN stream
 *      through itself so CORS is never an issue and the browser starts
 *      receiving audio bytes immediately.
 *
 *   Native (iOS / Android)
 *   ──────────────────────
 *   Return /stream/:videoId — backend downloads with yt-dlp, caches the file,
 *   serves it with Range support for seeking.
 */

import { Platform } from 'react-native';
import { STREAM_BACKEND_URL } from '../config';

export async function extractStreamUrl(videoId: string): Promise<string | null> {
  if (!STREAM_BACKEND_URL) {
    console.warn('[streamExtractor] STREAM_BACKEND_URL not set in config');
    return null;
  }

  if (Platform.OS === 'web') {
    // On web: get the direct CDN URL via /audio/ then wrap in /proxy
    // This avoids the "download entire file then respond" latency of /stream/
    try {
      const res = await fetch(`${STREAM_BACKEND_URL}/audio/${videoId}`);
      if (!res.ok) {
        console.warn(`[streamExtractor] /audio/ returned ${res.status}`);
        return null;
      }
      const { url } = await res.json();
      if (!url) return null;
      const proxyUrl = `${STREAM_BACKEND_URL}/proxy?url=${encodeURIComponent(url)}`;
      console.log(`[streamExtractor] web proxy URL → ${proxyUrl.slice(0, 80)}…`);
      return proxyUrl;
    } catch (err) {
      console.warn('[streamExtractor] /audio/ fetch failed:', err);
      return null;
    }
  }

  // Native: /stream/ downloads and caches the file, serves with Range support
  const url = `${STREAM_BACKEND_URL}/stream/${videoId}`;
  console.log(`[streamExtractor] stream URL → ${url}`);
  return url;
}
