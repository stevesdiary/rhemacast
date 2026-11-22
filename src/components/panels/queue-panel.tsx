import { useEffect, useMemo, useRef, useState } from "react"
import { PanelHeader } from "@/components/ui/panel-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  PlayIcon,
  XIcon,
  GripVerticalIcon,
  MusicIcon,
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SkipBackIcon,
  SkipForwardIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  DownloadIcon,
  UploadIcon,
  PencilIcon,
  CheckIcon,
} from "lucide-react"
import { useQueueStore } from "@/stores"
import { useSettingsStore } from "@/stores/settings-store"
import { useSongsStore } from "@/stores/songs-store"
import { updateSectionLyrics } from "@/hooks/use-songs"
import { presentVerse, presentSongSlide } from "@/hooks/use-broadcast"
import { bibleActions } from "@/hooks/use-bible"
import { generateSongSlides, type SongSlide } from "@/lib/song-slides"
import { remoteActions } from "@/lib/remote-actions"
import {
  exportScheduleToFile,
  importScheduleFromFile,
  findMissingSongsInLibrary,
} from "@/lib/schedule-files"
import { ImportSongsPromptDialog } from "@/components/schedule/import-songs-prompt-dialog"
import { EditSongDialog } from "@/components/songs/edit-song-dialog"
import type {
  QueueItem,
  SongQueueItem,
  VerseQueueItem,
  SongWithSections,
} from "@/types"
import { isVerseQueueItem, isSongQueueItem } from "@/types"

function selectScheduleItem(index: number) {
  const { items } = useQueueStore.getState()
  if (index < 0 || index >= items.length) return
  useQueueStore.getState().setActive(index)
  const item = items[index]

  if (isVerseQueueItem(item)) {
    bibleActions.navigateToVerse(
      item.verse.book_number,
      item.verse.chapter,
      item.verse.verse
    )
    void presentVerse(item.verse)
  } else if (isSongQueueItem(item)) {
    const songStore = useSongsStore.getState()
    const mode = useSettingsStore.getState().songDisplayMode ?? "line"
    songStore.selectSong(item.song)
    if (item.section) songStore.selectSection(item.section)
    songStore.setActiveSlideIndex(0)

    const slides = generateSongSlides(item.song, mode, item.section)
    if (slides.length > 0) {
      const slide = slides[0]
      const lineInfo =
        mode === "line" && slide.lineIndex && slide.totalLines
          ? { current: slide.lineIndex, total: slide.totalLines }
          : undefined
      presentSongSlide(
        slide.songTitle,
        slide.sectionLabel,
        slide.text,
        lineInfo
      )
    }
  }
}

