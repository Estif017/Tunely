// Invidious — open-source YouTube frontend with a public API.
// No API key required. Tries multiple public instances in order.

const INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yt.artemislena.eu',
  'https://invidious.privacydev.net',
];

const TIMEOUT_MS = 6000;

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/** Search YouTube via Invidious and return the best-matching videoId. */
export async function searchVideoId(query: string): Promise<string | null> {
  for (const instance of INSTANCES) {
    try {
      const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&page=1`;
      const res = await fetch(url, { signal: withTimeout(TIMEOUT_MS) });
      if (!res.ok) continue;
      const data = await res.json();
      const videoId = data?.[0]?.videoId;
      if (videoId) return videoId;
    } catch {
      continue;
    }
  }
  return null;
}

/** Fetch the best audio-only stream URL for a YouTube video via Invidious. */
export async function getAudioStreamUrl(videoId: string): Promise<string | null> {
  for (const instance of INSTANCES) {
    try {
      const url = `${instance}/api/v1/videos/${videoId}?fields=adaptiveFormats`;
      const res = await fetch(url, { signal: withTimeout(TIMEOUT_MS) });
      if (!res.ok) continue;
      const data = await res.json();
      const formats: any[] = data.adaptiveFormats ?? [];
      // Prefer itag 140 (m4a 128kbps) → 251 (webm/opus) → any audio
      const best =
        formats.find(f => f.itag === 140) ??
        formats.find(f => f.itag === 251) ??
        formats.find(f => typeof f.type === 'string' && f.type.includes('audio'));
      if (best?.url) return best.url;
    } catch {
      continue;
    }
  }
  return null;
}

/** Convenience: search then immediately resolve the stream URL. */
export async function resolveTrackStream(artist: string, title: string): Promise<string | null> {
  const query = `${artist} ${title} official audio`;
  const videoId = await searchVideoId(query);
  if (!videoId) return null;
  return getAudioStreamUrl(videoId);
}
