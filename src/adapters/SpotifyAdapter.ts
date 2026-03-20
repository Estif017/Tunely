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
    id: `spotify:${item.id}`,
    title: item.name,
    artist: item.artists.map((a: any) => a.name).join(', '),
    album: item.album?.name,
    duration: Math.round(item.duration_ms / 1000),
    thumbnailUrl: item.album?.images?.[0]?.url ?? '',
    source: 'spotify',
    iscached: false,
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
  const params = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`${API_BASE}/browse/new-releases?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Spotify new releases failed: ${res.status}`);
  }

  const data = await res.json();

  // New releases returns albums — fetch the first track from each
  const trackPromises = data.albums.items.map(async (album: any) => {
    const tracksRes = await fetch(`${API_BASE}/albums/${album.id}/tracks?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const tracksData = await tracksRes.json();
    const track = tracksData.items?.[0];
    if (!track) return null;
    return mapToTrack({
      ...track,
      album,
      duration_ms: track.duration_ms,
    });
  });

  const tracks = await Promise.all(trackPromises);
  return tracks.filter(Boolean) as Track[];
}

export async function getFeaturedTracks(limit = 10): Promise<Track[]> {
  return searchTracks('top hits 2024', limit);
}