function ActiveSongStepper({
  item,
  mode,
  onEditSong,
}: {
  item: SongQueueItem
  mode: "line" | "stanza"
  onEditSong?: (song: SongWithSections) => void
}) {
  const activeSlideIndex = useSongsStore((s) => s.activeSlideIndex)
  const slides = useMemo(
    () => generateSongSlides(item.song, mode, item.section),
    [item.song, mode, item.section]
  )
  const slideListRef = useRef<HTMLDivElement>(null)
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState("")
  const [isSavingInline, setIsSavingInline] = useState(false)
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [])

  // Scroll the active slide into view smoothly
  useEffect(() => {
    if (!slideListRef.current) return
    const activeEl = slideListRef.current.querySelector(
      `[data-slide-idx="${activeSlideIndex}"]`
    )
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [activeSlideIndex])

  const handleSelectSlide = (idx: number) => {
    useSongsStore.getState().setActiveSlideIndex(idx)
    const slide = slides[idx]
    if (!slide) return
    const lineInfo =
      mode === "line" && slide.lineIndex && slide.totalLines
        ? { current: slide.lineIndex, total: slide.totalLines }
        : undefined
    presentSongSlide(slide.songTitle, slide.sectionLabel, slide.text, lineInfo)
  }

  const handlePrevSlide = () => {
    if (activeSlideIndex > 0) {
      handleSelectSlide(activeSlideIndex - 1)
    } else {
      remoteActions.queuePrev()
    }
  }

  const handleNextSlide = () => {
    if (activeSlideIndex < slides.length - 1) {
      handleSelectSlide(activeSlideIndex + 1)
    } else {
      remoteActions.queueNext()
    }
  }

  const handleStartEdit = (slide: SongSlide, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingSlideId(slide.id)
    setEditingText(slide.text)
    setAutosaveStatus("idle")
  }

  const handleCancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }
    setEditingSlideId(null)
    setEditingText("")
    setAutosaveStatus("idle")
  }

  const handleSaveInline = async (
    slide: SongSlide,
    closeAfter = true,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation()
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }

    const trimmed = editingText.trim()
    if (!trimmed) {
      if (closeAfter) {
        toast.error("Lyrics text cannot be empty")
      }
      return
    }

    const targetSection = item.song.sections.find(
      (s) => s.id === slide.sectionId
    )
    if (!targetSection) return

    let updatedLyrics = ""
    if (mode === "stanza") {
      updatedLyrics = trimmed
    } else {
      const lines = targetSection.lyrics
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
      const targetIdx = (slide.lineIndex ?? 1) - 1
      if (targetIdx >= 0 && targetIdx < lines.length) {
        lines[targetIdx] = trimmed
      } else {
        lines.push(trimmed)
      }
      updatedLyrics = lines.join("\n")
    }

    setIsSavingInline(true)
    setAutosaveStatus("saving")
    try {
      await updateSectionLyrics(slide.sectionId, updatedLyrics)
      useQueueStore
        .getState()
        .updateSongSectionLyrics(
          item.song.song.id,
          slide.sectionId,
          updatedLyrics
        )

      // If this slide is currently live, hot-patch the projection screen immediately!
      if (slides[activeSlideIndex]?.id === slide.id) {
        const lineInfo =
          mode === "line" && slide.lineIndex && slide.totalLines
            ? { current: slide.lineIndex, total: slide.totalLines }
            : undefined
        presentSongSlide(slide.songTitle, slide.sectionLabel, trimmed, lineInfo)
      }

      setAutosaveStatus("saved")
      if (closeAfter) {
        toast.success("Lyrics updated & autosaved to songlist")
        setEditingSlideId(null)
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to update lyrics", { description: String(err) })
      setAutosaveStatus("idle")
    } finally {
      setIsSavingInline(false)
    }
  }

  const handleTextChange = (slide: SongSlide, text: string) => {
    setEditingText(text)
    setAutosaveStatus("idle")
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }
    autosaveTimerRef.current = setTimeout(() => {
      void handleSaveInline(slide, false)
    }, 600)
  }

  const handleBlur = (slide: SongSlide) => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }
    void handleSaveInline(slide, true)
  }

  const currentSlide = slides[activeSlideIndex] ?? slides[0]

  return (
    <div className="flex flex-col gap-2 rounded-md border border-primary/25 bg-primary/5 p-2.5">
      {/* Song Header & Controls */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1.5">
            <MusicIcon className="size-3.5 shrink-0 text-primary" />
            <span className="truncate text-xs font-semibold text-foreground">
              {item.song.song.title}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={() => onEditSong?.(item.song)}
              title="Edit full song in Song Editor"
            >
              <PencilIcon className="size-3 text-lime-400" />
            </Button>
          </div>
          <span className="truncate text-[0.65rem] text-muted-foreground">
            {currentSlide
              ? `${currentSlide.sectionLabel} • ${mode === "line" ? `Line ${currentSlide.lineIndex ?? 1} of ${currentSlide.totalLines ?? 1}` : "Stanza"}`
              : "Lyrics"}
          </span>
        </div>

        {/* Stepper Buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => remoteActions.queuePrev()}
            title="Previous item in schedule"
          >
            <SkipBackIcon className="size-3" />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={handlePrevSlide}
            title={mode === "line" ? "Previous line" : "Previous stanza"}
          >
            <ChevronLeftIcon className="size-3.5" />
          </Button>
          <Button
            variant="default"
            size="xs"
            className="px-2 font-medium"
            onClick={handleNextSlide}
            title={mode === "line" ? "Next line" : "Next stanza"}
          >
            Next
            <ChevronRightIcon className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => remoteActions.queueNext()}
            title="Next item in schedule"
          >
            <SkipForwardIcon className="size-3" />
          </Button>
        </div>
      </div>

      {/* Interactive Slides List */}
      <div
        ref={slideListRef}
        className="flex min-h-[5rem] max-h-60 flex-1 flex-col gap-1 overflow-y-auto rounded border border-border/50 bg-background/60 p-1"
      >
        {slides.map((slide, idx) => {
          const isLiveSlide = idx === activeSlideIndex
          const isEditing = editingSlideId === slide.id

          return (
            <div
              key={slide.id}
              data-slide-idx={idx}
              onClick={() => {
                if (!isEditing) handleSelectSlide(idx)
              }}
              className={cn(
                "group flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-xs transition-colors",
                isLiveSlide
                  ? "border border-emerald-500/40 bg-emerald-500/15 font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60"
              )}
            >
              <span className="mt-0.5 shrink-0 font-mono text-[0.6rem] tabular-nums opacity-60">
                {idx + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[0.6rem] font-medium tracking-wider text-primary/80 uppercase">
                    {slide.sectionLabel}
                  </span>
                  {!isEditing && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="h-4 w-4 p-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                      onClick={(e) => handleStartEdit(slide, e)}
                      title="Quick edit this line"
                    >
                      <PencilIcon className="size-2.5" />
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  <div
                    className="mt-1 flex flex-col gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {mode === "line" ? (
                      <Input
                        value={editingText}
                        onChange={(e) => handleTextChange(slide, e.target.value)}
                        onBlur={() => handleBlur(slide)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            void handleSaveInline(slide, true)
                          } else if (e.key === "Escape") {
                            handleCancelEdit()
                          }
                        }}
                        autoFocus
                        disabled={isSavingInline}
                        className="h-6 bg-background px-1.5 text-xs"
                      />
                    ) : (
                      <Textarea
                        value={editingText}
                        onChange={(e) => handleTextChange(slide, e.target.value)}
                        onBlur={() => handleBlur(slide)}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                            e.preventDefault()
                            void handleSaveInline(slide, true)
                          } else if (e.key === "Escape") {
                            handleCancelEdit()
                          }
                        }}
                        autoFocus
                        rows={3}
                        disabled={isSavingInline}
                        className="bg-background p-1.5 text-xs"
                      />
                    )}
                    <div className="flex items-center justify-between gap-1 text-[0.6rem] text-muted-foreground">
                      <span className="italic">
                        {autosaveStatus === "saving" && "Autosaving..."}
                        {autosaveStatus === "saved" && "Autosaved ✓"}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="h-5 w-5"
                          onClick={handleCancelEdit}
                          title="Cancel (Esc)"
                        >
                          <XIcon className="size-3 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="default"
                          size="xs"
                          disabled={isSavingInline}
                          className="h-5 gap-1 bg-emerald-600 px-1.5 text-[0.65rem] hover:bg-emerald-500"
                          onClick={(e) => void handleSaveInline(slide, true, e)}
                          title={
                            mode === "line"
                              ? "Save & apply (Enter)"
                              : "Save & apply (Ctrl+Enter)"
                          }
                        >
                          <CheckIcon className="size-2.5" />
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p
                    onDoubleClick={(e) => handleStartEdit(slide, e)}
                    className={cn(
                      "leading-relaxed select-text",
                      mode === "stanza" ? "line-clamp-3" : "line-clamp-2"
                    )}
                    title="Double-click to quick edit"
                  >
                    {slide.text}
                  </p>
                )}
              </div>
              {isLiveSlide && !isEditing && (
                <Badge
                  variant="default"
                  className="h-4 shrink-0 bg-emerald-600 px-1 py-0 text-[0.55rem] font-bold uppercase"
                >
                  Live
                </Badge>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActiveVerseStepper({ item }: { item: VerseQueueItem }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-primary/25 bg-primary/5 p-2.5">
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <BookOpenIcon className="size-3.5 shrink-0 text-primary" />
          <span className="truncate text-xs font-semibold text-foreground">
            {item.reference}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => remoteActions.queuePrev()}
            title="Previous item in schedule"
          >
            <SkipBackIcon className="size-3" />
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => bibleActions.stepVerse("prev")}
            title="Previous verse"
          >
            <ChevronLeftIcon className="size-3" />
            Prev
          </Button>
          <Button
            variant="default"
            size="xs"
            onClick={() => bibleActions.stepVerse("next")}
            title="Next verse"
          >
            Next
            <ChevronRightIcon className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => remoteActions.queueNext()}
            title="Next item in schedule"
          >
            <SkipForwardIcon className="size-3" />
          </Button>
        </div>
      </div>
      <p className="line-clamp-3 rounded border border-border/50 bg-background/60 p-2 text-xs leading-relaxed text-muted-foreground">
        {item.verse.text || "(Verse text loading...)"}
      </p>
    </div>
  )
}

