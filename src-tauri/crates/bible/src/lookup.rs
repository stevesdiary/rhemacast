use crate::db::{BibleDb, USER_TRANSLATION_OFFSET};
use crate::error::BibleError;
use crate::models::{Book, SearchVerse, Translation, Verse};

impl BibleDb {
    /// Look up a verse by its database primary key (verses.id).
    ///
    /// # Panics
    ///
    /// Panics if the internal mutex is poisoned (i.e., a thread panicked
    /// while holding the database lock). This applies to all `BibleDb` methods.
    pub fn get_verse_by_id(&self, id: i64) -> Result<Option<Verse>, BibleError> {
        let bundled = {
            let conn = self.conn.lock().unwrap();
            let mut stmt = conn.prepare(
                "SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text \
                 FROM verses WHERE id = ?1",
            )?;
            let mut rows = stmt.query_map(rusqlite::params![id], |row: &rusqlite::Row| {
                Ok(Verse {
                    id: row.get(0)?,
                    translation_id: row.get(1)?,
                    book_number: row.get(2)?,
                    book_name: row.get(3)?,
                    book_abbreviation: row.get(4)?,
                    chapter: row.get(5)?,
                    verse: row.get(6)?,
                    text: row.get(7)?,
                })
            })?;
            match rows.next() {
                Some(row) => Some(row?),
                None => None,
            }
        };

        if let Some(v) = bundled {
            return Ok(Some(v));
        }

        if let Some(user_conn) = &self.user_conn {
            let uconn = user_conn.lock().unwrap();
            let mut ustmt = uconn.prepare(
                "SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text \
                 FROM verses WHERE id = ?1",
            )?;
            let mut urows = ustmt.query_map(rusqlite::params![id], |row: &rusqlite::Row| {
                let t_id: i64 = row.get(1)?;
                Ok(Verse {
                    id: row.get(0)?,
                    translation_id: t_id + USER_TRANSLATION_OFFSET,
                    book_number: row.get(2)?,
                    book_name: row.get(3)?,
                    book_abbreviation: row.get(4)?,
                    chapter: row.get(5)?,
                    verse: row.get(6)?,
                    text: row.get(7)?,
                })
            })?;
            match urows.next() {
                Some(row) => Ok(Some(row?)),
                None => Ok(None),
            }
        } else {
            Ok(None)
        }
    }

