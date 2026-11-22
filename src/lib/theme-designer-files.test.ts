import { describe, it, expect, vi, beforeEach } from "vitest"
import { pickThemeBackgroundImage } from "./theme-designer-files"

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}))

vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(),
  writeTextFile: vi.fn(),
}))

import { open } from "@tauri-apps/plugin-dialog"
import { readFile } from "@tauri-apps/plugin-fs"

describe("theme-designer-files", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("pickThemeBackgroundImage", () => {
    it("configures open dialog with PNG and JPEG filters", async () => {
      vi.mocked(open).mockResolvedValue(null)

      const result = await pickThemeBackgroundImage()
      expect(result).toBeNull()

      expect(open).toHaveBeenCalledWith({
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
    })

    it("reads and converts a PNG file to base64 data URL", async () => {
      vi.mocked(open).mockResolvedValue("/path/to/background.png")
      const fakeBytes = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
      vi.mocked(readFile).mockResolvedValue(fakeBytes)

      const result = await pickThemeBackgroundImage()
      expect(result).toBe(`data:image/png;base64,${btoa("Hello")}`)
      expect(readFile).toHaveBeenCalledWith("/path/to/background.png")
    })

    it("reads and converts a JPEG file to base64 data URL", async () => {
      vi.mocked(open).mockResolvedValue("/path/to/wallpaper.jpeg")
      const fakeBytes = new Uint8Array([72, 101, 108, 108, 111])
      vi.mocked(readFile).mockResolvedValue(fakeBytes)

      const result = await pickThemeBackgroundImage()
      expect(result).toBe(`data:image/jpeg;base64,${btoa("Hello")}`)
    })

    it("reads and converts a JPG file to base64 data URL with image/jpeg mime", async () => {
      vi.mocked(open).mockResolvedValue("/path/to/wallpaper.jpg")
      const fakeBytes = new Uint8Array([72, 101, 108, 108, 111])
      vi.mocked(readFile).mockResolvedValue(fakeBytes)

      const result = await pickThemeBackgroundImage()
      expect(result).toBe(`data:image/jpeg;base64,${btoa("Hello")}`)
    })

    it("rejects non-PNG/JPEG file formats like gif or webp", async () => {
      vi.mocked(open).mockResolvedValue("/path/to/animation.gif")

      const result = await pickThemeBackgroundImage()
      expect(result).toBeNull()
      expect(readFile).not.toHaveBeenCalled()
    })
  })
})
