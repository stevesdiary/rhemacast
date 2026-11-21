import { useState, useEffect, useCallback } from "react"
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PlusIcon, Trash2Icon, SparklesIcon, MusicIcon } from "lucide-react"
import { toast } from "sonner"
import { updateSong } from "@/stores/songs-store"
import { useQueueStore } from "@/stores"
import type { SongWithSections, SongSection, SectionType } from "@/types"

interface EditableSection {
  id: string
  dbId?: number
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

function sectionsToRawText(sections: EditableSection[]): string {
  return sections
    .map((sec) => `[${sec.section_type} ${sec.section_number}]\n${sec.lyrics}`)
    .join("\n\n")
}

interface EditSongDialogProps {
  song: SongWithSections | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (updated: SongWithSections) => void
}

export function EditSongDialog({
  song,
  open,
  onOpenChange,
  onSaved,
}: EditSongDialogProps) {
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [composer, setComposer] = useState("")
  const [copyright, setCopyright] = useState("")
  const [ccli, setCcli] = useState("")
  const [themesStr, setThemesStr] = useState("")

  const [activeTab, setActiveTab] = useState<"builder" | "paste">("builder")
  const [sections, setSections] = useState<EditableSection[]>([])
  const [rawPasteText, setRawPasteText] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Reset/populate form whenever the dialog opens with a new song
  useEffect(() => {
    if (!song) return
    setTitle(song.song.title)
    setAuthor(song.song.author ?? "")
    setComposer(song.song.composer ?? "")
    setCopyright(song.song.copyright ?? "")
    setCcli(song.song.ccli_number ?? "")
    setThemesStr(song.song.themes ? song.song.themes.join(", ") : "")

    const initialSections: EditableSection[] = song.sections.map((s) => ({
      id: crypto.randomUUID(),
      dbId: s.id,
      section_type: s.section_type as SectionType,
      section_number: s.section_number,
      lyrics: s.lyrics,
    }))
    setSections(initialSections)
    setRawPasteText(sectionsToRawText(initialSections))
  }, [song, open])

  const handleAddSection = () => {
    const nextNumber =
      sections.filter((s) => s.section_type === "verse").length + 1
    setSections((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        section_type: "verse" as SectionType,
        section_number: nextNumber,
        lyrics: "",
      },
    ])
  }

