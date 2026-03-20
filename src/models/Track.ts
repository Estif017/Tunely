export type TrackSource = 'youtube' | 'spotify' | 'deezer' | 'itunes';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;       // seconds
  thumbnailUrl: string;
  streamUrl?: string;     // populated when ready to play
  source: TrackSource;
  iscached: boolean;
  cachedPath?: string;    // local file path if cached
}
