import { Playlist } from './Playlist';

export interface User {
  id: string;
  displayName: string;
  avatarUrl?: string;
  playlists: Playlist[];
  likedTrackIds: string[];
}
