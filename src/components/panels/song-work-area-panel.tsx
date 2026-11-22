import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import {
  MusicIcon,
  PencilIcon,
  PlusIcon,
  PlayIcon,
  EyeIcon,
  CheckIcon,
  XIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RadioIcon,
  FileMusicIcon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { useSongsStore, updateSectionLyrics } from "@/stores/songs-store"
import { useQueueStore } from "@/stores/queue-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { generateSongSlides, type SongSlide } from "@/lib/song-slides"
import { previewSongSlide, presentSongSlide } from "@/hooks/use-broadcast"
import { EditSongDialog } from "@/components/songs/edit-song-dialog"
import { CreateSongDialog } from "@/components/songs/create-song-dialog"

export function SongWorkAreaPanel() {
  const selectedSong = useSongsStore((s) => s.selectedSong)
  const displayMode = useSongsStore((s) => s.displayMode)
  const setDisplayMode = useSongsStore((s) => s.setDisplayMode)
  const activeSlideIndex = useSongsStore((s) => s.activeSlideIndex)
  const setActiveSlideIndex = useSongsStore((s) => s.setActiveSlideIndex)

  const liveVerse = useBroadcastStore((s) => s.liveVerse)
  const previewVerse = useBroadcastStore((s) => s.previewVerse)

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  // In-line slide editing state
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState("")
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const listContainerRef = useRef<HTMLDivElement>(null)

  // Generate flat continuous list of slides for all sections of the selected song
  const slides = useMemo(() => {
    if (!selectedSong) return []
    return generateSongSlides(selectedSong, displayMode)
  }, [selectedSong, displayMode])

  // Clear autosave timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [])

  // Auto-scroll active slide into view smoothly
  useEffect(() => {
    if (!listContainerRef.current) return
    const activeEl = listContainerRef.current.querySelector(
      `[data-slide-index="${activeSlideIndex}"]`
    )
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [activeSlideIndex])

  // Action: Single-click Preview
  const handlePreviewSlide = useCallback(
    (slide: SongSlide, idx: number) => {
      setActiveSlideIndex(idx)
      const lineInfo =
        displayMode === "line" && slide.lineIndex && slide.totalLines
          ? { current: slide.lineIndex, total: slide.totalLines }
          : undefined
      previewSongSlide(slide.songTitle, slide.sectionLabel, slide.text, lineInfo)
    },
    [displayMode, setActiveSlideIndex]
  )

  // Action: Double-click or Enter -> Live Output
  const handlePresentLive = useCallback(
    (slide: SongSlide, idx: number) => {
      setActiveSlideIndex(idx)
      const lineInfo =
        displayMode === "line" && slide.lineIndex && slide.totalLines
          ? { current: slide.lineIndex, total: slide.totalLines }
          : undefined
      presentSongSlide(slide.songTitle, slide.sectionLabel, slide.text, lineInfo)
    },
    [displayMode, setActiveSlideIndex]
  )

  // Steppers
  const handlePrevSlide = useCallback(() => {
    if (activeSlideIndex > 0 && slides[activeSlideIndex - 1]) {
      const nextIdx = activeSlideIndex - 1
      handlePreviewSlide(slides[nextIdx], nextIdx)
    }
  }, [activeSlideIndex, slides, handlePreviewSlide])

  const handleNextSlide = useCallback(() => {
    if (activeSlideIndex < slides.length - 1 && slides[activeSlideIndex + 1]) {
      const nextIdx = activeSlideIndex + 1
      handlePreviewSlide(slides[nextIdx], nextIdx)
    }
  }, [activeSlideIndex, slides, handlePreviewSlide])

  // Keyboard navigation for work area
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingSlideId !== null) return // don't hijack keyboard when editing text
      if (slides.length === 0) return

      if (e.key === "ArrowDown") {
        e.preventDefault()
        handleNextSlide()
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        handlePrevSlide()
      } else if (e.key === "Enter") {
        e.preventDefault()
        const currentSlide = slides[activeSlideIndex]
        if (currentSlide) {
          handlePresentLive(currentSlide, activeSlideIndex)
        }
      }
    },
    [editingSlideId, slides, activeSlideIndex, handleNextSlide, handlePrevSlide, handlePresentLive]
  )

  // Inline editing handlers
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
    textToSave = editingText
  ) => {
    if (!selectedSong) return
    const trimmed = textToSave.trim()
    if (!trimmed) {
      if (closeAfter) toast.error("Lyrics text cannot be empty")
      return
    }

    const targetSection = selectedSong.sections.find((s) => s.id === slide.sectionId)
    if (!targetSection) return

    let updatedLyrics = ""
    if (displayMode === "stanza") {
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

    setAutosaveStatus("saving")
    try {
      await updateSectionLyrics(slide.sectionId, updatedLyrics)
      useQueueStore
        .getState()
        .updateSongSectionLyrics(selectedSong.song.id, slide.sectionId, updatedLyrics)

      // If this slide is currently live on screen, update broadcast immediately!
      const currentLiveText = liveVerse?.segments?.[0]?.text
      if (currentLiveText === slide.text || slides[activeSlideIndex]?.id === slide.id) {
        const lineInfo =
          displayMode === "line" && slide.lineIndex && slide.totalLines
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
    }
  }

  // Debounced typing autosave
  const handleTextChange = (text: string, slide: SongSlide) => {
    setEditingText(text)
    setAutosaveStatus("saving")
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }
    autosaveTimerRef.current = setTimeout(() => {
      void handleSaveInline(slide, false, text)
    }, 600)
  }

  // Add whole song to schedule queue
  const handleAddToSchedule = useCallback(() => {
    if (!selectedSong) return
    const ref = selectedSong.song.title
    useQueueStore.getState().addItem({
      id: crypto.randomUUID(),
      type: "song",
      song: selectedSong,
      section: null,
      reference: ref,
      added_at: Date.now(),
      source: "manual",
    })
    toast.success("Added to Schedule", {
      description: `${ref} (${slides.length} slides)`,
    })
  }, [selectedSong, slides.length])

  return (
    <div
      data-slot="song-work-area-panel"
      className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Header Bar */}
      <div className="flex min-h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <MusicIcon className="size-4 shrink-0 text-lime-400" />
          {selectedSong ? (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-semibold text-foreground">
                {selectedSong.song.title}
              </span>
              <span className="truncate text-[0.65rem] text-muted-foreground">
                {selectedSong.song.author
                  ? `${selectedSong.song.author} • `
                  : ""}
                {selectedSong.sections.length} sections • {slides.length} {displayMode === "line" ? "lines" : "stanzas"}
              </span>
            </div>
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">
              Song Work Area
            </span>
          )}
        </div>

        {selectedSong && (
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Display mode toggle (Lines vs Stanzas) */}
            <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setDisplayMode("line")}
                className={cn(
                  "rounded px-2 py-0.5 text-[0.68rem] font-medium transition-colors",
                  displayMode === "line"
                    ? "bg-background text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Expand lyrics line-by-line"
              >
                Lines
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode("stanza")}
                className={cn(
                  "rounded px-2 py-0.5 text-[0.68rem] font-medium transition-colors",
                  displayMode === "stanza"
                    ? "bg-background text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Group lyrics by stanzas"
              >
                Stanzas
              </button>
            </div>

            {/* Steppers */}
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handlePrevSlide}
                disabled={activeSlideIndex <= 0}
                title="Previous line/slide (Up arrow)"
              >
                <ChevronLeftIcon className="size-3.5" />
              </Button>
              <span className="min-w-[40px] text-center text-[0.68rem] font-mono text-muted-foreground">
                {slides.length > 0 ? `${activeSlideIndex + 1}/${slides.length}` : "0/0"}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleNextSlide}
                disabled={activeSlideIndex >= slides.length - 1}
                title="Next line/slide (Down arrow)"
              >
                <ChevronRightIcon className="size-3.5" />
              </Button>
            </div>

            {/* Add to Schedule */}
            <Button
              variant="outline"
              size="xs"
              onClick={handleAddToSchedule}
              className="h-7 gap-1 border-border px-2 text-xs font-medium hover:bg-muted"
              title="Add entire song to Schedule"
            >
              <PlusIcon className="size-3 text-lime-400" />
              <span>Schedule</span>
            </Button>

            {/* Edit Song metadata & sections dialog */}
            <Button
              variant="outline"
              size="xs"
              onClick={() => setEditDialogOpen(true)}
              className="h-7 gap-1 border-border px-2 text-xs font-medium hover:bg-muted"
              title="Edit full song details and sections"
            >
              <PencilIcon className="size-3 text-lime-400" />
              <span>Edit</span>
            </Button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div
        ref={listContainerRef}
        className="min-h-0 flex-1 overflow-y-auto p-2"
      >
        {!selectedSong ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted/50 mb-3">
              <MusicIcon className="size-6 text-muted-foreground/60" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              Song Work Area
            </h3>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Select a song from the <strong>Songs</strong> tab on the left or click a song in your <strong>Schedule</strong> to display its line-by-line lyrics here.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                size="xs"
                variant="outline"
                onClick={() => setCreateDialogOpen(true)}
                className="gap-1.5 text-xs"
              >
                <PlusIcon className="size-3 text-lime-400" />
                <span>Create New Song</span>
              </Button>
            </div>
          </div>
        ) : slides.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <FileMusicIcon className="size-8 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">
              This song does not have any lyrics in its sections yet.
            </p>
            <Button
              size="xs"
              variant="outline"
              className="mt-3 gap-1"
              onClick={() => setEditDialogOpen(true)}
            >
              <PencilIcon className="size-3 text-lime-400" />
              <span>Add Lyrics to Song</span>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {slides.map((slide, idx) => {
              const isActive = activeSlideIndex === idx
              const isEditing = editingSlideId === slide.id
              const isLive = liveVerse?.segments?.[0]?.text === slide.text
              const isPreview = previewVerse?.segments?.[0]?.text === slide.text

              return (
                <div
                  key={slide.id}
                  data-slide-index={idx}
                  onClick={() => handlePreviewSlide(slide, idx)}
                  onDoubleClick={() => handlePresentLive(slide, idx)}
                  className={cn(
                    "group relative flex flex-col rounded-md border p-2 transition-all cursor-pointer",
                    isEditing
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : isLive
                        ? "border-emerald-500/60 bg-emerald-500/10 shadow-xs"
                        : isActive || isPreview
                          ? "border-sky-500/60 bg-sky-500/10 shadow-xs"
                          : "border-border/50 bg-card/60 hover:border-border hover:bg-muted/40"
                  )}
                  title="Single-click to Preview • Double-click or Enter to Send Live"
                >
                  {/* Slide Top Metadata Bar */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      {/* Flat Continuous Line Index (1..N) */}
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full text-[0.65rem] font-bold font-mono",
                          isLive
                            ? "bg-emerald-600 text-white"
                            : isActive
                              ? "bg-sky-600 text-white"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {idx + 1}
                      </span>

                      {/* Section label badge */}
                      <Badge
                        variant="secondary"
                        className="h-4 px-1 text-[0.6rem] font-medium tracking-wide uppercase"
                      >
                        {slide.sectionLabel}
                        {displayMode === "line" && slide.lineIndex && slide.totalLines && (
                          <span className="ml-1 opacity-70">
                            ({slide.lineIndex}/{slide.totalLines})
                          </span>
                        )}
                      </Badge>

                      {/* Live Indicator */}
                      {isLive && (
                        <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.2 text-[0.6rem] font-bold text-emerald-400">
                          <RadioIcon className="size-2.5 animate-pulse" />
                          LIVE
                        </span>
                      )}

                      {/* Preview Indicator */}
                      {isPreview && !isLive && (
                        <span className="flex items-center gap-1 rounded bg-sky-500/20 px-1.5 py-0.2 text-[0.6rem] font-bold text-sky-400">
                          <EyeIcon className="size-2.5" />
                          PREVIEW
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {autosaveStatus === "saving" && (
                            <span className="text-[0.62rem] text-muted-foreground italic mr-1">
                              Saving...
                            </span>
                          )}
                          {autosaveStatus === "saved" && (
                            <span className="flex items-center gap-0.5 text-[0.62rem] text-emerald-400 font-medium mr-1">
                              <CheckIcon className="size-2.5" />
                              Autosaved
                            </span>
                          )}
                          <Button
                            variant="default"
                            size="icon-xs"
                            className="size-5 bg-emerald-600 hover:bg-emerald-500"
                            title="Done (or press Cmd+Enter)"
                            onClick={() => void handleSaveInline(slide, true)}
                          >
                            <CheckIcon className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="size-5 text-muted-foreground hover:text-foreground"
                            title="Cancel (Esc)"
                            onClick={handleCancelEdit}
                          >
                            <XIcon className="size-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="size-5 text-muted-foreground hover:text-foreground"
                            title="Edit this line"
                            onClick={(e) => handleStartEdit(slide, e)}
                          >
                            <PencilIcon className="size-3 text-lime-400" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="size-5 text-sky-400 hover:text-sky-300"
                            title="Preview slide"
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePreviewSlide(slide, idx)
                            }}
                          >
                            <EyeIcon className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="size-5 text-emerald-400 hover:text-emerald-300"
                            title="Send Live"
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePresentLive(slide, idx)
                            }}
                          >
                            <PlayIcon className="size-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Slide Lyrics Text or In-line Edit Field */}
                  {isEditing ? (
                    <div
                      className="mt-1 flex flex-col gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Textarea
                        value={editingText}
                        onChange={(e) => handleTextChange(e.target.value, slide)}
                        onBlur={() => void handleSaveInline(slide, false)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault()
                            void handleSaveInline(slide, true)
                          } else if (e.key === "Escape") {
                            e.preventDefault()
                            handleCancelEdit()
                          }
                        }}
                        autoFocus
                        rows={displayMode === "stanza" ? 4 : 2}
                        className="resize-none font-sans text-xs leading-relaxed"
                        placeholder="Type lyrics here..."
                      />
                      <div className="flex justify-between items-center text-[0.62rem] text-muted-foreground px-0.5">
                        <span>Autosaves on typing • Press Cmd+Enter to finish • Esc to cancel</span>
                      </div>
                    </div>
                  ) : (
                    <p
                      className={cn(
                        "font-sans text-xs leading-relaxed select-text",
                        isLive
                          ? "font-medium text-emerald-200"
                          : isActive
                            ? "font-medium text-foreground"
                            : "text-muted-foreground group-hover:text-foreground"
                      )}
                    >
                      {slide.text}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Dialogs for Song Creation & Full Song Editing */}
      <CreateSongDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <EditSongDialog
        song={selectedSong}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSaved={() => {
          // If edited song changed, refresh will update store through updateSong
        }}
      />
    </div>
  )
}
