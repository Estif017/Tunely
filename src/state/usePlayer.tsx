/**
 * Brick 7 — usePlayer hook + PlayerProvider context
 *
 * Manages the full playback lifecycle:
 *   - Queue with add / next / previous
 *   - Shuffle (randomised next) and Repeat (none / one / all)
 *   - Stream resolution via playbackResolver
 *   - expo-audio under the hood
 *   - Auto-advances to the next track when one finishes
 *
 * Usage:
 *   Wrap your root component with <PlayerProvider>.
 *   Call usePlayer() anywhere inside to get state + actions.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { Track } from '../models';
import { resolveTrackStream } from '../services/playbackResolver';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type RepeatMode = 'none' | 'one' | 'all';

export interface PlayerContextType {
  // State
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  positionSecs: number;
  durationSecs: number;
  shuffle: boolean;
  repeat: RepeatMode;

  // Actions
  playTrack: (track: Track, newQueue?: Track[]) => void;
  pause: () => void;
  resume: () => void;
  togglePlayPause: () => void;
  seek: (secs: number) => void;
  next: () => void;
  previous: () => void;
  addToQueue: (track: Track) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const PlayerContext = createContext<PlayerContextType | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('none');

  // Keep refs so effects can read latest values without stale closures
  const queueRef = useRef<Track[]>([]);
  const queueIndexRef = useRef(-1);
  const repeatRef = useRef<RepeatMode>('none');
  const shuffleRef = useRef(false);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);

  // ── expo-audio ──────────────────────────────────────────────────────────────
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  // Configure audio session once (background playback + silent mode on iOS)
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    }).catch(console.warn);
  }, []);

  // ── Core: load and play a track ─────────────────────────────────────────────
  const loadAndPlay = useCallback(
    async (track: Track) => {
      setIsLoading(true);
      try {
        const url = await resolveTrackStream(track);
        if (url) {
          player.replace({ uri: url });
        } else {
          console.warn('[usePlayer] no stream URL for', track.title);
        }
      } catch (err) {
        console.error('[usePlayer] loadAndPlay error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [player],
  );

  // ── Auto-advance when track ends ────────────────────────────────────────────
  useEffect(() => {
    if (!status.didJustFinish) return;

    const q = queueRef.current;
    const idx = queueIndexRef.current;
    const rep = repeatRef.current;
    const shuf = shuffleRef.current;

    if (rep === 'one') {
      // Replay same track
      player.seekTo(0);
      player.play();
      return;
    }

    // Find the next index
    let nextIdx: number;
    if (shuf) {
      nextIdx = Math.floor(Math.random() * q.length);
    } else {
      nextIdx = idx + 1;
    }

    if (nextIdx >= q.length) {
      if (rep === 'all') nextIdx = 0;
      else return; // end of queue, stop
    }

    const nextTrack = q[nextIdx];
    if (!nextTrack) return;

    setQueueIndex(nextIdx);
    loadAndPlay(nextTrack);
  }, [status.didJustFinish, player, loadAndPlay]);

  // ── Public actions ──────────────────────────────────────────────────────────

  const playTrack = useCallback(
    (track: Track, newQueue?: Track[]) => {
      if (newQueue && newQueue.length > 0) {
        setQueue(newQueue);
        const idx = newQueue.findIndex((t) => t.id === track.id);
        setQueueIndex(idx >= 0 ? idx : 0);
      } else {
        setQueue((prev) => {
          const existing = prev.findIndex((t) => t.id === track.id);
          if (existing >= 0) {
            setQueueIndex(existing);
            return prev;
          }
          setQueueIndex(prev.length);
          return [...prev, track];
        });
      }
      loadAndPlay(track);
    },
    [loadAndPlay],
  );

  const pause = useCallback(() => player.pause(), [player]);
  const resume = useCallback(() => player.play(), [player]);
  const togglePlayPause = useCallback(() => {
    if (player.playing) player.pause();
    else player.play();
  }, [player]);

  const seek = useCallback((secs: number) => player.seekTo(secs), [player]);

  const next = useCallback(() => {
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    if (q.length === 0) return;

    let nextIdx = shuffleRef.current
      ? Math.floor(Math.random() * q.length)
      : idx + 1;

    if (nextIdx >= q.length) {
      if (repeatRef.current === 'all') nextIdx = 0;
      else return;
    }

    const track = q[nextIdx];
    setQueueIndex(nextIdx);
    loadAndPlay(track);
  }, [loadAndPlay]);

  const previous = useCallback(() => {
    const q = queueRef.current;
    const idx = queueIndexRef.current;

    // If more than 3 seconds in, restart the current track
    if ((status.currentTime ?? 0) > 3) {
      player.seekTo(0);
      return;
    }

    const prevIdx = Math.max(0, idx - 1);
    const track = q[prevIdx];
    if (!track) return;
    setQueueIndex(prevIdx);
    loadAndPlay(track);
  }, [status.currentTime, player, loadAndPlay]);

  const addToQueue = useCallback((track: Track) => {
    setQueue((prev) => {
      if (prev.find((t) => t.id === track.id)) return prev;
      return [...prev, track];
    });
  }, []);

  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);

  const toggleRepeat = useCallback(() => {
    setRepeat((r) => (r === 'none' ? 'one' : r === 'one' ? 'all' : 'none'));
  }, []);

  // ── Derived state ───────────────────────────────────────────────────────────
  const currentTrack =
    queueIndex >= 0 && queueIndex < queue.length ? queue[queueIndex] : null;

  const value: PlayerContextType = {
    currentTrack,
    queue,
    queueIndex,
    isPlaying: status.isLoaded ? (status.playing ?? false) : false,
    isLoading,
    positionSecs: status.currentTime ?? 0,
    durationSecs: status.duration ?? 0,
    shuffle,
    repeat,
    playTrack,
    pause,
    resume,
    togglePlayPause,
    seek,
    next,
    previous,
    addToQueue,
    toggleShuffle,
    toggleRepeat,
  };

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function usePlayer(): PlayerContextType {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return ctx;
}
