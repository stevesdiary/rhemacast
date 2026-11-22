/**
 * CLI tool to import, validate, and convert any Bible JSON file into Rhema source format.
 *
 * Usage:
 *   bun run data/import-bible-json.ts <path-to-json> [options]
 *
 * Options:
 *   --abbrev <ABBREV>    Bible abbreviation (e.g. MSG, TPT, TLB)
 *   --title <TITLE>      Full title (e.g. "The Message", "The Passion Translation")
 *   --lang <LANG>        Language code (default: en)
 *   --license <LICENSE>  License notice
 *
 * Example:
 *   bun run data/import-bible-json.ts ~/Downloads/TheMessage.json --abbrev MSG --title "The Message"
 *   bun run build:bible
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join, resolve, basename } from "node:path"

const DATA_DIR = import.meta.dir
const SOURCES_DIR = join(DATA_DIR, "sources")

// Standard 66-book Protestant canon info
const CANONICAL_BOOKS: Array<{
  number: number
  name: string
  abbrev: string
  testament: "OT" | "NT"
}> = [
  { number: 1, name: "Genesis", abbrev: "Gen", testament: "OT" },
  { number: 2, name: "Exodus", abbrev: "Exod", testament: "OT" },
  { number: 3, name: "Leviticus", abbrev: "Lev", testament: "OT" },
  { number: 4, name: "Numbers", abbrev: "Num", testament: "OT" },
  { number: 5, name: "Deuteronomy", abbrev: "Deut", testament: "OT" },
  { number: 6, name: "Joshua", abbrev: "Josh", testament: "OT" },
  { number: 7, name: "Judges", abbrev: "Judg", testament: "OT" },
  { number: 8, name: "Ruth", abbrev: "Ruth", testament: "OT" },
  { number: 9, name: "1 Samuel", abbrev: "1Sam", testament: "OT" },
  { number: 10, name: "2 Samuel", abbrev: "2Sam", testament: "OT" },
  { number: 11, name: "1 Kings", abbrev: "1Kgs", testament: "OT" },
  { number: 12, name: "2 Kings", abbrev: "2Kgs", testament: "OT" },
  { number: 13, name: "1 Chronicles", abbrev: "1Chr", testament: "OT" },
  { number: 14, name: "2 Chronicles", abbrev: "2Chr", testament: "OT" },
  { number: 15, name: "Ezra", abbrev: "Ezra", testament: "OT" },
  { number: 16, name: "Nehemiah", abbrev: "Neh", testament: "OT" },
  { number: 17, name: "Esther", abbrev: "Esth", testament: "OT" },
  { number: 18, name: "Job", abbrev: "Job", testament: "OT" },
  { number: 19, name: "Psalms", abbrev: "Ps", testament: "OT" },
  { number: 20, name: "Proverbs", abbrev: "Prov", testament: "OT" },
  { number: 21, name: "Ecclesiastes", abbrev: "Eccl", testament: "OT" },
  { number: 22, name: "Song of Solomon", abbrev: "Song", testament: "OT" },
  { number: 23, name: "Isaiah", abbrev: "Isa", testament: "OT" },
  { number: 24, name: "Jeremiah", abbrev: "Jer", testament: "OT" },
  { number: 25, name: "Lamentations", abbrev: "Lam", testament: "OT" },
  { number: 26, name: "Ezekiel", abbrev: "Ezek", testament: "OT" },
  { number: 27, name: "Daniel", abbrev: "Dan", testament: "OT" },
  { number: 28, name: "Hosea", abbrev: "Hos", testament: "OT" },
  { number: 29, name: "Joel", abbrev: "Joel", testament: "OT" },
  { number: 30, name: "Amos", abbrev: "Amos", testament: "OT" },
  { number: 31, name: "Obadiah", abbrev: "Obad", testament: "OT" },
  { number: 32, name: "Jonah", abbrev: "Jonah", testament: "OT" },
  { number: 33, name: "Micah", abbrev: "Mic", testament: "OT" },
  { number: 34, name: "Nahum", abbrev: "Nah", testament: "OT" },
  { number: 35, name: "Habakkuk", abbrev: "Hab", testament: "OT" },
  { number: 36, name: "Zephaniah", abbrev: "Zeph", testament: "OT" },
  { number: 37, name: "Haggai", abbrev: "Hag", testament: "OT" },
  { number: 38, name: "Zechariah", abbrev: "Zech", testament: "OT" },
  { number: 39, name: "Malachi", abbrev: "Mal", testament: "OT" },
  { number: 40, name: "Matthew", abbrev: "Matt", testament: "NT" },
  { number: 41, name: "Mark", abbrev: "Mark", testament: "NT" },
  { number: 42, name: "Luke", abbrev: "Luke", testament: "NT" },
  { number: 43, name: "John", abbrev: "John", testament: "NT" },
  { number: 44, name: "Acts", abbrev: "Acts", testament: "NT" },
  { number: 45, name: "Romans", abbrev: "Rom", testament: "NT" },
  { number: 46, name: "1 Corinthians", abbrev: "1Cor", testament: "NT" },
  { number: 47, name: "2 Corinthians", abbrev: "2Cor", testament: "NT" },
  { number: 48, name: "Galatians", abbrev: "Gal", testament: "NT" },
  { number: 49, name: "Ephesians", abbrev: "Eph", testament: "NT" },
  { number: 50, name: "Philippians", abbrev: "Phil", testament: "NT" },
  { number: 51, name: "Colossians", abbrev: "Col", testament: "NT" },
  { number: 52, name: "1 Thessalonians", abbrev: "1Thess", testament: "NT" },
  { number: 53, name: "2 Thessalonians", abbrev: "2Thess", testament: "NT" },
  { number: 54, name: "1 Timothy", abbrev: "1Tim", testament: "NT" },
  { number: 55, name: "2 Timothy", abbrev: "2Tim", testament: "NT" },
  { number: 56, name: "Titus", abbrev: "Titus", testament: "NT" },
  { number: 57, name: "Philemon", abbrev: "Phlm", testament: "NT" },
  { number: 58, name: "Hebrews", abbrev: "Heb", testament: "NT" },
  { number: 59, name: "James", abbrev: "Jas", testament: "NT" },
  { number: 60, name: "1 Peter", abbrev: "1Pet", testament: "NT" },
  { number: 61, name: "2 Peter", abbrev: "2Pet", testament: "NT" },
  { number: 62, name: "1 John", abbrev: "1John", testament: "NT" },
  { number: 63, name: "2 John", abbrev: "2John", testament: "NT" },
  { number: 64, name: "3 John", abbrev: "3John", testament: "NT" },
  { number: 65, name: "Jude", abbrev: "Jude", testament: "NT" },
  { number: 66, name: "Revelation", abbrev: "Rev", testament: "NT" },
]

function resolveBook(raw: string) {
  const norm = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\bfirst\b/, "1")
    .replace(/\bsecond\b/, "2")
    .replace(/\bthird\b/, "3")
    .replace(/\b1st\b/, "1")
    .replace(/\b2nd\b/, "2")
    .replace(/\b3rd\b/, "3")
    .replace(/^i\s+/, "1 ")
    .replace(/^ii\s+/, "2 ")
    .replace(/^iii\s+/, "3 ")
    .replace(/\bpsalm\b/, "psalms")
    .replace(/\bsong of songs\b/, "song of solomon")
    .replace(/\brevelations\b/, "revelation")
    .trim()

  for (const b of CANONICAL_BOOKS) {
    if (
      b.name.toLowerCase() === norm ||
      b.abbrev.toLowerCase() === norm ||
      b.name.toLowerCase().replace(/\s/g, "") === norm.replace(/\s/g, "")
    ) {
      return b
    }
  }
  return null
}

interface ParsedVerse {
  chapter: number
  verse: number
  text: string
}

interface ParsedBook {
  bookNumber: number
  name: string
  chapters: Array<{
    chapter: number
    verses: Array<{ verse: number; text: string }>
  }>
}

function parseInputJson(raw: string): ParsedBook[] {
  const root = JSON.parse(raw)
  const booksMap = new Map<number, { name: string; verses: ParsedVerse[] }>()

  if (Array.isArray(root)) {
    // Check if array of book objects or flat verses
    if (root.length > 0 && root[0].chapters) {
      // Array of books
      for (let idx = 0; idx < root.length; idx++) {
        const b = root[idx]
        const canon = resolveBook(b.name || b.title || "")
        const num = canon ? canon.number : idx + 1
        const name = canon ? canon.name : b.name || `Book ${num}`
        const verses: ParsedVerse[] = []
        for (const ch of b.chapters || []) {
          const chNum = Number(ch.chapter || ch.number || 1)
          for (const v of ch.verses || []) {
            const vNum = Number(v.verse || v.number || 1)
            const text = String(v.text || "").trim()
            if (text) verses.push({ chapter: chNum, verse: vNum, text })
          }
        }
        if (verses.length > 0) {
          booksMap.set(num, { name, verses })
        }
      }
    } else {
      // Flat array of verse records
      for (let idx = 0; idx < root.length; idx++) {
        const v = root[idx]
        const canon = resolveBook(v.book_name || v.book || "")
        const num = canon ? canon.number : Math.floor(idx / 1000) + 1
        const name = canon ? canon.name : v.book_name || `Book ${num}`
        const ch = Number(v.chapter || 1)
        const verse = Number(v.verse || 1)
        const text = String(v.text || "").trim()
        if (!text) continue

        if (!booksMap.has(num)) {
          booksMap.set(num, { name, verses: [] })
        }
        booksMap.get(num)!.verses.push({ chapter: ch, verse, text })
      }
    }
  } else if (root.books && Array.isArray(root.books)) {
    // Scrollmapper standard
    for (let idx = 0; idx < root.books.length; idx++) {
      const b = root.books[idx]
      const canon = resolveBook(b.name || b.title || "")
      const num = canon ? canon.number : idx + 1
      const name = canon ? canon.name : b.name || `Book ${num}`
      const verses: ParsedVerse[] = []
      for (const ch of b.chapters || []) {
        const chNum = Number(ch.chapter || ch.number || 1)
        for (const v of ch.verses || []) {
          const vNum = Number(v.verse || v.number || 1)
          const text = String(v.text || "").trim()
          if (text) verses.push({ chapter: chNum, verse: vNum, text })
        }
      }
      if (verses.length > 0) {
        booksMap.set(num, { name, verses })
      }
    }
  } else if (typeof root === "object" && root !== null) {
    // Keyed map of books: { "Genesis": { "1": { "1": "text" } } }
    for (const [rawBook, chs] of Object.entries(root)) {
      if (typeof chs !== "object" || !chs) continue
      const canon = resolveBook(rawBook)
      const num = canon ? canon.number : 1
      const name = canon ? canon.name : rawBook
      const verses: ParsedVerse[] = []

      for (const [chStr, vObj] of Object.entries(chs as Record<string, any>)) {
        const chNum = Number(chStr) || 1
        if (typeof vObj !== "object" || !vObj) continue
        for (const [vStr, textVal] of Object.entries(vObj as Record<string, any>)) {
          const vNum = Number(vStr) || 1
          const text = String(textVal || "").trim()
          if (text) verses.push({ chapter: chNum, verse: vNum, text })
        }
      }

      if (verses.length > 0) {
        booksMap.set(num, { name, verses })
      }
    }
  }

  const sortedNums = Array.from(booksMap.keys()).sort((a, b) => a - b)
  const result: ParsedBook[] = []

  for (const num of sortedNums) {
    const item = booksMap.get(num)!
    // Group verses by chapter
    const chMap = new Map<number, Array<{ verse: number; text: string }>>()
    for (const v of item.verses) {
      if (!chMap.has(v.chapter)) {
        chMap.set(v.chapter, [])
      }
      chMap.get(v.chapter)!.push({ verse: v.verse, text: v.text })
    }

    const sortedChs = Array.from(chMap.keys()).sort((a, b) => a - b)
    const chapters = sortedChs.map((chNum) => {
      const vList = chMap.get(chNum)!
      vList.sort((a, b) => a.verse - b.verse)
      return { chapter: chNum, verses: vList }
    })

    result.push({
      bookNumber: num,
      name: item.name,
      chapters,
    })
  }

  return result
}

function parseArgs() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
Rhema Bible JSON Importer
Convert external Bible JSON into Rhema source format for build-time bundling.

Usage:
  bun run data/import-bible-json.ts <file.json> [options]

Options:
  --abbrev <CODE>    Translation code (e.g. MSG, TPT, TLB)
  --title <TITLE>    Display title (e.g. "The Message")
  --lang <CODE>      Language code (default: en)
  --license <NAME>   Copyright / License notice
`)
    process.exit(0)
  }

  const filePath = args[0]
  let abbrev = ""
  let title = ""
  let lang = "en"
  let license = "Custom"

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--abbrev" && args[i + 1]) {
      abbrev = args[++i].toUpperCase()
    } else if (args[i] === "--title" && args[i + 1]) {
      title = args[++i]
    } else if (args[i] === "--lang" && args[i + 1]) {
      lang = args[++i].toLowerCase()
    } else if (args[i] === "--license" && args[i + 1]) {
      license = args[++i]
    }
  }

  if (!abbrev) {
    // Derive from filename
    abbrev = basename(filePath).replace(/\.json$/i, "").toUpperCase()
  }
  if (!title) {
    title = abbrev
  }

  return { filePath, abbrev, title, lang, license }
}

function main() {
  const { filePath, abbrev, title, lang, license } = parseArgs()
  const resolvedPath = resolve(filePath)

  if (!existsSync(resolvedPath)) {
    console.error(`❌ File not found: ${resolvedPath}`)
    process.exit(1)
  }

  console.log(`\n📖 Reading ${resolvedPath}...`)
  const content = readFileSync(resolvedPath, "utf-8")
  const books = parseInputJson(content)

  if (books.length === 0) {
    console.error(`❌ Could not find any valid books or verses in the JSON file.`)
    process.exit(1)
  }

  let totalVerses = 0
  for (const b of books) {
    for (const c of b.chapters) {
      totalVerses += c.verses.length
    }
  }

  console.log(`✓ Parsed ${books.length} books, ${totalVerses} verses.`)

  const outData = {
    translation: abbrev,
    title,
    language: lang,
    license,
    books: books.map((b) => ({
      name: b.name,
      chapters: b.chapters,
    })),
  }

  const targetPath = join(SOURCES_DIR, `${abbrev}.json`)
  writeFileSync(targetPath, JSON.stringify(outData, null, 2), "utf-8")
  console.log(`\n✅ Saved to: ${targetPath}`)
  console.log(`\nTo bundle this translation into the production app:`)
  console.log(`  bun run build:bible`)
  console.log(`  bun run tauri build\n`)
}

main()
