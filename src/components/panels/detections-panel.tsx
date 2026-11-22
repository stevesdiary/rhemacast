import { useEffect, useMemo } from "react"
import { PanelHeader } from "@/components/ui/panel-header"
import { ConfidenceDot } from "@/components/ui/confidence-dot"
import { Button } from "@/components/ui/button"
import { PlayIcon, PlusIcon, XIcon, EyeIcon, LanguagesIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDetection, detectionActions } from "@/hooks/use-detection"
import { bibleActions } from "@/hooks/use-bible"
import { useQueueStore, useBibleStore } from "@/stores"
import { presentVerse, presentConcordance, previewConcordance } from "@/hooks/use-broadcast"
import { mark } from "@/lib/latency-marks"
import type { DetectionResult, ConcordanceDetection } from "@/types"

const SOURCE_COLORS: Record<string, { text: string; label: string }> = {
  direct: { text: "text-green-600", label: "Direct" },
  semantic: { text: "text-indigo-300", label: "Semantic" },
}

function DetectionCard({ detection }: { detection: DetectionResult }) {
  const handlePresent = () => {
    // Navigate book search panel to this verse
    if (detection.book_number > 0) {
      bibleActions.navigateToVerse(
        detection.book_number,
        detection.chapter,
        detection.verse
      )
    }
    // Refetch full verse text, select for preview, and set live
    void presentVerse({
      id: 0,
      translation_id: useBibleStore.getState().activeTranslationId,
      book_number: detection.book_number,
      book_name: detection.book_name,
      book_abbreviation: "",
      chapter: detection.chapter,
      verse: detection.verse,
      text: detection.verse_text,
    })
  }

  return (
    <div className="group border-b border-border p-3 last:border-0">
      <div className="flex items-center gap-2">
        <ConfidenceDot confidence={detection.confidence} />
        <span className="flex-1 truncate text-sm font-semibold text-foreground">
          {detection.verse_ref}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Dismiss ${detection.verse_ref}`}
          title="Dismiss"
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          onClick={() =>
            detectionActions.dismissDetection(
              detection.verse_ref,
              detection.source
            )
          }
        >
          <XIcon className="size-2.5" />
        </Button>
      </div>

      {detection.verse_text && (
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {detection.verse_text}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <Button size="sm" className="gap-1" onClick={handlePresent}>
          <PlayIcon className="size-3" />
          Present
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => {
            useQueueStore.getState().addItem({
              id: crypto.randomUUID(),
              type: "verse",
              verse: {
                id: 0,
                translation_id: useBibleStore.getState().activeTranslationId,
                book_number: detection.book_number,
                book_name: detection.book_name,
                book_abbreviation: "",
                chapter: detection.chapter,
                verse: detection.verse,
                text: detection.verse_text,
              },
              reference: detection.verse_ref,
              confidence: detection.confidence,
              source:
                detection.source === "direct" ? "ai-direct" : "ai-semantic",
              added_at: Date.now(),
            })
          }}
        >
          <PlusIcon className="size-3" />
          Queue
        </Button>
      </div>
    </div>
  )
}

function ConcordanceCard({ detection }: { detection: ConcordanceDetection }) {
  const { entry } = detection
  const pronStr = entry.pronunciation ? ` /${entry.pronunciation}/` : ""

  const handlePresent = () => {
    presentConcordance(entry)
  }

  const handlePreview = () => {
    previewConcordance(entry)
  }

  const handleQueue = () => {
    useQueueStore.getState().addItem({
      id: crypto.randomUUID(),
      type: "concordance",
      entry,
      reference: `${entry.lemma} • ${entry.translit} (${entry.strongs_number})`,
      added_at: Date.now(),
      source: "ai",
    })
  }

  return (
    <div className="group border-b border-amber-500/30 bg-amber-500/5 p-3 transition-colors hover:bg-amber-500/10 last:border-0">
      <div className="flex items-center gap-2">
        <ConfidenceDot confidence={detection.confidence} />
        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[0.625rem] font-bold text-amber-500 uppercase tracking-wider">
          {entry.language} • {entry.strongs_number}
        </span>
        <span className="flex-1 truncate text-sm font-semibold text-foreground">
          {entry.lemma} • {entry.translit}
          {pronStr && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {pronStr}
            </span>
          )}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Dismiss ${entry.strongs_number}`}
          title="Dismiss"
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          onClick={() =>
            detectionActions.dismissConcordanceDetection(entry.strongs_number)
          }
        >
          <XIcon className="size-2.5" />
        </Button>
      </div>

      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-foreground/90">
        {entry.strongs_def}
      </p>

      {entry.kjv_def && (
        <p className="mt-0.5 line-clamp-1 text-[0.6875rem] text-muted-foreground italic">
          <span className="font-medium text-foreground/70 not-italic">KJV:</span> {entry.kjv_def}
        </p>
      )}

      {detection.trigger_phrase && (
        <p className="mt-1 text-[0.625rem] text-amber-600/80 dark:text-amber-400/80 font-medium">
          Trigger: &ldquo;{detection.trigger_phrase}&rdquo;
        </p>
      )}

      <div className="mt-2 flex gap-1.5">
        <Button
          size="xs"
          className="gap-1 bg-amber-600 hover:bg-amber-700 text-white font-medium"
          onClick={handlePresent}
        >
          <PlayIcon className="size-3" />
          Present
        </Button>
        <Button
          variant="outline"
          size="xs"
          className="gap-1 border-amber-500/30 hover:bg-amber-500/10"
          onClick={handlePreview}
        >
          <EyeIcon className="size-3" />
          Preview
        </Button>
        <Button
          variant="outline"
          size="xs"
          className="gap-1 border-amber-500/30 hover:bg-amber-500/10"
          onClick={handleQueue}
        >
          <PlusIcon className="size-3" />
          Schedule
        </Button>
      </div>
    </div>
  )
}

