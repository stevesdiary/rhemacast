import type { Verse } from "./bible"
import type { Song, SongSection } from "./songs"

export type QueueItemType = "verse" | "song"

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
  song: Song
  section: SongSection | null // null = full song
  reference: string // e.g., "Amazing Grace - Verse 1"
  added_at: number
  source: "manual" | "search"
}

export type QueueItem = VerseQueueItem | SongQueueItem

/** Type guard to check if item is a verse */
export function isVerseQueueItem(item: QueueItem): item is VerseQueueItem {
  return item.type === "verse"
}

/** Type guard to check if item is a song */
export function isSongQueueItem(item: QueueItem): item is SongQueueItem {
  return item.type === "song"
}
