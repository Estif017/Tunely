import { StatusBar } from 'expo-status-bar';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

const COLORS = {
  bg: '#0D0D0D',
  surface: '#1A1A1A',
  card: '#222222',
  accent: '#1DB954',
  accentAlt: '#FF4D6D',
  text: '#FFFFFF',
  textMuted: '#9B9B9B',
  border: '#2A2A2A',
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

function FeaturedCard({ title, artist, duration, color }: { title: string; artist: string; duration: string; color: string }) {
  return (
    <TouchableOpacity style={[styles.featuredCard, { backgroundColor: color + '22', borderColor: color + '44' }]}>
      <View style={[styles.featuredArt, { backgroundColor: color + '55' }]}>
        <Text style={styles.featuredArtIcon}>♫</Text>
      </View>
      <Text style={styles.featuredTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.featuredArtist} numberOfLines={1}>{artist}</Text>
      <View style={styles.featuredFooter}>
        <Text style={styles.featuredDuration}>{duration}</Text>
        <TouchableOpacity style={[styles.playBtn, { backgroundColor: color }]}>
          <Text style={styles.playBtnText}>▶</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function TrackRow({ title, artist, duration, color }: { title: string; artist: string; duration: string; color: string }) {
  return (
    <TouchableOpacity style={styles.trackRow}>
      <View style={[styles.trackThumb, { backgroundColor: color + '44' }]}>
        <Text style={styles.trackThumbIcon}>♪</Text>
      </View>
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.trackArtist} numberOfLines={1}>{artist}</Text>
      </View>
      <Text style={styles.trackDuration}>{duration}</Text>
      <TouchableOpacity style={styles.trackMore}>
        <Text style={styles.trackMoreText}>⋯</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function PlaylistCard({ name, count, color }: { name: string; count: number; color: string }) {
  return (
    <TouchableOpacity style={styles.playlistCard}>
      <View style={[styles.playlistCover, { backgroundColor: color + '33' }]}>
        <Text style={[styles.playlistIcon, { color }]}>♬</Text>
      </View>
      <Text style={styles.playlistName} numberOfLines={1}>{name}</Text>
      <Text style={styles.playlistCount}>{count} tracks</Text>
    </TouchableOpacity>
  );
}

export default function App() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good evening 👋</Text>
            <Text style={styles.appName}>Tunely</Text>
          </View>
          <TouchableOpacity style={styles.avatar}>
            <Text style={styles.avatarText}>E</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TouchableOpacity style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search songs, artists, albums…</Text>
        </TouchableOpacity>

        {/* Featured */}
        <Text style={styles.sectionTitle}>Trending Now</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {featuredTracks.map(t => (
            <FeaturedCard key={t.id} {...t} />
          ))}
        </ScrollView>

        {/* Playlists */}
        <Text style={styles.sectionTitle}>Your Playlists</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {playlists.map(p => (
            <PlaylistCard key={p.id} {...p} />
          ))}
        </ScrollView>

        {/* Recent Tracks */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recently Played</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.trackList}>
          {recentTracks.map(t => (
            <TrackRow key={t.id} {...t} />
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Now Playing Bar */}
      <View style={styles.nowPlaying}>
        <View style={[styles.nowPlayingThumb, { backgroundColor: COLORS.accent + '33' }]}>
          <Text style={{ color: COLORS.accent, fontSize: 14 }}>♫</Text>
        </View>
        <View style={styles.nowPlayingInfo}>
          <Text style={styles.nowPlayingTitle}>Blinding Lights</Text>
          <Text style={styles.nowPlayingArtist}>The Weeknd</Text>
        </View>
        <TouchableOpacity style={styles.nowPlayingBtn}>
          <Text style={styles.nowPlayingBtnText}>⏮</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.nowPlayingBtn, styles.nowPlayingPlay]}>
          <Text style={[styles.nowPlayingBtnText, { color: '#000', fontSize: 12 }]}>▶</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nowPlayingBtn}>
          <Text style={styles.nowPlayingBtnText}>⏭</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        {[['🏠', 'Home'], ['🔍', 'Search'], ['📚', 'Library'], ['⬇️', 'Downloads']].map(([icon, label]) => (
          <TouchableOpacity key={label} style={styles.navItem}>
            <Text style={styles.navIcon}>{icon}</Text>
            <Text style={[styles.navLabel, label === 'Home' && { color: COLORS.accent }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  greeting: { color: COLORS.textMuted, fontSize: 13 },
  appName: { color: COLORS.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#000', fontWeight: '700', fontSize: 16 },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 24, borderWidth: 1, borderColor: COLORS.border },
  searchIcon: { marginRight: 8, fontSize: 14 },
  searchPlaceholder: { color: COLORS.textMuted, fontSize: 14 },

  // Sections
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 20 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', paddingHorizontal: 20, marginBottom: 14 },
  seeAll: { color: COLORS.accent, fontSize: 13, fontWeight: '600', marginBottom: 14 },
  horizontalScroll: { paddingLeft: 20, marginBottom: 28 },

  // Featured Card
  featuredCard: { width: 150, borderRadius: 16, padding: 14, marginRight: 12, borderWidth: 1 },
  featuredArt: { width: '100%', height: 100, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  featuredArtIcon: { fontSize: 32 },
  featuredTitle: { color: COLORS.text, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  featuredArtist: { color: COLORS.textMuted, fontSize: 11, marginBottom: 10 },
  featuredFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  featuredDuration: { color: COLORS.textMuted, fontSize: 11 },
  playBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  playBtnText: { color: '#000', fontSize: 10, fontWeight: '700' },

  // Playlist Card
  playlistCard: { width: 120, marginRight: 12 },
  playlistCover: { width: 120, height: 120, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  playlistIcon: { fontSize: 40 },
  playlistName: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  playlistCount: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },

  // Track Row
  trackList: { paddingHorizontal: 20 },
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  trackThumb: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  trackThumbIcon: { fontSize: 18 },
  trackInfo: { flex: 1 },
  trackTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  trackArtist: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  trackDuration: { color: COLORS.textMuted, fontSize: 12, marginRight: 12 },
  trackMore: { padding: 4 },
  trackMoreText: { color: COLORS.textMuted, fontSize: 18 },

  // Now Playing Bar
  nowPlaying: { position: 'absolute', bottom: 64, left: 12, right: 12, backgroundColor: COLORS.surface, borderRadius: 14, flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1, borderColor: COLORS.border },
  nowPlayingThumb: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  nowPlayingInfo: { flex: 1 },
  nowPlayingTitle: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  nowPlayingArtist: { color: COLORS.textMuted, fontSize: 11 },
  nowPlayingBtn: { padding: 8 },
  nowPlayingBtnText: { color: COLORS.text, fontSize: 16 },
  nowPlayingPlay: { backgroundColor: COLORS.accent, borderRadius: 20, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', padding: 0 },

  // Bottom Nav
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 64, backgroundColor: COLORS.surface, flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIcon: { fontSize: 18 },
  navLabel: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
});
