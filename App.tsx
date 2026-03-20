import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

const DARK = {
  bg: '#1C1C1E',
  surface: '#2C2C2E',
  card: '#3A3A3C',
  accent: '#1DB954',
  text: '#FFFFFF',
  textMuted: '#AEAEB2',
  border: '#3A3A3C',
  statusBar: 'light' as const,
};

const LIGHT = {
  bg: '#F2F2F7',
  surface: '#FFFFFF',
  card: '#E5E5EA',
  accent: '#1DB954',
  text: '#1C1C1E',
  textMuted: '#6C6C70',
  border: '#D1D1D6',
  statusBar: 'dark' as const,
};

const featuredTracks = [
  { id: '1', title: 'Blinding Lights', artist: 'The Weeknd', duration: '3:22', color: '#FF4D6D' },
  { id: '2', title: 'As It Was', artist: 'Harry Styles', duration: '2:37', color: '#4D9FFF' },
  { id: '3', title: 'Flowers', artist: 'Miley Cyrus', duration: '3:20', color: '#FFB74D' },
  { id: '4', title: 'Unholy', artist: 'Sam Smith', duration: '2:56', color: '#B44DFF' },
];

const recentTracks = [
  { id: '5', title: 'Anti-Hero', artist: 'Taylor Swift', duration: '3:21', color: '#FF6B9D' },
  { id: '6', title: 'Calm Down', artist: 'Rema', duration: '3:35', color: '#4DFFB4' },
  { id: '7', title: 'Escapism', artist: 'RAYE', duration: '3:17', color: '#FFD54D' },
  { id: '8', title: 'Snooze', artist: 'SZA', duration: '3:22', color: '#4DB8FF' },
  { id: '9', title: 'Die For You', artist: 'The Weeknd', duration: '4:20', color: '#FF7043' },
];

