import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useCallback } from 'react';
import {
  ScrollView, StyleSheet, Text, View, TouchableOpacity,
  TextInput, Image, ActivityIndicator, Modal, Pressable,
  KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  { id: 'p1', name: 'Chill Vibes',  count: 24, color: '#1DB954', query: 'chill lofi acoustic' },
  { id: 'p2', name: 'Workout Mix',  count: 18, color: '#FF4D6D', query: 'workout pump energy hip hop' },
  { id: 'p3', name: 'Late Night',   count: 31, color: '#4D9FFF', query: 'late night soul rnb' },
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
function FeaturedCard({ track, index, C, isActive, allTracks, onAfterPlay, cardWidth }: {
  track: Track; index: number; C: Theme; isActive: boolean; allTracks: Track[]; onAfterPlay?: () => void; cardWidth: number;
}) {
  const { playTrack } = usePlayer();
  const color = CARD_COLORS[index % CARD_COLORS.length];
  return (
    <TouchableOpacity
      style={[styles.featuredCard, { width: cardWidth, backgroundColor: color + '22', borderColor: isActive ? color : color + '44' }]}
      onPress={() => { playTrack(track, allTracks); onAfterPlay?.(); }}
    >
      {track.albumArt
        ? <Image source={{ uri: track.albumArt }} style={[styles.featuredArt, { height: cardWidth * 0.7 }]} />
        : <View style={[styles.featuredArt, { height: cardWidth * 0.7, backgroundColor: color + '55', alignItems: 'center', justifyContent: 'center' }]}>
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
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const isMd = W >= 600;    // tablet+
  const isLg = W >= 1024;   // desktop/laptop

  const SIDEBAR_W = 220;
  // content width for centering on very wide screens
  const contentW = isLg ? Math.min(W - SIDEBAR_W, 1100) : W;
  // card widths
  const featuredCardW = isLg ? Math.floor((contentW - 48 - 36) / 4) : isMd ? 175 : 155;
  const playlistCardW = isLg ? 150 : isMd ? 140 : 120;

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
        const [t, n] = await Promise.all([getTrending(isLg ? 12 : 8), getNewReleases(isLg ? 12 : 8)]);
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

  const loadPlaylistByName = useCallback(async (name: string, query: string) => {
    setPlaylistLoading(true);
    try {
      const tracks = await searchTracks(query, 20);
      setPlaylistName(name); setPlaylistTracks(tracks); setActiveTab('library');
    } catch { /* silently ignore */ }
    finally { setPlaylistLoading(false); }
  }, []);

  const switchTab = useCallback((tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab !== 'search') setIsSearchMode(false);
    if (tab === 'search' && searchResults.length > 0) setIsSearchMode(true);
  }, [searchResults]);

  const tabs    = ['home','search','library','downloads'] as const;
  const tabIcons  = ['🏠','🔍','📚','⬇️'];
  const tabLabels = ['Home','Search','Library','Downloads'];

  // ── Scrollable page content ────────────────────────────────────────────────
  const pageContent = (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

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
            : isLg
              // Desktop: grid wrap
              ? <View style={[styles.cardGrid, { paddingHorizontal: 20, marginBottom: 28, gap: 12 }]}>
                  {trending.map((t, i) => (
                    <FeaturedCard key={t.id} track={t} index={i} C={C} cardWidth={featuredCardW}
                      isActive={currentTrack?.id === t.id} allTracks={trending} onAfterPlay={openNowPlaying} />
                  ))}
                </View>
              // Mobile/tablet: horizontal scroll
              : <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={{ paddingRight: 20 }}>
                  {trending.map((t, i) => (
                    <FeaturedCard key={t.id} track={t} index={i} C={C} cardWidth={featuredCardW}
                      isActive={currentTrack?.id === t.id} allTracks={trending} onAfterPlay={openNowPlaying} />
                  ))}
                </ScrollView>}

          <Text style={[styles.sectionTitle, { color: C.text }]}>Your Playlists</Text>
          {isLg
            ? <View style={[styles.cardGrid, { paddingHorizontal: 20, marginBottom: 28, gap: 12 }]}>
                {PLAYLISTS.map(p => (
                  <TouchableOpacity key={p.id} style={[styles.playlistCard, { width: playlistCardW }]}
                    onPress={() => loadPlaylistByName(p.name, p.query)}>
                    <View style={[styles.playlistCover, { width: playlistCardW, height: playlistCardW, backgroundColor: p.color + '33' }]}>
                      <Text style={[styles.playlistIcon, { color: p.color }]}>♬</Text>
                    </View>
                    <Text style={[styles.playlistName, { color: C.text }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[styles.playlistCount, { color: C.textMuted }]}>{p.count} tracks</Text>
                  </TouchableOpacity>
                ))}
              </View>
            : <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={{ paddingRight: 20 }}>
                {PLAYLISTS.map(p => (
                  <TouchableOpacity key={p.id} style={[styles.playlistCard, { width: playlistCardW }]}
                    onPress={() => loadPlaylistByName(p.name, p.query)}>
                    <View style={[styles.playlistCover, { width: playlistCardW, height: playlistCardW, backgroundColor: p.color + '33' }]}>
                      <Text style={[styles.playlistIcon, { color: p.color }]}>♬</Text>
                    </View>
                    <Text style={[styles.playlistName, { color: C.text }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[styles.playlistCount, { color: C.textMuted }]}>{p.count} tracks</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>}

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

      <View style={{ height: 20 }} />
    </ScrollView>
  );

  // ── Desktop layout ─────────────────────────────────────────────────────────
  if (isLg) {
    return (
      <View style={[styles.root, { backgroundColor: C.bg, flexDirection: 'row' }]}>
        <StatusBar style={C.statusBar} />

        {/* Sidebar */}
        <View style={[styles.sidebar, { width: SIDEBAR_W, backgroundColor: C.surface, borderRightColor: C.border, paddingTop: insets.top }]}>
          <View style={{ paddingHorizontal: 24, paddingVertical: 20 }}>
            <Text style={[styles.appName, { color: C.text }]}>Tunely</Text>
            <Text style={[styles.greeting, { color: C.textMuted, marginTop: 2 }]}>{getGreeting()}</Text>
          </View>

          {tabs.map((tab, i) => (
            <TouchableOpacity key={tab}
              style={[styles.sidebarItem, { borderRadius: 12, marginHorizontal: 12, marginBottom: 4 },
                activeTab === tab && { backgroundColor: C.accent + '22' }]}
              onPress={() => switchTab(tab)}>
              <Text style={styles.sidebarItemIcon}>{tabIcons[i]}</Text>
              <Text style={[styles.sidebarItemLabel, { color: activeTab === tab ? C.accent : C.text }]}>{tabLabels[i]}</Text>
            </TouchableOpacity>
          ))}

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={[styles.sidebarItem, { borderRadius: 12, marginHorizontal: 12, marginBottom: 12 }]}
            onPress={() => setIsDark(!isDark)}>
            <Text style={styles.sidebarItemIcon}>{isDark ? '☀️' : '🌙'}</Text>
            <Text style={[styles.sidebarItemLabel, { color: C.textMuted }]}>{isDark ? 'Light mode' : 'Dark mode'}</Text>
          </TouchableOpacity>
        </View>

        {/* Main column */}
        <View style={{ flex: 1, flexDirection: 'column' }}>
          {/* Desktop header */}
          <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: C.bg }]}>
            <Text style={[styles.sectionTitle, { color: C.text, margin: 0, paddingHorizontal: 0 }]}>
              {activeTab === 'home' ? 'Home' : activeTab === 'library' ? 'Library' : activeTab === 'search' ? 'Search' : 'Downloads'}
            </Text>
            <View style={styles.headerRight}>
              {/* Search bar inline on desktop */}
              <View style={[styles.desktopSearch, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={{ marginRight: 8, fontSize: 13 }}>🔍</Text>
                <TextInput
                  style={[{ flex: 1, fontSize: 14, color: C.text, padding: 0 }]}
                  placeholder="Search songs, artists…"
                  placeholderTextColor={C.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={() => doSearch(searchQuery)}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); setIsSearchMode(false); }}>
                    <Text style={{ color: C.textMuted, fontSize: 14, paddingHorizontal: 6 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={[styles.avatar, { backgroundColor: C.accent }]}>
                <Text style={styles.avatarText}>E</Text>
              </View>
            </View>
          </View>

          {/* Content area */}
          <View style={{ flex: 1 }}>
            {pageContent}
          </View>

          {/* Player bar */}
          <PlayerBar colors={C} onExpand={openNowPlaying} />
        </View>

        <NowPlayingCard visible={showNowPlaying} onClose={() => setShowNowPlaying(false)} colors={C} />
        <PlaylistModal visible={showPLModal} C={C} playlistUrl={playlistUrl} setPlaylistUrl={setPlaylistUrl}
          playlistError={playlistError} playlistLoading={playlistLoading}
          onClose={() => { setShowPLModal(false); setPlaylistUrl(''); setPlaylistError(''); }}
          onLoad={handleLoadPlaylist} />
      </View>
    );
  }

  // ── Mobile / Tablet layout ─────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <StatusBar style={C.statusBar} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
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

      {/* Scrollable content */}
      {pageContent}

      {/* PlayerBar — sits above the tab bar */}
      <PlayerBar colors={C} onExpand={openNowPlaying} />
      <NowPlayingCard visible={showNowPlaying} onClose={() => setShowNowPlaying(false)} colors={C} />

      {/* Bottom nav */}
      <View style={[styles.bottomNav, { backgroundColor: C.surface, borderTopColor: C.border, paddingBottom: insets.bottom }]}>
        {tabs.map((tab, i) => (
          <TouchableOpacity key={tab} style={styles.navItem} onPress={() => switchTab(tab)}>
            <Text style={styles.navIcon}>{tabIcons[i]}</Text>
            <Text style={[styles.navLabel, { color: activeTab === tab ? C.accent : C.textMuted }]}>{tabLabels[i]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <PlaylistModal visible={showPLModal} C={C} playlistUrl={playlistUrl} setPlaylistUrl={setPlaylistUrl}
        playlistError={playlistError} playlistLoading={playlistLoading}
        onClose={() => { setShowPLModal(false); setPlaylistUrl(''); setPlaylistError(''); }}
        onLoad={handleLoadPlaylist} />
    </View>
  );
}

// ─── Playlist Modal (extracted) ───────────────────────────────────────────────
function PlaylistModal({ visible, C, playlistUrl, setPlaylistUrl, playlistError, playlistLoading, onClose, onLoad }: {
  visible: boolean; C: Theme; playlistUrl: string; setPlaylistUrl: (v: string) => void;
  playlistError: string; playlistLoading: boolean; onClose: () => void; onLoad: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable onPress={() => {}} style={[styles.modalSheet, { backgroundColor: C.surface }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>Load Playlist</Text>
            <Text style={[styles.modalSub, { color: C.textMuted }]}>Paste a Spotify or Deezer playlist URL</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]}
              placeholder="https://..." placeholderTextColor={C.textMuted}
              value={playlistUrl} onChangeText={setPlaylistUrl}
              autoCapitalize="none" autoCorrect={false}
            />
            {playlistError ? <Text style={styles.modalError}>{playlistError}</Text> : null}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.card }]} onPress={onClose}>
                <Text style={[styles.modalBtnTxt, { color: C.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.accent }]} onPress={onLoad} disabled={playlistLoading}>
                {playlistLoading
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={[styles.modalBtnTxt, { color: '#000' }]}>Load</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <PlayerProvider>
        <InnerApp />
      </PlayerProvider>
    </SafeAreaProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  greeting: { fontSize: 13 }, appName: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  themeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#000', fontWeight: '700', fontSize: 15 },
  // Sidebar (desktop)
  sidebar: { borderRightWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  sidebarItemIcon: { fontSize: 18, width: 28 },
  sidebarItemLabel: { fontSize: 15, fontWeight: '500', marginLeft: 4 },
  // Desktop search
  desktopSearch: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, width: 260 },
  // Search bar (mobile)
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 10, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  searchIcon: { marginRight: 8, fontSize: 14 }, searchInput: { flex: 1, fontSize: 14, padding: 0 },
  clearBtn: { paddingHorizontal: 8 },
  goBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, marginLeft: 6 }, goBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  // Sections
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 20, marginBottom: 14, marginTop: 8 },
  hScroll: { paddingLeft: 20, marginBottom: 24 },
  // Card grid (desktop)
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  // Featured cards
  featuredCard: { borderRadius: 16, padding: 12, marginRight: 12, marginBottom: 12, borderWidth: 1.5 },
  featuredArt: { width: '100%', borderRadius: 10, marginBottom: 10 },
  featuredTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 }, featuredArtist: { fontSize: 11, marginBottom: 10 },
  featuredFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, featuredDuration: { fontSize: 11 },
  smallPlayBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, smallPlayBtnText: { color: '#000', fontSize: 10, fontWeight: '700' },
  // Playlist cards
  playlistCard: { marginRight: 12, marginBottom: 12 },
  playlistCover: { borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  playlistIcon: { fontSize: 40 }, playlistName: { fontSize: 13, fontWeight: '600' }, playlistCount: { fontSize: 11, marginTop: 2 },
  // Track list
  trackList: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  trackThumb: { width: 44, height: 44, borderRadius: 8, marginRight: 12 },
  trackInfo: { flex: 1 }, trackTitle: { fontSize: 14, fontWeight: '600' }, trackArtist: { fontSize: 12, marginTop: 2 }, trackDuration: { fontSize: 12, marginLeft: 8 },
  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60 }, emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  pasteBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }, pasteBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  loadBtn: { marginRight: 20, marginBottom: 14, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }, loadBtnText: { color: '#000', fontWeight: '700', fontSize: 12 },
  // Bottom nav (mobile/tablet)
  bottomNav: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 6 }, navIcon: { fontSize: 20 }, navLabel: { fontSize: 10, marginTop: 2 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 }, modalSub: { fontSize: 13, marginBottom: 20, lineHeight: 20 },
  modalInput: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 14, marginBottom: 12 }, modalError: { color: '#FF4D6D', fontSize: 13, marginBottom: 12 },
  modalBtns: { flexDirection: 'row', gap: 12 }, modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }, modalBtnTxt: { fontWeight: '700', fontSize: 15 },
});
