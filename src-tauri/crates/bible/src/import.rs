use rusqlite::{params, OptionalExtension};
use serde_json::Value;

use crate::db::{BibleDb, USER_TRANSLATION_OFFSET};
use crate::error::BibleError;
use crate::models::Translation;

pub struct CanonicalBook {
    pub number: i32,
    pub name: &'static str,
    pub abbreviation: &'static str,
    pub testament: &'static str,
}

pub const CANONICAL_BOOKS: &[CanonicalBook] = &[
    CanonicalBook { number: 1, name: "Genesis", abbreviation: "Gen", testament: "OT" },
    CanonicalBook { number: 2, name: "Exodus", abbreviation: "Exod", testament: "OT" },
    CanonicalBook { number: 3, name: "Leviticus", abbreviation: "Lev", testament: "OT" },
    CanonicalBook { number: 4, name: "Numbers", abbreviation: "Num", testament: "OT" },
    CanonicalBook { number: 5, name: "Deuteronomy", abbreviation: "Deut", testament: "OT" },
    CanonicalBook { number: 6, name: "Joshua", abbreviation: "Josh", testament: "OT" },
    CanonicalBook { number: 7, name: "Judges", abbreviation: "Judg", testament: "OT" },
    CanonicalBook { number: 8, name: "Ruth", abbreviation: "Ruth", testament: "OT" },
    CanonicalBook { number: 9, name: "1 Samuel", abbreviation: "1Sam", testament: "OT" },
    CanonicalBook { number: 10, name: "2 Samuel", abbreviation: "2Sam", testament: "OT" },
    CanonicalBook { number: 11, name: "1 Kings", abbreviation: "1Kgs", testament: "OT" },
    CanonicalBook { number: 12, name: "2 Kings", abbreviation: "2Kgs", testament: "OT" },
    CanonicalBook { number: 13, name: "1 Chronicles", abbreviation: "1Chr", testament: "OT" },
    CanonicalBook { number: 14, name: "2 Chronicles", abbreviation: "2Chr", testament: "OT" },
    CanonicalBook { number: 15, name: "Ezra", abbreviation: "Ezra", testament: "OT" },
    CanonicalBook { number: 16, name: "Nehemiah", abbreviation: "Neh", testament: "OT" },
    CanonicalBook { number: 17, name: "Esther", abbreviation: "Esth", testament: "OT" },
    CanonicalBook { number: 18, name: "Job", abbreviation: "Job", testament: "OT" },
    CanonicalBook { number: 19, name: "Psalms", abbreviation: "Ps", testament: "OT" },
    CanonicalBook { number: 20, name: "Proverbs", abbreviation: "Prov", testament: "OT" },
    CanonicalBook { number: 21, name: "Ecclesiastes", abbreviation: "Eccl", testament: "OT" },
    CanonicalBook { number: 22, name: "Song of Solomon", abbreviation: "Song", testament: "OT" },
    CanonicalBook { number: 23, name: "Isaiah", abbreviation: "Isa", testament: "OT" },
    CanonicalBook { number: 24, name: "Jeremiah", abbreviation: "Jer", testament: "OT" },
    CanonicalBook { number: 25, name: "Lamentations", abbreviation: "Lam", testament: "OT" },
    CanonicalBook { number: 26, name: "Ezekiel", abbreviation: "Ezek", testament: "OT" },
    CanonicalBook { number: 27, name: "Daniel", abbreviation: "Dan", testament: "OT" },
    CanonicalBook { number: 28, name: "Hosea", abbreviation: "Hos", testament: "OT" },
    CanonicalBook { number: 29, name: "Joel", abbreviation: "Joel", testament: "OT" },
    CanonicalBook { number: 30, name: "Amos", abbreviation: "Amos", testament: "OT" },
    CanonicalBook { number: 31, name: "Obadiah", abbreviation: "Obad", testament: "OT" },
    CanonicalBook { number: 32, name: "Jonah", abbreviation: "Jonah", testament: "OT" },
    CanonicalBook { number: 33, name: "Micah", abbreviation: "Mic", testament: "OT" },
    CanonicalBook { number: 34, name: "Nahum", abbreviation: "Nah", testament: "OT" },
    CanonicalBook { number: 35, name: "Habakkuk", abbreviation: "Hab", testament: "OT" },
    CanonicalBook { number: 36, name: "Zephaniah", abbreviation: "Zeph", testament: "OT" },
    CanonicalBook { number: 37, name: "Haggai", abbreviation: "Hag", testament: "OT" },
    CanonicalBook { number: 38, name: "Zechariah", abbreviation: "Zech", testament: "OT" },
    CanonicalBook { number: 39, name: "Malachi", abbreviation: "Mal", testament: "OT" },
    CanonicalBook { number: 40, name: "Matthew", abbreviation: "Matt", testament: "NT" },
    CanonicalBook { number: 41, name: "Mark", abbreviation: "Mark", testament: "NT" },
    CanonicalBook { number: 42, name: "Luke", abbreviation: "Luke", testament: "NT" },
    CanonicalBook { number: 43, name: "John", abbreviation: "John", testament: "NT" },
    CanonicalBook { number: 44, name: "Acts", abbreviation: "Acts", testament: "NT" },
    CanonicalBook { number: 45, name: "Romans", abbreviation: "Rom", testament: "NT" },
    CanonicalBook { number: 46, name: "1 Corinthians", abbreviation: "1Cor", testament: "NT" },
    CanonicalBook { number: 47, name: "2 Corinthians", abbreviation: "2Cor", testament: "NT" },
    CanonicalBook { number: 48, name: "Galatians", abbreviation: "Gal", testament: "NT" },
    CanonicalBook { number: 49, name: "Ephesians", abbreviation: "Eph", testament: "NT" },
    CanonicalBook { number: 50, name: "Philippians", abbreviation: "Phil", testament: "NT" },
    CanonicalBook { number: 51, name: "Colossians", abbreviation: "Col", testament: "NT" },
    CanonicalBook { number: 52, name: "1 Thessalonians", abbreviation: "1Thess", testament: "NT" },
    CanonicalBook { number: 53, name: "2 Thessalonians", abbreviation: "2Thess", testament: "NT" },
    CanonicalBook { number: 54, name: "1 Timothy", abbreviation: "1Tim", testament: "NT" },
    CanonicalBook { number: 55, name: "2 Timothy", abbreviation: "2Tim", testament: "NT" },
    CanonicalBook { number: 56, name: "Titus", abbreviation: "Titus", testament: "NT" },
    CanonicalBook { number: 57, name: "Philemon", abbreviation: "Phlm", testament: "NT" },
    CanonicalBook { number: 58, name: "Hebrews", abbreviation: "Heb", testament: "NT" },
    CanonicalBook { number: 59, name: "James", abbreviation: "Jas", testament: "NT" },
    CanonicalBook { number: 60, name: "1 Peter", abbreviation: "1Pet", testament: "NT" },
    CanonicalBook { number: 61, name: "2 Peter", abbreviation: "2Pet", testament: "NT" },
    CanonicalBook { number: 62, name: "1 John", abbreviation: "1John", testament: "NT" },
    CanonicalBook { number: 63, name: "2 John", abbreviation: "2John", testament: "NT" },
    CanonicalBook { number: 64, name: "3 John", abbreviation: "3John", testament: "NT" },
    CanonicalBook { number: 65, name: "Jude", abbreviation: "Jude", testament: "NT" },
    CanonicalBook { number: 66, name: "Revelation", abbreviation: "Rev", testament: "NT" },
];

