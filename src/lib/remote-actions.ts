import {
  presentVerse,
  presentSongSlide,
  previewSongSlide,
  presentConcordance,
  previewConcordance,
} from "@/hooks/use-broadcast"
import { stepVerse } from "@/hooks/use-bible"
import { useBibleStore } from "@/stores/bible-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useQueueStore } from "@/stores/queue-store"
import { useSongsStore } from "@/stores/songs-store"
import { useSettingsStore } from "@/stores/settings-store"
import { generateSongSlides } from "@/lib/song-slides"
import {
  isVerseQueueItem,
  isSongQueueItem,
  isConcordanceQueueItem,
} from "@/types"

/**
 * Find the queue index of the verse currently on the live output.
 * Returns null when the live verse came from somewhere other than the queue.
 */
function findLiveQueueIndex(): number | null {
  const { liveVerse } = useBroadcastStore.getState()
  if (!liveVerse) return null

  const index = useQueueStore
    .getState()
    .items.findIndex(
      (item) =>
        (isVerseQueueItem(item) && item.reference === liveVerse.reference) ||
        (isSongQueueItem(item) &&
          liveVerse.reference.startsWith(item.song.song.title))
    )
  return index >= 0 ? index : null
}

export async function dispatchQueueItem(
  index: number,
  options?: { forceLive?: boolean }
): Promise<void> {
  const item = useQueueStore.getState().items[index]
  if (!item) return

  const { isLive, autoLive } = useBroadcastStore.getState()
  const shouldPresentLive = Boolean(options?.forceLive || (isLive && autoLive))

  if (isVerseQueueItem(item)) {
    // Navigate the Bible panel to the verse
    useBibleStore.getState().setPendingNavigation({
      bookNumber: item.verse.book_number,
      chapter: item.verse.chapter,
      verse: item.verse.verse,
      present: shouldPresentLive,
    })
    if (shouldPresentLive) {
      await presentVerse(item.verse).catch((e) =>
        console.warn("[remote-actions] dispatchQueueItem verse failed:", e)
      )
    } else {
      useBibleStore.getState().selectVerse(item.verse)
      useBroadcastStore.getState().setPreviewVerse(null)
    }
  } else if (isSongQueueItem(item)) {
    const songStore = useSongsStore.getState()
    const settingsStore = useSettingsStore.getState()
    songStore.selectSong(item.song)
    if (item.section) songStore.selectSection(item.section)
    songStore.setActiveSlideIndex(0)

    const mode = settingsStore.songDisplayMode ?? "line"
    const slides = generateSongSlides(item.song, mode, item.section)
    if (slides.length > 0) {
      const slide = slides[0]
      const lineInfo =
        mode === "line" && slide.lineIndex && slide.totalLines
          ? { current: slide.lineIndex, total: slide.totalLines }
          : undefined
      if (shouldPresentLive) {
        presentSongSlide(
          slide.songTitle,
          slide.sectionLabel,
          slide.text,
          lineInfo
        )
      } else {
        previewSongSlide(
          slide.songTitle,
          slide.sectionLabel,
          slide.text,
          lineInfo
        )
      }
    }
  } else if (isConcordanceQueueItem(item)) {
    if (shouldPresentLive) {
      presentConcordance(item.entry)
    } else {
      previewConcordance(item.entry)
    }
  }
}

function stepQueue(offset: number): void {
  const { items, activeIndex } = useQueueStore.getState()
  if (items.length === 0) return

  const current = activeIndex ?? findLiveQueueIndex()

  // Advance to next/prev item in queue/schedule directly (the Song Work Area
  // panel handles slide-by-slide navigation independently)
  const target =
    current === null
      ? 0
      : Math.min(Math.max(current + offset, 0), items.length - 1)

  useQueueStore.getState().setActive(target)
  void dispatchQueueItem(target)
}

/**
 * Operator actions reachable from every control surface — OSC, the HTTP API,
 * and (from Phase 2) the keyboard. Each surface dispatches into this registry
 * rather than carrying its own copy of the behaviour, so the surfaces cannot
 * drift apart.
 *
 * Plain functions over `getState()`, never hooks: these run from Tauri event
 * callbacks, outside React's render cycle.
 */
export const remoteActions = {
  /** Present the verse showing in Program preview on the live output. */
  sendToLive: () => {
    const { selectedVerse } = useBibleStore.getState()
    if (!selectedVerse) return
    void presentVerse(selectedVerse).catch((e) =>
      console.warn("[remote-actions] sendToLive failed:", e)
    )
  },

  /** Queue the verse showing in Program preview. Duplicates are dropped by the store. */
  addToQueue: () => {
    const { selectedVerse } = useBibleStore.getState()
    if (!selectedVerse) return
    useQueueStore.getState().addItem({
      id: crypto.randomUUID(),
      type: "verse",
      verse: selectedVerse,
      reference: `${selectedVerse.book_name} ${selectedVerse.chapter}:${selectedVerse.verse}`,
      confidence: 1,
      source: "manual",
      added_at: Date.now(),
    })
  },

  queueNext: () => stepQueue(1),
  queuePrev: () => stepQueue(-1),

  selectQueueItem: (index: number, options?: { forceLive?: boolean }) => {
    useQueueStore.getState().setActive(index)
    return dispatchQueueItem(index, options)
  },

  /** Step the Bible Text panel one verse. Leaves the queue alone. */
  bibleNext: () => stepVerse("next"),
  biblePrev: () => stepVerse("prev"),

  toggleOnAir: (active: boolean) =>
    useBroadcastStore.getState().setLive(active),
}
