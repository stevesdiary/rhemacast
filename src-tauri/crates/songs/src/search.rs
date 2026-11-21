use std::collections::HashMap;

use rusqlite::Connection;

use crate::error::SongsError;
use crate::models::SearchSongRow;

// ─── Stop words ──────────────────────────────────────────────────────

/// Common English stop words that match nearly every song lyric.
/// Filtering these keeps AND queries fast.
const STOP_WORDS: &[&str] = &[
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "it", "be", "are", "was",
    "were", "been", "has", "have", "had", "do", "does", "did", "that",
    "this", "these", "those", "he", "she", "we", "they", "you", "i",
    "me", "him", "her", "us", "them", "my", "his", "its", "our", "your",
    "their", "so", "if", "as", "am", "about", "into", "than",
    "just", "also", "very", "like", "even",
];

fn is_stop_word(word: &str) -> bool {
    let lower = word.to_lowercase();
    STOP_WORDS.iter().any(|&w| w == lower)
}

// ─── FTS5 query builders ─────────────────────────────────────────────

/// Clean input: strip non-alphanumeric chars (except apostrophes).
fn clean_word(w: &str) -> String {
    w.chars()
        .filter(|c| c.is_alphanumeric() || *c == '\'')
        .collect()
}

/// Exact phrase match — wraps entire input in double quotes.
fn build_phrase_query(input: &str) -> String {
    let cleaned: String = input
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace() || *c == '\'')
        .collect();
    let trimmed = cleaned.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    format!("\"{trimmed}\"")
}

/// AND query with stop words removed — all significant words must be present.
fn build_and_query(input: &str) -> String {
    let tokens: Vec<String> = input
        .split_whitespace()
        .map(clean_word)
        .filter(|w| w.len() >= 2 && !is_stop_word(w))
        .take(12)
        .collect();
    if tokens.is_empty() {
        return String::new();
    }
    tokens.join(" ")
}

/// OR query with stop words removed — any significant word may be present.
fn build_or_query(input: &str) -> String {
    let tokens: Vec<String> = input
        .split_whitespace()
        .map(clean_word)
        .filter(|w| w.len() >= 2 && !is_stop_word(w))
        .take(12)
        .collect();
    if tokens.is_empty() {
        return String::new();
    }
    tokens.join(" OR ")
}
// ─── BM25 search ─────────────────────────────────────────────────────

