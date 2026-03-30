# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend
npm install               # install dependencies
npx expo start            # dev server (web + QR for Expo Go)
npx expo start --web      # web only
npx expo export --platform web  # production web build → dist/

# Backend (separate process, required for audio streaming)
cd backend && npm install
cd backend && node index.js     # runs on port 3002

# Type checking
npx tsc --noEmit
```

## Architecture

Tunely is an Expo (React Native) music streaming app with a Node.js stream backend. The frontend and backend are deployed separately.

### Audio Playback Pipeline

This is the core of the app. A track play goes through these steps in order:

```
playTrack(track)
  → resolveTrackStream(track)       [src/services/playbackResolver.ts]
      → getCachedStream(track.id)   [AsyncStorage, 6hr TTL]
      → matchTrackToYouTube(track)  [YouTube Data API v3 search + scoring]
      → extractStreamUrl(videoId)   [platform-specific, see below]
      → setCachedStream(...)
      fallback: track.streamUrl     [iTunes 30s preview, always playable]
  → player.replace({ uri })         [expo-audio useAudioPlayer]
```

**Platform split in `extractStreamUrl` (src/adapters/streamExtractor.ts):**
- **Web**: calls `GET /audio/:videoId` on the backend (yt-dlp extracts a CDN URL, fast), then plays via `GET /proxy?url=<encoded>` (backend pipes bytes — no download wait, no CORS)
- **Native**: uses `GET /stream/:videoId` (backend runs yt-dlp to download the full file, caches it on disk, serves with Range support for seeking)

The fallback to `track.streamUrl` (iTunes 30s MP3 preview) fires if the YouTube match, yt-dlp extraction, or backend call fails at any point.

### Backend (`backend/index.js`)

Express app on port `process.env.PORT` (Railway sets this) or 3002. Key endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /stream/:videoId` | Download full audio via yt-dlp, cache to tmpdir, serve with Range support |
| `GET /audio/:videoId` | Run yt-dlp in info-only mode, return CDN URL as JSON (used by web) |
| `GET /proxy?url=` | Pipe any CDN audio URL through the server (bypasses CORS for web) |
| `GET /search?q=` | Proxy iTunes Search API (bypasses browser CORS) |
| `GET /health` | Health check |

Requires Python 3 + yt-dlp (`pip install yt-dlp`) and ffmpeg. The `backend/requirements.txt` and `backend/nixpacks.toml` handle this on Railway.

### Frontend State

All playback state lives in `src/state/usePlayer.tsx` via React Context + `expo-audio`'s `useAudioPlayer`. Wrap the root with `<PlayerProvider>`, call `usePlayer()` anywhere.

### Config (`src/config.ts`)

Reads API keys from `EXPO_PUBLIC_*` environment variables. The backend URL is resolved in priority order:
1. `EXPO_PUBLIC_BACKEND_URL` (set in Netlify env vars for production)
2. Expo CLI dev server host (auto-detected for Expo Go on a real device)
3. `http://localhost:3002` (fallback for local browser dev)

`src/config.ts` is committed to git (no secrets in the file itself).

### Catalog Adapters

- **iTunes** (`src/adapters/iTunesAdapter.ts`) — primary search and home screen; calls `/search` on the backend to bypass CORS; 30s MP3 previews are the `streamUrl` fallback
- **Deezer** (`src/adapters/DeezerAdapter.ts`) — playlist loading via public API (no auth); also has 30s previews
- **Spotify** (`src/adapters/SpotifyAdapter.ts`) — client credentials flow, metadata only (no audio)
- **YouTube** (`src/adapters/youtube.ts`) — scores search results with boost/penalty terms to pick the best audio match

### Responsive Layout (`App.tsx`)

Single-file app layout with three breakpoints using `useWindowDimensions`:
- `< 600px` — mobile: bottom nav, horizontal card scrolls
- `600–1023px` — tablet: same but wider
- `≥ 1024px` — desktop: 220px left sidebar, card grid layout, inline search bar

### Deployment

| Service | What | Trigger |
|---|---|---|
| **Netlify** | Frontend static build (`dist/`) | push to `master` |
| **Railway** | Backend Node.js + Python/yt-dlp | push to `master` |

Netlify build command: `npx expo export --platform web`. Required env var: `EXPO_PUBLIC_BACKEND_URL=https://<railway-url>`.