pub fn canonical_info(raw: &str) -> Option<&'static CanonicalBook> {
    let normalized = raw.trim().to_lowercase();
    let cleaned: String = normalized
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ')
        .collect();
    let cleaned = cleaned
        .replace("first", "1")
        .replace("second", "2")
        .replace("third", "3")
        .replace("1st", "1")
        .replace("2nd", "2")
        .replace("3rd", "3")
        .replace("i ", "1 ")
        .replace("ii ", "2 ")
        .replace("iii ", "3 ")
        .replace("psalm", "psalms")
        .replace("song of songs", "song of solomon")
        .replace("canticle of canticles", "song of solomon")
        .replace("revelations", "revelation")
        .replace("revelation of john", "revelation");

    let cleaned = cleaned.trim();

    for b in CANONICAL_BOOKS {
        if b.name.eq_ignore_ascii_case(cleaned)
            || b.abbreviation.eq_ignore_ascii_case(cleaned)
            || b.name.to_lowercase().replace(' ', "") == cleaned.replace(' ', "")
            || b.abbreviation.to_lowercase().replace(' ', "") == cleaned.replace(' ', "")
        {
            return Some(b);
        }
    }
    None
}

#[derive(Debug, Clone)]
pub struct ParsedVerse {
    pub chapter: i32,
    pub verse: i32,
    pub text: String,
}

