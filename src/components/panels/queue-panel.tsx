import { useEffect, useState } from "react"
import { PanelHeader } from "@/components/ui/panel-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  PlayIcon,
  XIcon,
  GripVerticalIcon,
  MusicIcon,
  BookOpenIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  DownloadIcon,
  UploadIcon,
  PencilIcon,
  LanguagesIcon,
} from "lucide-react"
import { useQueueStore } from "@/stores"
import { useSettingsStore } from "@/stores/settings-store"
import { useSongsStore } from "@/stores/songs-store"
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
  SongWithSections,
} from "@/types"
import { isVerseQueueItem, isSongQueueItem, isConcordanceQueueItem } from "@/types"

function selectScheduleItem(index: number, options?: { forceLive?: boolean }) {
  void remoteActions.selectQueueItem(index, options)
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
  const isConcordance = isConcordanceQueueItem(item)
  const title = isVerseQueueItem(item)
    ? item.reference
    : isSongQueueItem(item)
      ? `${item.song.song.title}${item.section ? ` (${item.section.section_type} ${item.section.section_number})` : ""}`
      : `${item.entry.lemma} • ${item.entry.translit} (${item.entry.strongs_number})`

  const subtitle = isVerseQueueItem(item)
    ? item.verse.text?.slice(0, 45) + "..."
    : isSongQueueItem(item)
      ? item.song.song.author || `${item.song.sections.length} sections`
      : item.entry.strongs_def.slice(0, 45) + "..."

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
      ) : isConcordance ? (
        <LanguagesIcon className="size-3.5 shrink-0 text-amber-500/80" />
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
            selectScheduleItem(index, { forceLive: true })
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

  // Scroll active schedule item into view
  useEffect(() => {
    if (activeIndex === null) return
    const el = document.querySelector(
      `[data-slot="queue-panel"] [data-queue-idx="${activeIndex}"]`
    )
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [activeIndex])

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

      // Don't intercept if a modal or dialog is open
      const isModalOpen = Boolean(
        document.querySelector(
          '[role="dialog"], [role="alertdialog"], [data-state="open"][data-slot*="dialog"]'
        )
      )
      if (isModalOpen) return

      const isInsideQueue = Boolean(
        activeElement?.closest('[data-slot="queue-panel"]')
      )

      if (e.key === "ArrowDown") {
        if (!isInsideQueue) return
        e.preventDefault()
        remoteActions.queueNext()
      } else if (e.key === "ArrowUp") {
        if (!isInsideQueue) return
        e.preventDefault()
        remoteActions.queuePrev()
      } else if (e.key === "Enter") {
        if (!isInsideQueue) return
        e.preventDefault()
        if (activeIndex !== null) {
          selectScheduleItem(activeIndex, { forceLive: true })
        }
      } else if (
        e.key === "PageDown" ||
        (e.key === " " && !e.shiftKey)
      ) {
        // Presentation clicker remotes send PageDown / Space globally
        e.preventDefault()
        remoteActions.queueNext()
      } else if (
        e.key === "PageUp" ||
        (e.key === " " && e.shiftKey)
      ) {
        // Presentation clicker remotes send PageUp / Shift+Space globally
        e.preventDefault()
        remoteActions.queuePrev()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeIndex])

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
      tabIndex={0}
      className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card outline-none"
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
