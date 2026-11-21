import { TransportBar } from "@/components/controls/transport-bar"
import { TranscriptPanel } from "@/components/panels/transcript-panel"
import { PreviewPanel } from "@/components/panels/preview-panel"
import { LiveOutputPanel } from "@/components/panels/live-output-panel"
import { QueuePanel } from "@/components/panels/queue-panel"
import { SearchPanel } from "@/components/panels/search-panel"
import { SongsSearchPanel } from "@/components/panels/songs-search-panel"
import { DetectionsPanel } from "@/components/panels/detections-panel"
import { EmbeddingWarningBanner } from "@/components/ui/embedding-warning-banner"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"

export function Dashboard() {
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      {/* Row 1: Transport Bar */}
      <div className="shrink-0">
        <TransportBar />
      </div>

      {/* Row 2: Warning banner (collapses to 0 when healthy) */}
      <EmbeddingWarningBanner />

      {/* Main Resizable Workspace */}
      <div className="min-h-0 flex-1 p-2">
        <ResizablePanelGroup orientation="vertical" className="h-full w-full">
          {/* Upper Section: 4 Panels */}
          <ResizablePanel
            defaultSize="45%"
            minSize="20%"
            className="flex min-h-0 flex-col"
          >
            <ResizablePanelGroup
              orientation="horizontal"
              className="h-full w-full"
            >
              <ResizablePanel
                defaultSize="22%"
                minSize="14%"
                className="flex min-h-0 flex-col p-1"
              >
                <TranscriptPanel />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                defaultSize="28%"
                minSize="18%"
                className="flex min-h-0 flex-col p-1"
              >
                <PreviewPanel />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                defaultSize="28%"
                minSize="18%"
                className="flex min-h-0 flex-col p-1"
              >
                <LiveOutputPanel />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                defaultSize="22%"
                minSize="14%"
                className="flex min-h-0 flex-col p-1"
              >
                <QueuePanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle orientation="horizontal" />

          {/* Lower Section: 3 Panels */}
          <ResizablePanel
            defaultSize="55%"
            minSize="20%"
            className="flex min-h-0 flex-col"
          >
            <ResizablePanelGroup
              orientation="horizontal"
              className="h-full w-full"
            >
              <ResizablePanel
                defaultSize="38%"
                minSize="20%"
                className="flex min-h-0 flex-col p-1"
              >
                <SearchPanel />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                defaultSize="38%"
                minSize="20%"
                className="flex min-h-0 flex-col p-1"
              >
                <SongsSearchPanel />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                defaultSize="24%"
                minSize="14%"
                className="flex min-h-0 flex-col p-1"
              >
                <DetectionsPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
