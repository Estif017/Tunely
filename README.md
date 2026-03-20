# Tunely

Tunely is a mobile music and video streaming app that delivers an ad-free experience with offline caching — no subscriptions, no interruptions.

## What it does

- Stream music and video from **YouTube** and **Spotify** in one place
- **Ad-free playback** via direct API access
- **Offline caching** so you can listen without a connection
- Clean, fast UI built for both iOS and Android

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo (Managed Workflow) |
| Language | TypeScript |
| Music/Video | YouTube Data API v3 |
| Catalog/Metadata | Spotify Web API |
| Navigation | Expo Router |
| State | Zustand |
| Caching | Expo FileSystem + AsyncStorage |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Expo Go app on your phone (iOS or Android)

### Install

```bash
git clone https://github.com/YOUR_USERNAME/Tunely.git
cd tunely
npm install
```

### Run

```bash
npx expo start
```

Scan the QR code with Expo Go to open the app on your device.

### Environment Variables

Create a `.env` file in the root:

```
YOUTUBE_API_KEY=your_youtube_api_key
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

## Project Structure

```
src/
  adapters/    # YouTube and Spotify API clients
  cache/       # Offline caching logic
  components/  # Reusable UI components
  models/      # Data models (Track, Playlist, User)
  screens/     # App screens
  state/       # Global state (NowPlaying, queue)
```

## License

MIT
