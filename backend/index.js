/**
 * Tunely Stream Backend
 *
 * Uses yt-dlp (Nix binary, installed via nixpacks.toml) to resolve YouTube
 * videoIds to direct audio URLs.
 *
 * HOW TO RUN:
 *   cd backend && node index.js
 *
 * REQUIREMENTS:
 *   - yt-dlp in PATH  (on Railway: installed via nixpacks.toml)
 *   - ffmpeg in PATH  (on Railway: installed via nixpacks.toml)
 *   - Node.js 16+
 *
 * Local dev: install yt-dlp with  pip install yt-dlp  or  brew install yt-dlp
 */

const express             = require('express');
const cors                = require('cors');
const { execFile, spawn } = require('child_process');
const os                  = require('os');
const fs                  = require('fs');
const path                = require('path');

const app  = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract a direct audio CDN URL for a YouTube video using yt-dlp --dump-json.
 * Returns { url, ext, abr, title } or throws.
 */
function resolveWithYtDlp(videoId) {
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '-f', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best',
      '--no-warnings',
      '--no-playlist',
      '--extractor-args', 'youtube:player_client=android,web',
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    execFile('yt-dlp', args, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(err.message));
      try {
        const jsonLine = stdout.split('\n').find(l => l.trim().startsWith('{'));
        if (!jsonLine) return reject(new Error('No JSON output from yt-dlp'));
        const info = JSON.parse(jsonLine);
        const url  = info.url || info.formats?.find(f => f.acodec !== 'none')?.url;
        if (!url) return reject(new Error('No playable audio URL found'));
        resolve({ url, ext: info.ext || '?', abr: info.abr || null, title: info.title || '' });
      } catch (e) {
        reject(new Error('Failed to parse yt-dlp output: ' + stdout.slice(0, 200)));
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
 * serves it with proper Content-Length and Range support for seeking.
 * Used by native (iOS/Android) clients only.
 */
const streamCache    = new Map();
const STREAM_CACHE_TTL = 60 * 60 * 1000; // 1 hour

app.get('/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid videoId' });
  }

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
  proc.stderr?.on('data', d => {
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
  console.log(`    /audio/<videoId> — get CDN URL via yt-dlp`);
  console.log(`    /proxy?url=<url> — CORS-safe audio proxy\n`);
});