function ScheduleItemRow({
  item,
  index,
  isActive,
  isHighlighted,
  onMoveUp,
  onMoveDown,
  onEditSong,
  isFirst,
  isLast,
}: {
  item: QueueItem
  index: number
  isActive: boolean
  isHighlighted: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onEditSong?: (song: SongWithSections) => void
  isFirst: boolean
  isLast: boolean
}) {
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    useQueueStore.getState().removeItem(item.id)
  }

  const isSong = isSongQueueItem(item)
  const title = isVerseQueueItem(item)
    ? item.reference
    : `${item.song.song.title}${item.section ? ` (${item.section.section_type} ${item.section.section_number})` : ""}`

  const subtitle = isVerseQueueItem(item)
    ? item.verse.text?.slice(0, 45) + "..."
    : item.song.song.author || `${item.song.sections.length} sections`

  return (
    <div
      data-queue-idx={index}
      onClick={() => selectScheduleItem(index)}
      className={cn(
        "group flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 transition-colors",
        isHighlighted
          ? "animate-pulse border-amber-500/50 bg-amber-500/15"
          : isActive
            ? "border-primary/40 bg-primary/10 shadow-xs"
            : "border-transparent hover:border-border hover:bg-muted/40"
      )}
    >
      <GripVerticalIcon className="size-3 shrink-0 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100" />

      {isSong ? (
        <MusicIcon className="size-3.5 shrink-0 text-emerald-500/80" />
      ) : (
        <BookOpenIcon className="size-3.5 shrink-0 text-blue-500/80" />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-medium text-foreground">
          {title}
        </span>
        <span className="truncate text-[0.6rem] text-muted-foreground">
          {subtitle}
        </span>
      </div>

      {/* Reorder & Action buttons */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={isFirst}
          onClick={(e) => {
            e.stopPropagation()
            onMoveUp()
          }}
          title="Move up in schedule"
        >
          <ArrowUpIcon className="size-2.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={isLast}
          onClick={(e) => {
            e.stopPropagation()
            onMoveDown()
          }}
          title="Move down in schedule"
        >
          <ArrowDownIcon className="size-2.5" />
        </Button>
        {isSong && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation()
              onEditSong?.(item.song)
            }}
            title="Edit song lyrics & structure"
          >
            <PencilIcon className="size-2.5 text-lime-400" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation()
            selectScheduleItem(index)
          }}
          title="Present this item"
        >
          <PlayIcon className="size-2.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleRemove}
          title="Remove from schedule"
        >
          <XIcon className="size-2.5" />
        </Button>
      </div>
    </div>
  )
}

