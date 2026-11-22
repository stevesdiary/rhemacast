import { beforeEach, describe, expect, it } from "vitest"
import { useQueueStore } from "./queue-store"
import type { VerseQueueItem, SongQueueItem, SongWithSections, SectionType } from "@/types"
import type { Verse } from "@/types"

function makeVerse(overrides: Partial<Verse> = {}): Verse {
  return {
    id: 1,
    translation_id: 1,
    book_number: 43,
    book_name: "John",
    book_abbreviation: "Jn",
    chapter: 3,
    verse: 16,
    text: "For God so loved the world",
    ...overrides,
  }
}

function makeItem(
  overrides: Partial<VerseQueueItem> = {},
  verse: Partial<Verse> = {}
): VerseQueueItem {
  return {
    id: "item-1",
    type: "verse",
    verse: makeVerse(verse),
    reference: "John 3:16",
    confidence: 1,
    source: "manual",
    added_at: 0,
    ...overrides,
  }
}

function getVerseText(item: VerseQueueItem): string {
  return item.verse.text
}

beforeEach(() => {
  useQueueStore.setState({ items: [], activeIndex: null, highlightedId: null })
})

describe("addItem", () => {
  it("prepends a new item", () => {
    useQueueStore.getState().addItem(makeItem({ id: "a" }))
    useQueueStore.getState().addItem(makeItem({ id: "b" }, { verse: 17 }))

    const items = useQueueStore.getState().items
    expect(items.map((i) => i.id)).toEqual(["b", "a"])
  })

  it("drops an exact duplicate that adds no text", () => {
    useQueueStore.getState().addItem(makeItem({ id: "a" }))
    useQueueStore.getState().addItem(makeItem({ id: "b" }))

    const items = useQueueStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe("a")
  })

  it("backfills text on a duplicate when the existing item has no text", () => {
    useQueueStore.getState().addItem(makeItem({ id: "a" }, { text: "" }))
    useQueueStore
      .getState()
      .addItem(
        makeItem(
          { id: "b", added_at: 99 },
          { text: "For God so loved the world" }
        )
      )

    const items = useQueueStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe("a")
    expect(items[0].added_at).toBe(0)
    expect(getVerseText(items[0] as VerseQueueItem)).toBe(
      "For God so loved the world"
    )
  })

  it("does not overwrite existing text on a duplicate", () => {
    useQueueStore
      .getState()
      .addItem(makeItem({ id: "a" }, { text: "original text" }))
    useQueueStore
      .getState()
      .addItem(makeItem({ id: "b" }, { text: "different text" }))

    expect(
      getVerseText(useQueueStore.getState().items[0] as VerseQueueItem)
    ).toBe("original text")
  })
})

describe("backfillText", () => {
  it("fills empty text", () => {
    useQueueStore.getState().addItem(makeItem({ id: "a" }, { text: "" }))
    useQueueStore.getState().backfillText("a", "For God so loved the world")

    expect(
      getVerseText(useQueueStore.getState().items[0] as VerseQueueItem)
    ).toBe("For God so loved the world")
  })

  it("never overwrites non-empty text", () => {
    useQueueStore
      .getState()
      .addItem(makeItem({ id: "a" }, { text: "original text" }))
    useQueueStore.getState().backfillText("a", "different text")

    expect(
      getVerseText(useQueueStore.getState().items[0] as VerseQueueItem)
    ).toBe("original text")
  })

  it("ignores unknown ids and empty text", () => {
    useQueueStore.getState().addItem(makeItem({ id: "a" }, { text: "" }))
    useQueueStore.getState().backfillText("missing", "text")
    useQueueStore.getState().backfillText("a", "")

    expect(
      getVerseText(useQueueStore.getState().items[0] as VerseQueueItem)
    ).toBe("")
  })
})

describe("updateSongSectionLyrics and updateSongInQueue", () => {
  const sampleSong: SongWithSections = {
    song: {
      id: 5,
      title: "Blessed Assurance",
      author: "Fanny Crosby",
      composer: "Phoebe Knapp",
      copyright: null,
      ccli_number: null,
      themes: ["assurance"],
    },
    sections: [
      {
        id: 50,
        song_id: 5,
        section_type: "verse" as SectionType,
        section_number: 1,
        lyrics: "Blessed assurance, Jesus is mine",
        order_index: 1,
      },
    ],
  }

  it("updates song section lyrics in queue items", () => {
    const songItem: SongQueueItem = {
      id: "song-item-1",
      type: "song",
      song: sampleSong,
      section: sampleSong.sections[0],
      reference: "Blessed Assurance",
      source: "manual",
      added_at: 1000,
    }

    useQueueStore.getState().addItem(songItem)
    useQueueStore
      .getState()
      .updateSongSectionLyrics(5, 50, "Updated lyrics line 1\nUpdated lyrics line 2")

    const updatedItem = useQueueStore.getState().items[0] as SongQueueItem
    expect(updatedItem.song.sections[0].lyrics).toBe(
      "Updated lyrics line 1\nUpdated lyrics line 2"
    )
    expect(updatedItem.section?.lyrics).toBe(
      "Updated lyrics line 1\nUpdated lyrics line 2"
    )
  })

  it("updates entire song in queue when updateSongInQueue is called", () => {
    const songItem: SongQueueItem = {
      id: "song-item-1",
      type: "song",
      song: sampleSong,
      section: sampleSong.sections[0],
      reference: "Blessed Assurance",
      source: "manual",
      added_at: 1000,
    }

    useQueueStore.getState().addItem(songItem)

    const revisedSong: SongWithSections = {
      ...sampleSong,
      song: { ...sampleSong.song, title: "Blessed Assurance (Revised)" },
      sections: [
        {
          ...sampleSong.sections[0],
          lyrics: "Brand new stanza lyrics",
        },
      ],
    }

    useQueueStore.getState().updateSongInQueue(revisedSong)

    const updatedItem = useQueueStore.getState().items[0] as SongQueueItem
    expect(updatedItem.song.song.title).toBe("Blessed Assurance (Revised)")
    expect(updatedItem.song.sections[0].lyrics).toBe("Brand new stanza lyrics")
  })
})
