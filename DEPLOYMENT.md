# PlaylistVault — Production Deployment Guide & Runbook

This document is the authoritative operational guide for deploying **PlaylistVault** to production environments.

> [!IMPORTANT]
> **Pre-Flight Notice:** This runbook prepares PlaylistVault for deployment. Never execute a public launch, activate production external credentials, or register domain names without explicit administrative authorization.

---

## 1. Architecture & Hosting Strategy

PlaylistVault is architected as a **Static Single-Page Application (SPA)** backed by a **Serverless PostgreSQL Backend (Supabase)** and the **Spotify Web API**.

```
┌─────────────────────────────────────────────────────────────┐
│                       End User Browser                      │
│                                                             │
│   ┌──────────────────────────┐  ┌────────────────────────┐  │
│   │   React 18 SPA (Vite)    │  │  IndexedDB (Local-First)│  │
│   │   TypeScript + Tailwind  │  │  Audio Binaries & Hash │  │
│   └─────────────┬────────────┘  └────────────────────────┘  │
└─────────────────┼──────────────────────────────┬────────────┘
                  │ HTTPS (Static CDN)           │ Web API (PKCE)
                  ▼                              ▼
     ┌────────────────────────┐     ┌────────────────────────┐
     │ Static Hosting CDN     │     │ Spotify Web API        │
     │ (Vercel/Netlify/CF)    │     │ Accounts & Metadata    │
     └────────────────────────┘     └────────────────────────┘
                  │
                  ▼ HTTPS / WebSockets
     ┌────────────────────────────────────────────────────────┐
     │ Supabase Cloud Platform (Optional Sync & Backup)       │
     │  - PostgreSQL 15+ (Row Level Security Enabled)         │
     │  - Supabase Auth (JWT Verification)                    │
     │  - Supabase Storage (Private Export Archive Buckets)   │
     └────────────────────────────────────────────────────────┘
```

### Key Deployment Characteristics
- **Pure Static Artifacts:** The build artifact is compiled static HTML, CSS, JavaScript, and asset files in `/dist`.
- **Zero Server Compute Required for Core Logic:** All matching, audio decoding, ID3 tag extraction, and ZIP compression execute directly in the browser Web Worker / Main Thread.
- **Client-Side SPA Routing:** All non-asset routes (`/playlists`, `/audio`, `/match`, `/player`, `/export`, `/settings`, `/callback`) must rewrite to `/index.html`.

---

## 2. Environment Variables Matrix

The client application compiles environment variables at build time using Vite's `import.meta.env` mechanism. Only variables prefixed with `VITE_` are bundled.

| Variable Name | Required | Default / Fallback | Purpose & Security Constraint |
| :--- | :---: | :---: | :--- |
| `VITE_SUPABASE_URL` | **Yes** | None | Public REST/GraphQL endpoint of your Supabase project (e.g., `https://xyz.supabase.co`). |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | None | Supabase Anonymous (public) JWT key. Safe for client exposure; Row Level Security enforces authorization. **NEVER use the `service_role` key!** |
| `VITE_SPOTIFY_CLIENT_ID` | **Yes** | None | 32-character Client ID registered in Spotify Developer Portal. Safe for client exposure. |
| `VITE_SPOTIFY_REDIRECT_URI` | No | `origin + '/callback'` | Explicit OAuth redirect callback. Defaults to `window.location.origin + '/callback'`. Must match Spotify dashboard allowlist. |
| `VITE_APP_NAME` | No | `PlaylistVault` | User-facing application branding title. |
| `VITE_APP_ENV` | No | `production` | Environment indicator (`development`, `staging`, `production`). |

> [!CAUTION]
> **Strict Secret Isolation:** Do NOT add server secrets (such as `SUPABASE_SERVICE_ROLE_KEY` or Spotify Client Secret) to environment files or CI/CD secrets. PlaylistVault's runtime environment validator (`src/lib/env.ts`) actively blocks initialization if secret key patterns are detected in the bundle.

---

## 3. Platform Deployment Guides

### Option A: Vercel (Recommended)

PlaylistVault includes an automated `vercel.json` configuration file supporting SPA rewrites and hardened HTTP headers.

