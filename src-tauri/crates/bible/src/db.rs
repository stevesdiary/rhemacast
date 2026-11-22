use std::path::Path;
use std::sync::Mutex;

use rusqlite::{Connection, OpenFlags};

use crate::error::BibleError;

pub const USER_TRANSLATION_OFFSET: i64 = 100_000;

pub struct BibleDb {
    pub(crate) conn: Mutex<Connection>,
    pub(crate) user_conn: Option<Mutex<Connection>>,
}

impl std::fmt::Debug for BibleDb {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BibleDb").finish_non_exhaustive()
    }
}

/// Initialize the schema for custom user-imported translations.
fn init_user_db_schema(conn: &Connection) -> Result<(), BibleError> {
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         CREATE TABLE IF NOT EXISTS translations (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             abbreviation TEXT NOT NULL UNIQUE,
             title TEXT NOT NULL,
             language TEXT NOT NULL,
             license TEXT NOT NULL,
             is_copyrighted INTEGER NOT NULL DEFAULT 0,
             is_downloaded INTEGER NOT NULL DEFAULT 1,
             is_user_imported INTEGER NOT NULL DEFAULT 1
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
         CREATE INDEX IF NOT EXISTS idx_user_verses_lookup ON verses(translation_id, book_number, chapter, verse);
         CREATE INDEX IF NOT EXISTS idx_user_verses_chapter ON verses(translation_id, book_number, chapter);
         CREATE VIRTUAL TABLE IF NOT EXISTS verses_fts USING fts5(
             text,
             content='verses',
             content_rowid='id',
             tokenize='unicode61'
         );
         CREATE TRIGGER IF NOT EXISTS user_verses_ai AFTER INSERT ON verses BEGIN
             INSERT INTO verses_fts(rowid, text) VALUES (new.id, new.text);
         END;
         CREATE TRIGGER IF NOT EXISTS user_verses_ad AFTER DELETE ON verses BEGIN
             INSERT INTO verses_fts(verses_fts, rowid, text) VALUES ('delete', old.id, old.text);
         END;
         CREATE TRIGGER IF NOT EXISTS user_verses_au AFTER UPDATE ON verses BEGIN
             INSERT INTO verses_fts(verses_fts, rowid, text) VALUES ('delete', old.id, old.text);
             INSERT INTO verses_fts(rowid, text) VALUES (new.id, new.text);
         END;",
    )?;
    Ok(())
}

