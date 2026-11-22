import { useState } from "react"
import { BookOpenIcon, MusicIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { SearchPanel } from "./search-panel"
import { SongsSearchPanel } from "./songs-search-panel"
import { useSongsStore } from "@/stores/songs-store"

export type BibleSongsTab = "bible" | "songs"

export function BibleSongsPanel() {
  const [activeTab, setActiveTab] = useState<BibleSongsTab>("bible")
  const songCount = useSongsStore((s) => s.songs.length)

  return (
    <div
      data-slot="bible-songs-panel"
      className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      {/* Top Tab Switcher */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/20 px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("bible")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors",
              activeTab === "bible"
                ? "bg-background text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            title="Browse and search Bible scriptures"
          >
            <BookOpenIcon className={cn("size-3.5", activeTab === "bible" ? "text-primary" : "text-muted-foreground")} />
            <span>Bible</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("songs")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors",
              activeTab === "songs"
                ? "bg-background text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            title="Browse and search worship songs"
          >
            <MusicIcon className={cn("size-3.5", activeTab === "songs" ? "text-lime-400" : "text-muted-foreground")} />
            <span>Songs</span>
            {songCount > 0 && (
              <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.2 text-[0.65rem] font-medium text-muted-foreground">
                {songCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Contents: Both kept mounted with CSS display toggling to preserve search state and scroll */}
      <div className={cn("min-h-0 flex-1 flex-col", activeTab === "bible" ? "flex" : "hidden")}>
        <SearchPanel embedded />
      </div>
      <div className={cn("min-h-0 flex-1 flex-col", activeTab === "songs" ? "flex" : "hidden")}>
        <SongsSearchPanel embedded />
      </div>
    </div>
  )
}
