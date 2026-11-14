# Lyrics Search Feature - Analysis & Implementation Plan

## Executive Summary

This document analyzes the current Rhema codebase and provides a comprehensive implementation plan for adding **lyrics search for songs** — mirroring the existing scripture search capability (by reference or verse content).

---

## Current Codebase Analysis

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Rhema Application                          │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React/TypeScript)          │  Backend (Rust/Tauri)  │
│  ├── components/panels/               │  ├── crates/            │
│  │   └── search-panel.tsx (33KB)      │  │   ├── bible/          │
│  ├── hooks/                           │  │   │   ├── search.rs   │ ← FTS5 + BM25
│  │   └── use-bible.ts                 │  │   │   ├── db.rs       │
│  ├── stores/                          │  │   │   └── models.rs   │
│  │   └── bible-store.ts               │  │   └── detection/      │
│  └── lib/                             │  │       └── semantic/   │
│      └── quick-search.ts              │  └── src/commands/      │
│                                       │      └── bible.rs       │
└─────────────────────────────────────────────────────────────────┘
```

### Existing Search Capabilities

| Feature | Implementation | Location |
|---------|---------------|----------|
| **Reference Search** | Autocomplete parser for "John 3:16" | `quick-search.ts` |
| **Keyword Search** | FTS5 + BM25 with stop-word filtering | `search.rs` (3-tier: phrase/AND/OR) |
| **Semantic Search** | ONNX embeddings + cosine similarity | `detection/semantic/` |
| **Cross-references** | Pre-computed verse links | `crossref.rs` |

### Database Schema (Current)

```sql
-- Bible data (read-only, bundled)
translations (id, abbreviation, title, language, ...)
books (id, translation_id, book_number, name, abbreviation, testament)
verses (id, translation_id, book_id, book_number, chapter, verse, text)
verses_fts (FTS5 virtual table on verses.text)
cross_references (from/to verse mappings)
embedding_status (translation_id, model_name, status)
```
---

## Feature Requirements

### User Stories

1. **Search by Song Title** — "Amazing Grace", "How Great Thou Art"
2. **Search by Lyrics Content** — "amazing grace how sweet the sound"
3. **Autocomplete Suggestions** — Type "Amaz" → suggest "Amazing Grace"
4. **Add to Queue** — Click result → add to presentation queue
5. **Present Live** — Send selected song to live output

### Search Modes (Mirroring Scripture)

| Mode | Scripture | Songs |
|------|-----------|-------|
| **Reference** | "John 3:16" | "Amazing Grace v1" |
| **Content** | "for god so loved" | "amazing grace sweet sound" |
| **Semantic** | "god's love for humanity" | "songs about redemption" |

---

## Implementation Plan

### Phase 1: Database Schema & Data Model

#### 1.1 New Tables (Add to `schema.sql`)

```sql
-- Song metadata
CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT,
    composer TEXT,
    copyright TEXT,
    ccli_number TEXT,
    themes TEXT, -- JSON array: ["worship", "grace", "salvation"]
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Song verses/sections (verse, chorus, bridge, etc.)
CREATE TABLE IF NOT EXISTS song_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL, -- 'verse', 'chorus', 'bridge', 'pre_chorus', 'tag', 'intro', 'outro'
    section_number INTEGER NOT NULL, -- 1, 2, 3...
    lyrics TEXT NOT NULL,
    order_index INTEGER NOT NULL, -- for proper song flow
    UNIQUE(song_id, section_type, section_number)
);

