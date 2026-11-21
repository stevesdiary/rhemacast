import { invoke } from "@tauri-apps/api/core"
import { useSongsStore } from "@/stores/songs-store"
import type { Song, SongSection, SongWithSections, SearchSongRow, SongQueueItem } from "@/types"

// Stable action functions using getState() to avoid re-render loops

async function loadSongs(): Promise<Song[]> {
  const songs = await invoke<Song[]>("list_songs")
  useSongsStore.getState().setSongs(songs)
  return songs
}

export async function fetchSong(songId: number): Promise<SongWithSections | null> {
  return invoke<SongWithSections | null>("get_song", { songId })
}

export async function searchSongs(query: string, limit = 20): Promise<SearchSongRow[]> {
  const results = await invoke<SearchSongRow[]>("search_songs", { query, limit })
  useSongsStore.getState().setSearchResults(results)
  return results
}

export async function searchSongsByTitle(query: string, limit = 20): Promise<Song[]> {
  return invoke<Song[]>("search_songs_by_title", { query, limit })
}

export function selectSong(song: SongWithSections | null) {
  useSongsStore.getState().selectSong(song)
}

export function selectSection(section: SongSection | null) {
  useSongsStore.getState().selectSection(section)
}

/** Queue a song or section for presentation */
export function queueSong(
  song: SongWithSections,
  section: SongSection | null,
  reference: string
): SongQueueItem {
  const item: SongQueueItem = {
    id: crypto.randomUUID(),
    type: "song",
    song,
    section,
    reference,
    added_at: Date.now(),
    source: "manual",
  }
  useSongsStore.getState().setPendingSongQueue(item)
  return item
}

export function clearPendingQueue() {
  useSongsStore.getState().setPendingSongQueue(null)
}

// Exported stable references
export const songsActions = {
  loadSongs,
  fetchSong,
  searchSongs,
  searchSongsByTitle,
  selectSong,
  selectSection,
  queueSong,
  clearPendingQueue,
}

// Hook for components that need reactive store data
export function useSongs() {
  const songs = useSongsStore((s) => s.songs)
  const searchResults = useSongsStore((s) => s.searchResults)
  const selectedSong = useSongsStore((s) => s.selectedSong)
  const selectedSection = useSongsStore((s) => s.selectedSection)
  const pendingSongQueue = useSongsStore((s) => s.pendingSongQueue)

  return {
    songs,
    searchResults,
    selectedSong,
    selectedSection,
    pendingSongQueue,
    ...songsActions,
  }
}