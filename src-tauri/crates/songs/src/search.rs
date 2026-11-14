use std::collections::HashSet;

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
/// Deduplicate results by song_id, keeping the best-ranked section per song.
fn deduplicate_by_song(mut results: Vec<SearchSongRow>) -> Vec<SearchSongRow> {
    results.sort_by(|a, b| a.rank.partial_cmp(&b.rank).unwrap_or(std::cmp::Ordering::Equal));
    let mut seen = HashSet::new();
    results.into_iter().filter(|r| seen.insert(r.song_id)).collect()
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

    // Title prefix boost
    let title_boost = search_by_title_prefix(conn, query, limit)?;
    all_results.extend(title_boost);

    // Deduplicate by song_id, keeping best match
    let mut final_results = deduplicate_by_song(all_results);

    // Sort by rank (best first)
    final_results.sort_by(|a, b| a.rank.partial_cmp(&b.rank).unwrap_or(std::cmp::Ordering::Equal));

    // Limit final results
    final_results.truncate(limit);

    Ok(final_results)
}
/// Search songs by title prefix (for autocomplete / quick search)
fn search_by_title_prefix(
    conn: &Connection,
    query: &str,
    limit: usize,
) -> Result<Vec<SearchSongRow>, SongsError> {
    let pattern = format!("{}%", query);
    let sql = "
        SELECT
            s.id as song_id,
            s.title,
            s.author
        FROM songs s
        WHERE s.title LIKE ?1
        ORDER BY s.title
        LIMIT ?2
    ";

    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([&pattern, &limit.to_string()], |row| {
        Ok(SearchSongRow {
            song_id: row.get(0)?,
            title: row.get(1)?,
            author: row.get(2)?,
            section_type: String::new(),
            section_number: 0,
            lyrics: String::new(),
            rank: -1000.0,
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
}