function DetectionColumn({
  source,
  detections,
}: {
  source: "direct" | "semantic"
  detections: DetectionResult[]
}) {
  const style = SOURCE_COLORS[source]
  return (
    <div className="flex min-h-0 flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-border bg-card px-3 py-1.5">
        <span
          className={cn(
            "text-[0.5625rem] font-medium tracking-wider uppercase",
            style.text
          )}
        >
          {style.label}
        </span>
        <span className="text-[0.5625rem] text-muted-foreground">
          {detections.length}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {detections.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">
            No {style.label.toLowerCase()} detections yet
          </p>
        ) : (
          detections.map((detection, i) => (
            <DetectionCard
              key={`${detection.verse_ref}-${i}`}
              detection={detection}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function DetectionsPanel() {
  const { detections, concordanceDetections } = useDetection()

  // Latency debugging: when the list changes, mark the React commit and the
  // next animation frame (≈ actual pixels on screen).
  useEffect(() => {
    if (detections.length === 0) return
    mark(
      `detections-commit n=${detections.length} first=${detections[0]?.verse_ref ?? ""} src=${detections[0]?.source ?? "?"}`
    )
    const raf = requestAnimationFrame(() => mark("detections-paint"))
    return () => cancelAnimationFrame(raf)
  }, [detections])

  // Issue #104: direct (spoken references) and semantic (quoted text)
  // detections in separate columns, so a burst of direct hits doesn't push
  // the semantic ones out of view.
  const directDetections = useMemo(
    () => detections.filter((d) => d.source === "direct"),
    [detections]
  )
  const semanticDetections = useMemo(
    () => detections.filter((d) => d.source !== "direct"),
    [detections]
  )

  const hasAnyDetections = detections.length > 0 || concordanceDetections.length > 0

  return (
    <div
      data-slot="detections-panel"
      className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <PanelHeader title="Recent detections">
        <button
          onClick={() => {
            detectionActions.clearDetections()
            detectionActions.clearConcordanceDetections()
          }}
          className="text-[0.625rem] text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear all
        </button>
      </PanelHeader>

      {/* Greek & Hebrew Lexicon Detections Banner */}
      {concordanceDetections.length > 0 && (
        <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between border-b border-amber-500/20 bg-amber-500/10 px-3 py-1">
            <span className="flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <LanguagesIcon className="size-3" />
              Greek & Hebrew Lexicon ({concordanceDetections.length})
            </span>
            <button
              onClick={() => detectionActions.clearConcordanceDetections()}
              className="text-[0.6rem] text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-amber-500/15">
            {concordanceDetections.map((d) => (
              <ConcordanceCard key={d.entry.strongs_number} detection={d} />
            ))}
          </div>
        </div>
      )}

      {!hasAnyDetections ? (
        <p className="p-4 text-center text-xs text-muted-foreground">
          Verse & Greek/Hebrew word detections will appear here during preaching
        </p>
      ) : detections.length === 0 ? (
        <div className="p-4 text-center text-xs text-muted-foreground">
          No verse detections yet
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-2 divide-x divide-border">
          <DetectionColumn source="direct" detections={directDetections} />
          <DetectionColumn source="semantic" detections={semanticDetections} />
        </div>
      )}
    </div>
  )
}
