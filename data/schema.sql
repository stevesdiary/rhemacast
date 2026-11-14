CREATE TABLE IF NOT EXISTS translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    abbreviation TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    language TEXT NOT NULL,
    license TEXT NOT NULL,
    is_copyrighted INTEGER NOT NULL DEFAULT 0,
    is_downloaded INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    translation_id INTEGER NOT NULL REFERENCES translations(id),
    book_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    testament TEXT NOT NULL,
    UNIQUE(translation_id, book_number)
);

CREATE TABLE IF NOT EXISTS verses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    translation_id INTEGER NOT NULL REFERENCES translations(id),
    book_id INTEGER NOT NULL REFERENCES books(id),
    book_number INTEGER NOT NULL,
    book_name TEXT NOT NULL,
    book_abbreviation TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verses_lookup ON verses(translation_id, book_number, chapter, verse);
CREATE INDEX IF NOT EXISTS idx_verses_chapter ON verses(translation_id, book_number, chapter);

CREATE TABLE IF NOT EXISTS cross_references (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_book INTEGER NOT NULL,
    from_chapter INTEGER NOT NULL,
    from_verse INTEGER NOT NULL,
    to_book INTEGER NOT NULL,
    to_chapter INTEGER NOT NULL,
    to_verse_start INTEGER NOT NULL,
    to_verse_end INTEGER NOT NULL,
    votes INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_crossref_from ON cross_references(from_book, from_chapter, from_verse);

CREATE TABLE IF NOT EXISTS embedding_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    translation_id INTEGER NOT NULL REFERENCES translations(id),
    model_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    computed_at TEXT,
    UNIQUE(translation_id, model_name)
);

-- ============================================================
-- Songs / Lyrics Schema
-- ============================================================

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
CREATE TRIGGER IF NOT EXISTS song_sections_ai AFTER INSERT ON song_sections BEGIN
    INSERT INTO song_sections_fts(rowid, lyrics) VALUES (new.id, new.lyrics);
END;

CREATE TRIGGER IF NOT EXISTS song_sections_ad AFTER DELETE ON song_sections BEGIN
    INSERT INTO song_sections_fts(song_sections_fts, rowid, lyrics) VALUES ('delete', old.id, old.lyrics);
END;

CREATE TRIGGER IF NOT EXISTS song_sections_au AFTER UPDATE ON song_sections BEGIN
    INSERT INTO song_sections_fts(song_sections_fts, rowid, lyrics) VALUES ('delete', old.id, old.lyrics);
    INSERT INTO song_sections_fts(rowid, lyrics) VALUES (new.id, new.lyrics);
END;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
CREATE INDEX IF NOT EXISTS idx_song_sections_song ON song_sections(song_id, order_index);