/// Execute a single FTS5 query tier and return ranked results.
fn query_tier(
    conn: &Connection,
    fts_query: &str,
    limit: usize,
    phrase_match: bool,
) -> Result<Vec<SearchSongRow>, SongsError> {
    if fts_query.is_empty() {
        return Ok(Vec::new());
    }

    let sql = "
        SELECT
            s.id as song_id,
            s.title,
            s.author,
            ss.section_type,
            ss.section_number,
            ss.lyrics,
            bm25(song_sections_fts) as rank
        FROM song_sections_fts
        JOIN song_sections ss ON song_sections_fts.rowid = ss.id
        JOIN songs s ON ss.song_id = s.id
        WHERE song_sections_fts MATCH ?1
        ORDER BY rank
        LIMIT ?2
    ";

    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([fts_query, &limit.to_string()], |row| {
        Ok(SearchSongRow {
            song_id: row.get(0)?,
            title: row.get(1)?,
            author: row.get(2)?,
            section_type: row.get(3)?,
            section_number: row.get(4)?,
            lyrics: row.get(5)?,
            rank: row.get(6)?,
            phrase_match,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}
/// Deduplicate results by `song_id`, keeping the best-ranked section per song.
/// If a song has both a title-boost match (with empty lyrics) and a lyric match,
/// we retain the title-boost rank while attaching the matched section's lyrics snippet.
fn deduplicate_by_song(mut results: Vec<SearchSongRow>) -> Vec<SearchSongRow> {
    results.sort_by(|a, b| a.rank.partial_cmp(&b.rank).unwrap_or(std::cmp::Ordering::Equal));
    let mut seen: HashMap<i64, SearchSongRow> = HashMap::new();
    for r in results {
        match seen.entry(r.song_id) {
            std::collections::hash_map::Entry::Vacant(e) => {
                e.insert(r);
            }
            std::collections::hash_map::Entry::Occupied(mut e) => {
                let entry = e.get_mut();
                if entry.lyrics.is_empty() && !r.lyrics.is_empty() {
                    entry.section_type = r.section_type;
                    entry.section_number = r.section_number;
                    entry.lyrics = r.lyrics;
                    entry.phrase_match = entry.phrase_match || r.phrase_match;
                }
            }
        }
    }
    let mut deduped: Vec<SearchSongRow> = seen.into_values().collect();
    deduped.sort_by(|a, b| a.rank.partial_cmp(&b.rank).unwrap_or(std::cmp::Ordering::Equal));
    deduped
}

/// Search songs using 3-tier BM25 (phrase -> AND -> OR) with title boost.
pub fn search_songs(
    conn: &Connection,
    query: &str,
    limit: usize,
) -> Result<Vec<SearchSongRow>, SongsError> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let mut all_results = Vec::new();

    // Tier 1: Exact phrase match (highest priority)
    let phrase_query = build_phrase_query(query);
    if !phrase_query.is_empty() {
        let mut tier1 = query_tier(conn, &phrase_query, limit, true)?;
        for r in &mut tier1 {
            r.rank -= 100.0;
        }
        all_results.extend(tier1);
    }

    // Tier 2: AND query (all significant words)
    let and_query = build_and_query(query);
    if !and_query.is_empty() && all_results.len() < limit {
        let mut tier2 = query_tier(conn, &and_query, limit - all_results.len(), false)?;
        for r in &mut tier2 {
            r.rank -= 10.0;
        }
        all_results.extend(tier2);
    }

    // Tier 3: OR query (any significant word)
    let or_query = build_or_query(query);
    if !or_query.is_empty() && all_results.len() < limit {
        let tier3 = query_tier(conn, &or_query, limit - all_results.len(), false)?;
        all_results.extend(tier3);
    }

    // Title boost (prefix & substring)
    let title_boost = search_by_title_boost(conn, query, limit)?;
    all_results.extend(title_boost);

    // Deduplicate by song_id, keeping best match
    let mut final_results = deduplicate_by_song(all_results);

    // Sort by rank (best first)
    final_results.sort_by(|a, b| a.rank.partial_cmp(&b.rank).unwrap_or(std::cmp::Ordering::Equal));

    // Limit final results
    final_results.truncate(limit);

    Ok(final_results)
}
/// Search songs by title (prefix matches get -2000.0 boost, substring matches get -1000.0 boost)
fn search_by_title_boost(
    conn: &Connection,
    query: &str,
    limit: usize,
) -> Result<Vec<SearchSongRow>, SongsError> {
    let clean = query.trim();
    if clean.is_empty() {
        return Ok(Vec::new());
    }
    let prefix = format!("{clean}%");
    let contains = format!("%{clean}%");
    let sql = "
        SELECT
            s.id as song_id,
            s.title,
            s.author,
            CASE
                WHEN s.title LIKE ?1 THEN -2000.0
                ELSE -1000.0
            END as rank
        FROM songs s
        WHERE s.title LIKE ?2
        ORDER BY rank, s.title
        LIMIT ?3
    ";

    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([&prefix, &contains, &limit.to_string()], |row| {
        Ok(SearchSongRow {
            song_id: row.get(0)?,
            title: row.get(1)?,
            author: row.get(2)?,
            section_type: String::new(),
            section_number: 0,
            lyrics: String::new(),
            rank: row.get(3)?,
            phrase_match: false,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::SongsDb;
    use crate::models::{SectionType, Song, SongSection};
    use std::collections::HashSet;
    use std::env;
    use std::thread;

    fn test_db() -> SongsDb {
        let path = env::temp_dir().join(format!(
            "rhema-songs-test-{}-{:?}.db",
            std::process::id(),
            thread::current().id()
        ));
        let _ = std::fs::remove_file(&path);
        let db = SongsDb::open_writable(&path).unwrap();
        db.init_schema().unwrap();

        let song1 = Song {
            id: 0,
            title: "Amazing Grace".to_string(),
            author: Some("John Newton".to_string()),
            composer: Some("Traditional".to_string()),
            copyright: None,
            ccli_number: Some("22025".to_string()),
            themes: vec!["grace".to_string(), "salvation".to_string()],
        };
        let song1_id = db.insert_song(&song1).unwrap();

        db.insert_section(&SongSection {
            id: 0,
            song_id: song1_id,
            section_type: SectionType::Verse,
            section_number: 1,
            lyrics: "Amazing grace, how sweet the sound".to_string(),
            order_index: 1,
        }).unwrap();

        db.insert_section(&SongSection {
            id: 0,
            song_id: song1_id,
            section_type: SectionType::Chorus,
            section_number: 1,
            lyrics: "Amazing grace, amazing grace".to_string(),
            order_index: 2,
        }).unwrap();

        let song2 = Song {
            id: 0,
            title: "How Great Thou Art".to_string(),
            author: Some("Carl Boberg".to_string()),
            composer: Some("Traditional".to_string()),
            copyright: None,
            ccli_number: Some("14181".to_string()),
            themes: vec!["worship".to_string(), "creation".to_string()],
        };
        let song2_id = db.insert_song(&song2).unwrap();

        db.insert_section(&SongSection {
            id: 0,
            song_id: song2_id,
            section_type: SectionType::Verse,
            section_number: 1,
            lyrics: "O Lord my God, when I in awesome wonder".to_string(),
            order_index: 1,
        }).unwrap();

        db
    }

    #[test]
    fn test_search_by_title() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();
        let results = search_songs(&conn, "Amazing", 10).unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].title, "Amazing Grace");
    }

    #[test]
    fn test_search_by_lyrics() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();
        let results = search_songs(&conn, "sweet the sound", 10).unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].title, "Amazing Grace");
        assert!(results[0].phrase_match);
    }

    #[test]
    fn test_search_deduplicates_by_song() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();
        let results = search_songs(&conn, "amazing grace", 10).unwrap();
        let mut song_ids = HashSet::new();
        for r in &results {
            assert!(song_ids.insert(r.song_id), "duplicate song_id: {}", r.song_id);
        }
    }

    #[test]
    fn test_search_by_title_substring() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();
        // "Thou Art" is inside "How Great Thou Art" (substring, not a prefix)
        let results = search_songs(&conn, "Thou Art", 10).unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].title, "How Great Thou Art");
    }

    #[test]
    fn test_title_match_retains_lyric_snippet() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();
        // "Amazing" matches title AND lyrics
        let results = search_songs(&conn, "Amazing", 10).unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].title, "Amazing Grace");
        assert!(!results[0].lyrics.is_empty(), "lyrics snippet should be retained on title match");
    }

    #[test]
    fn test_create_song_and_search() {
        let db = test_db();
        let new_song = Song {
            id: 0,
            title: "Cornerstone".to_string(),
            author: Some("Hillsong".to_string()),
            composer: None,
            copyright: None,
            ccli_number: None,
            themes: vec!["faith".to_string()],
        };
        let sections = vec![
            SongSection {
                id: 0,
                song_id: 0,
                section_type: SectionType::Verse,
                section_number: 1,
                lyrics: "My hope is built on nothing less".to_string(),
                order_index: 1,
            },
            SongSection {
                id: 0,
                song_id: 0,
                section_type: SectionType::Chorus,
                section_number: 1,
                lyrics: "Christ alone, cornerstone".to_string(),
                order_index: 2,
            },
        ];
        let created = db.create_song(&new_song, &sections).unwrap();
        assert!(created.song.id > 0);
        assert_eq!(created.sections.len(), 2);

        let conn = db.conn.lock().unwrap();
        let results = search_songs(&conn, "Cornerstone", 10).unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].title, "Cornerstone");
    }

    #[test]
    fn test_update_song_and_update_section_lyrics() {
        let db = test_db();
        let mut song = db.get_song(1).unwrap().unwrap();
        assert_eq!(song.song.title, "Amazing Grace");

        // Update single section lyrics directly
        let sec_id = song.sections[0].id;
        db.update_section_lyrics(sec_id, "Amazing grace how sweet the melody").unwrap();
        let reloaded = db.get_song(1).unwrap().unwrap();
        assert_eq!(reloaded.sections[0].lyrics, "Amazing grace how sweet the melody");

        // Update entire song and sections
        song.song.title = "Amazing Grace (Updated)".to_string();
        song.sections[0].lyrics = "Amazing grace how sweet the sound changed".to_string();
        let updated = db.update_song(&song.song, &song.sections).unwrap();
        assert_eq!(updated.song.title, "Amazing Grace (Updated)");
        assert_eq!(updated.sections[0].lyrics, "Amazing grace how sweet the sound changed");

        // Verify FTS5 indexed the updated lyrics
        let conn = db.conn.lock().unwrap();
        let results = search_songs(&conn, "changed", 10).unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].title, "Amazing Grace (Updated)");
    }
}