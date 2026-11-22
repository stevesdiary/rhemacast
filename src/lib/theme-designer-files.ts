import { open, save } from "@tauri-apps/plugin-dialog"
import { readFile, writeTextFile } from "@tauri-apps/plugin-fs"
import type { BroadcastTheme } from "@/types"
import { normalizeTheme } from "@/lib/theme-migrations"

/**
 * Opens a native file dialog to pick a PNG or JPEG image, reads it,
 * and returns a base64 data URL that persists across restarts.
 */
export async function pickThemeBackgroundImage(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: "Images (PNG, JPEG)",
        extensions: ["png", "jpg", "jpeg"],
      },
      {
        name: "PNG Image (*.png)",
        extensions: ["png"],
      },
      {
        name: "JPEG Image (*.jpg, *.jpeg)",
        extensions: ["jpg", "jpeg"],
      },
    ],
  })
  if (!selected) return null

  const path = typeof selected === "string" ? selected : selected
  const extension = path.split(".").pop()?.toLowerCase() ?? ""
  if (!["png", "jpg", "jpeg"].includes(extension)) {
    return null
  }

  const bytes = await readFile(path)
  const mime = extension === "png" ? "image/png" : "image/jpeg"

  let binary = ""
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunkSize) as unknown as number[]
    )
  }
  const base64 = btoa(binary)
  return `data:${mime};base64,${base64}`
}

/**
 * Exports a theme as JSON via native save dialog.
 */
export async function exportTheme(theme: BroadcastTheme): Promise<void> {
  const path = await save({
    defaultPath: `${theme.name.replace(/[^a-zA-Z0-9-_ ]/g, "")}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  })
  if (!path) return

  const json = JSON.stringify(theme, null, 2)
  await writeTextFile(path, json)
}

/**
 * Imports a theme from a JSON file via native open dialog.
 * Returns the parsed theme or null if cancelled/invalid.
 */
export async function importTheme(): Promise<BroadcastTheme | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "Theme JSON", extensions: ["json"] }],
  })
  if (!selected) return null

  const path = typeof selected === "string" ? selected : selected
  const bytes = await readFile(path)
  const text = new TextDecoder().decode(bytes)
  const parsed = JSON.parse(text) as BroadcastTheme

  if (!parsed.id || !parsed.name || !parsed.background || !parsed.layout) {
    throw new Error("Invalid theme file: missing required fields")
  }

  return normalizeTheme({
    ...parsed,
    id: crypto.randomUUID(),
    builtin: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
}
