import { useState, useCallback, useRef, useEffect } from "react"
import { MusicIcon, SearchIcon, ChevronDownIcon, ChevronRightIcon, PlusIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useQueueStore } from "@/stores"
import { useSongsStore } from "@/stores/songs-store"
import { searchSongs, searchSongsByTitle, fetchSong } from "@/hooks/use-songs"
import { loadSongs } from "@/stores/songs-store"
import type { Song, SearchSongRow, SongWithSections, SongSection } from "@/types"

type SearchTab = "title" | "lyrics"

function sectionLabel(type: string, num: number): string {
  const t = type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ")
  return `${t} ${num}`
}

function LyricSnippet({ lyrics, query }: { lyrics: string; query: string }) {
  if (!query || query.length < 2) return <span className="line-clamp-2">{lyrics}</span>

  const words = new Set(query.toLowerCase().split(/\s+/).filter((w) => w.length >= 2))
  const parts = lyrics.split(/([\s]+)/)
  return (
    <span className="line-clamp-2">
      {parts.map((part, i) => {
        const clean = part.toLowerCase().replace(/[^a-z']/g, "")
        if (clean.length >= 2 && words.has(clean)) {
          return (
            <mark key={i} className="rounded-[2px] bg-emerald-800/90 px-0.5 text-foreground">
              {part}
            </mark>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

function SongSectionRow({
  section,
  onQueue,
}: {
  section: SongSection
  onQueue: (section: SongSection) => void
}) {
  return (
    <div className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40">
      <span className="mt-0.5 min-w-[72px] text-[0.6rem] font-medium uppercase tracking-wider text-muted-foreground">
        {sectionLabel(section.section_type as string, section.section_number)}
      </span>
      <p className="flex-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
        {section.lyrics}
      </p>
      <Button
        variant="ghost"
        size="icon-xs"
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity bg-primary/40! text-primary-foreground hover:bg-primary!"
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
}: {
  song: Song
  query: string
  matchedSection?: { type: string; num: number; lyrics: string }
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
      useQueueStore.getState().addItem({
        id: crypto.randomUUID(),
        type: "song",
        song: fullSong,
        section,
        reference: `${song.title} — ${sectionLabel(section.section_type as string, section.section_number)}`,
        added_at: Date.now(),
        source: "manual",
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
  }, [fullSong, song.id, song.title])

  return (
    <div className="rounded-lg border border-transparent hover:border-border transition-colors">
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
          <span className="truncate text-sm font-medium text-foreground">{song.title}</span>
          {song.author && (
            <span className="truncate text-[0.6rem] text-muted-foreground">{song.author}</span>
          )}
          {matchedSection && !expanded && (
            <p className="mt-0.5 text-[0.6rem] text-muted-foreground">
              <span className="font-medium text-lime-500/80">
                {sectionLabel(matchedSection.type, matchedSection.num)}:
              </span>{" "}
              <LyricSnippet lyrics={matchedSection.lyrics} query={query} />
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity bg-primary/40! text-primary-foreground hover:bg-primary!"
          onClick={(e) => {
            e.stopPropagation()
            void handleQueueAll()
          }}
        >
          <PlusIcon className="size-3" />
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-border/50 pb-1">
          {loading && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Loading sections...</p>
          )}
          {fullSong?.sections.map((section) => (
            <SongSectionRow
              key={section.id}
              section={section}
              onQueue={handleQueueSection}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function SongsSearchPanel() {
  const [activeTab, setActiveTab] = useState<SearchTab>("title")
  const [titleQuery, setTitleQuery] = useState("")
  const [lyricsQuery, setLyricsQuery] = useState("")
  const [titleResults, setTitleResults] = useState<Song[]>([])
  const [lyricsResults, setLyricsResults] = useState<SearchSongRow[]>([])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const songs = useSongsStore((s) => s.songs)

  // Load all songs on mount for the title tab default list
  useEffect(() => {
    loadSongs().catch(console.error)
  }, [])

  const handleTitleSearch = useCallback((q: string) => {
    setTitleQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length === 0) {
      setTitleResults([])
      return
    }
    debounceRef.current = setTimeout(() => {
      searchSongsByTitle(q, 30).then(setTitleResults).catch(console.error)
    }, 200)
  }, [])

  const handleLyricsSearch = useCallback((q: string) => {
    setLyricsQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 3) {
      setLyricsResults([])
      return
    }
    debounceRef.current = setTimeout(() => {
      searchSongs(q, 20).then(setLyricsResults).catch(console.error)
    }, 280)
  }, [])

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  // Deduplicate lyrics results by song_id, keeping first (best rank) match per song
  const dedupedLyrics = lyricsResults.reduce<SearchSongRow[]>((acc, row) => {
    if (!acc.find((r) => r.song_id === row.song_id)) acc.push(row)
    return acc
  }, [])

  const titleList = titleQuery.trim() ? titleResults : songs

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
      {/* Tab row + search input */}
      <div className="flex shrink-0 items-center gap-0 border-b border-border min-h-11">
        <div className="flex items-center gap-1 px-3 py-1.5">
          <button
            onClick={() => setActiveTab("title")}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              activeTab === "title"
                ? "border-lime-500/50 bg-lime-500/15"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <MusicIcon className={cn("size-3.5", activeTab === "title" ? "text-lime-400" : "text-muted-foreground")} />
            Songs
          </button>
          <button
            onClick={() => setActiveTab("lyrics")}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              activeTab === "lyrics"
                ? "border-lime-500/50 bg-lime-500/15"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            <SearchIcon className={cn("size-3.5", activeTab === "lyrics" ? "text-lime-400" : "text-muted-foreground")} />
            Lyrics
          </button>
        </div>

        <div className="flex flex-1 items-center pr-3">
          {activeTab === "title" ? (
            <Input
              placeholder="Search by title..."
              value={titleQuery}
              onChange={(e) => handleTitleSearch(e.target.value)}
              className="h-7 flex-1 text-xs"
            />
          ) : (
            <Input
              placeholder="Search by lyrics..."
              value={lyricsQuery}
              onChange={(e) => handleLyricsSearch(e.target.value)}
              className="h-7 flex-1 text-xs"
            />
          )}
        </div>
      </div>

      {/* Results */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0 p-2">
          {activeTab === "title" && (
            <>
              {titleList.length === 0 && (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  {titleQuery ? "No songs found" : "No songs in library yet"}
                </p>
              )}
              {titleList.map((song) => (
                <SongRow key={song.id} song={song} query={titleQuery} />
              ))}
            </>
          )}

          {activeTab === "lyrics" && (
            <>
              {lyricsQuery.length < 3 && (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  Type at least 3 characters to search lyrics...
                </p>
              )}
              {lyricsQuery.length >= 3 && dedupedLyrics.length === 0 && (
                <p className="p-4 text-center text-xs text-muted-foreground">No results found</p>
              )}
              {dedupedLyrics.map((row) => (
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
                  query={lyricsQuery}
                  matchedSection={{
                    type: row.section_type,
                    num: row.section_number,
                    lyrics: row.lyrics,
                  }}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
