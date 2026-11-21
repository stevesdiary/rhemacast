import { useState, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlusIcon, Trash2Icon, SparklesIcon, MusicIcon } from "lucide-react"
import { toast } from "sonner"
import { createSong } from "@/stores/songs-store"
import type { SongWithSections, SectionType } from "@/types"

interface EditableSection {
  id: string
  section_type: SectionType
  section_number: number
  lyrics: string
}

const SECTION_TYPES: Array<{ value: SectionType; label: string }> = [
  { value: "verse" as SectionType, label: "Verse" },
  { value: "chorus" as SectionType, label: "Chorus" },
  { value: "bridge" as SectionType, label: "Bridge" },
  { value: "pre_chorus" as SectionType, label: "Pre-Chorus" },
  { value: "tag" as SectionType, label: "Tag" },
  { value: "intro" as SectionType, label: "Intro" },
  { value: "outro" as SectionType, label: "Outro" },
]

function parsePastedLyrics(text: string): EditableSection[] {
  const blocks = text
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean)

  if (blocks.length === 0) return []

  let verseCount = 0
  let chorusCount = 0
  let bridgeCount = 0

  return blocks.map((block) => {
    const lines = block.split("\n")
    const firstLine = lines[0].trim()
    const headerMatch = firstLine.match(
      /^\s*\[?(verse|chorus|bridge|pre-?chorus|tag|intro|outro)\s*(\d+)?\]?:?\s*$/i
    )

    let type: SectionType = "verse" as SectionType
    let num = 1
    let lyrics = block

    if (headerMatch) {
      const rawType = headerMatch[1].toLowerCase().replace("-", "_")
      if (rawType.includes("chorus") && rawType.includes("pre")) {
        type = "pre_chorus" as SectionType
      } else if (rawType.includes("chorus")) {
        type = "chorus" as SectionType
      } else if (rawType.includes("bridge")) {
        type = "bridge" as SectionType
      } else if (rawType.includes("tag")) {
        type = "tag" as SectionType
      } else if (rawType.includes("intro")) {
        type = "intro" as SectionType
      } else if (rawType.includes("outro")) {
        type = "outro" as SectionType
      } else {
        type = "verse" as SectionType
      }

      num = headerMatch[2] ? parseInt(headerMatch[2], 10) : 1
      lyrics = lines.slice(1).join("\n").trim()
    } else {
      verseCount++
      num = verseCount
    }

    if (!headerMatch) {
      if (type === "chorus") {
        chorusCount++
        num = chorusCount
      } else if (type === "bridge") {
        bridgeCount++
        num = bridgeCount
      }
    }

    return {
      id: crypto.randomUUID(),
      section_type: type,
      section_number: num,
      lyrics,
    }
  })
}

interface CreateSongDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (song: SongWithSections) => void
}

