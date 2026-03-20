import { Track } from './Track';

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  tracks: Track[];
  createdAt: number;      // unix timestamp
  updatedAt: number;
}