1. **Connect Repository:** Import your repository in the [Vercel Dashboard](https://vercel.com/dashboard).
2. **Framework Preset:** Select **Vite**.
3. **Build Settings:**
   - **Build Command:** `pnpm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `pnpm install`
4. **Environment Variables:**
   - Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SPOTIFY_CLIENT_ID`, and `VITE_SPOTIFY_REDIRECT_URI`.
5. **Verify `vercel.json`:**
   Ensure the root `vercel.json` is deployed. It enforces:
   - `/(.*)` rewrites to `/index.html`.
   - Immutable caching for `/assets/*` (`max-age=31536000, immutable`).
   - Security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`).

### Option B: Netlify

PlaylistVault includes `netlify.toml` and `public/_redirects` for turnkey Netlify deployment.

1. **New Site from Git:** Select your GitHub/GitLab repository on [Netlify](https://app.netlify.com/).
2. **Build Settings:**
   - **Base directory:** (leave blank / root)
   - **Build command:** `pnpm run build`
   - **Publish directory:** `dist`
3. **Environment Variables:**
   Navigate to **Site Configuration > Environment Variables** and input the required `VITE_*` keys.
4. **Headers & Redirects:**
   Netlify automatically applies the redirect rule from `netlify.toml` and `dist/_redirects` (`/* /index.html 200`).

### Option C: Cloudflare Pages

1. **Create Application:** In Cloudflare Dashboard, go to **Workers & Pages > Create application > Pages > Connect to Git**.
2. **Build Settings:**
   - **Framework preset:** `Vite`
   - **Build command:** `pnpm run build`
   - **Build output directory:** `dist`
   - **Node.js version:** Set environment variable `NODE_VERSION=22`
3. **SPA Redirects:**
   Cloudflare automatically honors `public/_redirects` copied into `dist/_redirects` during build.

---

## 4. Supabase Setup & Migration Runbook

PlaylistVault uses Supabase for user authentication, metadata synchronization, and private export backups.

### Step 1: Initialize Supabase Project
1. Create a new project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Note your **Project URL** and **Anon Public API Key** from **Project Settings > API**.

### Step 2: Run Database Migrations
Migrations must be executed in exact chronological order:

```
supabase/migrations/
  ├── 20261123_phase1_initial_schema.sql         # Baseline relational schema & RLS
  ├── 20261123_phase2_spotify_schema.sql         # Playlist & Track idempotency keys
  ├── 20261123_phase4_match_schema.sql           # Track match constraints & indices
  └── 20261123_phase7_storage_backup_schema.sql  # Storage bucket & path-isolated RLS
```

**Using the Supabase CLI:**
```bash
# Link local repository to your remote Supabase project
supabase link --project-ref <your-project-id>

# Apply all pending migrations sequentially
supabase db push
```

**Using the Supabase Web SQL Editor:**
If running manually, open the **SQL Editor** in the Supabase Dashboard and execute the SQL migration files in this exact sequence:
1. `20261123_phase1_initial_schema.sql`
2. `20261123_phase2_spotify_schema.sql`
3. `20261123_phase4_match_schema.sql`
4. `20261123_phase7_storage_backup_schema.sql`

### Step 3: Configure Authentication Redirects
1. Go to **Authentication > URL Configuration** in the Supabase Dashboard.
2. Set **Site URL** to your production domain: `https://your-domain.com`.
3. Add to **Redirect URLs**:
   - `https://your-domain.com/`
   - `https://your-domain.com/callback`
   - `http://localhost:5173/` (for local development)
   - `http://localhost:5173/callback`

### Step 4: Verify Storage Bucket
Confirm that `20261123_phase7_storage_backup_schema.sql` provisioned the `export-archives` bucket:
- **Bucket ID:** `export-archives`
- **Public Access:** Disabled (`false`)
- **File Size Limit:** 1 GB (1,073,741,824 bytes)
- **Allowed MIME types:** `application/zip`, `application/x-zip-compressed`, `application/octet-stream`
- **RLS Policy:** Folder isolation ensuring users can only read/write files under their authenticated UID: `{userId}/{archiveId}/{filename}.zip`.

---

## 5. Spotify Developer Portal Configuration

1. Log in to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Create or select your application.
3. In **App Settings**:
   - Note the **Client ID** and assign it to `VITE_SPOTIFY_CLIENT_ID`.
   - Under **Redirect URIs**, add your production callback URL and development callbacks:
     - `https://your-domain.com/callback`
     - `http://localhost:5173/callback`
   - Under **Which API/SDKs are you planning to use?**, select **Web API**.
4. **User Quotas:** During development/staging, add your test user Spotify account emails under the **User Management** tab. For public production launch, submit an extension request to Spotify if users exceed 25.

---

## 6. Pre-Flight Verification & Quality Gates

Run the automated verification suite before triggering any deployment:

```bash
# 1. Typecheck
pnpm run typecheck

# 2. Linting
pnpm run lint

# 3. Complete Test Suite
pnpm run test

# 4. Production Build
pnpm run build

# 5. Local Production Preview
pnpm run preview
```

### Pre-Flight Checklist
- [ ] All 32 Vitest suites passed with 0 failures.
- [ ] TypeScript compiled cleanly without `--noEmit` errors.
- [ ] ESLint passed with 0 errors and 0 warnings.
- [ ] Vite production build succeeded with `_redirects` verified in `dist/`.
- [ ] Browser console produces 0 unhandled promise rejections on `/` and `/callback`.
- [ ] Direct refresh on sub-routes (`/playlists`, `/audio`, `/match`, `/player`, `/export`) loads the SPA without 404s.

---

## 7. Rollback Procedures

### Static Frontend Rollback
- **Vercel:** Open the project dashboard, select the previous stable deployment from the **Deployments** tab, and click **Promote to Production**. Instant rollback takes under 5 seconds.
- **Netlify:** Go to **Deploys**, select the desired previous deploy, and click **Publish deploy**.
- **Cloudflare Pages:** Navigate to **Deployments**, locate the last successful build, and select **Rollback**.

### Database Migration Rollback
The database schema changes from Phases 1–7 are non-destructive and backward compatible. If a rollback is needed:
1. Schema alterations (`ADD COLUMN IF NOT EXISTS`) and unique constraints do not break older client code.
2. If table drops or policy reverts are required, execute targeted rollback scripts through the Supabase SQL Editor. Always snapshot or export data before schema changes.
