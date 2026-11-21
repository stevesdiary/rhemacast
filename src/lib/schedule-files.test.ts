import { describe, it, expect } from "vitest"
import {
  defaultScheduleFilename,
  parseScheduleJson,
  findMissingSongsInLibrary,
} from "./schedule-files"
import type { QueueItem, Song, SongWithSections } from "@/types"

describe("schedule-files", () => {
  describe("defaultScheduleFilename", () => {
    it("generates filename with .rhema extension and today's date", () => {
      const filename = defaultScheduleFilename()
      expect(filename).toMatch(/^service-schedule-\d{4}-\d{2}-\d{2}\.rhema$/)
    })
  })

  describe("parseScheduleJson", () => {
    it("parses valid Rhema schedule JSON with song display mode and items", () => {
      const json = JSON.stringify({
        app: "rhema",
        version: 1,
        type: "schedule",
        exportedAt: 1700000000000,
        title: "Sunday Service",
        songDisplayMode: "line",
        items: [
          {
            id: "verse-1",
            type: "verse",
            reference: "John 3:16",
            text: "For God so loved the world...",
            version: "KJV",
          },
        ],
      })

      const parsed = parseScheduleJson(json)
      expect(parsed.app).toBe("rhema")
      expect(parsed.version).toBe(1)
      expect(parsed.title).toBe("Sunday Service")
      expect(parsed.songDisplayMode).toBe("line")
      expect(parsed.items).toHaveLength(1)
      expect(parsed.items[0].id).toBe("verse-1")
    })

    it("parses bare array of queue items as fallback", () => {
      const json = JSON.stringify([
        {
          id: "song-1",
          type: "song",
          song: {
            song: { id: 1, title: "Amazing Grace" },
            sections: [],
          },
        },
      ])

      const parsed = parseScheduleJson(json)
      expect(parsed.app).toBe("rhema")
      expect(parsed.items).toHaveLength(1)
      expect(parsed.songDisplayMode).toBe("line")
    })

    it("throws on invalid JSON string", () => {
      expect(() => parseScheduleJson("not-a-json")).toThrow()
    })

    it("throws on object without items array", () => {
      expect(() =>
        parseScheduleJson(JSON.stringify({ hello: "world" }))
      ).toThrow(/missing schedule items array/)
    })
  })

  describe("findMissingSongsInLibrary", () => {
    const existingSongs: Song[] = [
      {
        id: 1,
        title: "Amazing Grace",
        author: "John Newton",
      },
      {
        id: 2,
        title: "Way Maker",
        author: "Sinach",
      },
    ]

    const makeSongItem = (title: string, id = 99): QueueItem =>
      ({
        id: `song-${title}`,
        type: "song",
        song: {
          song: { id, title },
          sections: [
            { id: 1, song_id: id, label: "Verse 1", lyrics: "Some lyrics" },
          ],
        } as unknown as SongWithSections,
      }) as QueueItem

    const makeVerseItem = (): QueueItem =>
      ({
        id: "verse-1",
        type: "verse",
        reference: "Genesis 1:1",
        text: "In the beginning...",
        version: "KJV",
      }) as QueueItem

    it("identifies songs in schedule that are not in local library", () => {
      const items: QueueItem[] = [
        makeSongItem("Amazing Grace"), // exists
        makeSongItem("Goodness of God"), // missing
        makeVerseItem(), // scripture
      ]

      const missing = findMissingSongsInLibrary(items, existingSongs)
      expect(missing).toHaveLength(1)
      expect(missing[0].song.title).toBe("Goodness of God")
    })

    it("handles case-insensitive and trimmed title comparison", () => {
      const items: QueueItem[] = [
        makeSongItem("  amazing grace  "), // exists (case & whitespace variation)
        makeSongItem("WAY MAKER"), // exists
      ]

      const missing = findMissingSongsInLibrary(items, existingSongs)
      expect(missing).toHaveLength(0)
    })

    it("deduplicates multiple references to the same missing song in schedule", () => {
      const items: QueueItem[] = [
        makeSongItem("10,000 Reasons"),
        makeVerseItem(),
        makeSongItem("10,000 Reasons"),
      ]

      const missing = findMissingSongsInLibrary(items, existingSongs)
      expect(missing).toHaveLength(1)
      expect(missing[0].song.title).toBe("10,000 Reasons")
    })

    it("returns empty array if all songs are in library", () => {
      const items: QueueItem[] = [
        makeSongItem("Amazing Grace"),
        makeSongItem("Way Maker"),
      ]

      const missing = findMissingSongsInLibrary(items, existingSongs)
      expect(missing).toHaveLength(0)
    })
  })
})
