/**
 * Tunely Stream Backend
 *
 * Uses yt-dlp (native binary) to resolve a YouTube videoId to a direct,
 * playable audio URL.
 *
 * HOW TO RUN:
 *   cd backend && node index.js
 *
 * REQUIREMENTS:
 *   - yt-dlp binary in PATH  (https://github.com/yt-dlp/yt-dlp)
 *   - ffmpeg in PATH
 *   - Node.js 16+
 *
 * For production, deploy to Railway (nixpacks.toml installs yt-dlp + ffmpeg).
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

/**
 * Run yt-dlp (native binary) to extract a direct stream URL for a YouTube video.
 * Returns { url, ext, abr, title } or throws.
 */
function resolveWithYtDlp(videoId) {
  return new Promise((resolve, reject) => {
    const args = [
      '--no-playlist',
      '--no-warnings',
      '--skip-download',
      '--print', '%(url)s\t%(ext)s\t%(abr)s\t%(title)s',
      '-f', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best',
      '--extractor-args', 'youtube:player_client=android,web',
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    execFile('yt-dlp', args, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(err.message));
      const line = stdout.trim().split('\n').find(l => l.includes('\t'));
      if (!line) return reject(new Error('No output from yt-dlp'));
      const [url, ext, abr, ...titleParts] = line.split('\t');
      if (!url || url === 'NA') return reject(new Error('No playable format found'));
      resolve({ url, ext: ext || '?', abr: parseFloat(abr) || null, title: titleParts.join('\t') });
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
    console.log(`[audio] resolving ${videoId}...`);
    const result = await resolveWithYtDlp(videoId);
    console.log(`[audio] ✅ ${videoId} → ${result.ext} ${result.abr ?? '?'}kbps — "${result.title}"`);
    res.set('Cache-Control', 'public, max-age=14400');
    res.json(result);
  } catch (err) {
    console.error(`[audio] ❌ ${videoId}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /stream/:videoId
 *
 * Downloads the best audio track via yt-dlp to a local temp file, then
 * serves it with proper Content-Length so seekable playback works.
 * The temp file is reused for ~1 hour (in-memory cache).
 */
const streamCache = new Map(); // videoId → { file, ext, cachedAt }
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

  const args = [
    '-f', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best',
    '--no-playlist',
    '--no-warnings',
    '--extractor-args', 'youtube:player_client=android,web',
    '-o', tmpFile,
    '--force-overwrites',
    `https://www.youtube.com/watch?v=${videoId}`,
  ];

  const proc = spawn('yt-dlp', args, { timeout: 60000 });
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
    const tmpDir  = os.tmpdir();
    const prefix  = `tunely_${videoId}.`;
    const entries = fs.readdirSync(tmpDir).filter(f => f.startsWith(prefix));
    if (entries.length === 0) {
      console.error(`[stream] ❌ no output file found for ${videoId}`);
      if (!res.headersSent) res.status(500).json({ error: 'output file missing' });
      return;
    }
    const actualFile = path.join(tmpDir, entries[0]);
    const ext = path.extname(actualFile).slice(1);
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
  const stat  = fs.statSync(filePath);
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
 * Pipes the upstream audio stream through this server to avoid browser CORS.
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      },
    });

    const contentType = upstream.headers.get('content-type') || 'audio/mp4';
    res.set('Content-Type', contentType);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Accept-Ranges', 'bytes');

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.set('Content-Length', contentLength);

    const contentRange = upstream.headers.get('content-range');
    if (contentRange) res.set('Content-Range', contentRange);

    res.status(upstream.status);

    const { Readable } = require('stream');
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    console.error('[proxy] error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

/**
 * GET /search?q=<query>&limit=<n>
 * Proxies iTunes Search API to avoid browser CORS.
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎵  Tunely stream backend  →  http://0.0.0.0:${PORT}`);
  console.log(`    /health          — status check`);
  console.log(`    /audio/<videoId> — get stream URL`);
  console.log(`    /proxy?url=<url> — CORS-safe audio proxy\n`);
});