/// Build a `SQLite` URI that opens `path` as immutable.
///
/// `immutable=1` tells `SQLite` the file cannot change underneath it, so it skips
/// locking and never creates `-wal` / `-shm` companions. That matters because
/// the bundled database lives inside `Rhema.app/Contents/Resources`, where any
/// new file breaks the macOS code signature seal.
fn immutable_uri(path: &Path) -> String {
    // Windows separators are not valid in a URI path.
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

    // Absolute POSIX paths already start with `/`; Windows drive paths
    // ("C:/...") need one added. Relative paths must stay relative, so they get
    // no authority component at all.
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

impl BibleDb {
    /// Open the Bible database for reading.
    pub fn open(path: &Path) -> Result<Self, BibleError> {
        Self::open_with_user_db(path, None)
    }

    /// Open the Bible database with an optional user translations database in app data dir.
    pub fn open_with_user_db(path: &Path, user_db_path: Option<&Path>) -> Result<Self, BibleError> {
        let conn = Connection::open_with_flags(
            immutable_uri(path),
            OpenFlags::SQLITE_OPEN_READ_ONLY
                | OpenFlags::SQLITE_OPEN_URI
                | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )?;

        let user_conn = if let Some(u_path) = user_db_path {
            if let Some(parent) = u_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let uconn = Connection::open_with_flags(
                u_path,
                OpenFlags::SQLITE_OPEN_READ_WRITE
                    | OpenFlags::SQLITE_OPEN_CREATE
                    | OpenFlags::SQLITE_OPEN_NO_MUTEX,
            )?;
            init_user_db_schema(&uconn)?;
            Some(Mutex::new(uconn))
        } else {
            None
        };

        Ok(Self {
            conn: Mutex::new(conn),
            user_conn,
        })
    }

    /// Open a database for writing. Only tooling that builds or fixtures a
    /// database needs this; the shipped database is read-only at runtime.
    pub fn open_writable(path: &Path) -> Result<Self, BibleError> {
        Ok(Self {
            conn: Mutex::new(Connection::open(path)?),
            user_conn: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_path(name: &str) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!(
            "rhema-db-test-{name}-{}-{:?}.db",
            std::process::id(),
            std::thread::current().id(),
        ));
        for suffix in ["", "-wal", "-shm"] {
            let _ = std::fs::remove_file(format!("{}{suffix}", path.display()));
        }
        path
    }

    /// Build a database the way the bundled one is built: WAL journal mode,
    /// then closed so the WAL is checkpointed away.
    fn write_bundled_style_db(path: &Path) {
        let conn = Connection::open(path).unwrap();
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             CREATE TABLE verses (id INTEGER PRIMARY KEY, text TEXT);
             INSERT INTO verses VALUES (1, 'In the beginning');",
        )
        .unwrap();
        drop(conn);

        let sidecars: Vec<String> = ["-wal", "-shm"]
            .iter()
            .map(|s| format!("{}{s}", path.display()))
            .filter(|p| std::path::Path::new(p).exists())
            .collect();
        assert!(
            sidecars.is_empty(),
            "fixture should start clean, found {sidecars:?}"
        );
    }

    fn sidecars(path: &Path) -> Vec<String> {
        ["-wal", "-shm"]
            .iter()
            .map(|s| format!("{}{s}", path.display()))
            .filter(|p| std::path::Path::new(p).exists())
            .collect()
    }

    #[test]
    fn open_writes_nothing_beside_the_database() {
        let path = fixture_path("sidecars");
        write_bundled_style_db(&path);

        let db = BibleDb::open(&path).unwrap();
        let count: i64 = db
            .conn
            .lock()
            .unwrap()
            .query_row("SELECT COUNT(*) FROM verses", [], |r| r.get(0))
            .unwrap();

        assert_eq!(count, 1);
        assert!(
            sidecars(&path).is_empty(),
            "opening the bundled database must not create files inside the app \
             bundle — that breaks the macOS code signature seal; found {:?}",
            sidecars(&path)
        );
    }

    #[test]
    fn open_rejects_writes() {
        let path = fixture_path("readonly");
        write_bundled_style_db(&path);

        let db = BibleDb::open(&path).unwrap();
        let result = db
            .conn
            .lock()
            .unwrap()
            .execute("INSERT INTO verses VALUES (2, 'and the earth')", []);

        assert!(result.is_err(), "the bundled database must open read-only");
    }

    #[test]
    fn open_writable_allows_schema_setup() {
        let path = fixture_path("writable");

        let db = BibleDb::open_writable(&path).unwrap();
        db.conn
            .lock()
            .unwrap()
            .execute_batch("CREATE TABLE verses (id INTEGER PRIMARY KEY);")
            .unwrap();
    }

    #[test]
    fn immutable_uri_encodes_reserved_characters() {
        assert_eq!(
            immutable_uri(Path::new("/Applications/My App.app/rhema.db")),
            "file:///Applications/My%20App.app/rhema.db?immutable=1"
        );
        assert_eq!(
            immutable_uri(Path::new("/tmp/wh#at?/db")),
            "file:///tmp/wh%23at%3f/db?immutable=1"
        );
    }

    #[test]
    fn immutable_uri_keeps_relative_paths_relative() {
        assert_eq!(
            immutable_uri(Path::new("data/rhema.db")),
            "file:data/rhema.db?immutable=1"
        );
    }
}