-- FTS5 index for lyrics search (mirrors verses_fts)
CREATE VIRTUAL TABLE IF NOT EXISTS song_sections_fts USING fts5(
    lyrics,
    content='song_sections',
    content_rowid='id',
    tokenize='unicode61'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER song_sections_ai AFTER INSERT ON song_sections BEGIN
    INSERT INTO song_sections_fts(rowid, lyrics) VALUES (new.id, new.lyrics);
END;

CREATE TRIGGER song_sections_ad AFTER DELETE ON song_sections BEGIN
    INSERT INTO song_sections_fts(song_sections_fts, rowid, lyrics) VALUES ('delete', old.id, old.lyrics);
END;

CREATE TRIGGER song_sections_au AFTER UPDATE ON song_sections BEGIN
    INSERT INTO song_sections_fts(song_sections_fts, rowid, lyrics) VALUES ('delete', old.id, old.lyrics);
    INSERT INTO song_sections_fts(rowid, lyrics) VALUES (new.id, new.lyrics);
END;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
CREATE INDEX IF NOT EXISTS idx_song_sections_song ON song_sections(song_id, order_index);
```

#### 1.2 Rust Models (`crates/bible/src/models.rs` → new `crates/songs/src/models.rs`)

```rust
// New crate: rhema_songs
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Song {
    pub id: i64,
    pub title: String,
    pub author: Option<String>,
    pub composer: Option<String>,
    pub copyright: Option<String>,
    pub ccli_number: Option<String>,
    pub themes: Vec<String>, // JSON deserialized
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SongSection {
    pub id: i64,
    pub song_id: i64,
    pub section_type: SectionType,
    pub section_number: i32,
    pub lyrics: String,
    pub order_index: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SectionType {
    Verse,
    Chorus,
    Bridge,
    PreChorus,
    Tag,
    Intro,
    Outro,
    Other(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SongWithSections {
    pub song: Song,
    pub sections: Vec<SongSection>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SearchSongRow {
    pub song_id: i64,
    pub title: String,
    pub author: Option<String>,
    pub section_type: String,
    pub section_number: i32,
    pub lyrics: String,
    pub rank: f64,
    pub phrase_match: bool,
}
```
---

### Phase 2: Backend Search Implementation

#### 2.1 New Crate: `rhema_songs`

Create `/src-tauri/crates/songs/` with structure:
```
crates/songs/
├── Cargo.toml
└── src/
    ├── lib.rs
    ├── db.rs          // Database operations
    ├── models.rs      // Data models
    └── search.rs      // FTS5 + BM25 search (adapted from bible/search.rs)
```

#### 2.2 Search Logic (`search.rs`)

Adapt the existing 3-tier BM25 search from `bible/search.rs`:

```rust
// Key differences from Bible search:
// 1. Search across song_sections_fts (not verses_fts)
// 2. Return Song + matching section (not verse)
// 3. Support section-type filtering (verse vs chorus)
// 4. Title-boosted ranking (exact title matches first)

pub fn search_songs(
    conn: &Connection,
    query: &str,
    limit: usize,
) -> Result<Vec<SearchSongRow>, BibleError> {
    // Tier 1: Exact phrase match (quoted)
    // Tier 2: AND query (all significant words)
    // Tier 3: OR query (any significant word)
    // + Title prefix match boost
    // Deduplicate by song_id (not verse reference)
}
```

#### 2.3 Tauri Commands (`src-tauri/src/commands/songs.rs`)

```rust
#[tauri::command]
pub fn list_songs(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<Song>, String> { ... }

#[tauri::command]
pub fn get_song(
    state: State<'_, Mutex<AppState>>,
    song_id: i64,
) -> Result<Option<SongWithSections>, String> { ... }

#[tauri::command]
pub fn search_songs(
    state: State<'_, Mutex<AppState>>,
    query: String,
    limit: usize,
) -> Result<Vec<SearchSongRow>, String> { ... }

#[tauri::command]
pub fn search_songs_by_title(
    state: State<'_, Mutex<AppState>>,
    query: String,
    limit: usize,
) -> Result<Vec<Song>, String> { ... } // Prefix match on title
```

#### 2.4 Register Commands

In `src-tauri/src/lib.rs`:
```rust
mod commands; // add songs.rs to commands module
// ...
.invoke_handler(tauri::generate_handler![
    // ... existing
    commands::songs::list_songs,
    commands::songs::get_song,
    commands::songs::search_songs,
    commands::songs::search_songs_by_title,
])
```
---

### Phase 3: Frontend Types & Store

#### 3.1 Types (`src/types/songs.ts`)

```typescript
export interface Song {
  id: number;
  title: string;
  author?: string;
  composer?: string;
  copyright?: string;
  ccli_number?: string;
  themes: string[];
}

export interface SongSection {
  id: number;
  song_id: number;
  section_type: 'verse' | 'chorus' | 'bridge' | 'pre_chorus' | 'tag' | 'intro' | 'outro' | 'other';
  section_number: number;
  lyrics: string;
  order_index: number;
}

export interface SongWithSections {
  song: Song;
  sections: SongSection[];
}

export interface SearchSongResult {
  song_id: number;
  title: string;
  author?: string;
  section_type: string;
  section_number: number;
  lyrics: string;
  rank: number;
  phrase_match: boolean;
}

export type SongSearchTab = 'title' | 'lyrics' | 'semantic';
```

#### 3.2 Store (`src/stores/songs-store.ts`)

```typescript
import { create } from 'zustand';
import type { Song, SongWithSections, SearchSongResult } from '@/types/songs';

interface SongsState {
  songs: Song[];
  selectedSong: SongWithSections | null;
  searchResults: SearchSongResult[];
  setSongs: (songs: Song[]) => void;
  setSelectedSong: (song: SongWithSections | null) => void;
  setSearchResults: (results: SearchSongResult[]) => void;
}

export const useSongsStore = create<SongsState>((set) => ({
  songs: [],
  selectedSong: null,
  searchResults: [],
  setSongs: (songs) => set({ songs }),
  setSelectedSong: (selectedSong) => set({ selectedSong }),
  setSearchResults: (searchResults) => set({ searchResults }),
}));
```
---

### Phase 4: Frontend Search Logic

#### 4.1 Quick Search for Songs (`src/lib/song-quick-search.ts`)

```typescript
// Mirror quick-search.ts but for song titles
export interface SongAutocompleteResult {
  suggestion: string;
  matchedSong?: Song;
  stage: 'title' | 'section' | 'complete' | 'none';
}

export function getSongAutocompleteSuggestion(
  input: string,
  songs: Song[]
): SongAutocompleteResult {
  1. Title prefix match: "Amaz" → "Amazing Grace"
  2. verse / section: "how sweet the sound" → "Amazing Grace"
  // 3. Title + section + number: "Amazing Grace v1" → complete
}
```

#### 4.2 Search Hook (`src/hooks/use-songs.ts`)

```typescript
import { invoke } from '@tauri-apps/api/core';
import { useSongsStore } from '@/stores';
import type { Song, SongWithSections, SearchSongResult } from '@/types/songs';

export async function searchSongs(
  query: string,
  limit = 20
): Promise<SearchSongResult[]> {
  const results = await invoke<SearchSongResult[]>('search_songs', { query, limit });
  useSongsStore.getState().setSearchResults(results);
  return results;
}

export async function searchSongsByTitle(
  query: string,
  limit = 20
): Promise<Song[]> {
  return invoke<Song[]>('search_songs_by_title', { query, limit });
}

export async function loadSongs(): Promise<Song[]> {
  const songs = await invoke<Song[]>('list_songs');
  useSongsStore.getState().setSongs(songs);
  return songs;
}

export async function getSong(songId: number): Promise<SongWithSections | null> {
  return invoke<SongWithSections | null>('get_song', { songId });
}
```

---

### Phase 5: UI Components

#### 5.1 New Search Panel Tab

Add a **"Songs"** tab to the existing `SearchPanel` (or create dedicated `SongsSearchPanel`):

```tsx
// In search-panel.tsx, add to SearchTab type:
type SearchTab = 'book' | 'context' | 'songs';

// Add tab button and render SongsSearchResults component
```

#### 5.2 Songs Search Results Component

```tsx
// src/components/panels/songs-search-results.tsx
function SongsSearchResults({
  query,
  activeTab, // 'title' | 'lyrics'
  onSelectSong,
}) {
  // Title search: debounced prefix match
  // Lyrics search: BM25 full-text (reuse search logic)
  // Show: Song title, author, matching section (verse/chorus), highlighted lyrics
  // Actions: "Add to Queue", "Present", "View Full Song"
}
```

#### 5.3 Song Viewer Component

```tsx
// src/components/panels/song-viewer.tsx
function SongViewer({ song: SongWithSections }) {
  // Render sections in order with proper labels:
  // ▼ Verse 1
  //   Amazing grace, how sweet the sound...
  // ▼ Chorus
  //   Amazing grace, amazing grace...
  // ▼ Verse 2
  //   'Twas grace that taught my heart to fear...
}
```

---

### Phase 6: Data Pipeline

#### 6.1 Song Data Source

Options for populating the songs database:

| Source | Approach | Effort |
|--------|----------|--------|
| **CCLI SongSelect** | API integration (requires license) | High |
| **OpenSong/ChordPro** | Import `.onsong`/`.chopro` files | Medium |
| **Manual CSV/JSON** | Admin import tool | Low |
| **Public Domain Hymnals** | Scrape/convert (e.g., Cyber Hymnal) | Medium |

#### 6.2 Build Script (`data/build-songs-db.ts`)

```typescript
// Similar to build-bible-db.ts
// 1. Parse source files (CSV, JSON, ChordPro)
// 2. Normalize: titles, authors, section types
// 3. Write to SQLite with FTS5
// 4. Bundle with app or download on first run
```

#### 6.3 Sample Data Format (JSON)

```json
{
  "title": "Amazing Grace",
  "author": "John Newton",
  "composer": "Traditional",
  "ccli_number": "22025",
  "themes": ["grace", "salvation", "worship"],
  "sections": [
    { "type": "verse", "number": 1, "lyrics": "Amazing grace, how sweet the sound..." },
    { "type": "verse", "number": 2, "lyrics": "'Twas grace that taught my heart to fear..." },
    { "type": "chorus", "number": 1, "lyrics": "Amazing grace, amazing grace..." },
    { "type": "verse", "number": 3, "lyrics": "Through many dangers, toils and snares..." }
  ]
}
```
---

## Integration Points

### 1. Queue System Integration

Reuse existing queue store (`queue-store.ts`):

```typescript
// Add song to queue (similar to verse)
useQueueStore.getState().addItem({
  id: crypto.randomUUID(),
  type: 'song', // NEW: distinguish from 'verse'
  song: { id, title, sections: [...] },
  reference: `${title} - Verse 1`,
  confidence: 1.0,
  source: 'manual',
  added_at: Date.now(),
});
```

### 2. Broadcast/Present Integration

Extend `use-broadcast.ts` to handle song presentation:

```typescript
// New command: present_song_section
// Sends formatted lyrics to live output with proper slide breaks
```

### 3. Settings Integration

Add to `settings-dialog.tsx`:
- Default song database source
- CCLI license key (if applicable)
- Display preferences (show chords, section labels, etc.)

---

## Recommended Implementation Order

| Priority | Task | Est. Effort |
|----------|------|-------------|
| **P0** | Database schema + Rust models + basic CRUD | 2 days |
| **P0** | FTS5 lyrics search (adapt bible/search.rs) | 2 days |
| **P0** | Tauri commands + frontend types/store/hook | 1 day |
| **P1** | Search panel "Songs" tab + results UI | 2 days |
| **P1** | Song viewer component (full lyrics display) | 1 day |
| **P1** | Queue integration (add song sections to queue) | 1 day |
| **P2** | Data import pipeline (CSV/ChordPro → SQLite) | 2 days |
| **P2** | Semantic search for songs (embeddings) | 3 days |
| **P3** | CCLI SongSelect API integration | 5 days |
| **P3** | Chord diagrams / transpose support | 3 days |

**Total MVP: ~9 days**

---

## Code Quality Considerations

### 1. Reuse Existing Patterns

| Pattern | Current Use | Apply To Songs |
|---------|-------------|----------------|
| FTS5 + BM25 | `bible/search.rs` | `songs/search.rs` |
| Autocomplete | `quick-search.ts` | `song-quick-search.ts` |
| Zustand store | `bible-store.ts` | `songs-store.ts` |
| Search panel | `search-panel.tsx` | New tab in same panel |
| Queue items | `queue-store.ts` | Add `type: 'song'` |

### 2. Testing Strategy

- Unit tests for search logic (mirror `search.rs` tests)
- Integration tests for Tauri commands
- Component tests for search panel (React Testing Library)
- Golden dataset for search relevance (like `search-golden.json`)

### 3. Performance

- FTS5 indexes keep search < 50ms
- Debounce frontend search (300ms)
- Limit results to 20 by default
- Lazy-load full song sections on selection

---

## Future Enhancements

1. **Chord Support** — Store ChordPro format, render diagrams
2. **Transpose** — Key change on-the-fly
3. **Setlists** — Group songs for services
4. **CCLI Reporting** — Auto-generate usage reports
5. **Multi-language** — Translations of same song
6. **Audio Preview** — Link to reference recordings
7. **Slide Generation** — Auto-split lyrics for projection

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Copyright/licensing | Start with public domain; add CCLI later |
| Data quality | Build validation into import pipeline |
| Search relevance | Tune BM25 weights; add title boost |
| Bundle size | Lazy-load song DB; optional download |
| Maintenance | Automate rebuild from source files |

---

## Conclusion

The Rhema codebase has a **well-architected search foundation** (FTS5 + BM25, autocomplete, semantic search) that can be **directly adapted for lyrics search**. The primary work is:

1. **New data model** (songs, sections, FTS index)
2. **Adapted search logic** (reuse 3-tier BM25)
3. **UI integration** (new search tab, song viewer)
4. **Data pipeline** (import tooling)

This follows the existing patterns closely, minimizing new code and maximizing consistency with the scripture search experience.

---

*Generated from codebase analysis on 2026-11-14*