use rusqlite::params;

use crate::db::BibleDb;
use crate::error::BibleError;
use crate::models::ConcordanceEntry;

impl BibleDb {
    /// Retrieve a single concordance entry by Strong's number (e.g., "G2540", "H7965").
    pub fn get_concordance_entry(
        &self,
        strongs_number: &str,
    ) -> Result<Option<ConcordanceEntry>, BibleError> {
        let conn = self.conn.lock().map_err(|e| BibleError::Internal(e.to_string()))?;
        let mut stmt = conn.prepare_cached(
            "SELECT id, strongs_number, language, lemma, translit, translit_clean,
                    pronunciation, strongs_def, kjv_def, derivation, aliases
             FROM concordance_entries
             WHERE UPPER(strongs_number) = UPPER(?1)
             LIMIT 1",
        )?;

        let mut rows = stmt.query(params![strongs_number])?;
        if let Some(row) = rows.next()? {
            Ok(Some(ConcordanceEntry {
                id: row.get(0)?,
                strongs_number: row.get(1)?,
                language: row.get(2)?,
                lemma: row.get(3)?,
                translit: row.get(4)?,
                translit_clean: row.get(5)?,
                pronunciation: row.get(6)?,
                strongs_def: row.get(7)?,
                kjv_def: row.get(8)?,
                derivation: row.get(9)?,
                aliases: row.get(10)?,
            }))
        } else {
            Ok(None)
        }
    }

    /// Lookup concordance entries matching a clean transliteration or alias (e.g. "kairos", "rhema", "rema", "zoe").
    pub fn lookup_concordance_by_word(
        &self,
        term: &str,
    ) -> Result<Vec<ConcordanceEntry>, BibleError> {
        let clean = term
            .trim()
            .to_lowercase()
            .chars()
            .filter(|c| c.is_alphanumeric())
            .collect::<String>();

        if clean.is_empty() {
            return Ok(Vec::new());
        }

        let conn = self.conn.lock().map_err(|e| BibleError::Internal(e.to_string()))?;
        let alias_pattern = format!("%\"{}\"%", clean);

        let mut stmt = conn.prepare_cached(
            "SELECT id, strongs_number, language, lemma, translit, translit_clean,
                    pronunciation, strongs_def, kjv_def, derivation, aliases
             FROM concordance_entries
             WHERE translit_clean = ?1 OR aliases LIKE ?2
             ORDER BY CASE WHEN translit_clean = ?1 THEN 0 ELSE 1 END, id ASC
             LIMIT 10",
        )?;

        let rows = stmt.query_map(params![clean, alias_pattern], |row| {
            Ok(ConcordanceEntry {
                id: row.get(0)?,
                strongs_number: row.get(1)?,
                language: row.get(2)?,
                lemma: row.get(3)?,
                translit: row.get(4)?,
                translit_clean: row.get(5)?,
                pronunciation: row.get(6)?,
                strongs_def: row.get(7)?,
                kjv_def: row.get(8)?,
                derivation: row.get(9)?,
                aliases: row.get(10)?,
            })
        })?;

        let mut entries = Vec::new();
        for r in rows {
            entries.push(r?);
        }
        Ok(entries)
    }

    /// Search the concordance by Strong's number, Greek/Hebrew lemma, transliteration,
    /// or definition text (using FTS5 with LIKE fallback).
    pub fn search_concordance(
        &self,
        query: &str,
        limit: u32,
    ) -> Result<Vec<ConcordanceEntry>, BibleError> {
        let trimmed = query.trim();
        if trimmed.is_empty() {
            return Ok(Vec::new());
        }

        // 1. Direct Strong's number match (e.g. "G2540", "H7965")
        if (trimmed.starts_with('G') || trimmed.starts_with('g') || trimmed.starts_with('H') || trimmed.starts_with('h'))
            && trimmed[1..].chars().all(|c| c.is_ascii_digit())
        {
            if let Some(entry) = self.get_concordance_entry(trimmed)? {
                return Ok(vec![entry]);
            }
        }

        let conn = self.conn.lock().map_err(|e| BibleError::Internal(e.to_string()))?;

        // 2. Try FTS5 search first
        let fts_query = trimmed
            .split_whitespace()
            .map(|word| {
                let clean: String = word.chars().filter(|c| c.is_alphanumeric()).collect();
                format!("\"{clean}\"*")
            })
            .collect::<Vec<_>>()
            .join(" ");

        if !fts_query.is_empty() {
            let fts_res = conn.prepare_cached(
                "SELECT c.id, c.strongs_number, c.language, c.lemma, c.translit, c.translit_clean,
                        c.pronunciation, c.strongs_def, c.kjv_def, c.derivation, c.aliases
                 FROM concordance_entries c
                 JOIN concordance_fts f ON f.rowid = c.id
                 WHERE concordance_fts MATCH ?1
                 ORDER BY rank
                 LIMIT ?2",
            );

            if let Ok(mut stmt) = fts_res {
                if let Ok(rows) = stmt.query_map(params![fts_query, limit], |row| {
                    Ok(ConcordanceEntry {
                        id: row.get(0)?,
                        strongs_number: row.get(1)?,
                        language: row.get(2)?,
                        lemma: row.get(3)?,
                        translit: row.get(4)?,
                        translit_clean: row.get(5)?,
                        pronunciation: row.get(6)?,
                        strongs_def: row.get(7)?,
                        kjv_def: row.get(8)?,
                        derivation: row.get(9)?,
                        aliases: row.get(10)?,
                    })
                }) {
                    let mut entries = Vec::new();
                    for r in rows.flatten() {
                        entries.push(r);
                    }
                    if !entries.is_empty() {
                        return Ok(entries);
                    }
                }
            }
        }

        // 3. Fallback to LIKE matching
        let like_pat = format!("%{trimmed}%");
        let mut stmt = conn.prepare_cached(
            "SELECT id, strongs_number, language, lemma, translit, translit_clean,
                    pronunciation, strongs_def, kjv_def, derivation, aliases
             FROM concordance_entries
             WHERE translit_clean LIKE ?1
                OR translit LIKE ?1
                OR lemma LIKE ?1
                OR strongs_def LIKE ?1
                OR kjv_def LIKE ?1
             ORDER BY CASE WHEN translit_clean LIKE ?1 THEN 0 ELSE 1 END, id ASC
             LIMIT ?2",
        )?;

        let rows = stmt.query_map(params![like_pat, limit], |row| {
            Ok(ConcordanceEntry {
                id: row.get(0)?,
                strongs_number: row.get(1)?,
                language: row.get(2)?,
                lemma: row.get(3)?,
                translit: row.get(4)?,
                translit_clean: row.get(5)?,
                pronunciation: row.get(6)?,
                strongs_def: row.get(7)?,
                kjv_def: row.get(8)?,
                derivation: row.get(9)?,
                aliases: row.get(10)?,
            })
        })?;

        let mut entries = Vec::new();
        for r in rows {
            entries.push(r?);
        }
        Ok(entries)
    }
}
