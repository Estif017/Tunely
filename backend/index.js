/**
 * Tunely Stream Backend
 *
 * Uses Python's yt-dlp to resolve a YouTube videoId to a direct, playable URL.
 * Returns a googlevideo.com CDN URL that expo-audio can stream directly.
 *
 * HOW TO RUN:
 *   cd backend && node index.js
 *
 * REQUIREMENTS:
 *   - Python 3.x with yt-dlp installed  (pip install yt-dlp)
 *   - Node.js 16+
 *
 * For Expo Go on a physical phone, set STREAM_BACKEND_URL in src/config.ts
 * to your machine's local IP:  http://192.168.x.x:3001
 *
 * For production, deploy to Railway / Render / Fly.io (all have free tiers).
 */

const express = require('express');
const cors    = require('cors');
const { execFile } = require('child_process');
const os      = require('os');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Detect the python binary name available on this machine */
function pythonBin() {
  return os.platform() === 'win32' ? 'python' : 'python3';
}

/**
 * Run yt-dlp via Python to get a direct stream URL for a YouTube video.
 * Returns the best available audio URL (prefers m4a, falls back to mp4).
 */
function resolveWithYtDlp(videoId) {
  return new Promise((resolve, reject) => {
    const script = `
import yt_dlp, json, sys
opts = {'quiet': True, 'no_warnings': True, 'skip_download': True}
try:
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info('https://www.youtube.com/watch?v=${videoId}', download=False)
        fmts = info.get('formats', [])
        # Prefer audio-only formats (no video codec)
        audio_only = [f for f in fmts if f.get('vcodec') == 'none' and f.get('acodec') not in (None, 'none') and f.get('url')]
        # Fall back to combined formats that have audio (e.g. format 18)
        combined   = [f for f in fmts if f.get('acodec') not in (None, 'none') and f.get('url') and f.get('ext') in ('mp4','m4a','webm')]
        candidates = audio_only or combined
        # Sort: prefer m4a/mp4, higher bitrate
        candidates.sort(key=lambda f: (0 if f.get('ext') in ('m4a','mp4') else 1, -(f.get('abr') or f.get('tbr') or 0)))
        best = candidates[0] if candidates else None
        if best:
            print(json.dumps({'url': best['url'], 'ext': best.get('ext','?'), 'abr': best.get('abr'), 'title': info.get('title','')}))
        else:
            print(json.dumps({'error': 'No playable format found'}))
except Exception as e:
    print(json.dumps({'error': str(e)}))
`;
    execFile(pythonBin(), ['-c', script], { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(err.message));
      try {
        // stdout may have a deprecation warning line before the JSON — find the JSON line
        const jsonLine = stdout.split('\n').find(l => l.trim().startsWith('{'));
        if (!jsonLine) return reject(new Error('No JSON output from yt-dlp'));
        const result = JSON.parse(jsonLine);
        if (result.error) return reject(new Error(result.error));
        resolve(result);
      } catch (e) {
        reject(new Error('Failed to parse yt-dlp output: ' + stdout.substring(0, 200)));
      }
    });
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'tunely-stream-backend' });
});

/**
 * GET /audio/:videoId
 * Returns: { url, ext, abr, title }
 * Error:   { error }
 */
app.get('/audio/:videoId', async (req, res) => {
  const { videoId } = req.params;

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid videoId' });
  }

  try {
    console.log(`[stream] resolving ${videoId}...`);
    const result = await resolveWithYtDlp(videoId);
    console.log(`[stream] ✅ ${videoId} → ${result.ext} ${result.abr ?? '?'}kbps — "${result.title}"`);
    // Cache for 4 hours (googlevideo.com URLs expire after ~6h)
    res.set('Cache-Control', 'public, max-age=14400');
    res.json(result);
  } catch (err) {
    console.error(`[stream] ❌ ${videoId}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🎵  Tunely stream backend  →  http://localhost:${PORT}`);
  console.log(`    /health          — status check`);
  console.log(`    /audio/<videoId> — get stream URL\n`);
});
