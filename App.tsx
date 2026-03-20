import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useCallback } from 'react';
import {
  ScrollView, StyleSheet, Text, View, TouchableOpacity,
  TextInput, Image, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Track } from './src/models';
import { getTrending, getNewReleases, searchTracks } from './src/adapters/iTunesAdapter';
import { getPlaylistByUrl } from './src/adapters/DeezerAdapter';

// ─── Themes ──────────────────────────────────────────────────────────────────
const DARK = {
  bg: '#1C1C1E', surface: '#2C2C2E', card: '#3A3A3C',
  accent: '#1DB954', text: '#FFFFFF', textMuted: '#AEAEB2',
  border: '#3A3A3C', input: '#3A3A3C', statusBar: 'light' as const,
};
const LIGHT = {
  bg: '#F2F2F7', surface: '#FFFFFF', card: '#E5E5EA',
  accent: '#1DB954', text: '#1C1C1E', textMuted: '#6C6C70',
  border: '#D1D1D6', input: '#E5E5EA', statusBar: 'dark' as const,
};
const CARD_COLORS = ['#FF4D6D','#4D9FFF','#FFB74D','#B44DFF','#FF6B9D','#4DFFB4','#FFD54D','#4DB8FF','#FF7043','#1DB954'];

function fmt(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function TrackRow({
  track, index, C, onPlay, isActive,
}: {
  track: Track; index: number; C: typeof DARK;
  onPlay: (t: Track) => void; isActive: boolean;
}) {
  const color = CARD_COLORS[index % CARD_COLORS.length];
  return (
    <TouchableOpacity
      style={[styles.trackRow, { borderBottomColor: C.border }]}
      onPress={() => onPlay(track)}
    >
      {track.thumbnailUrl ? (
        <Image source={{ uri: track.thumbnailUrl }} style={styles.trackThumb} />
      ) : (
        <View style={[styles.trackThumb, { backgroundColor: color + '44' }]}>
          <Text style={styles.trackThumbIcon}>♪</Text>
        </View>
      )}
      <View style={styles.trackInfo}>
        <Text style={[styles.trackTitle, { color: isActive ? C.accent : C.text }]} numberOfLines={1}>
          {isActive ? '▶ ' : ''}{track.title}
        </Text>
        <Text style={[styles.trackArtist, { color: C.textMuted }]} numberOfLines={1}>{track.artist}</Text>
      </View>
      <Text style={[styles.trackDuration, { color: C.textMuted }]}>{fmt(track.duration)}</Text>
    </TouchableOpacity>
  );
}

function FeaturedCard({
  track, index, C, onPlay, isActive,
}: {
  track: Track; index: number; C: typeof DARK;
  onPlay: (t: Track) => void; isActive: boolean;
}) {
  const color = CARD_COLORS[index % CARD_COLORS.length];
  return (
    <TouchableOpacity
      style={[styles.featuredCard, { backgroundColor: color + '22', borderColor: isActive ? color : color + '44' }]}
      onPress={() => onPlay(track)}
    >
      {track.thumbnailUrl ? (
        <Image source={{ uri: track.thumbnailUrl }} style={styles.featuredArt} />
      ) : (
        <View style={[styles.featuredArt, { backgroundColor: color + '55', alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: 32 }}>♫</Text>
        </View>
      )}
      <Text style={[styles.featuredTitle, { color: isActive ? color : C.text }]} numberOfLines={1}>
        {isActive ? '▶ ' : ''}{track.title}
      </Text>
      <Text style={[styles.featuredArtist, { color: C.textMuted }]} numberOfLines={1}>{track.artist}</Text>
      <View style={styles.featuredFooter}>
        <Text style={[styles.featuredDuration, { color: C.textMuted }]}>{fmt(track.duration)}</Text>
        <View style={[styles.playBtn, { backgroundColor: color }]}>
          <Text style={styles.playBtnText}>▶</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [isDark, setIsDark] = useState(true);
  const C = isDark ? DARK : LIGHT;

  // Home data
  const [trending, setTrending] = useState<Track[]>([]);
  const [newReleases, setNewReleases] = useState<Track[]>([]);
  const [homeLoading, setHomeLoading] = useState(true);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Playlist
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState('');

  // Player
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'library' | 'downloads'>('home');
  const [audioSource, setAudioSource] = useState<{ uri: string } | null>(null);
  const player = useAudioPlayer(audioSource ?? { uri: '' });
  const isPlaying = player.playing;

  // Load home data
  useEffect(() => {
    (async () => {
      try {
        const [t, n] = await Promise.all([getTrending(8), getNewReleases(8)]);
        setTrending(t);
        setNewReleases(n);
      } finally {
        setHomeLoading(false);
      }
    })();
  }, []);

  // Audio setup
  useEffect(() => {
    setAudioModeAsync({ playsInSilentModeIOS: true, shouldPlayInBackground: true });
  }, []);

  const playTrack = useCallback((track: Track) => {
    if (!track.streamUrl) return;
    setCurrentTrack(track);
    setAudioSource({ uri: track.streamUrl });
    // Give the player a tick to load the new source, then play
    setTimeout(() => { try { player.play(); } catch {} }, 100);
  }, [player]);

  const togglePlay = useCallback(() => {
    if (!currentTrack) return;
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [player, currentTrack]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setIsSearchMode(true);
    try {
      const results = await searchTracks(searchQuery.trim(), 20);
      setSearchResults(results);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery]);

  const handleLoadPlaylist = useCallback(async () => {
    const url = playlistUrl.trim();
    if (!url) return;
    setPlaylistLoading(true);
    setPlaylistError('');
    try {
      // Spotify playlist URL — extract playlist name from URL slug and search iTunes
      if (url.includes('spotify.com/playlist')) {
        const slugMatch = url.match(/playlist\/([A-Za-z0-9]+)/);
        if (!slugMatch) throw new Error('Invalid Spotify playlist URL');
        // Fetch Spotify playlist metadata via oEmbed (no auth needed)
        const oembedRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
        let playlistTitle = 'Spotify Playlist';
        if (oembedRes.ok) {
          const oembed = await oembedRes.json();
          playlistTitle = oembed.title ?? playlistTitle;
        }
        // Use iTunes to find tracks matching the playlist name
        const { searchTracks: iTunesSearch } = await import('./src/adapters/iTunesAdapter');
        const tracks = await iTunesSearch(playlistTitle, 20);
        setPlaylistName(playlistTitle);
        setPlaylistTracks(tracks);
        setShowPlaylistModal(false);
        setPlaylistUrl('');
        setActiveTab('library');
        return;
      }
      // Deezer playlist URL
      const { name, tracks } = await getPlaylistByUrl(url);
      setPlaylistName(name);
      setPlaylistTracks(tracks);
      setShowPlaylistModal(false);
      setPlaylistUrl('');
      setActiveTab('library');
    } catch (e: any) {
      setPlaylistError(e.message ?? 'Failed to load playlist');
    } finally {
      setPlaylistLoading(false);
    }
  }, [playlistUrl]);

  const playlists = [
    { id: 'p1', name: 'Chill Vibes', count: 24, color: '#1DB954' },
    { id: 'p2', name: 'Workout Mix', count: 18, color: '#FF4D6D' },
    { id: 'p3', name: 'Late Night', count: 31, color: '#4D9FFF' },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <StatusBar style={C.statusBar} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: C.border }]}>
        <View>
          <Text style={[styles.greeting, { color: C.textMuted }]}>Good evening 👋</Text>
          <Text style={[styles.appName, { color: C.text }]}>Tunely</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.themeBtn, { backgroundColor: C.surface, borderColor: C.border }]}
            onPress={() => setIsDark(!isDark)}
          >
            <Text>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <View style={[styles.avatar, { backgroundColor: C.accent }]}>
            <Text style={styles.avatarText}>E</Text>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchRow, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: C.text }]}
          placeholder="Search songs, artists, albums…"
          placeholderTextColor={C.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity onPress={() => { setSearchQuery(''); setIsSearchMode(false); }} style={styles.searchClearBtn}>
            <Text style={{ color: C.textMuted, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.searchGoBtn, { backgroundColor: C.accent }]}
          onPress={handleSearch}
        >
          <Text style={styles.searchGoBtnText}>Go</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Search Results ── */}
        {isSearchMode && (
          <View style={{ paddingBottom: 20 }}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>
              {searchLoading ? 'Searching…' : `Results for "${searchQuery}"`}
            </Text>
            {searchLoading ? (
              <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} />
            ) : (
              <View style={[styles.trackList, { backgroundColor: C.surface, borderColor: C.border }]}>
                {searchResults.length === 0 ? (
                  <Text style={[styles.emptyText, { color: C.textMuted }]}>No results found</Text>
                ) : searchResults.map((t, i) => (
                  <TrackRow key={t.id} track={t} index={i} C={C}
                    onPlay={playTrack} isActive={currentTrack?.id === t.id} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Library (loaded playlist) ── */}
        {activeTab === 'library' && (
          <View style={{ paddingBottom: 20 }}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: C.text }]}>
                {playlistName || 'Library'}
              </Text>
              <TouchableOpacity
                style={[styles.loadBtn, { backgroundColor: C.accent }]}
                onPress={() => setShowPlaylistModal(true)}
              >
                <Text style={styles.loadBtnText}>+ Load Playlist</Text>
              </TouchableOpacity>
            </View>
            {playlistTracks.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 48 }}>🎵</Text>
                <Text style={[styles.emptyText, { color: C.textMuted, marginTop: 12 }]}>
                  Paste a Deezer playlist link to load tracks
                </Text>
                <TouchableOpacity
                  style={[styles.pasteBtn, { backgroundColor: C.accent }]}
                  onPress={() => setShowPlaylistModal(true)}
                >
                  <Text style={styles.pasteBtnText}>Paste Playlist Link</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.trackList, { backgroundColor: C.surface, borderColor: C.border }]}>
                {playlistTracks.map((t, i) => (
                  <TrackRow key={t.id} track={t} index={i} C={C}
                    onPlay={playTrack} isActive={currentTrack?.id === t.id} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Home ── */}
        {activeTab === 'home' && (
          <>
            {/* Trending */}
            <Text style={[styles.sectionTitle, { color: C.text }]}>Trending Now</Text>
            {homeLoading ? (
              <ActivityIndicator color={C.accent} style={{ marginBottom: 28 }} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {trending.map((t, i) => (
                  <FeaturedCard key={t.id} track={t} index={i} C={C}
                    onPlay={playTrack} isActive={currentTrack?.id === t.id} />
                ))}
              </ScrollView>
            )}

            {/* Playlists */}
            <Text style={[styles.sectionTitle, { color: C.text }]}>Your Playlists</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {playlists.map(p => (
                <TouchableOpacity key={p.id} style={styles.playlistCard}
                  onPress={() => { setActiveTab('library'); setShowPlaylistModal(true); }}>
                  <View style={[styles.playlistCover, { backgroundColor: p.color + '33' }]}>
                    <Text style={[styles.playlistIcon, { color: p.color }]}>♬</Text>
                  </View>
                  <Text style={[styles.playlistName, { color: C.text }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={[styles.playlistCount, { color: C.textMuted }]}>{p.count} tracks</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* New Releases */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: C.text }]}>New Releases</Text>
              <TouchableOpacity style={{ paddingRight: 20, marginBottom: 14 }}>
                <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600' }}>See all</Text>
              </TouchableOpacity>
            </View>
            {homeLoading ? (
              <ActivityIndicator color={C.accent} />
            ) : (
              <View style={[styles.trackList, { backgroundColor: C.surface, borderColor: C.border }]}>
                {newReleases.map((t, i) => (
                  <TrackRow
                    key={t.id} track={t} index={i} C={C}
                    onPlay={playTrack} isActive={currentTrack?.id === t.id}
                  />
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Now Playing Bar */}
      {currentTrack && (
        <View style={[styles.nowPlaying, { backgroundColor: C.surface, borderColor: C.accent + '88' }]}>
          {currentTrack.thumbnailUrl ? (
            <Image source={{ uri: currentTrack.thumbnailUrl }} style={styles.nowPlayingThumb} />
          ) : (
            <View style={[styles.nowPlayingThumb, { backgroundColor: C.accent + '33', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: C.accent }}>♫</Text>
            </View>
          )}
          <View style={styles.nowPlayingInfo}>
            <Text style={[styles.nowPlayingTitle, { color: C.text }]} numberOfLines={1}>{currentTrack.title}</Text>
            <Text style={[styles.nowPlayingArtist, { color: C.textMuted }]} numberOfLines={1}>{currentTrack.artist}</Text>
          </View>
          <TouchableOpacity style={[styles.nowPlayingPlay, { backgroundColor: C.accent }]} onPress={togglePlay}>
            <Text style={{ color: '#000', fontSize: 14, fontWeight: '700' }}>{isPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom Nav */}
      <View style={[styles.bottomNav, { backgroundColor: C.surface, borderTopColor: C.border }]}>
        {([
          ['🏠', 'Home', 'home'],
          ['🔍', 'Search', 'search'],
          ['📚', 'Library', 'library'],
          ['⬇️', 'Downloads', 'downloads'],
        ] as const).map(([icon, label, tab]) => (
          <TouchableOpacity key={tab} style={styles.navItem} onPress={() => {
            setActiveTab(tab);
            if (tab === 'search') setIsSearchMode(searchResults.length > 0);
          }}>
            <Text style={styles.navIcon}>{icon}</Text>
            <Text style={[styles.navLabel, { color: activeTab === tab ? C.accent : C.textMuted }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Playlist Modal */}
      <Modal visible={showPlaylistModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.surface }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>Load Playlist</Text>
            <Text style={[styles.modalSub, { color: C.textMuted }]}>
              Paste a Spotify or Deezer playlist link{'\n'}
              e.g. https://open.spotify.com/playlist/...{'\n'}
              e.g. https://www.deezer.com/playlist/...
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]}
              placeholder="https://www.deezer.com/playlist/..."
              placeholderTextColor={C.textMuted}
              value={playlistUrl}
              onChangeText={setPlaylistUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {playlistError ? (
              <Text style={styles.modalError}>{playlistError}</Text>
            ) : null}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: C.card }]}
                onPress={() => { setShowPlaylistModal(false); setPlaylistUrl(''); setPlaylistError(''); }}
              >
                <Text style={[styles.modalBtnText, { color: C.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: C.accent }]}
                onPress={handleLoadPlaylist}
                disabled={playlistLoading}
              >
                {playlistLoading
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={[styles.modalBtnText, { color: '#000' }]}>Load</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 0 },
  greeting: { fontSize: 13 },
  appName: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  themeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#000', fontWeight: '700', fontSize: 15 },

  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 12, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  searchIcon: { marginRight: 8, fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  searchClearBtn: { paddingHorizontal: 8 },
  searchGoBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, marginLeft: 6 },
  searchGoBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 20, marginBottom: 14, marginTop: 8 },
  horizontalScroll: { paddingLeft: 20, marginBottom: 24 },

  featuredCard: { width: 155, borderRadius: 16, padding: 12, marginRight: 12, borderWidth: 1.5 },
  featuredArt: { width: '100%', height: 110, borderRadius: 10, marginBottom: 10 },
  featuredTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  featuredArtist: { fontSize: 11, marginBottom: 10 },
  featuredFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  featuredDuration: { fontSize: 11 },
  playBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  playBtnText: { color: '#000', fontSize: 10, fontWeight: '700' },

  playlistCard: { width: 120, marginRight: 12 },
  playlistCover: { width: 120, height: 120, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  playlistIcon: { fontSize: 40 },
  playlistName: { fontSize: 13, fontWeight: '600' },
  playlistCount: { fontSize: 11, marginTop: 2 },

  trackList: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  trackThumb: { width: 44, height: 44, borderRadius: 8, marginRight: 12 },
  trackThumbIcon: { fontSize: 18 },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 14, fontWeight: '600' },
  trackArtist: { fontSize: 12, marginTop: 2 },
  trackDuration: { fontSize: 12, marginRight: 8 },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  pasteBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  pasteBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  loadBtn: { marginRight: 20, marginBottom: 14, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  loadBtnText: { color: '#000', fontWeight: '700', fontSize: 12 },

  nowPlaying: { position: 'absolute', bottom: 64, left: 12, right: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1.5 },
  nowPlayingThumb: { width: 44, height: 44, borderRadius: 10, marginRight: 12 },
  nowPlayingInfo: { flex: 1 },
  nowPlayingTitle: { fontSize: 13, fontWeight: '700' },
  nowPlayingArtist: { fontSize: 11 },
  nowPlayingPlay: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 64, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 10, marginTop: 2 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  modalSub: { fontSize: 13, marginBottom: 20, lineHeight: 20 },
  modalInput: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 14, marginBottom: 12 },
  modalError: { color: '#FF4D6D', fontSize: 13, marginBottom: 12 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalBtnText: { fontWeight: '700', fontSize: 15 },
});
