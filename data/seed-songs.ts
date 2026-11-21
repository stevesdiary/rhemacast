/**
 * Seeds songs and lyrics into rhema.db from data/seed-songs.json.
 * Run: bun run data/seed-songs.ts
 */

import { Database } from "bun:sqlite"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const DATA_DIR = import.meta.dir
const DB_PATH = join(DATA_DIR, "rhema.db")
const SEED_SONGS_PATH = join(DATA_DIR, "seed-songs.json")

interface SeedSection {
  type: string
  number: number
  lyrics: string
}

interface SeedSong {
  title: string
  author?: string
  composer?: string
  copyright?: string
  ccli_number?: string
  themes?: string[]
  sections: SeedSection[]
}

export function seedSongs(db: Database): {
  songsAdded: number
  sectionsAdded: number
} {
  if (!existsSync(SEED_SONGS_PATH)) {
    console.log("  ⏭ seed-songs.json not found, skipping songs seed")
    return { songsAdded: 0, sectionsAdded: 0 }
  }

  const raw = readFileSync(SEED_SONGS_PATH, "utf-8")
  const seedSongs: SeedSong[] = JSON.parse(raw)

  const findSong = db.prepare("SELECT id FROM songs WHERE title = ?")
  const insertSong = db.prepare(`
    INSERT INTO songs (title, author, composer, copyright, ccli_number, themes)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const insertSection = db.prepare(`
    INSERT INTO song_sections (song_id, section_type, section_number, lyrics, order_index)
    VALUES (?, ?, ?, ?, ?)
  `)

  let songsAdded = 0
  let sectionsAdded = 0

  db.exec("BEGIN TRANSACTION")

  for (const song of seedSongs) {
    const existing = findSong.get(song.title) as { id: number } | null
    if (existing) {
      continue
    }

    const themesJson = JSON.stringify(song.themes || [])
    insertSong.run(
      song.title,
      song.author || null,
      song.composer || null,
      song.copyright || null,
      song.ccli_number || null,
      themesJson
    )

    const songId = (
      db.query("SELECT last_insert_rowid() as id").get() as { id: number }
    ).id
    songsAdded++

    let orderIndex = 1
    for (const section of song.sections) {
      insertSection.run(
        songId,
        section.type,
        section.number,
        section.lyrics,
        orderIndex++
      )
      sectionsAdded++
    }
  }

  db.exec("COMMIT")
  return { songsAdded, sectionsAdded }
}

function main() {
  console.log("\n🎵 Seeding songs into rhema.db...")

  if (!existsSync(DB_PATH)) {
    console.error(
      `❌ rhema.db does not exist at ${DB_PATH}. Run bun run build:bible first.`
    )
    process.exit(1)
  }

  const db = new Database(DB_PATH)
  const { songsAdded, sectionsAdded } = seedSongs(db)

  const totalSongs = (
    db.query("SELECT count(*) as c FROM songs").get() as { c: number }
  ).c
  const totalSections = (
    db.query("SELECT count(*) as c FROM song_sections").get() as { c: number }
  ).c

  console.log(`✓ Added ${songsAdded} new songs (${sectionsAdded} sections)`)
  console.log(
    `📊 Total in DB: ${totalSongs} songs, ${totalSections} sections\n`
  )

  db.close()
}

if (import.meta.main) {
  main()
}
