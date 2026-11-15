use std::path::Path;
use std::sync::Mutex;

use rusqlite::{Connection, OpenFlags, OptionalExtension};
use serde_json;

use crate::error::{Result, SongsError};
use crate::models::{SearchSongRow, Song, SongSection, SongWithSections};

pub struct SongsDb {
    pub(crate) conn: Mutex<Connection>,
}

impl std::fmt::Debug for SongsDb {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SongsDb").finish_non_exhaustive()
    }
}

fn immutable_uri(path: &Path) -> String {
    let raw = path.to_string_lossy().replace('\\', "/");

    let mut encoded = String::with_capacity(raw.len() + 8);
    for ch in raw.chars() {
        match ch {
            '%' => encoded.push_str("%25"),
            '?' => encoded.push_str("%3f"),
            '#' => encoded.push_str("%23"),
            ' ' => encoded.push_str("%20"),
            c => encoded.push(c),
        }
    }

    let is_windows_drive = {
        let bytes = encoded.as_bytes();
        bytes.len() >= 2 && bytes[1] == b':'
    };

    if encoded.starts_with('/') {
        format!("file://{encoded}?immutable=1")
    } else if is_windows_drive {
        format!("file:///{encoded}?immutable=1")
    } else {
        format!("file:{encoded}?immutable=1")
    }
}

impl SongsDb {
    /// Open the songs database for reading (immutable, like the bible DB).
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open_with_flags(
            immutable_uri(path),
            OpenFlags::SQLITE_OPEN_READ_ONLY
                | OpenFlags::SQLITE_OPEN_URI
                | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Open a database for writing. Only tooling that builds or fixtures a
    /// database needs this; the shipped database is read-only at runtime.
    pub fn open_writable(path: &Path) -> Result<Self> {
        Ok(Self {
            conn: Mutex::new(Connection::open(path)?),
        })
    }

    /// Initialize the database schema (for writable databases).
    pub fn init_schema(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(include_str!("../../../../data/schema.sql"))?;
        Ok(())
    }
}
// ============================================================
// Song CRUD
// ============================================================

impl SongsDb {
    pub fn list_songs(&self) -> Result<Vec<Song>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, author, composer, copyright, ccli_number, themes
             FROM songs
             ORDER BY title",
        )?;
        let songs = stmt.query_map([], |row| {
            let themes_json: String = row.get(6)?;
            let themes: Vec<String> = serde_json::from_str(&themes_json).unwrap_or_default();
            Ok(Song {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                composer: row.get(3)?,
                copyright: row.get(4)?,
                ccli_number: row.get(5)?,
                themes,
            })
        })?;
        Ok(songs.map(|r| r.map_err(SongsError::Database)).collect::<Result<Vec<Song>>>()?)
    }

    pub fn get_song(&self, song_id: i64) -> Result<Option<SongWithSections>> {
        let conn = self.conn.lock().unwrap();

        let song = conn
            .query_row(
                "SELECT id, title, author, composer, copyright, ccli_number, themes
                 FROM songs WHERE id = ?1",
                [song_id],
                |row| {
                    let themes_json: String = row.get(6)?;
                    let themes: Vec<String> = serde_json::from_str(&themes_json).unwrap_or_default();
                    Ok(Song {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        author: row.get(2)?,
                        composer: row.get(3)?,
                        copyright: row.get(4)?,
                        ccli_number: row.get(5)?,
                        themes,
                    })
                },
            )
            .optional()?;

        let Some(song) = song else {
            return Ok(None);
        };

        let mut stmt = conn.prepare(
            "SELECT id, song_id, section_type, section_number, lyrics, order_index
             FROM song_sections
             WHERE song_id = ?1
             ORDER BY order_index",
        )?;
        let sections = stmt.query_map([song_id], |row| {
            Ok(SongSection {
                id: row.get(0)?,
                song_id: row.get(1)?,
                section_type: crate::models::SectionType::from_str(&row.get::<_, String>(2)?),
                section_number: row.get(3)?,
                lyrics: row.get(4)?,
                order_index: row.get(5)?,
            })
        })?;
        let sections = sections.map(|r| r.map_err(SongsError::Database)).collect::<Result<Vec<SongSection>>>()?;

        Ok(Some(SongWithSections { song, sections }))
    }

    pub fn insert_song(&self, song: &Song) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let themes_json = serde_json::to_string(&song.themes)?;
        conn.execute(
            "INSERT INTO songs (title, author, composer, copyright, ccli_number, themes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            (
                &song.title,
                &song.author,
                &song.composer,
                &song.copyright,
                &song.ccli_number,
                &themes_json,
            ),
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn insert_section(&self, section: &SongSection) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO song_sections (song_id, section_type, section_number, lyrics, order_index)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            (
                section.song_id,
                section.section_type.as_str(),
                section.section_number,
                &section.lyrics,
                section.order_index,
            ),
        )?;
        Ok(conn.last_insert_rowid())
    }

    // ============================================================
    // Search
    // ============================================================

    pub fn search_songs_by_title(&self, query: &str, limit: usize) -> Result<Vec<Song>> {
        let conn = self.conn.lock().unwrap();
        let pattern = format!("{}%", query);
        let mut stmt = conn.prepare(
            "SELECT id, title, author, composer, copyright, ccli_number, themes
             FROM songs
             WHERE title LIKE ?1
             ORDER BY title
             LIMIT ?2",
        )?;
        let songs = stmt.query_map([&pattern, &limit.to_string()], |row| {
            let themes_json: String = row.get(6)?;
            let themes: Vec<String> = serde_json::from_str(&themes_json).unwrap_or_default();
            Ok(Song {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                composer: row.get(3)?,
                copyright: row.get(4)?,
                ccli_number: row.get(5)?,
                themes,
            })
        })?;
        Ok(songs.map(|r| r.map_err(SongsError::Database)).collect::<Result<Vec<Song>>>()?)
    }

    pub fn search_songs(&self, query: &str, limit: usize) -> Result<Vec<SearchSongRow>> {
        let conn = self.conn.lock().unwrap();
        crate::search::search_songs(&conn, query, limit)
    }
}