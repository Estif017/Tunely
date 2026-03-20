import { Track } from '../models';

const API = 'https://itunes.apple.com';

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
    source: 'youtube', // using youtube slot for non-spotify sources
  };
}

export async function searchTracks(query: string, limit = 20): Promise<Track[]> {
  const params = new URLSearchParams({ term: query, media: 'music', entity: 'song', limit: String(limit) });
  const res = await fetch(`${API}/search?${params}`);
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
