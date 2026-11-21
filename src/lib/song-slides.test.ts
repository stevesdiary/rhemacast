import { describe, expect, it } from "vitest"
import {
  generateSongSlides,
  toSongRenderData,
  sectionLabel,
} from "./song-slides"
import type { SongWithSections, SectionType } from "@/types"

const sampleSong: SongWithSections = {
  song: {
    id: 1,
    title: "Amazing Grace",
    author: "John Newton",
    composer: "Traditional",
    copyright: null,
    ccli_number: "22025",
    themes: ["grace", "salvation"],
  },
  sections: [
    {
      id: 101,
      song_id: 1,
      section_type: "verse" as SectionType,
      section_number: 1,
      lyrics:
        "Amazing grace! How sweet the sound\nThat saved a wretch like me!\nI once was lost, but now am found;\nWas blind, but now I see.",
      order_index: 1,
    },
    {
      id: 102,
      song_id: 1,
      section_type: "chorus" as SectionType,
      section_number: 1,
      lyrics: "Amazing grace, amazing grace",
      order_index: 2,
    },
  ],
}

describe("song-slides", () => {
  describe("sectionLabel", () => {
    it("formats section types correctly", () => {
      expect(sectionLabel("verse", 1)).toBe("Verse 1")
      expect(sectionLabel("chorus", 2)).toBe("Chorus 2")
      expect(sectionLabel("pre_chorus", 1)).toBe("Pre chorus 1")
    })
  })

  describe("generateSongSlides in line mode (default)", () => {
    it("breaks verses and choruses into individual line slides", () => {
      const slides = generateSongSlides(sampleSong, "line")
      expect(slides).toHaveLength(5) // 4 lines in Verse 1 + 1 line in Chorus 1

      expect(slides[0].text).toBe("Amazing grace! How sweet the sound")
      expect(slides[0].sectionLabel).toBe("Verse 1")
      expect(slides[0].lineIndex).toBe(1)
      expect(slides[0].totalLines).toBe(4)
      expect(slides[0].slideIndex).toBe(0)

      expect(slides[3].text).toBe("Was blind, but now I see.")
      expect(slides[3].lineIndex).toBe(4)
      expect(slides[3].slideIndex).toBe(3)

      expect(slides[4].text).toBe("Amazing grace, amazing grace")
      expect(slides[4].sectionLabel).toBe("Chorus 1")
      expect(slides[4].lineIndex).toBe(1)
      expect(slides[4].totalLines).toBe(1)
      expect(slides[4].slideIndex).toBe(4)
    })

    it("filters to a specific target section if provided", () => {
      const slides = generateSongSlides(
        sampleSong,
        "line",
        sampleSong.sections[1]
      )
      expect(slides).toHaveLength(1)
      expect(slides[0].text).toBe("Amazing grace, amazing grace")
      expect(slides[0].sectionLabel).toBe("Chorus 1")
    })
  })

  describe("generateSongSlides in stanza mode", () => {
    it("keeps each entire section as a single slide", () => {
      const slides = generateSongSlides(sampleSong, "stanza")
      expect(slides).toHaveLength(2)

      expect(slides[0].text).toContain("Amazing grace! How sweet the sound")
      expect(slides[0].text).toContain("Was blind, but now I see.")
      expect(slides[0].sectionLabel).toBe("Verse 1")
      expect(slides[0].slideIndex).toBe(0)
      expect(slides[0].lineIndex).toBeUndefined()

      expect(slides[1].text).toBe("Amazing grace, amazing grace")
      expect(slides[1].sectionLabel).toBe("Chorus 1")
      expect(slides[1].slideIndex).toBe(1)
    })
  })

  describe("toSongRenderData", () => {
    it("omits song title by default so it is not repeated on every live line", () => {
      const renderData = toSongRenderData(
        "Amazing Grace",
        "Verse 1",
        "Line text",
        {
          current: 1,
          total: 4,
        }
      )
      expect(renderData.reference).toBe("")
      expect(renderData.segments).toHaveLength(1)
      expect(renderData.segments[0].text).toBe("Line text")
      expect(renderData.segments[0].verseNumber).toBeUndefined()
    })

    it("omits song title without line numbers (stanza mode) by default", () => {
      const renderData = toSongRenderData(
        "Amazing Grace",
        "Verse 1",
        "Stanza text"
      )
      expect(renderData.reference).toBe("")
      expect(renderData.segments[0].text).toBe("Stanza text")
    })

    it("includes song title and section when showTitle is explicitly true", () => {
      const renderDataWithLines = toSongRenderData(
        "Amazing Grace",
        "Verse 1",
        "Line text",
        {
          current: 1,
          total: 4,
        },
        true
      )
      expect(renderDataWithLines.reference).toBe(
        "Amazing Grace — Verse 1 (1/4)"
      )

      const renderDataStanza = toSongRenderData(
        "Amazing Grace",
        "Verse 1",
        "Stanza text",
        undefined,
        true
      )
      expect(renderDataStanza.reference).toBe("Amazing Grace — Verse 1")
    })
  })
})
