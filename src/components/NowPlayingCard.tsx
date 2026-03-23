/**
 * NowPlayingCard — Full-screen immersive player
 *
 * Features:
 *  • Blurred album art fills the entire background (native blurRadius, no extra deps)
 *  • Dark gradient overlay so text is always readable
 *  • Large sharp album art card with shadow
 *  • Seekable progress bar with draggable thumb
 *  • ⏮ | ↺10s | ▶/⏸ | ↻10s | ⏭  controls
 *  • Shuffle + Repeat toggles, active state highlighted in accent colour
 *  • Loading spinner while the stream resolves
 *  • Swipe-down or tap the chevron to dismiss
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  GestureResponderEvent,
  Image,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { usePlayer, RepeatMode } from '../state/usePlayer';

const { width: W, height: H } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSecs(s: number): string {
  const sec = Math.max(0, Math.floor(s));
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
}

function repeatLabel(mode: RepeatMode): string {
  return mode === 'one' ? '🔂' : '🔁';
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Colors {
  bg: string;
  surface: string;
  accent: string;
  text: string;
  textMuted: string;
  border: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NowPlayingCard({ visible, onClose, colors: C }: Props) {
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
    queue,
    queueIndex,
  } = usePlayer();

  const [barWidth, setBarWidth] = useState(1);

  // ── Swipe-down to close ────────────────────────────────────────────────────
  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          Animated.timing(translateY, { toValue: H, duration: 250, useNativeDriver: true }).start(onClose);
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const handleModalShow = () => translateY.setValue(0);

  // ── Progress bar seek ──────────────────────────────────────────────────────
  function handleSeek(e: GestureResponderEvent) {
    if (barWidth <= 1 || durationSecs <= 0) return;
    const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth));
    seek(pct * durationSecs);
  }

  // ── ±10-second skip ────────────────────────────────────────────────────────
  function skip(delta: number) {
    seek(Math.max(0, Math.min(durationSecs, positionSecs + delta)));
  }

  const progress = durationSecs > 0 ? positionSecs / durationSecs : 0;
  const nextTrack = queue[queueIndex + 1] ?? null;

  if (!currentTrack) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onShow={handleModalShow}
    >
      <Animated.View
        style={[styles.root, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        {/* ── Blurred background ────────────────────────────────────────────── */}
        {currentTrack.albumArt ? (
          <Image
            source={{ uri: currentTrack.albumArt }}
            style={styles.bgArt}
            blurRadius={28}
          />
        ) : (
          <View style={[styles.bgArt, { backgroundColor: '#111' }]} />
        )}

        {/* ── Dark overlay ──────────────────────────────────────────────────── */}
        <View style={styles.overlay} />

        {/* ── Content ───────────────────────────────────────────────────────── */}
        <View style={styles.content}>

          {/* Header row */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.chevronBtn} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
              <View style={styles.chevronBar} />
            </TouchableOpacity>
            <Text style={styles.headerLabel}>Now Playing</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Album art */}
          <View style={styles.artWrapper}>
            {currentTrack.albumArt ? (
              <Image source={{ uri: currentTrack.albumArt }} style={styles.art} />
            ) : (
              <View style={[styles.art, { backgroundColor: C.accent + '33', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 80, color: '#fff' }}>♫</Text>
              </View>
            )}
          </View>

          {/* Track info */}
          <View style={styles.trackInfo}>
            <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
            <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist}</Text>
            {currentTrack.album ? (
              <Text style={styles.album} numberOfLines={1}>{currentTrack.album}</Text>
            ) : null}
          </View>

          {/* Progress bar */}
          <View style={styles.progressSection}>
            <View
              style={styles.progressTrack}
              onLayout={e => setBarWidth(e.nativeEvent.layout.width)}
              onStartShouldSetResponder={() => true}
              onResponderGrant={handleSeek}
              onResponderMove={handleSeek}
            >
              {/* Filled portion */}
              <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: C.accent }]} />
              {/* Thumb dot */}
              <View
                style={[
                  styles.progressThumb,
                  {
                    left: `${Math.min(progress * 100, 98)}%`,
                    backgroundColor: '#ffffff',
                    shadowColor: C.accent,
                  },
                ]}
              />
            </View>

            {/* Timestamps */}
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{fmtSecs(positionSecs)}</Text>
              <Text style={styles.timeText}>
                {durationSecs > 0 ? fmtSecs(durationSecs) : '--:--'}
              </Text>
            </View>
          </View>

          {/* Main controls */}
          <View style={styles.controls}>
            {/* Shuffle */}
            <TouchableOpacity onPress={toggleShuffle} style={styles.sideCtrl}>
              <Text style={[styles.sideIcon, { color: shuffle ? C.accent : 'rgba(255,255,255,0.45)' }]}>🔀</Text>
            </TouchableOpacity>

            {/* Previous track */}
            <TouchableOpacity onPress={previous} style={styles.skipCtrl}>
              <Text style={styles.ctrlIcon}>⏮</Text>
            </TouchableOpacity>

            {/* −10 seconds */}
            <TouchableOpacity onPress={() => skip(-10)} style={styles.skipSecBtn}>
              <Text style={styles.skipSecArrow}>↺</Text>
              <Text style={styles.skipSecLabel}>10</Text>
            </TouchableOpacity>

            {/* Play / Pause */}
            <TouchableOpacity
              onPress={togglePlayPause}
              disabled={isLoading}
              style={[styles.playBtn, { backgroundColor: C.accent }]}
              activeOpacity={0.85}
            >
              {isLoading
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
              }
            </TouchableOpacity>

            {/* +10 seconds */}
            <TouchableOpacity onPress={() => skip(10)} style={styles.skipSecBtn}>
              <Text style={styles.skipSecArrow}>↻</Text>
              <Text style={styles.skipSecLabel}>10</Text>
            </TouchableOpacity>

            {/* Next track */}
            <TouchableOpacity onPress={next} style={styles.skipCtrl}>
              <Text style={styles.ctrlIcon}>⏭</Text>
            </TouchableOpacity>

            {/* Repeat */}
            <TouchableOpacity onPress={toggleRepeat} style={styles.sideCtrl}>
              <Text style={[styles.sideIcon, { color: repeat !== 'none' ? C.accent : 'rgba(255,255,255,0.45)' }]}>
                {repeatLabel(repeat)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Up Next hint */}
          {nextTrack && (
            <View style={styles.upNext}>
              <Text style={styles.upNextLabel}>Up Next</Text>
              <View style={styles.upNextRow}>
                {nextTrack.albumArt
                  ? <Image source={{ uri: nextTrack.albumArt }} style={styles.upNextArt} />
                  : <View style={[styles.upNextArt, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 14 }}>♪</Text>
                    </View>
                }
                <View style={{ flex: 1 }}>
                  <Text style={styles.upNextTitle} numberOfLines={1}>{nextTrack.title}</Text>
                  <Text style={styles.upNextArtist} numberOfLines={1}>{nextTrack.artist}</Text>
                </View>
              </View>
            </View>
          )}

        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },

  // Blurred album art stretches full screen as background
  bgArt: {
    ...StyleSheet.absoluteFillObject,
    width: W,
    height: H,
    resizeMode: 'cover',
    opacity: 0.55,
  },

  // Dark gradient-like overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.60)',
  },

  // All content layered above background
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 54,
    paddingBottom: 32,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  chevronBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  headerLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // ── Album art ─────────────────────────────────────────────────────────────
  artWrapper: {
    alignItems: 'center',
    marginBottom: 32,
  },
  art: {
    width: W - 80,
    height: W - 80,
    maxWidth: 320,
    maxHeight: 320,
    borderRadius: 20,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 20,
  },

  // ── Track info ────────────────────────────────────────────────────────────
  trackInfo: {
    alignItems: 'center',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 6,
  },
  artist: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  album: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },

  // ── Progress bar ──────────────────────────────────────────────────────────
  progressSection: {
    marginBottom: 32,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 10,
    position: 'relative',
    justifyContent: 'center',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: -5,
    top: '50%',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '500',
  },

  // ── Controls ─────────────────────────────────────────────────────────────
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  sideCtrl: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideIcon: {
    fontSize: 20,
  },
  skipCtrl: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlIcon: {
    fontSize: 26,
    color: '#ffffff',
  },
  // ±10s button — stacked arrow + "10"
  skipSecBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipSecArrow: {
    fontSize: 26,
    color: '#ffffff',
    lineHeight: 28,
  },
  skipSecLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    position: 'absolute',
    bottom: 6,
    letterSpacing: 0.3,
  },
  // Big play / pause button
  playBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  playIcon: {
    color: '#000000',
    fontSize: 22,
    fontWeight: '900',
    marginLeft: 3, // optical center for ▶
  },

  // ── Up Next ───────────────────────────────────────────────────────────────
  upNext: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: 16,
  },
  upNextLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  upNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upNextArt: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  upNextTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
  upNextArtist: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: 2,
  },
});
