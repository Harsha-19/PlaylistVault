# PlaylistVault

> **Spotify Playlist Metadata Manager & Authorized Local Audio Library**  
> An enterprise-grade, local-first web application designed to bridge Spotify playlist curation with personal offline audio collections.

[![CI Quality Gate](https://github.com/your-org/playlistvault/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/playlistvault/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646cff.svg)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Overview

**PlaylistVault** provides an end-to-end workflow for importing Spotify playlists, matching them against locally stored audio files, organizing personal audio libraries, and generating self-contained offline ZIP archives. 

Engineered with a **local-first philosophy**, all audio binaries remain strictly within the user's browser IndexedDB. No audio files are ever uploaded to third-party cloud servers without explicit user request, guaranteeing user privacy and data sovereignty.

---

## Architectural Highlights

- **Local-First Audio Storage:** Uses high-capacity browser IndexedDB (`idb-keyval` / custom schema) with SHA-256 deduplication and streaming byte management.
- **OAuth 2.0 PKCE Security:** Pure RFC 7636 Authorization Code Flow with Proof Key for Code Exchange for Spotify Web API. Zero client secrets stored in the browser.
- **Intelligent Track Matching:** Multi-strategy matching engine combining exact, normalized string, Levenshtein fuzzy distance, duration tolerance windows (±3s), and ISRC code matching with explainable confidence scores.
- **Persistent Web Audio Player:** Full-featured playback bar with scrubbing, volume memory, shuffle, repeat, queue management, and automatic object URL lifecycle revocation.
- **Standalone ZIP Packaging:** Client-side JSZip archive generator creating offline packages with original audio binaries, UTF-8 M3U8 playlists, sanitized CSV manifests, and JSON summaries.
- **Supabase Cloud Sync & Backup:** Multi-tenant PostgreSQL synchronization with strict Row Level Security (RLS) and user-isolated Supabase Storage buckets for optional encrypted backup.
- **Authentic Spotify Design:** Pixel-perfect implementation of Spotify's design system (`#121212`, `#242424`, `#1ed760`, `#ffffff`, `#b3b3b3`) adhering strictly to typography, micro-interactions, and accessibility standards.

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 18, TypeScript (Strict Mode) |
| **Build & Tooling** | Vite 6, PostCSS, Autoprefixer, Tailwind CSS |
| **Routing & Navigation** | React Router DOM v6 (declarative client-side routing) |
| **State & Data Fetching**| TanStack Query v5, React Context API |
| **Audio Processing** | Web Audio API, HTML5 Audio, `music-metadata-browser` |
| **Client Storage** | IndexedDB, SessionStorage (ephemeral PKCE), LocalStorage |
| **Archive Generation** | JSZip (client-side in-memory Blob assembly) |
| **Backend & Cloud** | Supabase (PostgreSQL 15+, Auth, Storage, Row Level Security) |
| **Testing & Quality** | Vitest 3, React Testing Library, ESLint, TypeScript `tsc` |

---

## System Requirements

- **Node.js:** `^20.18.0` or `>= 22.0.0`
- **Package Manager:** `pnpm` (version `>= 9.0.0` recommended)
- **Modern Browser:** Chrome 100+, Firefox 100+, Safari 16+, Edge 100+ (requires IndexedDB and Web Audio API support)

---

## Quick Start & Local Development

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/playlistvault.git
cd playlistvault
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Configure Environment Variables
Copy the example environment template:
```bash
cp .env.example .env
```

Edit `.env` with your development credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
VITE_SPOTIFY_REDIRECT_URI=http://localhost:5173/callback
```

### 4. Run the Development Server
```bash
pnpm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Verification & Testing

PlaylistVault includes an exhaustive automated test suite covering unit tests, integration journeys, security validations, and cross-browser regressions.

```bash
# Run all tests once
pnpm run test

# Run tests in interactive watch mode
pnpm run test:watch

# Execute strict TypeScript typecheck
pnpm run typecheck

# Run ESLint across all source files
pnpm run lint

# Compile production build
pnpm run build
```

---

## Key User Journeys

```
[Connect Spotify] ➔ [Import Playlist] ➔ [Add Local Audio Files]
       │                    │                       │
       ▼                    ▼                       ▼
[Spotify OAuth PKCE]  [Fetch Tracks]         [IndexedDB Storage]
                                                    │
                                                    ▼
                                          [Intelligent Match]
                                                    │
                                                    ▼
                                          [Preview & Playback]
                                                    │
                                                    ▼
                                          [Download Offline ZIP]
                                                    │
                                                    ▼
                                        (Optional Cloud Backup)
```

1. **Spotify Authorization:** Users log in using Spotify OAuth with PKCE. Tokens are stored securely in browser session memory.
2. **Playlist Ingestion:** Paste any Spotify playlist URL or ID to retrieve tracks, cover art, release dates, and ISRCs with full pagination.
3. **Local Audio Library:** Drag-and-drop local audio files (`.mp3`, `.flac`, `.wav`, `.m4a`, `.ogg`). The app parses ID3/Vorbis tags and computes SHA-256 hashes for deduplication.
4. **Intelligent Match Engine:** Automatically correlates Spotify tracks with local audio files based on fuzzy text and audio duration. Users can inspect, approve, or manually override matches.
5. **Playback & Organization:** Listen to matched local audio with persistent playback controls and edit track metadata on the fly.
6. **Export Archive:** Package the playlist into a downloadable ZIP archive containing original audio files, an M3U8 playlist, a CSV manifest (with CSV injection defense), and a summary JSON.

---

## Deployment & Production Readiness

PlaylistVault is pre-configured for instant zero-configuration deployment to **Vercel**, **Netlify**, or **Cloudflare Pages**.

For comprehensive deployment instructions, database migration steps, OAuth configuration, and rollback strategies, see:
- [DEPLOYMENT.md](file:///d:/My%20Things/PROJECTS/Spotifyy/DEPLOYMENT.md) — Production Runbook & Hosting Guide.
- [SECURITY.md](file:///d:/My%20Things/PROJECTS/Spotifyy/SECURITY.md) — Security Architecture & Threat Model.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
