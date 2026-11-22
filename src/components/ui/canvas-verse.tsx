import { useRef, useEffect, useState, useCallback, memo } from "react"
import { onThemeFontsLoaded, renderVerse } from "@/lib/verse-renderer"
import { preloadThemeImages, themeImageCache } from "@/lib/theme-image-cache"
import type { BroadcastTheme, VerseRenderData } from "@/types"
import { cn } from "@/lib/utils"

interface CanvasVerseProps {
  theme: BroadcastTheme
  verse: VerseRenderData | null
  className?: string
}

export const CanvasVerse = memo(function CanvasVerse({
  theme,
  verse,
  className,
}: CanvasVerseProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [containerSize, setContainerSize] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })

  // Measure container dimensions with ResizeObserver
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const w = Math.floor(rect.width)
      const h = Math.floor(rect.height)
      if (w > 0) {
        setContainerSize((prev) =>
          prev.width === w && prev.height === h ? prev : { width: w, height: h }
        )
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || containerSize.width === 0) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const aspectRatio = theme.resolution.width / theme.resolution.height

    // Calculate maximum dimensions that fit inside the container while preserving aspect ratio
    let displayW = containerSize.width
    let displayH = displayW / aspectRatio

    if (containerSize.height > 0 && displayH > containerSize.height) {
      displayH = containerSize.height
      displayW = displayH * aspectRatio
    }

    displayW = Math.max(1, Math.floor(displayW))
    displayH = Math.max(1, Math.floor(displayH))

    canvas.width = Math.round(displayW * dpr)
    canvas.height = Math.round(displayH * dpr)
    canvas.style.width = `${displayW}px`
    canvas.style.height = `${displayH}px`

    ctx.scale(dpr, dpr)
    const scale = displayW / theme.resolution.width
    renderVerse(ctx, theme, verse, {
      scale,
      imageCache: themeImageCache(),
    })
  }, [theme, verse, containerSize])

  // Preload every image the theme uses so the renderer finds them in the cache.
  useEffect(() => {
    preloadThemeImages(theme, draw)
  }, [theme, draw])

  // Redraw whenever theme, verse, or container size changes.
  useEffect(() => {
    draw()
  }, [draw])

  // Redraw once theme webfonts load so early frames drawn against fallback
  // font metrics are corrected.
  useEffect(() => onThemeFontsLoaded(() => draw()), [draw])

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden",
        className
      )}
    >
      <canvas ref={canvasRef} className="rounded-md shadow-xs block" />
    </div>
  )
})