export function QueuePanel() {
  const items = useQueueStore((s) => s.items)
  const activeIndex = useQueueStore((s) => s.activeIndex)
  const highlightedId = useQueueStore((s) => s.highlightedId)
  const songDisplayMode = useSettingsStore((s) => s.songDisplayMode ?? "line")
  const setSongDisplayMode = useSettingsStore((s) => s.setSongDisplayMode)

  const [missingSongs, setMissingSongs] = useState<SongWithSections[]>([])
  const [importedItems, setImportedItems] = useState<QueueItem[]>([])
  const [promptOpen, setPromptOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [editingSong, setEditingSong] = useState<SongWithSections | null>(null)

  const activeItem =
    activeIndex !== null && activeIndex >= 0 && activeIndex < items.length
      ? items[activeIndex]
      : null

  const handleExportSchedule = async () => {
    if (items.length === 0) {
      toast.info("Schedule is empty", {
        description: "Add some songs or scriptures first before exporting.",
      })
      return
    }

    setExporting(true)
    try {
      const saved = await exportScheduleToFile(items, {
        songDisplayMode,
      })
      if (saved) {
        toast.success("Schedule Exported", {
          description: `Exported ${items.length} items to .rhema file.`,
        })
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to export schedule", {
        description: String(err),
      })
    } finally {
      setExporting(false)
    }
  }

  const handleImportSchedule = async () => {
    setImporting(true)
    try {
      const fileData = await importScheduleFromFile()
      if (!fileData) return // user cancelled

      if (fileData.songDisplayMode) {
        setSongDisplayMode(fileData.songDisplayMode)
      }

      // Check for missing songs in local library
      const existingSongs = useSongsStore.getState().songs
      const missing = findMissingSongsInLibrary(fileData.items, existingSongs)

      if (missing.length > 0) {
        // Prompt user to save missing songs to library or load into schedule only
        setMissingSongs(missing)
        setImportedItems(fileData.items)
        setPromptOpen(true)
      } else {
        // All songs already exist (or no songs in schedule) - load directly!
        useQueueStore.getState().setItems(fileData.items)
        toast.success("Schedule Imported", {
          description: `${fileData.items.length} items loaded and ready to present.`,
        })
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to import schedule", {
        description: String(err),
      })
    } finally {
      setImporting(false)
    }
  }

  // Keyboard navigation listener (ArrowUp/Down, Space, PageUp/Down)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute("contenteditable") === "true"

      if (isInput) return

      if (
        e.key === "ArrowDown" ||
        e.key === "PageDown" ||
        (e.key === " " && !e.shiftKey)
      ) {
        e.preventDefault()
        remoteActions.queueNext()
      } else if (
        e.key === "ArrowUp" ||
        e.key === "PageUp" ||
        (e.key === " " && e.shiftKey)
      ) {
        e.preventDefault()
        remoteActions.queuePrev()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleMoveUp = (idx: number) => {
    if (idx > 0) {
      useQueueStore.getState().reorderItems(idx, idx - 1)
      if (activeIndex === idx) useQueueStore.getState().setActive(idx - 1)
      else if (activeIndex === idx - 1) useQueueStore.getState().setActive(idx)
    }
  }

  const handleMoveDown = (idx: number) => {
    if (idx < items.length - 1) {
      useQueueStore.getState().reorderItems(idx, idx + 1)
      if (activeIndex === idx) useQueueStore.getState().setActive(idx + 1)
      else if (activeIndex === idx + 1) useQueueStore.getState().setActive(idx)
    }
  }

  return (
    <div
      data-slot="queue-panel"
      className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <PanelHeader title="Schedule">
        <div className="flex items-center gap-1.5">
          {/* Export & Import buttons */}
          <div className="flex items-center gap-0.5 border-r border-border pr-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleExportSchedule}
              disabled={exporting}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title="Export schedule to file (.rhema)"
            >
              <UploadIcon className="size-3.5 text-lime-400" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleImportSchedule}
              disabled={importing}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title="Import schedule from file (.rhema)"
            >
              <DownloadIcon className="size-3.5 text-lime-400" />
            </Button>
          </div>

          {/* Line vs Stanza Mode Toggle */}
          <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5 text-[0.6rem]">
            <button
              onClick={() => setSongDisplayMode("line")}
              className={cn(
                "cursor-pointer rounded px-1.5 py-0.5 font-medium transition-colors",
                songDisplayMode === "line"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Display song lyrics line by line (default)"
            >
              Lines
            </button>
            <button
              onClick={() => setSongDisplayMode("stanza")}
              className={cn(
                "cursor-pointer rounded px-1.5 py-0.5 font-medium transition-colors",
                songDisplayMode === "stanza"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Display song lyrics stanza by stanza"
            >
              Stanzas
            </button>
          </div>

          <Badge variant="outline" className="px-1.5 text-[0.6rem]">
            {items.length}
          </Badge>

          <button
            onClick={() => useQueueStore.getState().clearQueue()}
            className="cursor-pointer text-[0.6rem] text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      </PanelHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2">
        {/* Active Stepper Card (when a song or scripture is active) */}
        {activeItem && isSongQueueItem(activeItem) && (
          <ActiveSongStepper
            item={activeItem}
            mode={songDisplayMode}
            onEditSong={setEditingSong}
          />
        )}
        {activeItem && isVerseQueueItem(activeItem) && (
          <ActiveVerseStepper item={activeItem} />
        )}

        {/* Schedule Items List */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-1">
            {items.length === 0 && (
              <p className="p-6 text-center text-xs leading-relaxed text-muted-foreground">
                Add songs from the Songs panel or scriptures to build your
                service schedule
              </p>
            )}
            {items.map((item, idx) => (
              <ScheduleItemRow
                key={item.id}
                item={item}
                index={idx}
                isActive={idx === activeIndex}
                isHighlighted={item.id === highlightedId}
                onMoveUp={() => handleMoveUp(idx)}
                onMoveDown={() => handleMoveDown(idx)}
                onEditSong={setEditingSong}
                isFirst={idx === 0}
                isLast={idx === items.length - 1}
              />
            ))}
          </div>
        </div>
      </div>
      <ImportSongsPromptDialog
        open={promptOpen}
        onOpenChange={setPromptOpen}
        missingSongs={missingSongs}
        importedItems={importedItems}
      />
      <EditSongDialog
        song={editingSong}
        open={editingSong !== null}
        onOpenChange={(open) => !open && setEditingSong(null)}
      />
    </div>
  )
}
