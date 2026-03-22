import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from '../config';
import { Track } from '../models';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const credentials = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error(`Spotify auth failed: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60_000; // refresh 1 min early
  return cachedToken!;
}

function mapToTrack(item: any): Track {
  return {
    id: item.id,
    spotifyId: item.id,
    title: item.name,
    artist: item.artists.map((a: any) => a.name).join(', '),
    album: item.album?.name ?? '',
    albumArt: item.album?.images?.[0]?.url ?? '',
    durationMs: item.duration_ms,
    source: 'spotify',
  };
}

export async function searchTracks(query: string, limit = 20): Promise<Track[]> {
  const token = await getAccessToken();
  const params = new URLSearchParams({ q: query, type: 'track', limit: String(limit) });
  const res = await fetch(`${API_BASE}/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Spotify search failed: ${res.status}`);
  }

  const data = await res.json();
  return data.tracks.items.map(mapToTrack);
}

export async function getNewReleases(limit = 20): Promise<Track[]> {
  const token = await getAccessToken();
  // Step 1: get album IDs from new-releases
  const listRes = await fetch(`${API_BASE}/browse/new-releases?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) throw new Error(`Spotify new releases failed: ${listRes.status}`);
  const listData = await listRes.json();
  const ids = listData.albums.items.map((a: any) => a.id).join(',');

  // Step 2: batch fetch full albums (includes tracks.items) — 2 requests total instead of N+1
  const batchRes = await fetch(`${API_BASE}/albums?ids=${ids}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!batchRes.ok) throw new Error(`Spotify albums batch failed: ${batchRes.status}`);
  const batchData = await batchRes.json();

  return batchData.albums
    .map((album: any) => {
      const track = album?.tracks?.items?.[0];
      if (!track) return null;
      return mapToTrack({ ...track, album });
    })
    .filter(Boolean) as Track[];
}

export async function getFeaturedTracks(limit = 10): Promise<Track[]> {
  return searchTracks(`top hits ${new Date().getFullYear()}`, limit);
}
