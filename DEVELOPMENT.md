# Rhema Developer Guide

Welcome to **Rhema**! This guide walks you through setting up your local environment, bootstrapping the required database and models, running the app in development mode, and understanding the project's architecture.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [First-Time Setup (Quick Start)](#first-time-setup-quick-start)
4. [Running the Application](#running-the-application)
5. [Database & Seed Data Pipeline](#database--seed-data-pipeline)
6. [AI Models & Embeddings (Optional)](#ai-models--embeddings-optional)
7. [Testing & Quality Checks](#testing--quality-checks)
8. [Codebase Layout](#codebase-layout)
9. [Troubleshooting & Common Pitfalls](#troubleshooting--common-pitfalls)

---

## Architecture Overview

Rhema is a desktop broadcast and presentation tool for live services:

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Zustand stores, `@dnd-kit/react`.
- **Backend:** Tauri v2, modular Rust workspace crates (`audio`, `stt`, `bible`, `songs`, `detection`, `broadcast`, `api`).
- **Database:** SQLite (`data/rhema.db`) with FTS5 BM25 search for both scriptures and hymns/lyrics.
- **Audio & AI:** Real-time audio capture (`cpal`), speech-to-text (local Whisper or cloud Deepgram), semantic embeddings (Qwen3-0.6B ONNX), and NDI video streaming output.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Rhema Desktop App                          │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React 19 / TypeScript)     │  Backend (Rust / Tauri) │
│  ├── components/panels/               │  ├── crates/            │
│  │   ├── transcript-panel.tsx         │  │   ├── audio/         │
│  │   ├── queue-panel.tsx              │  │   ├── stt/           │
│  │   ├── search-panel.tsx (Bible)     │  │   ├── bible/         │
│  │   └── songs-search-panel.tsx       │  │   ├── songs/         │
│  ├── stores/ (Zustand)                │  │   ├── detection/     │
│  └── hooks/                           │  │   └── broadcast/     │
└───────────────────────────────────────┴─────────────────────────┘
```

---

## Prerequisites

Before building Rhema, ensure your system has the following tools installed:

### 1. Core Toolchain

| Tool             | Recommended Version                               | Installation Command                                              |
| ---------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| **Bun**          | `v1.2+` (used for package management and scripts) | `curl -fsSL https://bun.sh/install \| bash`                       |
| **Node.js**      | `v20+` or `v22+`                                  | `brew install node` / nvm                                         |
| **Rust & Cargo** | Stable `1.80+`                                    | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **SQLite3 CLI**  | `3.35+` (for manual DB inspection)                | Pre-installed or `brew install sqlite`                            |

### 2. Platform Build Dependencies

- **macOS:**
  ```bash
  xcode-select --install
  ```
- **Windows:**
  - Install Visual Studio C++ Build Tools (MSVC).
  - Run bootstrap script in PowerShell (as Administrator):
    ```powershell
    bun run setup:windows
    ```
- **Linux (Ubuntu/Debian):**
  ```bash
  sudo apt-get update && sudo apt-get install -y \
    build-essential libwebkit2gtk-4.1-dev libasound2-dev libssl-dev libudev-dev
  ```

---

## First-Time Setup (Quick Start)

### 1. Clone & Install Frontend Dependencies

```bash
git clone https://github.com/openbezal/rhema.git
cd rhema
bun install
```

### 2. Configure Environment Variables (Optional)

Create a `.env` file in the project root:

```bash
cp .env.template .env
```

- `DEEPGRAM_API_KEY`: _(Optional)_ If provided, cloud speech-to-text can be used alongside or in place of local Whisper.

### 3. Build the SQLite Database

Rhema requires `data/rhema.db` containing Bible translations, cross-references, and the songs catalog:

```bash
# If data/sources/ is missing, download the Bible archives:
bun run download:bible-data

# Build data/rhema.db (imports 10 translations + cross-refs + seed songs):
bun run build:bible
```

To seed or refresh only the songs catalog at any time:

```bash
bun run seed:songs
```

---

## Running the Application

### The Standard Way (Tauri Dev Mode)

Run the full desktop application (Vite dev server + Tauri Rust backend):

```bash
bun run tauri dev
```

> **Note:** Tauri will automatically start Vite at `http://localhost:3000`, compile the Rust backend, and open the Rhema desktop window with hot reloading enabled for both Rust and TypeScript.

### Running with an Existing Frontend Server

If you already ran `bun run dev` (or `npm run dev`) in another terminal and want to attach Tauri to it:

```bash
bun run tauri dev -c '{"build":{"beforeDevCommand":""}}'
```

---

## Database & Seed Data Pipeline

The local SQLite database resides at `data/rhema.db` and is shared by both the `rhema-bible` and `rhema_songs` crates in read-only mode during runtime.

### Data Scripts Reference

| Script                        | Purpose                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `bun run build:bible`         | Drops and rebuilds `data/rhema.db` from `data/sources/*.json`, builds FTS5 indexes, imports cross-references, and seeds songs. |
| `bun run seed:songs`          | Inserts songs from `data/seed-songs.json` into `data/rhema.db` (idempotent; skips existing titles).                            |
| `bun run download:bible-data` | Downloads public domain Bible JSONs and the openbible.info cross-reference archive.                                            |

### Inspecting the Database

```bash
# Check loaded translations:
sqlite3 data/rhema.db "SELECT abbreviation, title, count(*) FROM translations JOIN verses ON translations.id = verses.translation_id GROUP BY translations.id;"

# Check loaded songs:
sqlite3 data/rhema.db "SELECT id, title, author FROM songs ORDER BY title;"

# Test full-text lyrics search:
sqlite3 data/rhema.db "SELECT s.title, ss.section_type, ss.section_number, ss.lyrics FROM song_sections_fts JOIN song_sections ss ON song_sections_fts.rowid = ss.id JOIN songs s ON ss.song_id = s.id WHERE song_sections_fts MATCH 'sweet sound';"
```

---

## AI Models & Embeddings (Optional)

Basic reference detection and keyword search work out of the box with `rhema.db`. For local Whisper speech-to-text and Qwen3 vector embeddings:

```bash
# Unified setup pipeline for models and embeddings:
bun run setup:all
```

Or run individual steps:

- **Download Whisper Model:** `bun run download:whisper`
- **Download & Quantize Qwen3 ONNX:** `bun run download:model`
- **Precompute KJV Embeddings:** `bun run precompute:embeddings`
- **Download NDI SDK:** `bun run download:ndi-sdk`

---

## Testing & Quality Checks

Always verify changes across both frontend and backend before committing:

```bash
# 1. TypeScript type check:
bun run typecheck

# 2. Frontend unit tests (Vitest):
bun run test --run

# 3. Code formatting & linting:
bun run lint
bun run format

# 4. Backend Rust tests:
cd src-tauri
cargo check
cargo test --workspace
```

---

## Codebase Layout

```
rhema/
├── src/                          # React Frontend
│   ├── components/
│   │   ├── broadcast/            # Theme designer & NDI settings
│   │   ├── controls/             # Transport & audio meter bar
│   │   ├── layout/               # App layout & dashboard split panes
│   │   ├── panels/               # UI Panels (Transcript, Queue, Search, Songs, Output)
│   │   └── ui/                   # shadcn/ui components
│   ├── hooks/                    # Custom React hooks (useBible, useSongs, useBroadcast, etc.)
│   ├── stores/                   # Zustand state stores (bible, queue, songs, settings, etc.)
│   ├── types/                    # TypeScript interfaces & tagged unions
│   └── lib/                      # Pure utilities (quick-search, verse-renderer, remote-actions)
├── src-tauri/                    # Rust Desktop Backend
│   ├── Cargo.toml                # Workspace definition
│   ├── src/                      # Tauri main entrypoint & commands
│   │   ├── commands/             # Tauri IPC commands (bible, songs, audio, broadcast)
│   │   └── state.rs              # AppState holding Db connections & runtime handles
│   └── crates/                   # Modular Rust crates
│       ├── audio/                # cpal audio capture & volume metering
│       ├── stt/                  # Deepgram streaming STT & Whisper bindings
│       ├── bible/                # SQLite Bible query & FTS5 search engine
│       ├── songs/                # SQLite songs & lyrics FTS5 search engine
│       ├── detection/            # Aho-Corasick citation & semantic embedding detection
│       └── broadcast/            # NDI video output streaming
├── data/                         # Data pipeline & schemas
│   ├── schema.sql                # SQLite schema (verses, songs, FTS5 virtual tables)
│   ├── seed-songs.json           # Seed dataset for public domain hymns
│   ├── seed-songs.ts             # Songs seeder script
│   ├── build-bible-db.ts         # Bible DB builder
│   └── download-sources.ts       # Raw source downloader
└── public/                       # Static web assets & icons
```

---

## Troubleshooting & Common Pitfalls

### 1. `Port 3000 is already in use`

- **Why:** `vite.config.ts` enforces `server.strictPort = true`.
- **Solution:** Terminate any running Vite/frontend processes, or run:
  ```bash
  bun run tauri dev -c '{"build":{"beforeDevCommand":""}}'
  ```

### 2. Bible Verses or Songs Not Showing Up

- **Why:** `data/rhema.db` is empty or was cleared without running the build script.
- **Solution:** Rebuild the database:
  ```bash
  bun run build:bible
  ```

### 3. Microphone Audio Not Working on macOS

- **Why:** macOS requires microphone permissions for terminal apps running native binaries.
- **Solution:** Open **System Settings → Privacy & Security → Microphone**, and ensure your terminal app (Terminal, iTerm2, or VS Code) has permission enabled.

### 4. Bytemuck Memory Alignment Issues

- When dealing with binary embeddings or raw byte files in Rust, avoid `bytemuck::cast_slice` directly on raw file byte buffers unless strict memory alignment is guaranteed. Prefer chunking with `from_ne_bytes` or aligning buffers explicitly.
