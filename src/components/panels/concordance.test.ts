import { describe, expect, it } from "vitest"
import { toConcordanceRenderData } from "@/hooks/use-broadcast"
import { isConcordanceQueueItem } from "@/types"
import type { ConcordanceEntry, ConcordanceQueueItem, VerseQueueItem } from "@/types"

describe("Concordance Lexicon Presentation & Types", () => {
  const sampleGreek: ConcordanceEntry = {
    id: 2540,
    strongs_number: "G2540",
    language: "greek",
    lemma: "καιρός",
    translit: "kairós",
    translit_clean: "kairos",
    pronunciation: "kahee-ros'",
    strongs_def: "an occasion, i.e. set or proper time",
    kjv_def: "opportunity, season, time",
    derivation: "from G2734",
  }

  const sampleHebrew: ConcordanceEntry = {
    id: 7965,
    strongs_number: "H7965",
    language: "hebrew",
    lemma: "שָׁלוֹם",
    translit: "shâlôwm",
    translit_clean: "shalowm",
    pronunciation: "shaw-lome'",
    strongs_def: "safe, i.e. (figuratively) well, happy, friendly; also peace, prosperity",
    kjv_def: "peace, prosper, rest, safe, welfare, well",
  }

  it("formats Greek concordance entry into Scripture Anchor slide render data", () => {
    const renderData = toConcordanceRenderData(sampleGreek)
    expect(renderData.reference).toBe("καιρός • kairós [G2540 • /kahee-ros'/]")
    expect(renderData.segments).toHaveLength(1)
    expect(renderData.segments[0].text).toContain("an occasion, i.e. set or proper time")
    expect(renderData.segments[0].text).toContain("KJV: opportunity, season, time")
  })

  it("formats Hebrew concordance entry into Scripture Anchor slide render data", () => {
    const renderData = toConcordanceRenderData(sampleHebrew)
    expect(renderData.reference).toBe("שָׁלוֹם • shâlôwm [H7965 • /shaw-lome'/]")
    expect(renderData.segments[0].text).toContain("safe, i.e. (figuratively) well")
    expect(renderData.segments[0].text).toContain("KJV: peace, prosper, rest")
  })

  it("handles concordance entry without pronunciation cleanly", () => {
    const entryWithoutPron: ConcordanceEntry = {
      ...sampleGreek,
      pronunciation: null,
    }
    const renderData = toConcordanceRenderData(entryWithoutPron)
    expect(renderData.reference).toBe("καιρός • kairós [G2540]")
  })

  it("discriminates ConcordanceQueueItem from VerseQueueItem using type guard", () => {
    const concordanceItem: ConcordanceQueueItem = {
      id: "test-1",
      type: "concordance",
      entry: sampleGreek,
      reference: "G2540 • Kairos",
      added_at: Date.now(),
      source: "ai",
    }

    const verseItem: VerseQueueItem = {
      id: "test-2",
      type: "verse",
      verse: {
        id: 1,
        translation_id: 1,
        book_number: 43,
        book_name: "John",
        book_abbreviation: "Jn",
        chapter: 3,
        verse: 16,
        text: "For God so loved the world",
      },
      reference: "John 3:16",
      confidence: 1.0,
      source: "manual",
      added_at: Date.now(),
    }

    expect(isConcordanceQueueItem(concordanceItem)).toBe(true)
    expect(isConcordanceQueueItem(verseItem)).toBe(false)
  })
})
