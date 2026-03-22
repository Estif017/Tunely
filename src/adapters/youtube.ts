import { Track } from '../models';
import { YOUTUBE_API_KEY } from '../config';

const YT_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

// Words that strongly suggest this is the right kind of video
const BOOST_TERMS = ['official audio', 'audio only', 'lyrics', 'official music', 'full song'];

// Words that suggest it might NOT be the right video
const PENALTY_TERMS = ['live', 'cover', 'remix', 'karaoke', 'instrumental', 'reaction', 'tutorial'];

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    description: string;
  };
}

/**
 * Score a YouTube search result against a Track.
 * Higher score = better match.
 */
function scoreResult(item: YouTubeSearchItem, track: Track): number {
  const title = item.snippet.title.toLowerCase();
  const channel = item.snippet.channelTitle.toLowerCase();
  let score = 0;

  // Boost: title contains the track artist and title
  if (title.includes(track.artist.toLowerCase())) score += 20;
  if (title.includes(track.title.toLowerCase())) score += 20;

  // Boost: channel name matches artist (official channel)
  if (channel.includes(track.artist.toLowerCase())) score += 15;

  // Boost: contains high-quality audio indicators
  for (const term of BOOST_TERMS) {
    if (title.includes(term)) score += 10;
  }

  // Penalty: likely wrong type of video
  const trackIsLive = track.title.toLowerCase().includes('live');
  const trackIsRemix = track.title.toLowerCase().includes('remix');

  for (const term of PENALTY_TERMS) {
    if (title.includes(term)) {
      // Don't penalise if the track itself is live/remix
      if (term === 'live' && trackIsLive) continue;
      if (term === 'remix' && trackIsRemix) continue;
      score -= 15;
    }
  }

  return score;
}

/**
 * Brick 3 — YouTube Matcher
 *
 * Searches YouTube Data API v3 for the best matching video for a track.
 * Returns the videoId of the highest-scoring result, or null if nothing found.
 */
export async function matchTrackToYouTube(track: Track): Promise<string | null> {
  if (!YOUTUBE_API_KEY) {
    console.warn('[youtube] No API key — skipping YouTube match');
    return null;
  }

  const query = `${track.artist} ${track.title} audio`;

  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    videoCategoryId: '10', // Music
    maxResults: '5',
    key: YOUTUBE_API_KEY,
  });

  try {
    const res = await fetch(`${YT_SEARCH_URL}?${params.toString()}`);

    if (!res.ok) {
      const body = await res.text();
      console.error(`[youtube] Search failed ${res.status}:`, body);
      return null;
    }

    const data = await res.json();
    const items: YouTubeSearchItem[] = data.items ?? [];

    if (items.length === 0) {
      console.warn('[youtube] No results for:', query);
      return null;
    }

    // Score each result and pick the best one
    const scored = items.map((item) => ({
      videoId: item.id.videoId,
      score: scoreResult(item, track),
      title: item.snippet.title,
    }));

    scored.sort((a, b) => b.score - a.score);

    console.log('[youtube] Best match:', scored[0].title, '(score:', scored[0].score, ')');
    return scored[0].videoId;
  } catch (err) {
    console.error('[youtube] matchTrackToYouTube error:', err);
    return null;
  }
}
