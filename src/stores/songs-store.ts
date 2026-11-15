import { create } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import type { Song, SongSection, SongWithSections, SearchSongRow, SongQueueItem } from "@/types"

interface SongsState {
  songs: Song[]
  searchResults: SearchSongRow[]
  selectedSong: SongWithSections | null
  selectedSection: SongSection | null
  pendingSongQueue: SongQueueItem | null

  setSongs: (songs: Song[]) => void
  setSearchResults: (results: SearchSongRow[]) => void
  selectSong: (song: SongWithSections | null) => void
  selectSection: (section: SongSection | null) => void
  setPendingSongQueue: (item: SongQueueItem | null) => void
}

export const useSongsStore = create<SongsState>((set) => ({
  songs: [],
  searchResults: [],
  selectedSong: null,
  selectedSection: null,
  pendingSongQueue: null,

  setSongs: (songs) => set({ songs }),
  setSearchResults: (searchResults) => set({ searchResults }),
  selectSong: (selectedSong) => set({ selectedSong, selectedSection: null }),
  selectSection: (selectedSection) => set({ selectedSection }),
  setPendingSongQueue: (pendingSongQueue) => set({ pendingSongQueue }),
}))

/** Load all songs into the store */
export async function loadSongs(): Promise<Song[]> {
  const songs = await invoke<Song[]>("list_songs")
  useSongsStore.getState().setSongs(songs)
  return songs
}

/** Search songs by lyrics (BM25 full-text search) */
export async function searchSongs(query: string, limit = 20): Promise<SearchSongRow[]> {
  const results = await invoke<SearchSongRow[]>("search_songs", { query, limit })
  useSongsStore.getState().setSearchResults(results)
  return results
}

/** Search songs by title prefix (for autocomplete/quick search) */
export async function searchSongsByTitle(query: string, limit = 20): Promise<Song[]> {
  return invoke<Song[]>("search_songs_by_title", { query, limit })
}

/** Get a full song with all its sections */
export async function getSong(songId: number): Promise<SongWithSections | null> {
  const song = await invoke<SongWithSections | null>("get_song", { songId })
  if (song) {
    useSongsStore.getState().selectSong(song)
  }
  return song
}

/** Queue a song (or specific section) for presentation */
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