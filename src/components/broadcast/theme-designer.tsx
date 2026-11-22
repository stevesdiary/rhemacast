import { useEffect } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { useBroadcastStore } from "@/stores"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  SaveIcon,
  TrashIcon,
  XIcon,
  CheckCircleIcon,
  PinIcon,
  PinOffIcon,
  Trash2Icon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeLibrary } from "@/components/broadcast/theme-library"
import { DesignCanvas } from "@/components/broadcast/design-canvas"
import { PropertiesPanel } from "@/components/broadcast/properties-panel"

export function ThemeDesigner() {
  const isDesignerOpen = useBroadcastStore((s) => s.isDesignerOpen)
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const themes = useBroadcastStore((s) => s.themes)
  const editingThemeId = useBroadcastStore((s) => s.editingThemeId)
  const activeThemeId = useBroadcastStore((s) => s.activeThemeId)

  const currentTheme = themes.find((t) => t.id === editingThemeId) ?? draftTheme
  const isActive = currentTheme ? currentTheme.id === activeThemeId : false
  const isPinned = currentTheme ? Boolean(currentTheme.pinned) : false
  const isBuiltin = currentTheme ? Boolean(currentTheme.builtin) : false

  // Auto-start editing the first theme when opened if nothing is being edited
  useEffect(() => {
    if (isDesignerOpen && !draftTheme && themes.length > 0) {
      useBroadcastStore.getState().startEditing(themes[0].id)
    }
  }, [isDesignerOpen, draftTheme, themes])

  const handleDiscard = () => {
    useBroadcastStore.getState().discardDraft()
  }

  const handleSave = () => {
    useBroadcastStore.getState().saveDraft()
  }

  const handleClose = () => {
    useBroadcastStore.getState().setDesignerOpen(false)
  }

  return (
    <DialogPrimitive.Root
      open={isDesignerOpen}
      onOpenChange={(open) =>
        useBroadcastStore.getState().setDesignerOpen(open)
      }
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />

        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background text-foreground outline-none"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            Theme Designer
          </DialogPrimitive.Title>

          {/* Top bar */}
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
            <span className="text-xl font-semibold text-foreground">
              Theme Designer
            </span>

            {currentTheme && (
              <div className="flex items-center gap-2 pl-2">
                <span className="text-sm font-medium text-muted-foreground">•</span>
                <span className="max-w-[200px] truncate text-sm font-semibold text-foreground">
                  {currentTheme.name}
                </span>
                {isBuiltin && (
                  <Badge variant="outline" className="text-[0.625rem]">
                    Built-in
                  </Badge>
                )}
              </div>
            )}

            <div className="flex-1" />

            {/* Quick Actions for Selected Theme */}
            {currentTheme && (
              <div className="flex items-center gap-2 pr-2 border-r border-border">
                {/* Set as Active Button */}
                {isActive ? (
                  <Badge className="gap-1 bg-emerald-600 px-2.5 py-1 text-xs text-white hover:bg-emerald-600">
                    <CheckCircleIcon className="size-3.5" />
                    Active Theme
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-medium"
                    onClick={() => {
                      useBroadcastStore.getState().setActiveTheme(currentTheme.id)
                    }}
                    title="Set this theme as active for live output"
                  >
                    <CheckCircleIcon className="size-3.5 text-emerald-500" />
                    Set as Active
                  </Button>
                )}

                {/* Pin / Unpin Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 text-xs font-medium",
                    isPinned && "border-primary/50 bg-primary/10 text-primary"
                  )}
                  onClick={() => {
                    useBroadcastStore.getState().togglePinTheme(currentTheme.id)
                  }}
                  title={isPinned ? "Unpin theme" : "Pin theme"}
                >
                  {isPinned ? (
                    <>
                      <PinOffIcon className="size-3.5 text-primary" />
                      Pinned
                    </>
                  ) : (
                    <>
                      <PinIcon className="size-3.5 text-muted-foreground" />
                      Pin
                    </>
                  )}
                </Button>

                {/* Delete Button (Custom Themes only) */}
                {!isBuiltin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete "${currentTheme.name}"?`)) {
                        useBroadcastStore.getState().deleteTheme(currentTheme.id)
                      }
                    }}
                    title="Delete this custom theme"
                  >
                    <Trash2Icon className="size-3.5" />
                    Delete
                  </Button>
                )}
              </div>
            )}

            <Button variant="outline" size="sm" onClick={handleDiscard}>
              <TrashIcon className="size-3.5" />
              Discard
            </Button>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/80"
              onClick={handleSave}
            >
              <SaveIcon className="size-3.5" />
              Save Theme
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <XIcon strokeWidth={2} className="size-4" />
              Close
            </Button>
          </div>

          {/* 3-panel layout */}
          <div
            className="min-h-0 flex-1"
            style={{
              display: "grid",
              gridTemplateColumns: "260px 1fr 320px",
            }}
          >
            {/* Left: Theme Library */}
            <ThemeLibrary />

            {/* Center: Design Canvas */}
            <DesignCanvas />

            {/* Right: Properties Panel */}
            <PropertiesPanel />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
