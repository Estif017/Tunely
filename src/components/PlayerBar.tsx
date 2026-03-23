/**
 * Brick 8 — PlayerBar
 *
 * A persistent bottom bar shown whenever a track is loaded.
 * Sits just above the tab bar.
 *
 * Features:
 *   • Album art thumbnail (40×40, rounded corners)
 *   • Track title + artist (truncated to one line each)
 *   • Previous / Play-Pause / Next buttons
 *   • Shuffle and Repeat toggle buttons
 *   • Thin seekable progress bar along the very top of the bar
 *   • Loading spinner in place of the play button while resolving the stream
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  GestureResponderEvent,
} from 'react-native';
import { usePlayer, RepeatMode } from '../state/usePlayer';

// ─── Theme colours passed in from the parent ──────────────────────────────────
interface Colors {
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  card: string;
}

interface Props {
  colors: Colors;
  /** Called when the user taps the bar body (open full-screen Now Playing). */
  onExpand?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSecs(secs: number): string {
  const s = Math.floor(secs);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

function repeatIcon(mode: RepeatMode): string {
  if (mode === 'one') return '🔂';
  if (mode === 'all') return '🔁';
  return '🔁';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlayerBar({ colors: C, onExpand }: Props) {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    positionSecs,
    durationSecs,
    shuffle,
    repeat,
    togglePlayPause,
    next,
    previous,
    seek,
    toggleShuffle,
    toggleRepeat,
  } = usePlayer();

  const [barWidth, setBarWidth] = useState(0);
  const progressRef = useRef<View>(null);

  if (!currentTrack) return null;

  const progress = durationSecs > 0 ? positionSecs / durationSecs : 0;

  // ── Seek on tap / drag ────────────────────────────────────────────────────
  function handleProgressTouch(e: GestureResponderEvent) {
    if (barWidth <= 0 || durationSecs <= 0) return;
    const x = e.nativeEvent.locationX;
    const pct = Math.max(0, Math.min(1, x / barWidth));
    seek(pct * durationSecs);
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: C.surface, borderColor: C.accent + '66' },
      ]}
    >
      {/* ── Progress bar (top edge, tappable) ─────────────────────────────── */}
      <View
        ref={progressRef}
        style={styles.progressTrack}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handleProgressTouch}
        onResponderMove={handleProgressTouch}
      >
        <View
          style={[
            styles.progressFill,
            { width: `${progress * 100}%`, backgroundColor: C.accent },
          ]}
        />
      </View>

      {/* ── Bar body ──────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.body}
        onPress={onExpand}
        activeOpacity={onExpand ? 0.7 : 1}
      >
        {/* Album art */}
        {currentTrack.albumArt ? (
          <Image source={{ uri: currentTrack.albumArt }} style={styles.art} />
        ) : (
          <View style={[styles.art, { backgroundColor: C.accent + '33' }]}>
            <Text style={{ fontSize: 18 }}>♫</Text>
          </View>
        )}

        {/* Track info */}
        <View style={styles.info}>
          <Text style={[styles.title, { color: C.text }]} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text style={[styles.artist, { color: C.textMuted }]} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
          {/* Time */}
          <Text style={[styles.time, { color: C.textMuted }]}>
            {fmtSecs(positionSecs)}
            {durationSecs > 0 ? ` / ${fmtSecs(durationSecs)}` : ''}
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Shuffle */}
          <TouchableOpacity onPress={toggleShuffle} style={styles.iconBtn}>
            <Text style={[styles.icon, { color: shuffle ? C.accent : C.textMuted }]}>
              🔀
            </Text>
          </TouchableOpacity>

          {/* Previous */}
          <TouchableOpacity onPress={previous} style={styles.iconBtn}>
            <Text style={[styles.icon, { color: C.text }]}>⏮</Text>
          </TouchableOpacity>

          {/* Play / Pause / Loading */}
          <TouchableOpacity
            onPress={togglePlayPause}
            disabled={isLoading}
            style={[styles.playBtn, { backgroundColor: C.accent }]}
          >
            {isLoading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
            )}
          </TouchableOpacity>

          {/* Next */}
          <TouchableOpacity onPress={next} style={styles.iconBtn}>
            <Text style={[styles.icon, { color: C.text }]}>⏭</Text>
          </TouchableOpacity>

          {/* Repeat */}
          <TouchableOpacity onPress={toggleRepeat} style={styles.iconBtn}>
            <Text
              style={[
                styles.icon,
                { color: repeat !== 'none' ? C.accent : C.textMuted },
              ]}
            >
              {repeatIcon(repeat)}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 66, // sits just above the 64px tab bar
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    // Subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },

  // Progress bar — full width strip at the very top of the card
  progressTrack: {
    height: 3,
    width: '100%',
    backgroundColor: '#ffffff18',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  body: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },

  art: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  info: {
    flex: 1,
    overflow: 'hidden',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  artist: {
    fontSize: 11,
    marginTop: 1,
  },
  time: {
    fontSize: 10,
    marginTop: 2,
  },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 16,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
});