#[derive(Debug, Clone)]
pub struct ParsedBook {
    pub book_number: i32,
    pub name: String,
    pub abbreviation: String,
    pub testament: String,
    pub verses: Vec<ParsedVerse>,
}

/// Parse any common Bible JSON format into a structured list of books and verses.
pub fn parse_bible_json(raw: &str) -> Result<Vec<ParsedBook>, BibleError> {
    let root: Value = serde_json::from_str(raw)
        .map_err(|e| BibleError::Internal(format!("Invalid JSON format: {e}")))?;

    let mut parsed_books = Vec::new();

    // Format A: Scrollmapper format with root "books" array
    // e.g. { "translation": "MSG", "books": [ { "name": "Genesis", "chapters": [ ... ] } ] }
    let books_val = if let Some(books) = root.get("books").and_then(Value::as_array) {
        Some(books)
    } else if let Some(books) = root.as_array() {
        // Format B: Array of books directly at root [ { "name": "Genesis", "chapters": [...] } ]
        // Check if first element has "chapters"
        if books.first().and_then(|f| f.get("chapters")).is_some() {
            Some(books)
        } else {
            None
        }
    } else {
        None
    };

    if let Some(books) = books_val {
        for (idx, b_val) in books.iter().enumerate() {
            let raw_name = b_val
                .get("name")
                .or_else(|| b_val.get("title"))
                .or_else(|| b_val.get("book"))
                .and_then(Value::as_str)
                .unwrap_or("Unknown");

            let canon = canonical_info(raw_name);
            let book_number = canon.map_or(idx as i32 + 1, |c| c.number);
            let name = canon.map_or_else(|| raw_name.to_string(), |c| c.name.to_string());
            let abbrev = canon.map_or_else(
                || raw_name.chars().take(4).collect::<String>(),
                |c| c.abbreviation.to_string(),
            );
            let testament = canon.map_or_else(
                || if book_number <= 39 { "OT" } else { "NT" }.to_string(),
                |c| c.testament.to_string(),
            );

            let mut verses = Vec::new();

            if let Some(chapters) = b_val.get("chapters").and_then(Value::as_array) {
                for (ch_idx, ch_val) in chapters.iter().enumerate() {
                    let ch_num = ch_val
                        .get("chapter")
                        .or_else(|| ch_val.get("number"))
                        .and_then(Value::as_i64)
                        .map_or(ch_idx as i32 + 1, |n| n as i32);

                    if let Some(v_list) = ch_val.get("verses").and_then(Value::as_array) {
                        for (v_idx, v_val) in v_list.iter().enumerate() {
                            let v_num = v_val
                                .get("verse")
                                .or_else(|| v_val.get("number"))
                                .and_then(Value::as_i64)
                                .map_or(v_idx as i32 + 1, |n| n as i32);

                            let text = v_val
                                .get("text")
                                .and_then(Value::as_str)
                                .unwrap_or("")
                                .trim()
                                .to_string();

                            if !text.is_empty() {
                                verses.push(ParsedVerse {
                                    chapter: ch_num,
                                    verse: v_num,
                                    text,
                                });
                            }
                        }
                    }
                }
            }

            if !verses.is_empty() {
                parsed_books.push(ParsedBook {
                    book_number,
                    name,
                    abbreviation: abbrev,
                    testament,
                    verses,
                });
            }
        }
    } else if let Some(verses_arr) = root.as_array() {
        // Format C: Flat array of verse objects:
        // [ { "book_name": "Genesis", "chapter": 1, "verse": 1, "text": "..." }, ... ]
        use std::collections::BTreeMap;
        let mut grouped: BTreeMap<i32, (String, String, String, Vec<ParsedVerse>)> = BTreeMap::new();

        for (idx, v_val) in verses_arr.iter().enumerate() {
            let raw_book = v_val
                .get("book_name")
                .or_else(|| v_val.get("book"))
                .and_then(Value::as_str)
                .unwrap_or("Unknown");
            let canon = canonical_info(raw_book);
            let b_num = canon.map_or(idx as i32 / 1000 + 1, |c| c.number);
            let b_name = canon.map_or_else(|| raw_book.to_string(), |c| c.name.to_string());
            let b_abbrev = canon.map_or_else(
                || raw_book.chars().take(4).collect::<String>(),
                |c| c.abbreviation.to_string(),
            );
            let testament = canon.map_or_else(
                || if b_num <= 39 { "OT" } else { "NT" }.to_string(),
                |c| c.testament.to_string(),
            );

            let ch = v_val.get("chapter").and_then(Value::as_i64).unwrap_or(1) as i32;
            let v = v_val.get("verse").and_then(Value::as_i64).unwrap_or(1) as i32;
            let text = v_val.get("text").and_then(Value::as_str).unwrap_or("").trim().to_string();

            if !text.is_empty() {
                let entry = grouped.entry(b_num).or_insert_with(|| (b_name, b_abbrev, testament, Vec::new()));
                entry.3.push(ParsedVerse {
                    chapter: ch,
                    verse: v,
                    text,
                });
            }
        }

        for (b_num, (b_name, b_abbrev, testament, v_list)) in grouped {
            if !v_list.is_empty() {
                parsed_books.push(ParsedBook {
                    book_number: b_num,
                    name: b_name,
                    abbreviation: b_abbrev,
                    testament,
                    verses: v_list,
                });
            }
        }
    } else if let Some(map) = root.as_object() {
        // Format D: Keyed map of books: { "Genesis": { "1": { "1": "text" } } }
        for (raw_book, chs_val) in map {
            if let Some(chs_map) = chs_val.as_object() {
                let canon = canonical_info(raw_book);
                let b_num = canon.map_or(1, |c| c.number);
                let b_name = canon.map_or_else(|| raw_book.clone(), |c| c.name.to_string());
                let b_abbrev = canon.map_or_else(
                    || raw_book.chars().take(4).collect::<String>(),
                    |c| c.abbreviation.to_string(),
                );
                let testament = canon.map_or_else(
                    || if b_num <= 39 { "OT" } else { "NT" }.to_string(),
                    |c| c.testament.to_string(),
                );

                let mut verses = Vec::new();
                for (ch_str, v_obj) in chs_map {
                    let ch: i32 = ch_str.parse().unwrap_or(1);
                    if let Some(v_map) = v_obj.as_object() {
                        for (v_str, text_val) in v_map {
                            let v: i32 = v_str.parse().unwrap_or(1);
                            let text = text_val.as_str().unwrap_or("").trim().to_string();
                            if !text.is_empty() {
                                verses.push(ParsedVerse { chapter: ch, verse: v, text });
                            }
                        }
                    }
                }

                if !verses.is_empty() {
                    verses.sort_by_key(|v| (v.chapter, v.verse));
                    parsed_books.push(ParsedBook {
                        book_number: b_num,
                        name: b_name,
                        abbreviation: b_abbrev,
                        testament,
                        verses,
                    });
                }
            }
        }
    }

    if parsed_books.is_empty() {
        return Err(BibleError::Internal(
            "No Bible books or verses could be extracted from JSON. Check the file structure.".into(),
        ));
    }

    parsed_books.sort_by_key(|b| b.book_number);
    Ok(parsed_books)
}

