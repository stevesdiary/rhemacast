import { create } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import type {
  Song,
  SongSection,
  SongWithSections,
  SearchSongRow,
  SongQueueItem,
} from "@/types"

interface SongsState {
  songs: Song[]
  searchResults: SearchSongRow[]
  selectedSong: SongWithSections | null
  selectedSection: SongSection | null
  pendingSongQueue: SongQueueItem | null
  activeSlideIndex: number
  displayMode: "line" | "stanza"

  setSongs: (songs: Song[]) => void
  setSearchResults: (results: SearchSongRow[]) => void
  selectSong: (song: SongWithSections | null) => void
  selectSection: (section: SongSection | null) => void
  setPendingSongQueue: (item: SongQueueItem | null) => void
  setActiveSlideIndex: (index: number) => void
  setDisplayMode: (mode: "line" | "stanza") => void
}

export const useSongsStore = create<SongsState>((set) => ({
  songs: [],
  searchResults: [],
  selectedSong: null,
  selectedSection: null,
  pendingSongQueue: null,
  activeSlideIndex: 0,
  displayMode: "line",

  setSongs: (songs) => set({ songs }),
  setSearchResults: (searchResults) => set({ searchResults }),
  selectSong: (selectedSong) =>
    set({ selectedSong, selectedSection: null, activeSlideIndex: 0 }),
  selectSection: (selectedSection) =>
    set({ selectedSection, activeSlideIndex: 0 }),
  setPendingSongQueue: (pendingSongQueue) => set({ pendingSongQueue }),
  setActiveSlideIndex: (activeSlideIndex) => set({ activeSlideIndex }),
  setDisplayMode: (displayMode) => set({ displayMode, activeSlideIndex: 0 }),
}))

/** Load all songs into the store */
export async function loadSongs(): Promise<Song[]> {
  const songs = await invoke<Song[]>("list_songs")
  useSongsStore.getState().setSongs(songs)
  return songs
}

/** Search songs by lyrics (BM25 full-text search) */
export async function searchSongs(
  query: string,
  limit = 20
): Promise<SearchSongRow[]> {
  const results = await invoke<SearchSongRow[]>("search_songs", {
    query,
    limit,
  })
  useSongsStore.getState().setSearchResults(results)
  return results
}

/** Search songs by title prefix (for autocomplete/quick search) */
export async function searchSongsByTitle(
  query: string,
  limit = 20
): Promise<Song[]> {
  return invoke<Song[]>("search_songs_by_title", { query, limit })
}

/** Get a full song with all its sections */
export async function getSong(
  songId: number
): Promise<SongWithSections | null> {
  const song = await invoke<SongWithSections | null>("get_song", { songId })
  if (song) {
    useSongsStore.getState().selectSong(song)
  }
  return song
}

/** Create a new song with its sections and add to the library */
export async function createSong(
  song: Omit<Song, "id">,
  sections: Array<Omit<SongSection, "id" | "song_id">>
): Promise<SongWithSections> {
  const payloadSong: Song = {
    ...song,
    id: 0,
  }
  const payloadSections: SongSection[] = sections.map((sec, idx) => ({
    ...sec,
    id: 0,
    song_id: 0,
    order_index: sec.order_index ?? idx + 1,
  }))

  const created = await invoke<SongWithSections>("create_song", {
    song: payloadSong,
    sections: payloadSections,
  })

  // Refresh songs list in store
  await loadSongs()

  return created
}

/** Update an existing song and its sections in the database */
export async function updateSong(
  song: Song,
  sections: SongSection[]
): Promise<SongWithSections> {
  const updated = await invoke<SongWithSections>("update_song", {
    song,
    sections,
  })

  // Refresh songs list in store
  await loadSongs()

  // If this song is currently selected in the store, update it
  const currentSelected = useSongsStore.getState().selectedSong
  if (currentSelected?.song.id === song.id) {
    useSongsStore.getState().selectSong(updated)
  }

  return updated
}

/** Quickly update a single song section's lyrics in the database */
export async function updateSectionLyrics(
  sectionId: number,
  lyrics: string
): Promise<void> {
  await invoke("update_section_lyrics", {
    sectionId,
    lyrics,
  })

  // If this song is currently selected in the store, keep it updated
  const currentSelected = useSongsStore.getState().selectedSong
  if (currentSelected) {
    const hasSection = currentSelected.sections.some((s) => s.id === sectionId)
    if (hasSection) {
      useSongsStore.getState().selectSong({
        ...currentSelected,
        sections: currentSelected.sections.map((s) =>
          s.id === sectionId ? { ...s, lyrics } : s
        ),
      })
    }
  }
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
