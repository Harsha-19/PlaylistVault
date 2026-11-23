# PlaylistVault — Security Architecture & Threat Model

This document outlines the security architecture, threat model, mitigation strategies, and responsible disclosure policy for **PlaylistVault**.

---

## 1. Security Architecture Overview

PlaylistVault is designed around a **zero-trust, local-first** operational model. User audio files, cryptographic hashes, and private library data remain on the client machine by default, eliminating server-side audio leakage vectors.

```
+-------------------------------------------------------------------------+
|                              THREAT BOUNDARY                            |
|                                                                         |
|  [Browser Local Sandbox]                                                |
|  +-------------------------------------------------------------------+  |
|  | - Audio Binaries: Stored only in IndexedDB (origin-isolated)      |  |
|  | - PKCE Ephemeral State: sessionStorage only (auto-clears)         |  |
|  | - Object URLs: Immediate revocation on unmount/replacement        |  |
|  | - CSV Export: Sanitized against Formula Injection (OWASP)         |  |
|  | - ZIP Creation: Sanitized filenames against ZIP Slip traversal    |  |
|  +-------------------------------------------------------------------+  |
|                                     │                                   |
|                          HTTPS only │ (TLS 1.3)                         |
|                                     ▼                                   |
|  [External Services]                                                    |
|  +----------------------------------+--------------------------------+  |
|  | Spotify Web API                  | Supabase PostgreSQL + Storage  |  |
|  | - RFC 7636 OAuth PKCE            | - Strict Row Level Security    |  |
|  | - No Client Secret on Frontend   | - User Path Isolation Policy   |  |
|  | - Scoped Permissions             | - JWT-based Authorization      |  |
|  +----------------------------------+--------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## 2. Threat Model & Mitigations

### 2.1 Spotify OAuth 2.0 PKCE (RFC 7636)
- **Threat:** Interception of authorization codes or compromise of client credentials on public browser clients.
- **Mitigation:**
  - **No Client Secret:** Client applications cannot securely store secrets. PlaylistVault exclusively utilizes the **Authorization Code Flow with Proof Key for Code Exchange (PKCE)**.
  - **Cryptographic Verifier:** A high-entropy cryptographic `code_verifier` (43–128 characters) is generated using `crypto.getRandomValues()`.
  - **Code Challenge:** A SHA-256 hash (`code_challenge`) is sent during the initial authorization request. Only the client possessing the original unhashed verifier can exchange the authorization code for an access token.
  - **State Verification (CSRF Protection):** A randomized, cryptographically strong `state` parameter is passed and verified upon callback redirect to prevent Cross-Site Request Forgery (CSRF).
  - **Ephemeral Storage:** The PKCE verifier and state are stored in `sessionStorage` and immediately purged after the token exchange completes.

### 2.2 Supabase Row Level Security (RLS)
- **Threat:** Cross-tenant data exfiltration or unauthorized manipulation of user playlists, tracks, audio metadata, or export archives.
- **Mitigation:**
  - Row Level Security (RLS) is activated on all public tables: `profiles`, `playlists`, `tracks`, `audio_files`, `track_matches`, and `export_archives`.
  - Every query evaluates against `auth.uid() = user_id`.
  - Relational join constraints verify that users can only interact with tracks and matches belonging to playlists they own.
  - No anonymous access is permitted to user tables.

### 2.3 Supabase Storage Path Isolation
- **Threat:** Unauthorized access or overwriting of cloud export archives in shared storage buckets.
- **Mitigation:**
  - The `export-archives` bucket is configured as private (`public = false`).
  - Storage RLS enforces folder hierarchy isolation:
    ```sql
    auth.uid()::text = (storage.foldername(name))[1]
    ```
  - An authenticated user can only view, upload, modify, or delete objects located within the `{userId}/*` directory path. Attempts to access another user's prefix are rejected at the PostgreSQL storage engine level.

### 2.4 CSV Formula Injection (OWASP Compliance)
- **Threat:** Malicious track titles or artist names beginning with spreadsheet formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) executing arbitrary code when opening exported CSV manifests in Excel or Google Sheets.
- **Mitigation:**
  - All CSV export routines pass data through `escapeCsvField()`.
  - Fields beginning with formula trigger characters are automatically prefixed with an apostrophe (`'`), neutralizing executable expressions.
  - Text containing quotes, commas, or newlines is wrapped in double quotes, with internal quotes safely doubled (`""`).

### 2.5 ZIP Slip Directory Traversal
- **Threat:** An attacker crafting audio file names or playlist names containing path traversal sequences (e.g., `../../etc/passwd` or `..\..\Windows\System32`) to overwrite sensitive host files upon extraction.
- **Mitigation:**
  - `resolveArchivePath()` strips directory traversal sequences (`..`, `/`, `\`) from filenames.
  - File names are sanitized and normalized prior to inclusion in the JSZip archive.
  - Strict hierarchical packaging ensures all extracted contents remain confined to designated subfolders (`audio/`, `manifests/`).

### 2.6 Audio Binary Sovereignty & Privacy
- **Threat:** Leakage of user copyright or personal audio files to third-party cloud infrastructure.
- **Mitigation:**
  - **Local-First indexed storage:** Audio binaries (`Blob` / `ArrayBuffer`) are written strictly to browser IndexedDB storage.
  - **Zero Background Uploads:** The application has no automated audio file upload pipeline.
  - Cloud synchronization is strictly opt-in, metadata-only by default, and cloud archive backups are explicitly user-initiated.

### 2.7 Memory Safety & Resource Management
- **Threat:** Browser tab crashes or memory leakage caused by un-revoked object URLs referencing large audio blobs.
- **Mitigation:**
  - Every generated object URL (`URL.createObjectURL(blob)`) is tracked and systematically released via `URL.revokeObjectURL(url)`.
  - Player hooks and audio preview components invoke URL revocation on component unmount and before loading new audio buffers.

### 2.8 Secret Detection & Leaked Secret Prevention
- **Threat:** Accidental inclusion of backend credentials (`SUPABASE_SERVICE_ROLE_KEY`, database admin passwords) into client JavaScript bundles.
- **Mitigation:**
  - Vite's build architecture strictly prevents exposing environment variables not starting with `VITE_`.
  - `src/lib/env.ts` actively validates all imported variables and regex-scans `import.meta.env` keys against patterns matching `/SERVICE_ROLE/i`, `/SECRET/i`, `/PRIVATE_KEY/i`, and `/DATABASE_PASSWORD/i`. If detected, the application logs a security error and fails closed.

---

## 3. Security Headers Matrix

When served in production (via `vercel.json` or `netlify.toml`), the following security headers are enforced:

| Header | Production Directive | Purpose |
| :--- | :--- | :--- |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing. |
| `X-Frame-Options` | `DENY` | Prevents clickjacking attacks. |
| `X-XSS-Protection` | `1; mode=block` | Enables legacy browser XSS filters. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Protects sensitive URL query parameters across origins. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disables unneeded browser APIs. |

---

## 4. Vulnerability Disclosure Policy

If you discover a security vulnerability in PlaylistVault, please report it responsibly:

1. **Email:** Send details to `security@playlistvault.local` (or file a private security advisory on GitHub).
2. **Details:** Include a description of the issue, proof of concept, and affected components.
3. **Response Time:** We aim to acknowledge vulnerability reports within 48 hours and provide a remediation timeline within 7 days.
4. **Public Disclosure:** Please refrain from publicly disclosing the vulnerability until a fix has been published.
