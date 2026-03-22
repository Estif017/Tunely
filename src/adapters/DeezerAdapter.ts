import { Track } from '../models';

const API = 'https://api.deezer.com';

function mapToTrack(item: any): Track {
  return {
    id: `deezer:${item.id}`,
    title: item.title_short ?? item.title ?? 'Unknown',
    artist: item.artist?.name ?? '',
    album: item.album?.title ?? '',
    albumArt: item.album?.cover_medium ?? item.album?.cover ?? '',
    durationMs: (item.duration ?? 0) * 1000,
    spotifyId: '',
    streamUrl: item.preview,
    source: 'deezer',
  };
}

export async function searchTracks(query: string, limit = 20): Promise<Track[]> {
  const res = await fetch(`${API}/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const data = await res.json();
  return (data.data ?? []).map(mapToTrack);
}

export async function getTrending(limit = 10): Promise<Track[]> {
  const res = await fetch(`${API}/chart/0/tracks?limit=${limit}`);
  if (!res.ok) throw new Error(`Chart failed: ${res.status}`);
  const data = await res.json();
  return (data.data ?? []).map(mapToTrack);
}

// Deezer free API has no true new-releases endpoint; chart/0/tracks is the best proxy.
export async function getNewReleases(limit = 8): Promise<Track[]> {
  const res = await fetch(`${API}/chart/0/tracks?limit=${limit}`);
  if (!res.ok) throw new Error(`New releases failed: ${res.status}`);
  const data = await res.json();
  return (data.data ?? []).map(mapToTrack);
}

export async function getPlaylistByUrl(url: string): Promise<{ name: string; tracks: Track[] }> {
  const match = url.match(/deezer\.com(?:\/[a-z]{2})?\/playlist\/(\d+)/i);
  if (!match) {
    throw new Error('Please paste a valid Deezer playlist URL\ne.g. https://www.deezer.com/playlist/1234567890');
  }
  const res = await fetch(`${API}/playlist/${match[1]}`);
  if (!res.ok) throw new Error(`Could not load playlist (${res.status})`);
  const data = await res.json();
  return {
    name: data.title,
    tracks: (data.tracks?.data ?? []).map(mapToTrack),
  };
}
