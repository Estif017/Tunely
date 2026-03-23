import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useCallback } from 'react';
import {
  ScrollView, StyleSheet, Text, View, TouchableOpacity,
  TextInput, Image, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Track } from './src/models';
import { getTrending, getNewReleases, searchTracks } from './src/adapters/iTunesAdapter';
import { getPlaylistByUrl } from './src/adapters/DeezerAdapter';
import { clearExpiredCache } from './src/cache/streamCache';
import { PlayerProvider, usePlayer } from './src/state/usePlayer';
import PlayerBar from './src/components/PlayerBar';
import NowPlayingCard from './src/components/NowPlayingCard';

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
type Theme = { bg: string; surface: string; card: string; accent: string; text: string; textMuted: string; border: string; input: string; statusBar: 'light' | 'dark' };

const PLAYLISTS = [
  { id: 'p1', name: 'Chill Vibes',  count: 24, color: '#1DB954' },
  { id: 'p2', name: 'Workout Mix',  count: 18, color: '#FF4D6D' },
  { id: 'p3', name: 'Late Night',   count: 31, color: '#4D9FFF' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning 👋';
  if (h < 17) return 'Good afternoon 👋';
  return 'Good evening 👋';
}

function fmtSecs(secs: number) {
  const s = Math.round(secs);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

// ─── TrackRow ─────────────────────────────────────────────────────────────────
function TrackRow({ track, index, C, isActive, allTracks, onAfterPlay }: {
  track: Track; index: number; C: Theme; isActive: boolean; allTracks: Track[]; onAfterPlay?: () => void;
}) {
  const { playTrack } = usePlayer();
  const color = CARD_COLORS[index % CARD_COLORS.length];
  return (
    <TouchableOpacity
      style={[styles.trackRow, { borderBottomColor: C.border }]}
      onPress={() => { playTrack(track, allTracks); onAfterPlay?.(); }}
    >
      {track.albumArt
        ? <Image source={{ uri: track.albumArt }} style={styles.trackThumb} />
        : <View style={[styles.trackThumb, { backgroundColor: color + '44', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 18 }}>♪</Text>
          </View>}
      <View style={styles.trackInfo}>
        <Text style={[styles.trackTitle, { color: isActive ? C.accent : C.text }]} numberOfLines={1}>
          {isActive ? '▶ ' : ''}{track.title}
        </Text>
        <Text style={[styles.trackArtist, { color: C.textMuted }]} numberOfLines={1}>{track.artist}</Text>
      </View>
      <Text style={[styles.trackDuration, { color: C.textMuted }]}>{fmtSecs(track.durationMs / 1000)}</Text>
    </TouchableOpacity>
  );
}

// ─── FeaturedCard ─────────────────────────────────────────────────────────────
function FeaturedCard({ track, index, C, isActive, allTracks, onAfterPlay }: {
  track: Track; index: number; C: Theme; isActive: boolean; allTracks: Track[]; onAfterPlay?: () => void; // already correct
}) {
  const { playTrack } = usePlayer();
  const color = CARD_COLORS[index % CARD_COLORS.length];
  return (
    <TouchableOpacity
      style={[styles.featuredCard, { backgroundColor: color + '22', borderColor: isActive ? color : color + '44' }]}
      onPress={() => { playTrack(track, allTracks); onAfterPlay?.(); }}
    >
      {track.albumArt
        ? <Image source={{ uri: track.albumArt }} style={styles.featuredArt} />
        : <View style={[styles.featuredArt, { backgroundColor: color + '55', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 32 }}>♫</Text>
          </View>}
      <Text style={[styles.featuredTitle, { color: isActive ? color : C.text }]} numberOfLines={1}>
        {isActive ? '▶ ' : ''}{track.title}
      </Text>
      <Text style={[styles.featuredArtist, { color: C.textMuted }]} numberOfLines={1}>{track.artist}</Text>
      <View style={styles.featuredFooter}>
        <Text style={[styles.featuredDuration, { color: C.textMuted }]}>{fmtSecs(track.durationMs / 1000)}</Text>
        <View style={[styles.smallPlayBtn, { backgroundColor: color }]}>
          <Text style={styles.smallPlayBtnText}>▶</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Inner App ────────────────────────────────────────────────────────────────
function InnerApp() {
  const [isDark, setIsDark] = useState(true);
  const C = isDark ? DARK : LIGHT;
  const { currentTrack } = usePlayer();
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const openNowPlaying = useCallback(() => setShowNowPlaying(true), []);

  const [trending,    setTrending]    = useState<Track[]>([]);
  const [newReleases, setNewReleases] = useState<Track[]>([]);
  const [homeLoading, setHomeLoading] = useState(true);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchMode,  setIsSearchMode]  = useState(false);
  const [searchError,   setSearchError]   = useState<string | null>(null);
  const [activeTab,       setActiveTab]       = useState<'home'|'search'|'library'|'downloads'>('home');
  const [showPLModal,     setShowPLModal]     = useState(false);
  const [playlistUrl,     setPlaylistUrl]     = useState('');
  const [playlistName,    setPlaylistName]    = useState('');
  const [playlistTracks,  setPlaylistTracks]  = useState<Track[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistError,   setPlaylistError]   = useState('');

  useEffect(() => {
    clearExpiredCache();
    (async () => {
      try {
        const [t, n] = await Promise.all([getTrending(8), getNewReleases(8)]);
        setTrending(t); setNewReleases(n);
      } finally { setHomeLoading(false); }
    })();
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setSearchLoading(true); setIsSearchMode(true); setSearchError(null);
    try { setSearchResults(await searchTracks(q.trim(), 20)); }
    catch (e: any) { setSearchResults([]); setSearchError(e.message ?? 'Search failed.'); }
    finally { setSearchLoading(false); }
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setIsSearchMode(false); setSearchResults([]); setSearchError(null); return; }
    const t = setTimeout(() => doSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery, doSearch]);

  const handleLoadPlaylist = useCallback(async () => {
    const url = playlistUrl.trim();
    if (!url) return;
    setPlaylistLoading(true); setPlaylistError('');
    try {
      if (url.includes('spotify.com/playlist')) {
        const oRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
        const title = oRes.ok ? (await oRes.json()).title ?? 'Spotify Playlist' : 'Spotify Playlist';
        setPlaylistName(title); setPlaylistTracks(await searchTracks(title, 20));
      } else {
        const { name, tracks } = await getPlaylistByUrl(url);
        setPlaylistName(name); setPlaylistTracks(tracks);
      }
      setShowPLModal(false); setPlaylistUrl(''); setActiveTab('library');
    } catch (e: any) { setPlaylistError(e.message ?? 'Failed to load playlist'); }
    finally { setPlaylistLoading(false); }
  }, [playlistUrl]);

  const tabs    = ['home','search','library','downloads'] as const;
  const tabIcons  = ['🏠','🔍','📚','⬇️'];
  const tabLabels = ['Home','Search','Library','Downloads'];

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <StatusBar style={C.statusBar} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: C.textMuted }]}>{getGreeting()}</Text>
          <Text style={[styles.appName, { color: C.text }]}>Tunely</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.themeBtn, { backgroundColor: C.surface, borderColor: C.border }]} onPress={() => setIsDark(!isDark)}>
            <Text>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <View style={[styles.avatar, { backgroundColor: C.accent }]}>
            <Text style={styles.avatarText}>E</Text>
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: C.text }]}
          placeholder="Search songs, artists, albums…"
          placeholderTextColor={C.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => doSearch(searchQuery)}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); setIsSearchMode(false); }} style={styles.clearBtn}>
            <Text style={{ color: C.textMuted, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.goBtn, { backgroundColor: C.accent }]} onPress={() => doSearch(searchQuery)}>
          <Text style={styles.goBtnText}>Go</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Search results */}
        {isSearchMode && (
          <View style={{ paddingBottom: 20 }}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>
              {searchLoading ? 'Searching…' : `Results for "${searchQuery}"`}
            </Text>
            {searchLoading
              ? <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} />
              : <View style={[styles.trackList, { backgroundColor: C.surface, borderColor: C.border }]}>
                  {searchError
                    ? <Text style={[styles.emptyText, { color: '#FF4D6D', padding: 16 }]}>{searchError}</Text>
                    : searchResults.length === 0
                      ? <Text style={[styles.emptyText, { color: C.textMuted }]}>No results found</Text>
                      : searchResults.map((t, i) => (
                          <TrackRow key={t.id} track={t} index={i} C={C}
                            isActive={currentTrack?.id === t.id} allTracks={searchResults} onAfterPlay={openNowPlaying} />
                        ))}
                </View>}
          </View>
        )}

        {/* Library */}
        {!isSearchMode && activeTab === 'library' && (
          <View style={{ paddingBottom: 20 }}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: C.text }]}>{playlistName || 'Library'}</Text>
              <TouchableOpacity style={[styles.loadBtn, { backgroundColor: C.accent }]} onPress={() => setShowPLModal(true)}>
                <Text style={styles.loadBtnText}>+ Load</Text>
              </TouchableOpacity>
            </View>
            {playlistTracks.length === 0
              ? <View style={styles.emptyState}>
                  <Text style={{ fontSize: 48 }}>🎵</Text>
                  <Text style={[styles.emptyText, { color: C.textMuted, marginTop: 12 }]}>Paste a Deezer or Spotify playlist link</Text>
                  <TouchableOpacity style={[styles.pasteBtn, { backgroundColor: C.accent }]} onPress={() => setShowPLModal(true)}>
                    <Text style={styles.pasteBtnText}>Paste Playlist Link</Text>
                  </TouchableOpacity>
                </View>
              : <View style={[styles.trackList, { backgroundColor: C.surface, borderColor: C.border }]}>
                  {playlistTracks.map((t, i) => (
                    <TrackRow key={t.id} track={t} index={i} C={C}
                      isActive={currentTrack?.id === t.id} allTracks={playlistTracks} onAfterPlay={openNowPlaying} />
                  ))}
                </View>}
          </View>
        )}

        {/* Home */}
        {!isSearchMode && activeTab === 'home' && (
          <>
            <Text style={[styles.sectionTitle, { color: C.text }]}>Trending Now</Text>
            {homeLoading
              ? <ActivityIndicator color={C.accent} style={{ marginBottom: 28 }} />
              : <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
                  {trending.map((t, i) => (
                    <FeaturedCard key={t.id} track={t} index={i} C={C}
                      isActive={currentTrack?.id === t.id} allTracks={trending} onAfterPlay={openNowPlaying} />
                  ))}
                </ScrollView>}

            <Text style={[styles.sectionTitle, { color: C.text }]}>Your Playlists</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
              {PLAYLISTS.map(p => (
                <TouchableOpacity key={p.id} style={styles.playlistCard}
                  onPress={() => { setActiveTab('library'); setShowPLModal(true); }}>
                  <View style={[styles.playlistCover, { backgroundColor: p.color + '33' }]}>
                    <Text style={[styles.playlistIcon, { color: p.color }]}>♬</Text>
                  </View>
                  <Text style={[styles.playlistName, { color: C.text }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={[styles.playlistCount, { color: C.textMuted }]}>{p.count} tracks</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.sectionTitle, { color: C.text }]}>New Releases</Text>
            {homeLoading
              ? <ActivityIndicator color={C.accent} />
              : <View style={[styles.trackList, { backgroundColor: C.surface, borderColor: C.border }]}>
                  {newReleases.map((t, i) => (
                    <TrackRow key={t.id} track={t} index={i} C={C}
                      isActive={currentTrack?.id === t.id} allTracks={newReleases} onAfterPlay={openNowPlaying} />
                  ))}
                </View>}
          </>
        )}

        {!isSearchMode && activeTab === 'downloads' && (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>⬇️</Text>
            <Text style={[styles.emptyText, { color: C.textMuted, marginTop: 12 }]}>Offline downloads coming soon</Text>
          </View>
        )}

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* PlayerBar — sits above the tab bar */}
      <PlayerBar colors={C} onExpand={openNowPlaying} />
      <NowPlayingCard visible={showNowPlaying} onClose={() => setShowNowPlaying(false)} colors={C} />

      {/* Bottom nav */}
      <View style={[styles.bottomNav, { backgroundColor: C.surface, borderTopColor: C.border }]}>
        {tabs.map((tab, i) => (
          <TouchableOpacity key={tab} style={styles.navItem} onPress={() => {
            setActiveTab(tab);
            if (tab !== 'search') setIsSearchMode(false);
            if (tab === 'search' && searchResults.length > 0) setIsSearchMode(true);
          }}>
            <Text style={styles.navIcon}>{tabIcons[i]}</Text>
            <Text style={[styles.navLabel, { color: activeTab === tab ? C.accent : C.textMuted }]}>{tabLabels[i]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Playlist modal */}
      <Modal visible={showPLModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.surface }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>Load Playlist</Text>
            <Text style={[styles.modalSub, { color: C.textMuted }]}>
              Paste a Spotify or Deezer playlist URL
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]}
              placeholder="https://..." placeholderTextColor={C.textMuted}
              value={playlistUrl} onChangeText={setPlaylistUrl}
              autoCapitalize="none" autoCorrect={false}
            />
            {playlistError ? <Text style={styles.modalError}>{playlistError}</Text> : null}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.card }]}
                onPress={() => { setShowPLModal(false); setPlaylistUrl(''); setPlaylistError(''); }}>
                <Text style={[styles.modalBtnTxt, { color: C.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.accent }]}
                onPress={handleLoadPlaylist} disabled={playlistLoading}>
                {playlistLoading
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={[styles.modalBtnTxt, { color: '#000' }]}>Load</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
export default function App() {
  return (
    <PlayerProvider>
      <InnerApp />
    </PlayerProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 }, scroll: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  greeting: { fontSize: 13 }, appName: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  themeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#000', fontWeight: '700', fontSize: 15 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 10, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  searchIcon: { marginRight: 8, fontSize: 14 }, searchInput: { flex: 1, fontSize: 14, padding: 0 },
  clearBtn: { paddingHorizontal: 8 },
  goBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, marginLeft: 6 }, goBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 20, marginBottom: 14, marginTop: 8 },
  hScroll: { paddingLeft: 20, marginBottom: 24 },
  featuredCard: { width: 155, borderRadius: 16, padding: 12, marginRight: 12, borderWidth: 1.5 },
  featuredArt: { width: '100%', height: 110, borderRadius: 10, marginBottom: 10 },
  featuredTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 }, featuredArtist: { fontSize: 11, marginBottom: 10 },
  featuredFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, featuredDuration: { fontSize: 11 },
  smallPlayBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, smallPlayBtnText: { color: '#000', fontSize: 10, fontWeight: '700' },
  playlistCard: { width: 120, marginRight: 12 },
  playlistCover: { width: 120, height: 120, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  playlistIcon: { fontSize: 40 }, playlistName: { fontSize: 13, fontWeight: '600' }, playlistCount: { fontSize: 11, marginTop: 2 },
  trackList: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  trackThumb: { width: 44, height: 44, borderRadius: 8, marginRight: 12 },
  trackInfo: { flex: 1 }, trackTitle: { fontSize: 14, fontWeight: '600' }, trackArtist: { fontSize: 12, marginTop: 2 }, trackDuration: { fontSize: 12, marginLeft: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 60 }, emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  pasteBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }, pasteBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  loadBtn: { marginRight: 20, marginBottom: 14, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }, loadBtnText: { color: '#000', fontWeight: '700', fontSize: 12 },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 64, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' }, navIcon: { fontSize: 20 }, navLabel: { fontSize: 10, marginTop: 2 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 }, modalSub: { fontSize: 13, marginBottom: 20, lineHeight: 20 },
  modalInput: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 14, marginBottom: 12 }, modalError: { color: '#FF4D6D', fontSize: 13, marginBottom: 12 },
  modalBtns: { flexDirection: 'row', gap: 12 }, modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }, modalBtnTxt: { fontWeight: '700', fontSize: 15 },
});