export function CreateSongDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateSongDialogProps) {
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [composer, setComposer] = useState("")
  const [ccliNumber, setCcliNumber] = useState("")
  const [themesText, setThemesText] = useState("")

  const [activeTab, setActiveTab] = useState<"sections" | "paste">("sections")
  const [pastedText, setPastedText] = useState("")

  const [sections, setSections] = useState<EditableSection[]>([
    {
      id: crypto.randomUUID(),
      section_type: "verse" as SectionType,
      section_number: 1,
      lyrics: "",
    },
  ])

  const [saving, setSaving] = useState(false)

  const resetForm = useCallback(() => {
    setTitle("")
    setAuthor("")
    setComposer("")
    setCcliNumber("")
    setThemesText("")
    setPastedText("")
    setActiveTab("sections")
    setSections([
      {
        id: crypto.randomUUID(),
        section_type: "verse" as SectionType,
        section_number: 1,
        lyrics: "",
      },
    ])
  }, [])

  const handleAddSection = () => {
    // Determine default section number based on existing sections of same type
    const lastSection = sections[sections.length - 1]
    const nextType: SectionType =
      lastSection?.section_type === ("verse" as SectionType)
        ? ("verse" as SectionType)
        : ("chorus" as SectionType)
    const countOfSameType = sections.filter(
      (s) => s.section_type === nextType
    ).length

    setSections((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        section_type: nextType,
        section_number: countOfSameType + 1,
        lyrics: "",
      },
    ])
  }

  const handleRemoveSection = (id: string) => {
    setSections((prev) => {
      if (prev.length <= 1) {
        toast.info("A song must have at least one section")
        return prev
      }
      return prev.filter((s) => s.id !== id)
    })
  }

  const handleApplyPasted = () => {
    if (!pastedText.trim()) {
      toast.error("Please enter or paste lyrics first")
      return
    }
    const parsed = parsePastedLyrics(pastedText)
    if (parsed.length === 0) {
      toast.error("Could not parse lyrics. Please check format.")
      return
    }
    setSections(parsed)
    setActiveTab("sections")
    toast.success(`Parsed ${parsed.length} sections from lyrics`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      toast.error("Song title is required")
      return
    }

    // Filter valid sections with lyrics
    const validSections = sections
      .map((sec, idx) => ({
        section_type: sec.section_type,
        section_number: sec.section_number,
        lyrics: sec.lyrics.trim(),
        order_index: idx + 1,
      }))
      .filter((sec) => sec.lyrics.length > 0)

    if (validSections.length === 0) {
      toast.error("Please add lyrics to at least one section")
      return
    }

    const themes = themesText
      .split(/[,;\n]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)

    setSaving(true)
    try {
      const created = await createSong(
        {
          title: trimmedTitle,
          author: author.trim() || null,
          composer: composer.trim() || null,
          copyright: null,
          ccli_number: ccliNumber.trim() || null,
          themes,
        },
        validSections
      )

      toast.success("Song added to library", {
        description: `${created.song.title} (${created.sections.length} sections)`,
      })

      resetForm()
      onOpenChange(false)
      onCreated?.(created)
    } catch (err) {
      console.error(err)
      toast.error("Failed to add song", {
        description: String(err),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MusicIcon className="size-5 text-lime-400" />
            Add Song to Library
          </DialogTitle>
          <DialogDescription>
            Enter song details and lyrics to add to your permanent presentation
            catalog.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Metadata Row 1 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Title <span className="text-red-400">*</span>
              </label>
              <Input
                placeholder="e.g. 10,000 Reasons"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                required
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Author / Artist
              </label>
              <Input
                placeholder="e.g. Matt Redman, Jonas Myrin"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Metadata Row 2 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Composer
              </label>
              <Input
                placeholder="Optional"
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                CCLI #
              </label>
              <Input
                placeholder="e.g. 6016351"
                value={ccliNumber}
                onChange={(e) => setCcliNumber(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Themes / Tags
              </label>
              <Input
                placeholder="praise, worship, grace"
                value={themesText}
                onChange={(e) => setThemesText(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Sections editor with Tabs */}
          <div className="space-y-2 border-t border-border/60 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Song Sections & Lyrics
              </span>
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as "sections" | "paste")}
              >
                <TabsList className="h-7 p-0.5">
                  <TabsTrigger value="sections" className="h-6 px-2.5 text-xs">
                    Sections Builder
                  </TabsTrigger>
                  <TabsTrigger
                    value="paste"
                    className="h-6 gap-1 px-2.5 text-xs"
                  >
                    <SparklesIcon className="size-3 text-lime-400" />
                    Paste Lyrics
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Smart Paste View */}
            {activeTab === "paste" && (
              <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
                <p className="text-[0.72rem] text-muted-foreground">
                  Paste the full song lyrics below. Use blank lines between
                  stanzas, or labels like{" "}
                  <code className="text-lime-400">[Verse 1]</code>,{" "}
                  <code className="text-lime-400">[Chorus]</code>,{" "}
                  <code className="text-lime-400">[Bridge]</code>.
                </p>
                <Textarea
                  placeholder={`[Verse 1]\nBless the Lord O my soul\nO my soul, worship His holy name\n\n[Chorus]\nSing like never before, O my soul\nI'll worship Your holy name`}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  rows={8}
                  className="font-mono text-xs"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyPasted}
                    className="gap-1.5 text-xs"
                  >
                    <SparklesIcon className="size-3.5" />
                    Convert to Sections
                  </Button>
                </div>
              </div>
            )}

            {/* Structured Sections Builder */}
            {activeTab === "sections" && (
              <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {sections.map((sec, idx) => (
                  <div
                    key={sec.id}
                    className="space-y-2 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[0.65rem] font-semibold text-muted-foreground uppercase">
                        #{idx + 1}
                      </span>
                      <div className="w-32">
                        <Select
                          value={sec.section_type}
                          onValueChange={(v) => {
                            setSections((prev) =>
                              prev.map((s) =>
                                s.id === sec.id
                                  ? { ...s, section_type: v as SectionType }
                                  : s
                              )
                            )
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SECTION_TYPES.map((t) => (
                              <SelectItem
                                key={t.value}
                                value={t.value}
                                className="text-xs"
                              >
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex w-20 items-center gap-1">
                        <span className="text-[0.65rem] text-muted-foreground">
                          No.
                        </span>
                        <Input
                          type="number"
                          min={1}
                          max={99}
                          value={sec.section_number}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1
                            setSections((prev) =>
                              prev.map((s) =>
                                s.id === sec.id
                                  ? { ...s, section_number: val }
                                  : s
                              )
                            )
                          }}
                          className="h-7 text-xs"
                        />
                      </div>

                      <div className="flex-1" />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleRemoveSection(sec.id)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Delete section"
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>

                    <Textarea
                      placeholder="Enter lyrics for this section..."
                      value={sec.lyrics}
                      onChange={(e) => {
                        const val = e.target.value
                        setSections((prev) =>
                          prev.map((s) =>
                            s.id === sec.id ? { ...s, lyrics: val } : s
                          )
                        )
                      }}
                      rows={3}
                      className="text-xs leading-relaxed"
                    />
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSection}
                  className="w-full gap-1 border-dashed text-xs"
                >
                  <PlusIcon className="size-3.5" />
                  Add Another Section
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving || !title.trim()}
              className="gap-1.5"
            >
              {saving ? "Saving..." : "Save to Library"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
