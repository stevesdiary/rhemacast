export interface ConcordanceEntry {
  id: number
  strongs_number: string
  language: "greek" | "hebrew"
  lemma: string
  translit: string
  translit_clean: string
  pronunciation?: string | null
  strongs_def: string
  kjv_def: string
  derivation?: string | null
  aliases?: string | null
}

export interface ConcordanceDetection {
  entry: ConcordanceEntry
  confidence: number
  matched_term: string
  transcript_snippet: string
  trigger_phrase?: string | null
}
