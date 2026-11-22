import { useState, useEffect, useTransition } from "react"
import { SearchIcon, PlayIcon, EyeIcon, PlusIcon, XIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { detectionActions } from "@/hooks/use-detection"
import { presentConcordance, previewConcordance } from "@/hooks/use-broadcast"
import { useQueueStore } from "@/stores"
import type { ConcordanceEntry } from "@/types"

const POPULAR_TERMS = [
  { label: "Kairos (G2540)", code: "G2540" },
  { label: "Rhema (G4487)", code: "G4487" },
  { label: "Zoe (G2222)", code: "G2222" },
  { label: "Logos (G3056)", code: "G3056" },
  { label: "Dunamis (G1411)", code: "G1411" },
  { label: "Agape (G26)", code: "G26" },
  { label: "Parakletos (G3875)", code: "G3875" },
  { label: "Shalom (H7965)", code: "H7965" },
  { label: "Hesed (H2617)", code: "H2617" },
  { label: "Ruach (H7307)", code: "H7307" },
]

export function ConcordanceSearchPanel({ embedded = false }: { embedded?: boolean }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ConcordanceEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [langFilter, setLangFilter] = useState<"all" | "greek" | "hebrew">("all")
  const [, startTransition] = useTransition()

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      // Default to common terms when query is blank
      void detectionActions.searchConcordance("kairos", 20).then((res) => {
        setResults(res)
      })
      return
    }

    const timer = setTimeout(() => {
      setIsLoading(true)
      startTransition(async () => {
        try {
          const entries = await detectionActions.searchConcordance(trimmed, 30)
          setResults(entries)
        } catch (e) {
          console.error("Concordance search error:", e)
        } finally {
          setIsLoading(false)
        }
      })
    }, 150)

    return () => clearTimeout(timer)
  }, [query])

  const filteredResults = results.filter((entry) => {
    if (langFilter === "all") return true
    return entry.language === langFilter
  })

  const handleQueue = (entry: ConcordanceEntry) => {
    useQueueStore.getState().addItem({
      id: crypto.randomUUID(),
      type: "concordance",
      entry,
      reference: `${entry.lemma} • ${entry.translit} (${entry.strongs_number})`,
      added_at: Date.now(),
      source: "manual",
    })
  }

  return (
    <div
      data-slot="concordance-search-panel"
      className={cn(
        "flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden",
        !embedded && "rounded-lg border border-border bg-card"
      )}
    >
      {/* Search Header */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-card p-2.5">
        <div className="relative flex items-center">
          <SearchIcon className="absolute left-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Greek & Hebrew words, Strong's #, English meanings..."
            className="h-8 pl-8 pr-7 text-xs"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>

        {/* Quick Filter Tabs & Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5 text-[0.625rem]">
            <button
              onClick={() => setLangFilter("all")}
              className={cn(
                "rounded px-2 py-0.5 font-medium transition-colors",
                langFilter === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
              )}
            >
              All
            </button>
            <button
              onClick={() => setLangFilter("greek")}
              className={cn(
                "rounded px-2 py-0.5 font-medium transition-colors",
                langFilter === "greek" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
              )}
            >
              Greek
            </button>
            <button
              onClick={() => setLangFilter("hebrew")}
              className={cn(
                "rounded px-2 py-0.5 font-medium transition-colors",
                langFilter === "hebrew" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
              )}
            >
              Hebrew
            </button>
          </div>

          <div className="flex flex-1 items-center gap-1 overflow-x-auto py-0.5">
            {POPULAR_TERMS.slice(0, 5).map((term) => (
              <button
                key={term.code}
                onClick={() => setQuery(term.code)}
                className="shrink-0 rounded-full border border-border/80 bg-muted/30 px-2 py-0.5 text-[0.625rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {term.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-border">
        {filteredResults.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            {isLoading ? "Searching Strong's lexicon..." : "No concordance entries found"}
          </div>
        ) : (
          filteredResults.map((entry) => {
            const pronStr = entry.pronunciation ? ` /${entry.pronunciation}/` : ""
            return (
              <div
                key={entry.strongs_number}
                className="group flex flex-col gap-1.5 p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-1 py-0 text-[0.625rem] font-bold uppercase",
                          entry.language === "greek"
                            ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {entry.strongs_number}
                      </Badge>
                      <span className="font-semibold text-sm text-foreground">
                        {entry.lemma} • {entry.translit}
                      </span>
                      {pronStr && (
                        <span className="text-xs text-muted-foreground">
                          {pronStr}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="xs"
                      className="gap-1 bg-amber-600 hover:bg-amber-700 text-white font-medium"
                      onClick={() => presentConcordance(entry)}
                      title="Present directly on Live broadcast"
                    >
                      <PlayIcon className="size-2.5" />
                      Present
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      onClick={() => previewConcordance(entry)}
                      title="Preview on Program canvas"
                    >
                      <EyeIcon className="size-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      onClick={() => handleQueue(entry)}
                      title="Add to Schedule setlist"
                    >
                      <PlusIcon className="size-3" />
                    </Button>
                  </div>
                </div>

                <p className="line-clamp-2 text-xs leading-relaxed text-foreground/90">
                  {entry.strongs_def}
                </p>

                {entry.kjv_def && (
                  <p className="line-clamp-1 text-[0.6875rem] text-muted-foreground italic">
                    <span className="font-medium text-foreground/70 not-italic">KJV:</span> {entry.kjv_def}
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