const playlists = [
  { id: 'p1', name: 'Chill Vibes', count: 24, color: '#1DB954' },
  { id: 'p2', name: 'Workout Mix', count: 18, color: '#FF4D6D' },
  { id: 'p3', name: 'Late Night', count: 31, color: '#4D9FFF' },
];

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const C = isDark ? DARK : LIGHT;

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <StatusBar style={C.statusBar} />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: C.textMuted }]}>Good evening 👋</Text>
            <Text style={[styles.appName, { color: C.text }]}>Tunely</Text>
          </View>
          <View style={styles.headerRight}>
            {/* Theme switcher */}
            <TouchableOpacity
              style={[styles.themeBtn, { backgroundColor: C.surface, borderColor: C.border }]}
              onPress={() => setIsDark(!isDark)}
            >
              <Text style={styles.themeBtnIcon}>{isDark ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.avatar, { backgroundColor: C.accent }]}>
              <Text style={styles.avatarText}>E</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <TouchableOpacity style={[styles.searchBar, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={[styles.searchPlaceholder, { color: C.textMuted }]}>Search songs, artists, albums…</Text>
        </TouchableOpacity>

        {/* Featured */}
        <Text style={[styles.sectionTitle, { color: C.text }]}>Trending Now</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {featuredTracks.map(t => (
            <TouchableOpacity key={t.id} style={[styles.featuredCard, { backgroundColor: t.color + '22', borderColor: t.color + '44' }]}>
              <View style={[styles.featuredArt, { backgroundColor: t.color + '55' }]}>
                <Text style={styles.featuredArtIcon}>♫</Text>
              </View>
              <Text style={[styles.featuredTitle, { color: C.text }]} numberOfLines={1}>{t.title}</Text>
              <Text style={[styles.featuredArtist, { color: C.textMuted }]} numberOfLines={1}>{t.artist}</Text>
              <View style={styles.featuredFooter}>
                <Text style={[styles.featuredDuration, { color: C.textMuted }]}>{t.duration}</Text>
                <TouchableOpacity style={[styles.playBtn, { backgroundColor: t.color }]}>
                  <Text style={styles.playBtnText}>▶</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Playlists */}
        <Text style={[styles.sectionTitle, { color: C.text }]}>Your Playlists</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {playlists.map(p => (
            <TouchableOpacity key={p.id} style={styles.playlistCard}>
              <View style={[styles.playlistCover, { backgroundColor: p.color + '33' }]}>
                <Text style={[styles.playlistIcon, { color: p.color }]}>♬</Text>
              </View>
              <Text style={[styles.playlistName, { color: C.text }]} numberOfLines={1}>{p.name}</Text>
              <Text style={[styles.playlistCount, { color: C.textMuted }]}>{p.count} tracks</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Recent Tracks */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>Recently Played</Text>
          <TouchableOpacity style={{ paddingRight: 20, marginBottom: 14 }}>
            <Text style={[styles.seeAll, { color: C.accent }]}>See all</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.trackList, { backgroundColor: C.surface, borderColor: C.border }]}>
          {recentTracks.map((t, i) => (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.trackRow,
                { borderBottomColor: C.border },
                i === recentTracks.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={[styles.trackThumb, { backgroundColor: t.color + '44' }]}>
                <Text style={styles.trackThumbIcon}>♪</Text>
              </View>
              <View style={styles.trackInfo}>
                <Text style={[styles.trackTitle, { color: C.text }]} numberOfLines={1}>{t.title}</Text>
                <Text style={[styles.trackArtist, { color: C.textMuted }]} numberOfLines={1}>{t.artist}</Text>
              </View>
              <Text style={[styles.trackDuration, { color: C.textMuted }]}>{t.duration}</Text>
              <TouchableOpacity style={styles.trackMore}>
                <Text style={[styles.trackMoreText, { color: C.textMuted }]}>⋯</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 130 }} />
      </ScrollView>

      {/* Now Playing Bar */}
      <View style={[styles.nowPlaying, { backgroundColor: C.surface, borderColor: C.border }]}>
        <View style={[styles.nowPlayingThumb, { backgroundColor: C.accent + '33' }]}>
          <Text style={{ color: C.accent, fontSize: 14 }}>♫</Text>
        </View>
        <View style={styles.nowPlayingInfo}>
          <Text style={[styles.nowPlayingTitle, { color: C.text }]}>Blinding Lights</Text>
          <Text style={[styles.nowPlayingArtist, { color: C.textMuted }]}>The Weeknd</Text>
        </View>
        <TouchableOpacity style={styles.nowPlayingBtn}>
          <Text style={[styles.nowPlayingBtnText, { color: C.text }]}>⏮</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.nowPlayingBtn, styles.nowPlayingPlay, { backgroundColor: C.accent }]}>
          <Text style={[styles.nowPlayingBtnText, { color: '#000', fontSize: 12 }]}>▶</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nowPlayingBtn}>
          <Text style={[styles.nowPlayingBtnText, { color: C.text }]}>⏭</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Nav */}
      <View style={[styles.bottomNav, { backgroundColor: C.surface, borderTopColor: C.border }]}>
        {[['🏠', 'Home'], ['🔍', 'Search'], ['📚', 'Library'], ['⬇️', 'Downloads']].map(([icon, label]) => (
          <TouchableOpacity key={label} style={styles.navItem}>
            <Text style={styles.navIcon}>{icon}</Text>
            <Text style={[styles.navLabel, { color: label === 'Home' ? C.accent : C.textMuted }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  greeting: { fontSize: 13 },
  appName: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  themeBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  themeBtnIcon: { fontSize: 18 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#000', fontWeight: '700', fontSize: 16 },

  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 24, borderWidth: 1 },
  searchIcon: { marginRight: 8, fontSize: 14 },
  searchPlaceholder: { fontSize: 14 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 20, marginBottom: 14 },
  seeAll: { fontSize: 13, fontWeight: '600' },
  horizontalScroll: { paddingLeft: 20, marginBottom: 28 },

  featuredCard: { width: 150, borderRadius: 16, padding: 14, marginRight: 12, borderWidth: 1 },
  featuredArt: { width: '100%', height: 100, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  featuredArtIcon: { fontSize: 32 },
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

  trackList: { marginHorizontal: 20, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1 },
  trackThumb: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  trackThumbIcon: { fontSize: 18 },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 14, fontWeight: '600' },
  trackArtist: { fontSize: 12, marginTop: 2 },
  trackDuration: { fontSize: 12, marginRight: 12 },
  trackMore: { padding: 4 },
  trackMoreText: { fontSize: 18 },

  nowPlaying: { position: 'absolute', bottom: 64, left: 12, right: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1 },
  nowPlayingThumb: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  nowPlayingInfo: { flex: 1 },
  nowPlayingTitle: { fontSize: 13, fontWeight: '700' },
  nowPlayingArtist: { fontSize: 11 },
  nowPlayingBtn: { padding: 8 },
  nowPlayingBtnText: { fontSize: 16 },
  nowPlayingPlay: { borderRadius: 20, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', padding: 0 },

  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 64, flexDirection: 'row', borderTopWidth: 1 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIcon: { fontSize: 18 },
  navLabel: { fontSize: 10, marginTop: 2 },
});