    pub fn get_verse(
        &self,
        translation_id: i64,
        book_number: i32,
        chapter: i32,
        verse: i32,
    ) -> Result<Option<Verse>, BibleError> {
        if translation_id >= USER_TRANSLATION_OFFSET {
            let user_conn = self.user_conn.as_ref().ok_or_else(|| {
                BibleError::Internal("User translations database not configured".into())
            })?;
            let conn = user_conn.lock().unwrap();
            let internal_id = translation_id - USER_TRANSLATION_OFFSET;
            let mut stmt = conn.prepare(
                "SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text \
                 FROM verses \
                 WHERE translation_id = ?1 AND book_number = ?2 AND chapter = ?3 AND verse = ?4",
            )?;
            let mut rows = stmt.query_map(
                rusqlite::params![internal_id, book_number, chapter, verse],
                |row: &rusqlite::Row| {
                    Ok(Verse {
                        id: row.get::<_, i64>(0)? + USER_TRANSLATION_OFFSET * 1000,
                        translation_id,
                        book_number: row.get(2)?,
                        book_name: row.get(3)?,
                        book_abbreviation: row.get(4)?,
                        chapter: row.get(5)?,
                        verse: row.get(6)?,
                        text: row.get(7)?,
                    })
                },
            )?;
            return match rows.next() {
                Some(row) => Ok(Some(row?)),
                None => Ok(None),
            };
        }

        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text \
             FROM verses \
             WHERE translation_id = ?1 AND book_number = ?2 AND chapter = ?3 AND verse = ?4",
        )?;
        let mut rows = stmt.query_map(
            rusqlite::params![translation_id, book_number, chapter, verse],
            |row: &rusqlite::Row| {
                Ok(Verse {
                    id: row.get(0)?,
                    translation_id: row.get(1)?,
                    book_number: row.get(2)?,
                    book_name: row.get(3)?,
                    book_abbreviation: row.get(4)?,
                    chapter: row.get(5)?,
                    verse: row.get(6)?,
                    text: row.get(7)?,
                })
            },
        )?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn get_chapter(
        &self,
        translation_id: i64,
        book_number: i32,
        chapter: i32,
    ) -> Result<Vec<Verse>, BibleError> {
        if translation_id >= USER_TRANSLATION_OFFSET {
            let user_conn = self.user_conn.as_ref().ok_or_else(|| {
                BibleError::Internal("User translations database not configured".into())
            })?;
            let conn = user_conn.lock().unwrap();
            let internal_id = translation_id - USER_TRANSLATION_OFFSET;
            let mut stmt = conn.prepare(
                "SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text \
                 FROM verses \
                 WHERE translation_id = ?1 AND book_number = ?2 AND chapter = ?3 \
                 ORDER BY verse",
            )?;
            let rows = stmt.query_map(
                rusqlite::params![internal_id, book_number, chapter],
                |row: &rusqlite::Row| {
                    Ok(Verse {
                        id: row.get::<_, i64>(0)? + USER_TRANSLATION_OFFSET * 1000,
                        translation_id,
                        book_number: row.get(2)?,
                        book_name: row.get(3)?,
                        book_abbreviation: row.get(4)?,
                        chapter: row.get(5)?,
                        verse: row.get(6)?,
                        text: row.get(7)?,
                    })
                },
            )?;
            return Ok(rows.collect::<Result<Vec<_>, _>>()?);
        }

        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text \
             FROM verses \
             WHERE translation_id = ?1 AND book_number = ?2 AND chapter = ?3 \
             ORDER BY verse",
        )?;
        let rows = stmt.query_map(
            rusqlite::params![translation_id, book_number, chapter],
            |row: &rusqlite::Row| {
                Ok(Verse {
                    id: row.get(0)?,
                    translation_id: row.get(1)?,
                    book_number: row.get(2)?,
                    book_name: row.get(3)?,
                    book_abbreviation: row.get(4)?,
                    chapter: row.get(5)?,
                    verse: row.get(6)?,
                    text: row.get(7)?,
                })
            },
        )?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn get_verse_range(
        &self,
        translation_id: i64,
        book_number: i32,
        chapter: i32,
        verse_start: i32,
        verse_end: i32,
    ) -> Result<Vec<Verse>, BibleError> {
        if translation_id >= USER_TRANSLATION_OFFSET {
            let user_conn = self.user_conn.as_ref().ok_or_else(|| {
                BibleError::Internal("User translations database not configured".into())
            })?;
            let conn = user_conn.lock().unwrap();
            let internal_id = translation_id - USER_TRANSLATION_OFFSET;
            let mut stmt = conn.prepare(
                "SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text \
                 FROM verses \
                 WHERE translation_id = ?1 AND book_number = ?2 AND chapter = ?3 \
                   AND verse >= ?4 AND verse <= ?5 \
                 ORDER BY verse",
            )?;
            let rows = stmt.query_map(
                rusqlite::params![internal_id, book_number, chapter, verse_start, verse_end],
                |row: &rusqlite::Row| {
                    Ok(Verse {
                        id: row.get::<_, i64>(0)? + USER_TRANSLATION_OFFSET * 1000,
                        translation_id,
                        book_number: row.get(2)?,
                        book_name: row.get(3)?,
                        book_abbreviation: row.get(4)?,
                        chapter: row.get(5)?,
                        verse: row.get(6)?,
                        text: row.get(7)?,
                    })
                },
            )?;
            return Ok(rows.collect::<Result<Vec<_>, _>>()?);
        }

        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text \
             FROM verses \
             WHERE translation_id = ?1 AND book_number = ?2 AND chapter = ?3 \
               AND verse >= ?4 AND verse <= ?5 \
             ORDER BY verse",
        )?;
        let rows = stmt.query_map(
            rusqlite::params![translation_id, book_number, chapter, verse_start, verse_end],
            |row: &rusqlite::Row| {
                Ok(Verse {
                    id: row.get(0)?,
                    translation_id: row.get(1)?,
                    book_number: row.get(2)?,
                    book_name: row.get(3)?,
                    book_abbreviation: row.get(4)?,
                    chapter: row.get(5)?,
                    verse: row.get(6)?,
                    text: row.get(7)?,
                })
            },
        )?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    /// Load all verses for one translation for client-side context search indexing.
    pub fn load_translation_verses_for_search(
        &self,
        translation_id: i64,
    ) -> Result<Vec<SearchVerse>, BibleError> {
        if translation_id >= USER_TRANSLATION_OFFSET {
            let user_conn = self.user_conn.as_ref().ok_or_else(|| {
                BibleError::Internal("User translations database not configured".into())
            })?;
            let conn = user_conn.lock().unwrap();
            let internal_id = translation_id - USER_TRANSLATION_OFFSET;
            let mut stmt = conn.prepare(
                "SELECT book_number, book_name, chapter, verse, text \
                 FROM verses \
                 WHERE translation_id = ?1 \
                 ORDER BY book_number, chapter, verse",
            )?;
            let rows = stmt.query_map([internal_id], |row: &rusqlite::Row| {
                Ok(SearchVerse {
                    book_number: row.get(0)?,
                    book_name: row.get(1)?,
                    chapter: row.get(2)?,
                    verse: row.get(3)?,
                    text: row.get(4)?,
                })
            })?;
            return Ok(rows.collect::<Result<Vec<_>, _>>()?);
        }

        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT book_number, book_name, chapter, verse, text \
             FROM verses \
             WHERE translation_id = ?1 \
             ORDER BY book_number, chapter, verse",
        )?;
        let rows = stmt.query_map([translation_id], |row: &rusqlite::Row| {
            Ok(SearchVerse {
                book_number: row.get(0)?,
                book_name: row.get(1)?,
                chapter: row.get(2)?,
                verse: row.get(3)?,
                text: row.get(4)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn list_translations(&self) -> Result<Vec<Translation>, BibleError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, abbreviation, title, language, is_copyrighted, is_downloaded \
             FROM translations",
        )?;
        let rows = stmt.query_map([], |row: &rusqlite::Row| {
            Ok(Translation {
                id: row.get(0)?,
                abbreviation: row.get(1)?,
                title: row.get(2)?,
                language: row.get(3)?,
                is_copyrighted: row.get(4)?,
                is_downloaded: row.get(5)?,
                is_user_imported: false,
            })
        })?;
        let mut translations = rows.collect::<Result<Vec<_>, _>>()?;

        if let Some(user_conn) = &self.user_conn {
            let uconn = user_conn.lock().map_err(|e| BibleError::Internal(e.to_string()))?;
            let mut ustmt = uconn.prepare(
                "SELECT id, abbreviation, title, language, is_copyrighted, is_downloaded \
                 FROM translations \
                 ORDER BY id",
            )?;
            let urows = ustmt.query_map([], |row: &rusqlite::Row| {
                Ok(Translation {
                    id: row.get::<_, i64>(0)? + USER_TRANSLATION_OFFSET,
                    abbreviation: row.get(1)?,
                    title: row.get(2)?,
                    language: row.get(3)?,
                    is_copyrighted: row.get(4)?,
                    is_downloaded: row.get(5)?,
                    is_user_imported: true,
                })
            })?;
            for t in urows {
                translations.push(t?);
            }
        }

        Ok(translations)
    }

    pub fn list_books(&self, translation_id: i64) -> Result<Vec<Book>, BibleError> {
        if translation_id >= USER_TRANSLATION_OFFSET {
            let user_conn = self.user_conn.as_ref().ok_or_else(|| {
                BibleError::Internal("User translations database not configured".into())
            })?;
            let conn = user_conn.lock().unwrap();
            let internal_id = translation_id - USER_TRANSLATION_OFFSET;
            let mut stmt = conn.prepare(
                "SELECT id, translation_id, book_number, name, abbreviation, testament \
                 FROM books \
                 WHERE translation_id = ?1 \
                 ORDER BY book_number",
            )?;
            let rows = stmt.query_map(rusqlite::params![internal_id], |row: &rusqlite::Row| {
                Ok(Book {
                    id: row.get::<_, i64>(0)? + USER_TRANSLATION_OFFSET * 1000,
                    translation_id,
                    book_number: row.get(2)?,
                    name: row.get(3)?,
                    abbreviation: row.get(4)?,
                    testament: row.get(5)?,
                })
            })?;
            return Ok(rows.collect::<Result<Vec<_>, _>>()?);
        }

        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, translation_id, book_number, name, abbreviation, testament \
             FROM books \
             WHERE translation_id = ?1 \
             ORDER BY book_number",
        )?;
        let rows = stmt.query_map(rusqlite::params![translation_id], |row: &rusqlite::Row| {
            Ok(Book {
                id: row.get(0)?,
                translation_id: row.get(1)?,
                book_number: row.get(2)?,
                name: row.get(3)?,
                abbreviation: row.get(4)?,
                testament: row.get(5)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }
}
