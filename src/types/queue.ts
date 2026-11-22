import type { Verse } from "./bible"
import type { SongSection, SongWithSections } from "./songs"
import type { ConcordanceEntry } from "./concordance"

export type QueueItemType = "verse" | "song" | "concordance"

export interface VerseQueueItem {
  id: string
  type: "verse"
  verse: Verse
  reference: string
  confidence: number
  source: "manual" | "ai-direct" | "ai-semantic" | "ai-cloud"
  added_at: number
  /** True when queued from a chapter-only detection (verse defaults to 1, may be refined). */
  is_chapter_only?: boolean
}

export interface SongQueueItem {
  id: string
  type: "song"
  song: SongWithSections
  section: SongSection | null // null = full song
  reference: string // e.g., "Amazing Grace - Verse 1"
  added_at: number
  source: "manual" | "search"
}

export interface ConcordanceQueueItem {
  id: string
  type: "concordance"
  entry: ConcordanceEntry
  reference: string // e.g., "G2540 • Kairos (καιρός)"
  added_at: number
  source: "manual" | "ai"
}

export type QueueItem = VerseQueueItem | SongQueueItem | ConcordanceQueueItem

/** Type guard to check if item is a verse */
export function isVerseQueueItem(item: QueueItem): item is VerseQueueItem {
  return item.type === "verse"
}

/** Type guard to check if item is a song */
export function isSongQueueItem(item: QueueItem): item is SongQueueItem {
  return item.type === "song"
}

/** Type guard to check if item is a concordance entry */
export function isConcordanceQueueItem(
  item: QueueItem
): item is ConcordanceQueueItem {
  return item.type === "concordance"
}
