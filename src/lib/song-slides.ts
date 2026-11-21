import type { SongWithSections, SongSection, VerseRenderData } from "@/types"

export interface SongSlide {
  id: string
  songId: number
  songTitle: string
  sectionId: number
  sectionType: string
  sectionNumber: number
  sectionLabel: string
  text: string
  slideIndex: number
  lineIndex?: number
  totalLines?: number
}

export function sectionLabel(type: string, num: number): string {
  const t = type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ")
  return `${t} ${num}`
}

/**
 * Convert a song slide to VerseRenderData for canvas rendering and broadcast output.
 * By default, showTitle is false so the song title is not repeated on every line that goes live.
 */
export function toSongRenderData(
  songTitle: string,
  sectionLabelStr: string,
  lyrics: string,
  lineInfo?: { current: number; total: number },
  showTitle = false
): VerseRenderData {
  const reference = showTitle
    ? lineInfo
      ? `${songTitle} — ${sectionLabelStr} (${lineInfo.current}/${lineInfo.total})`
      : `${songTitle} — ${sectionLabelStr}`
    : ""

  return {
    reference,
    segments: [{ text: lyrics }],
  }
}

/**
 * Generate slides for a song based on display mode ('line' or 'stanza').
 * If targetSection is specified, only slides for that section are returned.
 */
export function generateSongSlides(
  songWithSections: SongWithSections,
  mode: "line" | "stanza" = "line",
  targetSection?: SongSection | null
): SongSlide[] {
  const sections = targetSection
    ? [targetSection]
    : [...songWithSections.sections].sort(
        (a, b) => a.order_index - b.order_index
      )

  const slides: SongSlide[] = []
  let globalIndex = 0

  for (const section of sections) {
    const label = sectionLabel(
      section.section_type as string,
      section.section_number
    )

    if (mode === "stanza") {
      const trimmed = section.lyrics.trim()
      if (trimmed.length > 0) {
        slides.push({
          id: `${section.id}-stanza`,
          songId: songWithSections.song.id,
          songTitle: songWithSections.song.title,
          sectionId: section.id,
          sectionType: section.section_type as string,
          sectionNumber: section.section_number,
          sectionLabel: label,
          text: trimmed,
          slideIndex: globalIndex++,
        })
      }
    } else {
      // Line by line mode (default)
      const lines = section.lyrics
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)

      // Fallback if no lines were found
      if (lines.length === 0 && section.lyrics.trim().length > 0) {
        lines.push(section.lyrics.trim())
      }

      for (let i = 0; i < lines.length; i++) {
        slides.push({
          id: `${section.id}-line-${i}`,
          songId: songWithSections.song.id,
          songTitle: songWithSections.song.title,
          sectionId: section.id,
          sectionType: section.section_type as string,
          sectionNumber: section.section_number,
          sectionLabel: label,
          text: lines[i],
          slideIndex: globalIndex++,
          lineIndex: i + 1,
          totalLines: lines.length,
        })
      }
    }
  }

  return slides
}