  const handleRemoveSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id))
  }

  const handleUpdateSection = (
    id: string,
    updates: Partial<Omit<EditableSection, "id">>
  ) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    )
  }

  const handleSmartPasteParse = useCallback(() => {
    if (!rawPasteText.trim()) return
    const parsed = parsePastedLyrics(rawPasteText)
    if (parsed.length > 0) {
      setSections(parsed)
      setActiveTab("builder")
      toast.success(
        `Parsed ${parsed.length} sections (${parsed.map((p) => p.section_type).join(", ")})`
      )
    } else {
      toast.error("No sections could be parsed from the pasted lyrics")
    }
  }, [rawPasteText])

  const handleSave = async () => {
    if (!song) return
    if (!title.trim()) {
      toast.error("Song title is required")
      return
    }

    let finalSections = sections
    if (activeTab === "paste" && rawPasteText.trim()) {
      const parsed = parsePastedLyrics(rawPasteText)
      if (parsed.length > 0) {
        finalSections = parsed
      }
    }

    const validSections = finalSections.filter(
      (s) => s.lyrics.trim().length > 0
    )
    if (validSections.length === 0) {
      toast.error("Please add at least one section with lyrics")
      return
    }

    setIsSaving(true)
    try {
      const themes = themesStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)

      const payloadSections: SongSection[] = validSections.map((s, idx) => ({
        id: s.dbId ?? 0,
        song_id: song.song.id,
        section_type: s.section_type,
        section_number: s.section_number,
        lyrics: s.lyrics.trim(),
        order_index: idx + 1,
      }))

      const updated = await updateSong(
        {
          id: song.song.id,
          title: title.trim(),
          author: author.trim() || null,
          composer: composer.trim() || null,
          copyright: copyright.trim() || null,
          ccli_number: ccli.trim() || null,
          themes,
        },
        payloadSections
      )

      // Sync with schedule queue so any active service item updates immediately
      useQueueStore.getState().updateSongInQueue(updated)

      toast.success("Song Updated", {
        description: `"${updated.song.title}" saved to library & schedule.`,
      })

      onSaved?.(updated)
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error("Failed to update song", {
        description: String(err),
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <MusicIcon className="size-5" />
            <DialogTitle>Edit Song</DialogTitle>
          </div>
          <DialogDescription>
            Update song lyrics, stanzas, or metadata. Changes synchronize
            instantly to your library and active service schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-foreground">
                Song Title <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Amazing Grace"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Author / Lyricist
              </label>
              <Input
                placeholder="e.g. John Newton"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Composer
              </label>
              <Input
                placeholder="e.g. Traditional"
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                CCLI Number
              </label>
              <Input
                placeholder="e.g. 22025"
                value={ccli}
                onChange={(e) => setCcli(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Themes (comma separated)
              </label>
              <Input
                placeholder="e.g. Grace, Salvation, Faith"
                value={themesStr}
                onChange={(e) => setThemesStr(e.target.value)}
              />
            </div>
          </div>

          {/* Lyrics Editor Tabs */}
          <div className="flex flex-col gap-2 pt-2">
            <label className="text-xs font-semibold text-foreground">
              Lyrics & Stanzas <span className="text-red-500">*</span>
            </label>

            <Tabs
              value={activeTab}
              onValueChange={(v) => {
                const nextTab = v as "builder" | "paste"
                if (nextTab === "paste" && activeTab === "builder") {
                  setRawPasteText(sectionsToRawText(sections))
                }
                setActiveTab(nextTab)
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="builder">Section Builder</TabsTrigger>
                <TabsTrigger value="paste" className="gap-1.5">
                  <SparklesIcon className="size-3.5 text-amber-400" />
                  Smart Lyric Paste
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Structured Section Builder */}
              <TabsContent value="builder" className="mt-3 flex flex-col gap-3">
                <div className="flex flex-col gap-3">
                  {sections.map((section, idx) => (
                    <div
                      key={section.id}
                      className="flex flex-col gap-2 rounded-lg border border-border bg-card/60 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            #{idx + 1}
                          </span>
                          <Select
                            value={section.section_type}
                            onValueChange={(v) =>
                              handleUpdateSection(section.id, {
                                section_type: v as SectionType,
                              })
                            }
                          >
                            <SelectTrigger className="h-7 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SECTION_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min={1}
                            max={20}
                            value={section.section_number}
                            onChange={(e) =>
                              handleUpdateSection(section.id, {
                                section_number:
                                  parseInt(e.target.value, 10) || 1,
                              })
                            }
                            className="h-7 w-16 text-center text-xs"
                            title="Section number (e.g. 1 for Verse 1)"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleRemoveSection(section.id)}
                          disabled={sections.length <= 1}
                          className="text-muted-foreground hover:text-destructive"
                          title="Delete section"
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </div>

                      <Textarea
                        placeholder={`Enter lyrics for ${section.section_type} ${section.section_number}...`}
                        value={section.lyrics}
                        onChange={(e) =>
                          handleUpdateSection(section.id, {
                            lyrics: e.target.value,
                          })
                        }
                        rows={3}
                        className="font-sans text-xs leading-relaxed"
                      />
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSection}
                  className="gap-1.5 self-start text-xs"
                >
                  <PlusIcon className="size-3.5" />
                  Add Section
                </Button>
              </TabsContent>

              {/* Tab 2: Smart Lyric Paste */}
              <TabsContent value="paste" className="mt-3 flex flex-col gap-2.5">
                <p className="text-[0.65rem] leading-relaxed text-muted-foreground">
                  Paste lyrics below. Blank lines or headers like{" "}
                  <code className="text-foreground">[Verse 1]</code> or{" "}
                  <code className="text-foreground">[Chorus]</code> will be
                  automatically structured.
                </p>
                <Textarea
                  placeholder={`[Verse 1]\nAmazing grace! How sweet the sound\nThat saved a wretch like me!\n\n[Chorus]\nAmazing grace, how sweet the sound...`}
                  value={rawPasteText}
                  onChange={(e) => setRawPasteText(e.target.value)}
                  rows={8}
                  className="font-mono text-xs leading-relaxed"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSmartPasteParse}
                  className="gap-1.5 self-start text-xs"
                >
                  <SparklesIcon className="size-3.5" />
                  Parse into Structured Stanzas
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-1.5">
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
