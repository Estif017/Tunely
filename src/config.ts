// This file is safe to commit — no hardcoded secrets.
// Set these in Netlify → Site settings → Environment variables.
import Constants from 'expo-constants';

// ─── API Keys (set as EXPO_PUBLIC_* in Netlify env vars) ─────────────────────
export const SPOTIFY_CLIENT_ID =
  process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';

export const SPOTIFY_CLIENT_SECRET =
  process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET ?? '';

export const YOUTUBE_API_KEY =
  process.env.EXPO_PUBLIC_YOUTUBE_API_KEY ?? '';

// ─── Stream backend URL ───────────────────────────────────────────────────────
// Resolution order:
//   1. EXPO_PUBLIC_BACKEND_URL env var  → set this in Netlify for production
//   2. Auto-detected dev machine IP     → works when scanning with Expo Go
//   3. localhost:3002 fallback          → web browser / simulator
function getBackendUrl(): string {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }

  const debuggerHost =
    (Constants.expoGoConfig as any)?.debuggerHost ??
    (Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost ??
    (Constants.manifest as any)?.debuggerHost;

  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:3002`;
    }
  }

  return 'http://localhost:3002';
}

export const STREAM_BACKEND_URL = getBackendUrl();
