import { invoke } from "@tauri-apps/api/core"
import { useDetectionStore } from "@/stores"
import type { DetectionResult, ConcordanceEntry, ConcordanceDetection } from "@/types"

// Stable action functions (same pattern as use-bible.ts)
async function detectVerses(text: string) {
  const results = await invoke<DetectionResult[]>("detect_verses", { text })
  if (results.length > 0) {
    useDetectionStore.getState().addDetections(results)
  }
  return results
}

async function getDetectionStatus() {
  return invoke<{ has_direct: boolean; has_semantic: boolean }>(
    "detection_status"
  )
}

async function searchConcordance(query: string, limit = 20) {
  return invoke<ConcordanceEntry[]>("search_concordance", { query, limit })
}

async function getConcordanceEntry(strongsNumber: string) {
  return invoke<ConcordanceEntry | null>("get_concordance_entry", {
    strongsNumber,
  })
}

async function detectConcordanceWords(text: string) {
  const results = await invoke<ConcordanceDetection[]>(
    "detect_concordance_words",
    { text }
  )
  if (results.length > 0) {
    useDetectionStore.getState().addConcordanceDetections(results)
  }
  return results
}

export const detectionActions = {
  detectVerses,
  getDetectionStatus,
  searchConcordance,
  getConcordanceEntry,
  detectConcordanceWords,
  clearDetections: () => useDetectionStore.getState().clearDetections(),
  removeDetection: (verseRef: string) =>
    useDetectionStore.getState().removeDetection(verseRef),
  dismissDetection: (verseRef: string, source: DetectionResult["source"]) =>
    useDetectionStore.getState().dismissDetection(verseRef, source),
  dismissConcordanceDetection: (strongsNumber: string) =>
    useDetectionStore.getState().dismissConcordanceDetection(strongsNumber),
  clearConcordanceDetections: () =>
    useDetectionStore.getState().clearConcordanceDetections(),
}

export function useDetection() {
  const detections = useDetectionStore((s) => s.detections)
  const concordanceDetections = useDetectionStore((s) => s.concordanceDetections)
  const autoMode = useDetectionStore((s) => s.autoMode)
  const confidenceThreshold = useDetectionStore((s) => s.confidenceThreshold)

  return {
    detections,
    concordanceDetections,
    autoMode,
    confidenceThreshold,
    ...detectionActions,
  }
}
