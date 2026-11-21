import { create } from "zustand"
import type { QueueItem, VerseQueueItem, SongWithSections } from "@/types"
import { isVerseQueueItem, isSongQueueItem } from "@/types"

interface QueueState {
  items: QueueItem[]
  activeIndex: number | null
  /** ID of the queue item currently being flash-highlighted (null = none). */
  highlightedId: string | null

  addItem: (item: QueueItem) => void
  removeItem: (id: string) => void
  reorderItems: (fromIndex: number, toIndex: number) => void
  setActive: (index: number | null) => void
  clearQueue: () => void
  setItems: (items: QueueItem[]) => void
  /** Flash-highlight a queue item briefly (1.5 s). */
  flashItem: (id: string) => void
  /** Find an existing verse item by book+chapter+verse. Returns its index or -1. */
  findDuplicate: (bookNumber: number, chapter: number, verse: number) => number
  /** Fill in verse text on an item that was queued without it. Never overwrites non-empty text. */
  backfillText: (id: string, text: string) => void
  /** Update a chapter-only queue item in place when the verse is refined. */
  updateEarlyRef: (
    bookNumber: number,
    chapter: number,
    verse: number,
    reference: string,
    verseText: string
  ) => boolean
  /** Update song and sections in schedule when edited */
  updateSongInQueue: (updated: SongWithSections) => void
  /** Update lyrics for a specific song section in schedule */
  updateSongSectionLyrics: (
    songId: number,
    sectionId: number,
    newLyrics: string
  ) => void
}

let flashTimer: ReturnType<typeof setTimeout> | null = null

function verseKey(item: VerseQueueItem): string {
  return `${item.verse.book_number}:${item.verse.chapter}:${item.verse.verse}`
}

function verseKeyFromValues(
  bookNumber: number,
  chapter: number,
  verse: number
): string {
  return `${bookNumber}:${chapter}:${verse}`
}

export const useQueueStore = create<QueueState>((set, get) => ({
  items: [],
  activeIndex: null,
  highlightedId: null,

  addItem: (item) =>
    set((state) => {
      if (isVerseQueueItem(item)) {
        const key = verseKey(item)
        const idx = state.items.findIndex(
          (i): i is VerseQueueItem => isVerseQueueItem(i) && verseKey(i) === key
        )
        if (idx !== -1) {
          const existing = state.items[idx] as VerseQueueItem
          if (!existing.verse.text && item.verse.text) {
            const items = [...state.items]
            items[idx] = {
              ...existing,
              verse: { ...existing.verse, text: item.verse.text },
            }
            return { items }
          }
          return state
        }
      }
      return { items: [item, ...state.items] }
    }),
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    })),
  reorderItems: (fromIndex, toIndex) =>
    set((state) => {
      const items = [...state.items]
      const [moved] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, moved)
      return { items }
    }),
  setActive: (activeIndex) => set({ activeIndex }),
  clearQueue: () => set({ items: [], activeIndex: null }),
  setItems: (items) => set({ items, activeIndex: items.length > 0 ? 0 : null }),
  flashItem: (id) => {
    if (flashTimer) clearTimeout(flashTimer)
    set({ highlightedId: id })
    flashTimer = setTimeout(() => set({ highlightedId: null }), 1500)
  },
  findDuplicate: (bookNumber, chapter, verse) =>
    get().items.findIndex(
      (i): i is VerseQueueItem =>
        isVerseQueueItem(i) &&
        verseKeyFromValues(bookNumber, chapter, verse) === verseKey(i)
    ),
  backfillText: (id, text) =>
    set((state) => {
      const idx = state.items.findIndex((i) => i.id === id)
      if (idx === -1) return state
      const item = state.items[idx]
      if (!isVerseQueueItem(item) || item.verse.text || !text) return state
      const items = [...state.items]
      items[idx] = { ...item, verse: { ...item.verse, text } }
      return { items }
    }),
  updateEarlyRef: (bookNumber, chapter, verse, reference, verseText) => {
    let found = false
    set((state) => {
      let idx = state.items.findIndex(
        (i): i is VerseQueueItem =>
          isVerseQueueItem(i) &&
          !!i.is_chapter_only &&
          i.verse.book_number === bookNumber &&
          i.verse.chapter === chapter
      )
      if (idx === -1) {
        idx = state.items.findIndex(
          (i): i is VerseQueueItem =>
            isVerseQueueItem(i) &&
            !!i.is_chapter_only &&
            i.verse.book_number === bookNumber
        )
      }
      if (idx === -1) return state
      found = true
      const items = [...state.items]
      const item = items[idx] as VerseQueueItem
      const updatedItem = { ...item }
      updatedItem.verse = { ...updatedItem.verse, verse, text: verseText }
      updatedItem.reference = reference
      updatedItem.is_chapter_only = false
      items[idx] = updatedItem
      return { items }
    })
    return found
  },
  updateSongInQueue: (updated) =>
    set((state) => {
      let changed = false
      const items = state.items.map((i) => {
        if (isSongQueueItem(i) && i.song.song.id === updated.song.id) {
          changed = true
          const matchingSection = i.section
            ? (updated.sections.find((s) => s.id === i.section?.id) ??
              i.section)
            : null
          return {
            ...i,
            song: updated,
            section: matchingSection,
          }
        }
        return i
      })
      return changed ? { items } : state
    }),
  updateSongSectionLyrics: (songId, sectionId, newLyrics) =>
    set((state) => {
      let changed = false
      const items = state.items.map((i) => {
        if (isSongQueueItem(i) && i.song.song.id === songId) {
          changed = true
          const updatedSections = i.song.sections.map((sec) =>
            sec.id === sectionId ? { ...sec, lyrics: newLyrics } : sec
          )
          const updatedSong: SongWithSections = {
            ...i.song,
            sections: updatedSections,
          }
          const matchingSection = i.section
            ? (updatedSections.find((s) => s.id === sectionId) ?? i.section)
            : null
          return {
            ...i,
            song: updatedSong,
            section: matchingSection,
          }
        }
        return i
      })
      return changed ? { items } : state
    }),
}))
