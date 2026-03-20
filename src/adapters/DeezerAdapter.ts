import { Track } from '../models';

const API = 'https://api.deezer.com';

function mapToTrack(item: any): Track {
  return {
    id: `deezer:${item.id}`,
    title: item.title_short ?? item.title ?? 'Unknown',
    artist: item.artist?.name ?? '',
    album: item.album?.title,
    duration: item.duration ?? 0,
    thumbnailUrl: item.album?.cover_medium ?? item.album?.cover ?? '',
    streamUrl: item.preview, // 30-second preview MP3
    source: 'deezer',
    iscached: false,
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

export async function getNewReleaseTracks(limit = 8): Promise<Track[]> {
  const res = await fetch(`${API}/chart/0/albums?limit=${limit}`);
  if (!res.ok) throw new Error(`Albums failed: ${res.status}`);
  const albums: any[] = (await res.json()).data ?? [];
  const results = await Promise.all(
    albums.slice(0, limit).map(async (album) => {
      try {
        const r = await fetch(`${API}/album/${album.id}/tracks?limit=1`);
        const d = await r.json();
        const t = d.data?.[0];
        if (!t) return null;
        return mapToTrack({ ...t, album: { title: album.title, cover_medium: album.cover_medium } });
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean) as Track[];
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