impl BibleDb {
    /// Import a custom translation from JSON into the user database.
    pub fn import_translation(
        &self,
        abbreviation: &str,
        title: &str,
        language: &str,
        license: &str,
        json_content: &str,
    ) -> Result<Translation, BibleError> {
        let user_conn = self.user_conn.as_ref().ok_or_else(|| {
            BibleError::Internal("User translations database not configured".into())
        })?;

        let parsed_books = parse_bible_json(json_content)?;
        let mut conn = user_conn
            .lock()
            .map_err(|e| BibleError::Internal(e.to_string()))?;
        let tx = conn.transaction()?;

        // Replace if abbreviation already exists
        let existing: Option<i64> = tx
            .query_row(
                "SELECT id FROM translations WHERE abbreviation = ?1",
                params![abbreviation],
                |r| r.get(0),
            )
            .optional()?;

        if let Some(old_id) = existing {
            tx.execute("DELETE FROM verses WHERE translation_id = ?1", params![old_id])?;
            tx.execute("DELETE FROM books WHERE translation_id = ?1", params![old_id])?;
            tx.execute("DELETE FROM translations WHERE id = ?1", params![old_id])?;
        }

        tx.execute(
            "INSERT INTO translations (abbreviation, title, language, license, is_copyrighted, is_downloaded, is_user_imported) \
             VALUES (?1, ?2, ?3, ?4, 0, 1, 1)",
            params![abbreviation, title, language, license],
        )?;
        let t_id = tx.last_insert_rowid();

        let mut insert_book = tx.prepare(
            "INSERT INTO books (translation_id, book_number, name, abbreviation, testament) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
        )?;
        let mut insert_verse = tx.prepare(
            "INSERT INTO verses (translation_id, book_id, book_number, book_name, book_abbreviation, chapter, verse, text) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        )?;

        for b in &parsed_books {
            insert_book.execute(params![
                t_id,
                b.book_number,
                b.name,
                b.abbreviation,
                b.testament,
            ])?;
            let b_id = tx.last_insert_rowid();

            for v in &b.verses {
                insert_verse.execute(params![
                    t_id,
                    b_id,
                    b.book_number,
                    b.name,
                    b.abbreviation,
                    v.chapter,
                    v.verse,
                    v.text,
                ])?;
            }
        }

        drop(insert_book);
        drop(insert_verse);
        tx.commit()?;

        log::info!(
            "[BIBLE-IMPORT] Imported {} ({}) with {} books",
            title,
            abbreviation,
            parsed_books.len()
        );

        Ok(Translation {
            id: t_id + USER_TRANSLATION_OFFSET,
            abbreviation: abbreviation.to_string(),
            title: title.to_string(),
            language: language.to_string(),
            is_copyrighted: false,
            is_downloaded: true,
            is_user_imported: true,
        })
    }

    /// Delete a user-imported translation by ID.
    pub fn delete_user_translation(&self, translation_id: i64) -> Result<bool, BibleError> {
        if translation_id < USER_TRANSLATION_OFFSET {
            return Err(BibleError::Internal(
                "Cannot delete bundled system translation".into(),
            ));
        }
        let internal_id = translation_id - USER_TRANSLATION_OFFSET;
        let user_conn = self.user_conn.as_ref().ok_or_else(|| {
            BibleError::Internal("User translations database not configured".into())
        })?;
        let mut conn = user_conn
            .lock()
            .map_err(|e| BibleError::Internal(e.to_string()))?;
        let tx = conn.transaction()?;
        tx.execute("DELETE FROM verses WHERE translation_id = ?1", params![internal_id])?;
        tx.execute("DELETE FROM books WHERE translation_id = ?1", params![internal_id])?;
        let deleted = tx.execute("DELETE FROM translations WHERE id = ?1", params![internal_id])?;
        tx.commit()?;
        Ok(deleted > 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_canonical_info_resolution() {
        let gen = canonical_info("Genesis").unwrap();
        assert_eq!(gen.number, 1);
        assert_eq!(gen.abbreviation, "Gen");

        let sam = canonical_info("1 Samuel").unwrap();
        assert_eq!(sam.number, 9);
        assert_eq!(sam.abbreviation, "1Sam");

        let ps = canonical_info("Psalm").unwrap();
        assert_eq!(ps.number, 19);

        let rev = canonical_info("Revelations").unwrap();
        assert_eq!(rev.number, 66);
    }

    #[test]
    fn test_parse_bible_json_scrollmapper() {
        let json = r#"{
            "translation": "Test Version",
            "books": [
                {
                    "name": "Genesis",
                    "chapters": [
                        {
                            "chapter": 1,
                            "verses": [
                                { "verse": 1, "text": "In the beginning..." },
                                { "verse": 2, "text": "The earth was formless..." }
                            ]
                        }
                    ]
                }
            ]
        }"#;

        let parsed = parse_bible_json(json).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].book_number, 1);
        assert_eq!(parsed[0].verses.len(), 2);
        assert_eq!(parsed[0].verses[0].text, "In the beginning...");
    }

