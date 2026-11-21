import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  MusicIcon,
  BookOpenIcon,
  CheckCircleIcon,
  SparklesIcon,
} from "lucide-react"
import { toast } from "sonner"
import { createSong } from "@/stores/songs-store"
import { useQueueStore } from "@/stores"
import type { SongWithSections, QueueItem } from "@/types"

interface ImportSongsPromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  missingSongs: SongWithSections[]
  importedItems: QueueItem[]
  onCompleted?: () => void
}

export function ImportSongsPromptDialog({
  open,
  onOpenChange,
  missingSongs,
  importedItems,
  onCompleted,
}: ImportSongsPromptDialogProps) {
  const [saving, setSaving] = useState(false)

  const handleSaveToLibrary = async () => {
    setSaving(true)
    let savedCount = 0
    try {
      for (const songWithSections of missingSongs) {
        await createSong(
          {
            title: songWithSections.song.title,
            author: songWithSections.song.author,
            composer: songWithSections.song.composer,
            copyright: songWithSections.song.copyright,
            ccli_number: songWithSections.song.ccli_number,
            themes: songWithSections.song.themes,
          },
          songWithSections.sections
        )
        savedCount++
      }

      // Populate queue
      useQueueStore.getState().setItems(importedItems)

      toast.success("Schedule Imported & Songs Saved", {
        description: `Saved ${savedCount} new song(s) to your library. Schedule is ready to present.`,
      })

      onOpenChange(false)
      onCompleted?.()
    } catch (err) {
      console.error("Failed to save imported songs to library:", err)
      toast.error("Failed to save some songs to library", {
        description: String(err),
      })
      // Still populate queue so the service can proceed
      useQueueStore.getState().setItems(importedItems)
      onOpenChange(false)
      onCompleted?.()
    } finally {
      setSaving(false)
    }
  }

  const handleDiscardLibrarySave = () => {
    // Only populate schedule without saving to DB library
    useQueueStore.getState().setItems(importedItems)
    toast.success("Schedule Loaded for Presentation", {
      description: `${importedItems.length} items loaded. Songs were not added to local library.`,
    })
    onOpenChange(false)
    onCompleted?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-5 text-lime-400" />
            Imported Schedule Contains New Songs
          </DialogTitle>
          <DialogDescription>
            This schedule includes {missingSongs.length} song(s) not currently
            found in your local song library.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground">
            Would you like to save these songs into your local library so they
            appear in your permanent song catalog?
          </p>

          <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-border bg-muted/20 p-2.5">
            {missingSongs.map((s, idx) => (
              <div
                key={s.song.id || idx}
                className="flex items-start gap-2.5 rounded border border-border/60 bg-card p-2 text-xs"
              >
                <MusicIcon className="mt-0.5 size-4 shrink-0 text-lime-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">
                    {s.song.title}
                  </p>
                  <p className="truncate text-[0.7rem] text-muted-foreground">
                    {s.song.author || "Unknown author"} • {s.sections.length}{" "}
                    sections
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[0.72rem] text-muted-foreground">
            Choosing <strong>&ldquo;Schedule Only&rdquo;</strong> will still
            load and present all songs during this service, but won&rsquo;t
            store them in your permanent library database.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscardLibrarySave}
              disabled={saving}
              title="Load into schedule only without saving to library"
            >
              Schedule Only
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveToLibrary}
              disabled={saving}
              className="gap-1.5"
            >
              {saving ? "Saving..." : "Save to Library"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
