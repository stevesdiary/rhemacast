#![expect(clippy::needless_pass_by_value, reason = "Tauri command extractors require pass-by-value")]

use std::sync::Mutex;
use serde::Serialize;
use tauri::State;

use crate::state::AppState;
use rhema_songs::{SearchSongRow, Song, SongSection, SongWithSections};

#[tauri::command]
pub fn list_songs(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<Song>, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let db = app_state
        .songs_db
        .as_ref()
        .ok_or_else(|| "Songs database not loaded".to_string())?;
    db.list_songs().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_song(
    state: State<'_, Mutex<AppState>>,
    song_id: i64,
) -> Result<Option<SongWithSections>, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let db = app_state
        .songs_db
        .as_ref()
        .ok_or_else(|| "Songs database not loaded".to_string())?;
    db.get_song(song_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_songs(
    state: State<'_, Mutex<AppState>>,
    query: String,
    limit: usize,
) -> Result<Vec<SearchSongRow>, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let db = app_state
        .songs_db
        .as_ref()
        .ok_or_else(|| "Songs database not loaded".to_string())?;
    
    let conn = db.conn.lock().unwrap();
    rhema_songs::search::search_songs(&conn, &query, limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_songs_by_title(
    state: State<'_, Mutex<AppState>>,
    query: String,
    limit: usize,
) -> Result<Vec<Song>, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let db = app_state
        .songs_db
        .as_ref()
        .ok_or_else(|| "Songs database not loaded".to_string())?;
    db.search_songs_by_title(&query, limit).map_err(|e| e.to_string())
}