import { useState, useCallback, useRef, useEffect } from "react"
import {
  MusicIcon,
  SearchIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  XIcon,
  PencilIcon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useQueueStore } from "@/stores"
import { useSongsStore, loadSongs, searchSongs } from "@/stores/songs-store"
import { fetchSong } from "@/hooks/use-songs"
import { previewSongSlide, presentSongSlide } from "@/hooks/use-broadcast"
import { CreateSongDialog } from "@/components/songs/create-song-dialog"
import { EditSongDialog } from "@/components/songs/edit-song-dialog"
import type {
  Song,
  SearchSongRow,
  SongWithSections,
  SongSection,
} from "@/types"

function sectionLabel(type: string, num: number): string {
  const t = type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ")
  return `${t} ${num}`
}

function HighlightedText({
  text,
  query,
  markClassName,
}: {
  text: string
  query: string
  markClassName?: string
}) {
  if (!query || query.trim().length < 2) {
    return <>{text}</>
  }

  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))

  if (tokens.length === 0) {
    return <>{text}</>
  }

  const regex = new RegExp(`(${tokens.join("|")})`, "gi")
  const parts = text.split(regex)
  const tokenSet = new Set(tokens.map((t) => t.toLowerCase()))

  return (
    <>
      {parts.map((part, i) => {
        if (tokenSet.has(part.toLowerCase())) {
          return (
            <mark
              key={i}
              className={cn(
                "rounded-[2px] bg-lime-500/25 px-0.5 font-semibold text-foreground",
                markClassName
              )}
            >
              {part}
            </mark>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function SongSectionRow({
  section,
  fullSong,
  onQueue,
}: {
  section: SongSection
  fullSong: SongWithSections
  onQueue: (section: SongSection) => void
}) {
  const label = sectionLabel(
    section.section_type as string,
    section.section_number
  )

  return (
    <div
      className="group flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40"
      onClick={() => {
        previewSongSlide(fullSong.song.title, label, section.lyrics)
      }}
      onDoubleClick={() => {
        presentSongSlide(fullSong.song.title, label, section.lyrics)
      }}
      title="Click to preview slide • Double-click to present live"
    >
      <span className="mt-0.5 min-w-[72px] text-[0.6rem] font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground group-hover:text-foreground">
        {section.lyrics}
      </p>
      <Button
        variant="ghost"
        size="icon-xs"
        className="shrink-0 bg-primary/40! text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-primary!"
        title="Add section to Schedule"
        onClick={(e) => {
          e.stopPropagation()
          onQueue(section)
        }}
      >
        <PlusIcon className="size-3" />
      </Button>
    </div>
  )
}

function SongRow({
  song,
  query,
  matchedSection,
  onEditSong,
}: {
  song: Song
  query: string
  matchedSection?: { type: string; num: number; lyrics: string }
  onEditSong: (song: SongWithSections) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [fullSong, setFullSong] = useState<SongWithSections | null>(null)
  const [loading, setLoading] = useState(false)

  const handleExpand = useCallback(async () => {
    if (!expanded && !fullSong) {
      setLoading(true)
      const data = await fetchSong(song.id).catch(() => null)
      setFullSong(data)
      setLoading(false)
    }
    setExpanded((v) => !v)
  }, [expanded, fullSong, song.id])

  const handleQueueSection = useCallback(
    (section: SongSection) => {
      if (!fullSong) return
      const ref = `${song.title} — ${sectionLabel(section.section_type as string, section.section_number)}`
      useQueueStore.getState().addItem({
        id: crypto.randomUUID(),
        type: "song",
        song: fullSong,
        section,
        reference: ref,
        added_at: Date.now(),
        source: "manual",
      })
      toast.success("Added to Schedule", {
        description: ref,
      })
    },
    [fullSong, song.title]
  )

  const handleQueueAll = useCallback(async () => {
    let data = fullSong
    if (!data) {
      data = await fetchSong(song.id).catch(() => null)
      if (data) setFullSong(data)
    }
    if (!data) return
    useQueueStore.getState().addItem({
      id: crypto.randomUUID(),
      type: "song",
      song: data,
      section: null,
      reference: song.title,
      added_at: Date.now(),
      source: "manual",
    })
    toast.success("Added to Schedule", {
      description: `${song.title} (${data.sections.length} sections)`,
    })
  }, [fullSong, song.id, song.title])

  const handleEditClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      let data = fullSong
      if (!data) {
        data = await fetchSong(song.id).catch(() => null)
        if (data) setFullSong(data)
      }
      if (data) onEditSong(data)
    },
    [fullSong, onEditSong, song.id]
  )

  return (
    <div className="rounded-lg border border-transparent transition-colors hover:border-border">
      <div
        className="group flex cursor-pointer items-center gap-2 px-3 py-2"
        onClick={handleExpand}
      >
        {expanded ? (
          <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground" />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-foreground">
            <HighlightedText
              text={song.title}
              query={query}
              markClassName="bg-lime-500/30 text-foreground"
            />
          </span>
          {song.author && (
            <span className="truncate text-[0.6rem] text-muted-foreground">
              {song.author}
            </span>
          )}
          {matchedSection && !expanded && (
            <p className="mt-0.5 line-clamp-2 text-[0.68rem] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-lime-400">
                {sectionLabel(matchedSection.type, matchedSection.num)}:
              </span>{" "}
              <HighlightedText
                text={matchedSection.lyrics}
                query={query}
                markClassName="bg-emerald-800/90 text-foreground"
              />
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
            title="Edit song lyrics & details"
            onClick={handleEditClick}
          >
            <PencilIcon className="size-3 text-lime-400" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0 bg-primary/40! text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-primary!"
            title="Add song to Schedule"
            onClick={(e) => {
              e.stopPropagation()
              void handleQueueAll()
            }}
          >
            <PlusIcon className="size-3" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/50 pb-1">
          {loading && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Loading sections...
            </p>
          )}
          {fullSong &&
            fullSong.sections.map((section) => (
              <SongSectionRow
                key={section.id}
                section={section}
                fullSong={fullSong}
                onQueue={handleQueueSection}
              />
            ))}
        </div>
      )}
    </div>
  )
}

export function SongsSearchPanel() {
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchSongRow[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingSong, setEditingSong] = useState<SongWithSections | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const songs = useSongsStore((s) => s.songs)

  // Load all songs on mount for the default catalog list
  useEffect(() => {
    loadSongs().catch(console.error)
  }, [])

  const handleSearch = useCallback((q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = q.trim()
    if (trimmed.length === 0) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    debounceRef.current = setTimeout(() => {
      searchSongs(trimmed, 30)
        .then((res) => {
          setSearchResults(res)
          setIsSearching(false)
        })
        .catch((err) => {
          console.error(err)
          setIsSearching(false)
        })
    }, 200)
  }, [])

  const handleClear = useCallback(() => {
    handleSearch("")
  }, [handleSearch])

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    []
  )

  const isQueryActive = query.trim().length > 0

  return (
    <div
      data-slot="songs-search-panel"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      {/* Header with single unified search input */}
      <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
        <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-foreground">
          <MusicIcon className="size-4 text-lime-400" />
          <span>Songs</span>
        </div>

        <div className="relative flex flex-1 items-center">
          <SearchIcon className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search songs by title or lyrics..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-7 flex-1 pr-7 pl-8 text-xs"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 rounded-xs p-0.5 text-muted-foreground hover:text-foreground"
              title="Clear search"
            >
              <XIcon className="size-3" />
            </button>
          )}
        </div>

        <Button
          size="xs"
          variant="outline"
          onClick={() => setCreateOpen(true)}
          className="h-7 shrink-0 gap-1 border-border px-2 text-xs font-medium hover:bg-muted"
          title="Add a new song to library"
        >
          <PlusIcon className="size-3 text-lime-400" />
          <span>Add Song</span>
        </Button>
      </div>

      {/* Results / Song Catalog */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0 p-2">
          {!isQueryActive && (
            <>
              {songs.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  No songs in library yet
                </p>
              ) : (
                songs.map((song) => (
                  <SongRow
                    key={song.id}
                    song={song}
                    query=""
                    onEditSong={setEditingSong}
                  />
                ))
              )}
            </>
          )}

          {isQueryActive && (
            <>
              {isSearching ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  Searching songs...
                </p>
              ) : searchResults.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  No songs found matching &ldquo;{query.trim()}&rdquo;
                </p>
              ) : (
                searchResults.map((row) => (
                  <SongRow
                    key={row.song_id}
                    song={{
                      id: row.song_id,
                      title: row.title,
                      author: row.author,
                      composer: null,
                      copyright: null,
                      ccli_number: null,
                      themes: [],
                    }}
                    query={query.trim()}
                    onEditSong={setEditingSong}
                    matchedSection={
                      row.lyrics && row.lyrics.trim().length > 0
                        ? {
                            type: row.section_type,
                            num: row.section_number,
                            lyrics: row.lyrics,
                          }
                        : undefined
                    }
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>

      <CreateSongDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditSongDialog
        song={editingSong}
        open={editingSong !== null}
        onOpenChange={(open) => !open && setEditingSong(null)}
        onSaved={() => {
          loadSongs().catch(console.error)
          if (query.trim().length > 0) {
            handleSearch(query)
          }
        }}
      />
    </div>
  )
}
