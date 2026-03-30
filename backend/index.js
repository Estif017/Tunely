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

const express            = require('express');
const cors               = require('cors');
const { execFile, spawn } = require('child_process');
const os                 = require('os');
const fs                 = require('fs');
const path               = require('path');

const app  = express();
const PORT = process.env.PORT || 3002;

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
opts = {
    'quiet': True,
    'no_warnings': True,
    'skip_download': True,
    'extractor_args': {'youtube': {'player_client': ['android', 'web']}},
}
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

/**
 * GET /stream/:videoId
 *
 * Downloads the best audio track via yt-dlp to a local temp file, then
 * serves it with proper Content-Length so the browser <audio> element can
 * seek.  The temp file is reused for ~1 hour before being refreshed.
 *
 * This completely avoids CORS — the browser only ever talks to localhost.
 */
const streamCache = new Map(); // videoId → { file, cachedAt }
const STREAM_CACHE_TTL = 60 * 60 * 1000; // 1 hour

app.get('/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid videoId' });
  }

  // Serve from in-memory cache if fresh
  const cached = streamCache.get(videoId);
  if (cached && Date.now() - cached.cachedAt < STREAM_CACHE_TTL && fs.existsSync(cached.file)) {
    console.log(`[stream] 🟢 cache hit → ${videoId}`);
    return serveFile(cached.file, cached.ext || 'mp4', req, res);
  }

  const tmpFile = path.join(os.tmpdir(), `tunely_${videoId}.%(ext)s`);
  console.log(`[stream] ⬇️  downloading ${videoId} via yt-dlp...`);

  const py = pythonBin();
  const args = [
    '-m', 'yt_dlp',
    '-f', 'bestaudio/best',   // take whatever is available
    '--no-playlist',
    '--no-warnings',
    '--extractor-args', 'youtube:player_client=android,web',
    '-o', tmpFile,
    '--force-overwrites',
    `https://www.youtube.com/watch?v=${videoId}`,
  ];

  const proc = spawn(py, args, { timeout: 60000 });
  proc.stderr.on('data', d => {
    const msg = d.toString().trim();
    if (msg) console.error('[yt-dlp]', msg);
  });

  proc.on('close', (code) => {
    if (code !== 0) {
      console.error(`[stream] ❌ yt-dlp exited ${code} for ${videoId}`);
      if (!res.headersSent) res.status(500).json({ error: 'yt-dlp failed' });
      return;
    }
    // Find the actual downloaded file (extension varies: m4a, webm, mp4…)
    const tmpDir  = os.tmpdir();
    const prefix  = `tunely_${videoId}.`;
    const entries = fs.readdirSync(tmpDir).filter(f => f.startsWith(prefix));
    if (entries.length === 0) {
      console.error(`[stream] ❌ no output file found for ${videoId}`);
      if (!res.headersSent) res.status(500).json({ error: 'output file missing' });
      return;
    }
    const actualFile = path.join(tmpDir, entries[0]);
    const ext = path.extname(actualFile).slice(1); // 'webm', 'm4a', 'mp4'…
    streamCache.set(videoId, { file: actualFile, ext, cachedAt: Date.now() });
    console.log(`[stream] ✅ ready → ${videoId} (${ext})`);
    serveFile(actualFile, ext, req, res);
  });

  proc.on('error', (err) => {
    console.error('[stream] spawn error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  });
});

const EXT_MIME = { m4a: 'audio/mp4', mp4: 'audio/mp4', webm: 'audio/webm', ogg: 'audio/ogg', opus: 'audio/ogg' };

function serveFile(filePath, ext, req, res) {
  const stat = fs.statSync(filePath);
  const total = stat.size;
  const range = req.headers['range'];
  const mime  = EXT_MIME[ext] || 'audio/mp4';

  res.set('Access-Control-Allow-Origin', '*');
  res.set('Content-Type', mime);
  res.set('Accept-Ranges', 'bytes');

  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(startStr, 10);
    const end   = endStr ? parseInt(endStr, 10) : total - 1;
    res.set('Content-Range', `bytes ${start}-${end}/${total}`);
    res.set('Content-Length', String(end - start + 1));
    res.status(206);
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.set('Content-Length', String(total));
    res.status(200);
    fs.createReadStream(filePath).pipe(res);
  }
}

/**
 * GET /proxy?url=<encoded CDN URL>
 *
 * Proxies a googlevideo.com (or any) audio stream through this server so that
 * browser clients don't hit CORS / mixed-content restrictions.
 *
 * expo-audio on web uses an <audio> element, which the browser blocks when the
 * src is a cross-origin URL without CORS headers.  By piping through localhost
 * the browser sees a same-origin (or explicitly CORS-allowed) stream.
 */
app.get('/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url query param' });
  }

  try {
    const rangeHeader = req.headers['range'];
    const upstream = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      },
    });

    // Forward relevant headers so the browser audio element can seek
    const contentType = upstream.headers.get('content-type') || 'audio/mp4';
    res.set('Content-Type', contentType);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Accept-Ranges', 'bytes');

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.set('Content-Length', contentLength);

    const contentRange = upstream.headers.get('content-range');
    if (contentRange) res.set('Content-Range', contentRange);

    res.status(upstream.status);

    // Pipe the upstream body straight to the client
    const { Readable } = require('stream');
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    console.error('[proxy] error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

/**
 * GET /search?q=<query>&limit=<n>
 *
 * Proxies iTunes Search API server-side to avoid CORS / musics:// redirect
 * issues that occur when the browser calls it directly.
 */
app.get('/search', async (req, res) => {
  const { q, limit = '20' } = req.query;
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Missing q query param' });
  }
  try {
    const params = new URLSearchParams({ term: q, media: 'music', entity: 'song', limit: String(limit) });
    const upstream = await fetch(`https://itunes.apple.com/search?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      redirect: 'follow',
    });
    if (!upstream.ok) return res.status(upstream.status).json({ error: `iTunes returned ${upstream.status}` });
    const data = await upstream.json();
    res.set('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) {
    console.error('[search] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🎵  Tunely stream backend  →  http://localhost:${PORT}`);
  console.log(`    /health          — status check`);
  console.log(`    /audio/<videoId> — get stream URL`);
  console.log(`    /proxy?url=<url> — CORS-safe audio proxy\n`);
});
