import { Track } from '../models';
import { STREAM_BACKEND_URL } from '../config';

function mapToTrack(item: any): Track | null {
  if (!item.trackId || !item.previewUrl) return null;
  return {
    id: `itunes:${item.trackId}`,
    title: item.trackName ?? 'Unknown',
    artist: item.artistName ?? '',
    album: item.collectionName ?? '',
    albumArt: item.artworkUrl100?.replace('100x100bb', '300x300bb') ?? '',
    durationMs: item.trackTimeMillis ?? 0,
    spotifyId: '',
    streamUrl: item.previewUrl,
    source: 'itunes',
  };
}

export async function searchTracks(query: string, limit = 20): Promise<Track[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await fetch(`${STREAM_BACKEND_URL}/search?${params}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const data = await res.json();
  return data.results.map(mapToTrack).filter(Boolean) as Track[];
}

export async function getTrending(limit = 10): Promise<Track[]> {
  return searchTracks('top hits', limit);
}

export async function getNewReleases(limit = 10): Promise<Track[]> {
  return searchTracks('new music 2025', limit);
}
