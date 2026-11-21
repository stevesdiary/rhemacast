import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  useSongsStore,
  loadSongs,
  searchSongs,
  searchSongsByTitle,
  getSong,
  createSong,
  queueSong,
} from "./songs-store"
import type {
  Song,
  SongWithSections,
  SearchSongRow,
  SectionType,
} from "@/types"

const mockInvoke = vi.fn()

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

const sampleSong: Song = {
  id: 1,
  title: "Amazing Grace",
  author: "John Newton",
  composer: "Traditional",
  copyright: null,
  ccli_number: "22025",
  themes: ["grace", "salvation"],
}

const sampleSongWithSections: SongWithSections = {
  ...sampleSong,
  sections: [
    {
      id: 10,
      song_id: 1,
      section_type: "verse" as SectionType,
      section_number: 1,
      lyrics: "Amazing grace, how sweet the sound\nThat saved a wretch like me",
      order_index: 1,
    },
    {
      id: 11,
      song_id: 1,
      section_type: "chorus" as SectionType,
      section_number: 1,
      lyrics: "Amazing grace, amazing grace",
      order_index: 2,
    },
  ],
}

const sampleSearchRow: SearchSongRow = {
  song_id: 1,
  title: "Amazing Grace",
  author: "John Newton",
  section_type: "verse",
  section_number: 1,
  lyrics: "Amazing grace, how sweet the sound",
  rank: -1000.0,
  phrase_match: true,
}

describe("songs-store", () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    useSongsStore.setState({
      songs: [],
      searchResults: [],
      selectedSong: null,
      selectedSection: null,
      pendingSongQueue: null,
      activeSlideIndex: 0,
      displayMode: "line",
    })
  })

  it("sets songs list in store", () => {
    useSongsStore.getState().setSongs([sampleSong])
    expect(useSongsStore.getState().songs).toEqual([sampleSong])
  })

  it("sets search results in store", () => {
    useSongsStore.getState().setSearchResults([sampleSearchRow])
    expect(useSongsStore.getState().searchResults).toEqual([sampleSearchRow])
  })

  it("selects song and resets slide index and section", () => {
    useSongsStore.setState({ activeSlideIndex: 3 })
    useSongsStore.getState().selectSong(sampleSongWithSections)
    expect(useSongsStore.getState().selectedSong).toEqual(
      sampleSongWithSections
    )
    expect(useSongsStore.getState().selectedSection).toBeNull()
    expect(useSongsStore.getState().activeSlideIndex).toBe(0)
  })

  it("selects section and resets slide index", () => {
    useSongsStore.setState({ activeSlideIndex: 2 })
    const section = sampleSongWithSections.sections[0]
    useSongsStore.getState().selectSection(section)
    expect(useSongsStore.getState().selectedSection).toEqual(section)
    expect(useSongsStore.getState().activeSlideIndex).toBe(0)
  })

  it("loads songs via Tauri list_songs invoke", async () => {
    mockInvoke.mockResolvedValueOnce([sampleSong])
    const result = await loadSongs()
    expect(mockInvoke).toHaveBeenCalledWith("list_songs")
    expect(result).toEqual([sampleSong])
    expect(useSongsStore.getState().songs).toEqual([sampleSong])
  })

  it("searches songs (unified title/lyrics) via Tauri search_songs invoke", async () => {
    mockInvoke.mockResolvedValueOnce([sampleSearchRow])
    const result = await searchSongs("sweet sound", 30)
    expect(mockInvoke).toHaveBeenCalledWith("search_songs", {
      query: "sweet sound",
      limit: 30,
    })
    expect(result).toEqual([sampleSearchRow])
    expect(useSongsStore.getState().searchResults).toEqual([sampleSearchRow])
  })

  it("searches songs by title via Tauri search_songs_by_title invoke", async () => {
    mockInvoke.mockResolvedValueOnce([sampleSong])
    const result = await searchSongsByTitle("Amazing", 15)
    expect(mockInvoke).toHaveBeenCalledWith("search_songs_by_title", {
      query: "Amazing",
      limit: 15,
    })
    expect(result).toEqual([sampleSong])
  })

  it("fetches full song and selects it", async () => {
    mockInvoke.mockResolvedValueOnce(sampleSongWithSections)
    const result = await getSong(1)
    expect(mockInvoke).toHaveBeenCalledWith("get_song", { songId: 1 })
    expect(result).toEqual(sampleSongWithSections)
    expect(useSongsStore.getState().selectedSong).toEqual(
      sampleSongWithSections
    )
  })

  it("queues song section with metadata", () => {
    const section = sampleSongWithSections.sections[0]
    const item = queueSong(
      sampleSongWithSections,
      section,
      "Amazing Grace — Verse 1"
    )
    expect(item.type).toBe("song")
    expect(item.reference).toBe("Amazing Grace — Verse 1")
    expect(item.section).toEqual(section)
    expect(useSongsStore.getState().pendingSongQueue).toEqual(item)
  })

  it("creates a song via Tauri create_song invoke and reloads songs", async () => {
    mockInvoke
      .mockResolvedValueOnce(sampleSongWithSections) // for create_song
      .mockResolvedValueOnce([sampleSong]) // for loadSongs
    const result = await createSong(
      {
        title: sampleSong.title,
        author: sampleSong.author,
        composer: sampleSong.composer,
        copyright: sampleSong.copyright,
        ccli_number: sampleSong.ccli_number,
        themes: sampleSong.themes,
      },
      sampleSongWithSections.sections
    )
    expect(mockInvoke).toHaveBeenCalledWith("create_song", {
      song: { ...sampleSong, id: 0 },
      sections: sampleSongWithSections.sections.map((s, idx) => ({
        ...s,
        id: 0,
        song_id: 0,
        order_index: idx + 1,
      })),
    })
    expect(result).toEqual(sampleSongWithSections)
    expect(useSongsStore.getState().songs).toEqual([sampleSong])
  })
})
