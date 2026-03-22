export interface Track {
  id: string;              // Spotify track ID
  title: string;
  artist: string;
  album: string;
  albumArt: string;        // Spotify image URL
  durationMs: number;
  spotifyId: string;
  youtubeVideoId?: string; // resolved after YouTube matching
  streamUrl?: string;      // resolved after stream extraction
  cachedAt?: number;       // timestamp when stream URL was cached
  source: 'spotify' | 'youtube' | 'itunes' | 'deezer';
}

export default Track;
