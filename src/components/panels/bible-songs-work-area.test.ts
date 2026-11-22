import { beforeEach, describe, expect, it, vi } from "vitest"
import { useSongsStore } from "@/stores/songs-store"
import { useQueueStore } from "@/stores/queue-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { generateSongSlides } from "@/lib/song-slides"
import { previewSongSlide, presentSongSlide } from "@/hooks/use-broadcast"
import type { SongWithSections, SectionType } from "@/types"

const mockInvoke = vi.fn()
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

const testSong: SongWithSections = {
  song: {
    id: 42,
    title: "How Great Thou Art",
    author: "Stuart K. Hine",
    composer: null,
    copyright: null,
    ccli_number: "14181",
    themes: ["praise", "greatness"],
  },
  sections: [
    {
      id: 101,
      song_id: 42,
      section_type: "verse" as SectionType,
      section_number: 1,
      lyrics: "O Lord my God, when I in awesome wonder\nConsider all the worlds Thy hands have made",
      order_index: 1,
    },
    {
      id: 102,
      song_id: 42,
      section_type: "chorus" as SectionType,
      section_number: 1,
      lyrics: "Then sings my soul, my Savior God, to Thee\nHow great Thou art, how great Thou art",
      order_index: 2,
    },
  ],
}

describe("Song Work Area and Layout Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSongsStore.setState({
      songs: [testSong.song],
      searchResults: [],
      selectedSong: null,
      selectedSection: null,
      pendingSongQueue: null,
      activeSlideIndex: 0,
      displayMode: "line",
    })
    useQueueStore.setState({ items: [], activeIndex: -1 })
    useBroadcastStore.setState({
      previewVerse: null,
      liveVerse: null,
      isLive: false,
    })
  })

  it("loads a selected song into work area state with flat continuous line numbering", () => {
    useSongsStore.getState().selectSong(testSong)
    expect(useSongsStore.getState().selectedSong?.song.title).toBe("How Great Thou Art")

    const lineSlides = generateSongSlides(testSong, "line")
    expect(lineSlides).toHaveLength(4)
    expect(lineSlides[0].text).toBe("O Lord my God, when I in awesome wonder")
    expect(lineSlides[0].slideIndex).toBe(0)
    expect(lineSlides[0].sectionLabel).toBe("Verse 1")
    expect(lineSlides[2].text).toBe("Then sings my soul, my Savior God, to Thee")
    expect(lineSlides[2].slideIndex).toBe(2)
    expect(lineSlides[2].sectionLabel).toBe("Chorus 1")
  })

  it("switches to stanza mode correctly", () => {
    useSongsStore.getState().selectSong(testSong)
    useSongsStore.getState().setDisplayMode("stanza")
    expect(useSongsStore.getState().displayMode).toBe("stanza")

    const stanzaSlides = generateSongSlides(testSong, "stanza")
    expect(stanzaSlides).toHaveLength(2)
    expect(stanzaSlides[0].text).toContain("O Lord my God")
    expect(stanzaSlides[1].text).toContain("Then sings my soul")
  })

  it("single-click previews slide in program preview canvas", () => {
    const slides = generateSongSlides(testSong, "line")
    const slide = slides[0]

    previewSongSlide(slide.songTitle, slide.sectionLabel, slide.text, {
      current: slide.lineIndex ?? 1,
      total: slide.totalLines ?? 2,
    })

    const preview = useBroadcastStore.getState().previewVerse
    expect(preview).not.toBeNull()
    expect(preview?.segments[0].text).toBe(slide.text)
    // Live should remain untouched
    expect(useBroadcastStore.getState().liveVerse).toBeNull()
  })

  it("double-click presents slide directly to live display", () => {
    const slides = generateSongSlides(testSong, "line")
    const slide = slides[1]

    presentSongSlide(slide.songTitle, slide.sectionLabel, slide.text, {
      current: slide.lineIndex ?? 2,
      total: slide.totalLines ?? 2,
    })

    const live = useBroadcastStore.getState().liveVerse
    expect(live).not.toBeNull()
    expect(live?.segments[0].text).toBe(slide.text)
  })

  it("maintains selected song in work area even when queue item selection updates", () => {
    useSongsStore.getState().selectSong(testSong)
    expect(useSongsStore.getState().selectedSong?.song.id).toBe(42)

    // Adding an item to queue
    useQueueStore.getState().addItem({
      id: "q-1",
      type: "song",
      song: testSong,
      section: null,
      reference: "How Great Thou Art",
      added_at: Date.now(),
      source: "manual",
    })

    expect(useQueueStore.getState().items).toHaveLength(1)
    expect(useSongsStore.getState().selectedSong?.song.id).toBe(42)
  })
})
