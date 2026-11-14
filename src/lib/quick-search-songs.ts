/**
 * Quick Search Utility Functions for Songs
 * Pure functions for song title autocomplete logic
 */

import type { Song } from "@/types"

export interface SongAutocompleteResult {
  suggestion: string
  matchedSong?: Song
  stage: "title" | "complete" | "none"
}

/**
 * Find matching song by title (case insensitive prefix match)
 */
export function findMatchingSong(titleInput: string, songs: Song[]): Song | undefined {
  const normalized = titleInput.toLowerCase()
  return songs.find(
    s =>
      s.title.toLowerCase().startsWith(normalized) ||
      (s.author && s.author.toLowerCase().startsWith(normalized))
  )
}

/**
 * Parse song title input and return autocomplete suggestion
 * Supports:
 * - "amazing" -> "Amazing Grace"
 * - "amazing grace" -> "Amazing Grace" (complete)
 * - "how great" -> "How Great Thou Art"
 */
export function getSongAutocompleteSuggestion(
  input: string,
  songs: Song[]
): SongAutocompleteResult {
  const trimmed = input.trim()

  if (!trimmed) {
    return { suggestion: "", stage: "none" }
  }

  const matchingSong = findMatchingSong(trimmed, songs)

  if (!matchingSong) {
    return { suggestion: "", stage: "none" }
  }

  // Check if input exactly matches the song title (or is a close prefix)
  const exactMatch =
    matchingSong.title.toLowerCase() === trimmed.toLowerCase() ||
    matchingSong.title.toLowerCase().startsWith(trimmed.toLowerCase() + " ")

  if (exactMatch) {
    return {
      suggestion: matchingSong.title,
      matchedSong: matchingSong,
      stage: "complete",
    }
  }

  // Partial match - suggest the full title
  return {
    suggestion: matchingSong.title,
    matchedSong: matchingSong,
    stage: "title",
  }
}

/**
 * Determine what should happen when Tab/Arrow-Right is pressed for song search
 */
export function getSongTabNavigationResult(
  currentInput: string,
  currentSuggestion: string
): string {
  if (!currentSuggestion || currentSuggestion === currentInput) {
    return currentInput
  }

  const trimmed = currentInput.trim()
  const suggestionTrimmed = currentSuggestion.trim()

  // Check if current input matches the COMPLETE song title
  const currentIsCompleteTitle =
    trimmed === suggestionTrimmed || trimmed === suggestionTrimmed + " "

  // Stage 1: Still typing title -> advance to complete title
  if (!currentIsCompleteTitle) {
    return suggestionTrimmed
  }

  // Default: accept full suggestion
  return currentSuggestion
}