    #[test]
    fn test_parse_bible_json_flat_array() {
        let json = r#"[
            { "book_name": "John", "chapter": 3, "verse": 16, "text": "For God so loved the world..." },
            { "book_name": "John", "chapter": 3, "verse": 17, "text": "For God did not send..." }
        ]"#;

        let parsed = parse_bible_json(json).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].book_number, 43);
        assert_eq!(parsed[0].verses.len(), 2);
    }

    #[test]
    fn test_import_and_query_user_translation() {
        let temp_dir = std::env::temp_dir().join(format!("rhema-test-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let bundled_path = temp_dir.join("bundled.db");
        let user_path = temp_dir.join("user.db");
        let _ = std::fs::remove_file(&bundled_path);
        let _ = std::fs::remove_file(&user_path);

        // Create bundled DB with schema
        {
            let conn = rusqlite::Connection::open(&bundled_path).unwrap();
            conn.execute_batch(
                "CREATE TABLE translations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    abbreviation TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    language TEXT NOT NULL,
                    license TEXT NOT NULL,
                    is_copyrighted INTEGER NOT NULL DEFAULT 0,
                    is_downloaded INTEGER NOT NULL DEFAULT 1
                 );
                 CREATE TABLE books (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    translation_id INTEGER NOT NULL REFERENCES translations(id),
                    book_number INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    abbreviation TEXT NOT NULL,
                    testament TEXT NOT NULL
                 );
                 CREATE TABLE verses (
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
                 INSERT INTO translations (id, abbreviation, title, language, license) VALUES (1, 'KJV', 'King James Version', 'en', 'Public Domain');
                 INSERT INTO books (id, translation_id, book_number, name, abbreviation, testament) VALUES (1, 1, 43, 'John', 'John', 'NT');
                 INSERT INTO verses (id, translation_id, book_id, book_number, book_name, book_abbreviation, chapter, verse, text)
                 VALUES (1, 1, 1, 43, 'John', 'John', 1, 1, 'In the beginning was the Word');",
            ).unwrap();
        }

        let db = BibleDb::open_with_user_db(&bundled_path, Some(&user_path)).unwrap();

        // Check bundled translation exists
        let translations = db.list_translations().unwrap();
        assert_eq!(translations.len(), 1);
        assert_eq!(translations[0].abbreviation, "KJV");
        assert!(!translations[0].is_user_imported);

        // Import a user translation (e.g. MSG)
        let msg_json = r#"[
            { "book_name": "John", "chapter": 1, "verse": 1, "text": "The Word was first, the Word present to God" },
            { "book_name": "John", "chapter": 1, "verse": 2, "text": "The Word was God, in readiness for God from day one." }
        ]"#;

        let imported = db.import_translation("MSG", "The Message", "en", "NavPress", msg_json).unwrap();
        assert_eq!(imported.abbreviation, "MSG");
        assert!(imported.id >= USER_TRANSLATION_OFFSET);
        assert!(imported.is_user_imported);

        // List translations returns both KJV and MSG
        let all_translations = db.list_translations().unwrap();
        assert_eq!(all_translations.len(), 2);
        let user_t = all_translations.iter().find(|t| t.abbreviation == "MSG").unwrap();
        assert!(user_t.is_user_imported);

        // Query verse from user translation
        let verse = db.get_verse(user_t.id, 43, 1, 1).unwrap().expect("Verse John 1:1 should exist");
        assert_eq!(verse.text, "The Word was first, the Word present to God");
        assert_eq!(verse.translation_id, user_t.id);

        // Query chapter from user translation
        let chapter = db.get_chapter(user_t.id, 43, 1).unwrap();
        assert_eq!(chapter.len(), 2);

        // Search verses in user translation
        let search_results = db.search_verses("readiness", user_t.id, 10).unwrap();
        assert_eq!(search_results.len(), 1);
        assert_eq!(search_results[0].verse, 2);

        // Delete user translation
        let deleted = db.delete_user_translation(user_t.id).unwrap();
        assert!(deleted);
        let after_delete = db.list_translations().unwrap();
        assert_eq!(after_delete.len(), 1);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
