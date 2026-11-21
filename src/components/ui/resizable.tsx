import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type PanelProps,
  type SeparatorProps,
} from "react-resizable-panels"
import { GripVerticalIcon, GripHorizontalIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function ResizablePanelGroup({ className, ...props }: GroupProps) {
  return (
    <Group
      className={cn(
        "flex h-full w-full",
        props.orientation === "vertical" ? "flex-col" : "flex-row",
        className
      )}
      {...props}
    />
  )
}

export function ResizablePanel({ className, ...props }: PanelProps) {
  return (
    <Panel
      className={cn("min-h-0 min-w-0 overflow-hidden", className)}
      {...props}
    />
  )
}

export function ResizableHandle({
  withHandle,
  className,
  orientation,
  ...props
}: SeparatorProps & {
  withHandle?: boolean
  orientation?: "horizontal" | "vertical"
}) {
  const isHorizontal = orientation === "horizontal"

  return (
    <Separator
      className={cn(
        "group relative flex items-center justify-center transition-colors select-none",
        isHorizontal
          ? "h-2 w-full cursor-row-resize py-0.5"
          : orientation === "vertical"
            ? "h-full w-2 cursor-col-resize px-0.5"
            : "aria-[orientation=horizontal]:h-2 aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:cursor-row-resize aria-[orientation=vertical]:h-full aria-[orientation=vertical]:w-2 aria-[orientation=vertical]:cursor-col-resize",
        "hover:bg-lime-500/30 active:bg-lime-500/60",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div
          className={cn(
            "z-10 flex items-center justify-center rounded-xs border border-border bg-background shadow-xs transition-colors group-hover:border-lime-500/50",
            isHorizontal ? "h-2.5 w-6" : "h-6 w-2.5"
          )}
        >
          {isHorizontal ? (
            <GripHorizontalIcon className="size-3 text-muted-foreground group-hover:text-foreground" />
          ) : (
            <GripVerticalIcon className="size-3 text-muted-foreground group-hover:text-foreground" />
          )}
        </div>
      )}
    </Separator>
  )
}
