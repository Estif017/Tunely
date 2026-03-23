/**
 * Brick 4 — Stream Extractor
 *
 * Takes a YouTube videoId and returns a direct, playable audio stream URL.
 * Delegates to Invidious (open-source YouTube frontend, no API key needed).
 * Tries multiple public instances in order — if one is down, the next is tried.
 */

const INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yt.artemislena.eu',
  'https://invidious.privacydev.net',
  'https://iv.datura.network',
];

const TIMEOUT_MS = 7000;

function makeSignal(ms: number): AbortSignal {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

/**
 * Returns the best audio-only stream URL for a YouTube video.
 *
 * Priority order:
 *   1. itag 140  — m4a  128 kbps  (widest device support)
 *   2. itag 251  — webm/opus 160 kbps
 *   3. any format whose MIME type contains "audio"
 */
export async function extractStreamUrl(videoId: string): Promise<string | null> {
  for (const instance of INSTANCES) {
    try {
      const url = `${instance}/api/v1/videos/${videoId}?fields=adaptiveFormats`;
      const res = await fetch(url, { signal: makeSignal(TIMEOUT_MS) });
      if (!res.ok) continue;

      const data = await res.json();
      const formats: any[] = data.adaptiveFormats ?? [];

      const best =
        formats.find((f) => f.itag === 140) ??
        formats.find((f) => f.itag === 251) ??
        formats.find((f) => typeof f.type === 'string' && f.type.includes('audio'));

      if (best?.url) {
        console.log(`[streamExtractor] resolved via ${instance}`);
        return best.url as string;
      }
    } catch {
      // instance timed out or had a network error — try the next one
      continue;
    }
  }

  console.warn('[streamExtractor] all instances failed for videoId:', videoId);
  return null;
}
