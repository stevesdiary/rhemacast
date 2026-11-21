import type { QueueItem, Song, SongWithSections } from "@/types"
import { isSongQueueItem } from "@/types"

export interface RhemaScheduleFile {
  app: "rhema"
  version: 1
  type: "schedule"
  exportedAt: number
  title?: string
  songDisplayMode?: "line" | "stanza"
  items: QueueItem[]
}

function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(
      (window as unknown as { __TAURI_INTERNALS__?: unknown })
        .__TAURI_INTERNALS__
    )
  )
}

/**
 * Format a filename with date: e.g. "service-schedule-2026-11-21.rhema"
 */
export function defaultScheduleFilename(): string {
  const date = new Date().toISOString().slice(0, 10)
  return `service-schedule-${date}.rhema`
}

/**
 * Validates and normalizes raw JSON data into a valid RhemaScheduleFile
 */
export function parseScheduleJson(rawText: string): RhemaScheduleFile {
  const data = JSON.parse(rawText) as Record<string, unknown>

  if (!data || typeof data !== "object") {
    throw new Error("Invalid schedule file: must be a JSON object")
  }

  // Handle standard Rhema schedule format
  if (Array.isArray(data.items)) {
    return {
      app: "rhema",
      version: 1,
      type: "schedule",
      exportedAt:
        typeof data.exportedAt === "number" ? data.exportedAt : Date.now(),
      title: typeof data.title === "string" ? data.title : "Service Schedule",
      songDisplayMode: data.songDisplayMode === "stanza" ? "stanza" : "line",
      items: data.items as QueueItem[],
    }
  }

  // Handle bare array of items if exported from raw queue
  if (Array.isArray(data)) {
    return {
      app: "rhema",
      version: 1,
      type: "schedule",
      exportedAt: Date.now(),
      title: "Service Schedule",
      songDisplayMode: "line",
      items: data as QueueItem[],
    }
  }

  throw new Error("Invalid schedule file: missing schedule items array")
}

/**
 * Finds all songs in the imported schedule that are not present in the local library.
 * Compares by normalized title.
 */
export function findMissingSongsInLibrary(
  items: QueueItem[],
  existingSongs: Song[]
): SongWithSections[] {
  const existingTitles = new Set(
    existingSongs.map((s) => s.title.trim().toLowerCase())
  )

  const missingMap = new Map<string, SongWithSections>()

  for (const item of items) {
    if (isSongQueueItem(item) && item.song?.song?.title) {
      const normTitle = item.song.song.title.trim().toLowerCase()
      if (!existingTitles.has(normTitle) && !missingMap.has(normTitle)) {
        missingMap.set(normTitle, item.song)
      }
    }
  }

  return Array.from(missingMap.values())
}

/**
 * Export schedule items to a `.rhema` file.
 * Uses native Tauri save dialog when available; falls back to browser download.
 */
export async function exportScheduleToFile(
  items: QueueItem[],
  options?: { title?: string; songDisplayMode?: "line" | "stanza" }
): Promise<boolean> {
  const scheduleData: RhemaScheduleFile = {
    app: "rhema",
    version: 1,
    type: "schedule",
    exportedAt: Date.now(),
    title: options?.title ?? "Service Schedule",
    songDisplayMode: options?.songDisplayMode ?? "line",
    items,
  }

  const jsonString = JSON.stringify(scheduleData, null, 2)
  const filename = defaultScheduleFilename()

  if (isTauri()) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog")
      const { writeTextFile } = await import("@tauri-apps/plugin-fs")

      const path = await save({
        defaultPath: filename,
        filters: [
          { name: "Rhema Schedule (*.rhema)", extensions: ["rhema", "json"] },
        ],
      })

      if (!path) return false // user cancelled

      await writeTextFile(path, jsonString)
      return true
    } catch (err) {
      console.warn(
        "Tauri native save failed, falling back to web download:",
        err
      )
    }
  }

  // Web download fallback
  const blob = new Blob([jsonString], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}

/**
 * Import a schedule from a `.rhema` or `.json` file.
 * Uses native Tauri open dialog when available; falls back to browser file input.
 */
export async function importScheduleFromFile(): Promise<RhemaScheduleFile | null> {
  if (isTauri()) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog")
      const { readFile } = await import("@tauri-apps/plugin-fs")

      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Rhema Schedule (*.rhema, *.json)",
            extensions: ["rhema", "json"],
          },
        ],
      })

      if (!selected) return null

      const path = typeof selected === "string" ? selected : selected
      const bytes = await readFile(path)
      const text = new TextDecoder().decode(bytes)
      return parseScheduleJson(text)
    } catch (err) {
      console.warn("Tauri native open failed, falling back to web input:", err)
    }
  }

  // Web file input fallback
  return new Promise<RhemaScheduleFile | null>((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".rhema,.json"
    input.style.display = "none"

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }

      try {
        const text = await file.text()
        const parsed = parseScheduleJson(text)
        resolve(parsed)
      } catch (err) {
        console.error("Failed to parse schedule file:", err)
        throw err
      } finally {
        document.body.removeChild(input)
      }
    }

    input.oncancel = () => {
      document.body.removeChild(input)
      resolve(null)
    }

    document.body.appendChild(input)
    input.click()
  })
}
