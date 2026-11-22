#![expect(clippy::needless_pass_by_value, reason = "Tauri command extractors require pass-by-value")]

use std::sync::Mutex;
use tauri::State;

use rhema_bible::ConcordanceEntry;
use rhema_detection::{ConcordanceDetection, ConcordanceDetector};

use crate::state::AppState;

#[tauri::command]
pub fn get_concordance_entry(
    state: State<'_, Mutex<AppState>>,
    strongs_number: String,
) -> Result<Option<ConcordanceEntry>, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let db = app_state
        .bible_db
        .as_ref()
        .ok_or_else(|| "Bible database not loaded".to_string())?;
    db.get_concordance_entry(&strongs_number).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_concordance(
    state: State<'_, Mutex<AppState>>,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<ConcordanceEntry>, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let db = app_state
        .bible_db
        .as_ref()
        .ok_or_else(|| "Bible database not loaded".to_string())?;
    db.search_concordance(&query, limit.unwrap_or(20))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn detect_concordance_words(
    state: State<'_, Mutex<AppState>>,
    detector_state: State<'_, Mutex<ConcordanceDetector>>,
    text: String,
) -> Result<Vec<ConcordanceDetection>, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let db = app_state
        .bible_db
        .as_ref()
        .ok_or_else(|| "Bible database not loaded".to_string())?;
    let mut detector = detector_state.lock().map_err(|e| e.to_string())?;
    Ok(detector.detect(&text, db))
}
