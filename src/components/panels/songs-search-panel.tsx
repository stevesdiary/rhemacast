"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Button } from "@/components/ui/button"
import {
  getSongAutocompleteSuggestion,
  getSongTabNavigationResult,
} from "@/lib/quick-search-songs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  MusicIcon,
  SparklesIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  PlusIcon,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSongs, songsActions, selectSong, selectSection, queueSong } from "@/hooks/use-songs"
import { useSongsStore } from "@/stores/songs-store"
import { useQueueStore } from "@/stores"
import type { Song, SongSection, SearchSongRow, SongQueueItem } from "@/types"
import { Input } from "@/components/ui/input"