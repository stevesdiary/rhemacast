export type SectionType =
  | "verse"
  | "chorus"
  | "bridge"
  | "pre_chorus"
  | "tag"
  | "intro"
  | "outro"
  | string; // Allow custom section types

export interface Song {
  id: number
  title: string
  author: string | null
  composer: string | null
  copyright: string | null
  ccli_number: string | null
  themes: string[]
}

export interface SongSection {
  id: number
  song_id: number
  section_type: SectionType
  section_number: number
  lyrics: string
  order_index: number
}

export interface SongWithSections {
  song: Song
  sections: SongSection[]
}

export interface SearchSongRow {
  song_id: number
  title: string
  author: string | null
  section_type: string
  section_number: number
  lyrics: string
  rank: number
  phrase_match: boolean
}

/** Song queue item for the presentation queue */
export interface SongQueueItem {
  id: string
  song: Song
  section: SongSection | null // null = full song, specific section if set
  reference: string // e.g., "Amazing Grace - Verse 1"
  added_at: number
  source: "manual" | "search"
}