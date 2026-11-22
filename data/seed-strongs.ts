/**
 * Downloads and seeds OpenScriptures Strong's Greek and Hebrew Lexicon into rhema.db.
 * Run: bun run data/seed-strongs.ts
 */

import { Database } from "bun:sqlite"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const DATA_DIR = import.meta.dir
const DB_PATH = join(DATA_DIR, "rhema.db")
const SOURCES_DIR = join(DATA_DIR, "sources")

const GREEK_URL =
  "https://raw.githubusercontent.com/openscriptures/strongs/master/greek/strongs-greek-dictionary.js"
const HEBREW_URL =
  "https://raw.githubusercontent.com/openscriptures/strongs/master/hebrew/strongs-hebrew-dictionary.js"

const GREEK_FILE = join(SOURCES_DIR, "strongs-greek-dictionary.js")
const HEBREW_FILE = join(SOURCES_DIR, "strongs-hebrew-dictionary.js")

export const PREACHING_ALIASES: Record<string, string[]> = {
  // Greek
  G2540: ["kairos", "cairos", "kyros", "kayros", "kiros"], // καιρός
  G4487: ["rhema", "rema", "rayma", "rehma"], // ῥῆμα
  G3056: ["logos", "logoss"], // λόγος
  G2222: ["zoe", "zoey", "zoee", "zowee"], // ζωή
  G1411: ["dunamis", "dynamis", "doonamis", "dunamiss"], // δύναμις
  G26: ["agape", "agapay", "agapey"], // ἀγάπη
  G3875: ["parakletos", "paraclete", "paraklete", "paracletos"], // παράκλητος
  G4151: ["pneuma", "neuma"], // πνεῦμα
  G5485: ["charis", "haris"], // χάρις
  G1343: ["dikaiosune", "dikaiosyne"], // δικαιοσύνη
  G4336: ["proskuneo", "proskuneo"], // προσκυνέω
  G3341: ["metanoia", "metanoya"], // μετάνοια
  G2842: ["koinonia", "coynonia"], // κοινωνία
  G1984: ["episkope"], // ἐπισκοπή
  G3466: ["mysterion", "misterion"], // μυστήριον
  G2098: ["euaggelion", "evangelion", "euangelion"], // εὐαγγέλιον
  G4991: ["soteria"], // σωτηρία
  G3588: ["ho", "tou"], // ὁ
  G2962: ["kurios", "kyrios"], // κύριος
  G5547: ["christos", "kristos"], // χριστός
  G2316: ["theos"], // θεός
  G1577: ["ekklesia", "ecclesia"], // ἐκκλησία
  G730: ["arrhabon", "arrhabo"], // ἀῤῥαβών

  // Hebrew
  H7965: ["shalom", "shalome", "shalowm", "shaloam"], // שָׁלוֹם
  H2617: ["hesed", "chesed", "khesed"], // חֶסֶד
  H7307: ["ruach", "ruah", "ruakh"], // רוּחַ
  H3068: ["yahweh", "yahveh", "yehovah", "jehovah"], // יְהֹוָה
  H430: ["elohim", "elohiym"], // אֱלֹהִים
  H136: ["adonai", "adonay"], // אֲדֹנָי
  H1285: ["berit", "berith", "beris"], // בְּרִית
  H3519: ["kabod", "kavod", "chabod"], // כָּבוֹד
  H6944: ["qodesh", "kodesh"], // קֹדֶשׁ
  H5315: ["nephesh", "nefesh"], // נֶפֶשׁ
  H2451: ["chokmah", "hokhmah", "chocmah"], // חָכְמָה
  H5769: ["olam", "owlam"], // עוֹלָם
  H8451: ["torah"], // תּוֹרָה
}

/**
 * Strips accents, macrons, diacritics, and punctuation to produce an ASCII
 * search token suitable for spoken speech-to-text transcript matching.
 */
export function cleanTransliteration(raw: string): string {
  if (!raw) return ""
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Strip diacritics
    .replace(/[ʻʼ'`^"\-–—]/g, "") // Strip breathings and dashes
    .replace(/[^a-zA-Z0-9]/g, "") // Keep alphanumeric only
    .trim()
    .toLowerCase()
}

interface RawGreekEntry {
  lemma?: string
  translit?: string
  derivation?: string
  strongs_def?: string
  kjv_def?: string
  pron?: string
}

interface RawHebrewEntry {
  lemma?: string
  xlit?: string
  translit?: string
  derivation?: string
  strongs_def?: string
  kjv_def?: string
  pron?: string
}

async function ensureFileDownloaded(url: string, path: string): Promise<void> {
  if (existsSync(path)) return
  console.log(`  Downloading ${url}...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.statusText}`)
  const text = await res.text()
  await Bun.write(path, text)
  console.log(`  ✓ Saved ${path} (${(text.length / 1024 / 1024).toFixed(1)} MB)`)
}

function parseDictionaryJs(filePath: string): Record<string, any> {
  const content = readFileSync(filePath, "utf-8")
  const start = content.indexOf("{")
  const end = content.lastIndexOf("}")
  if (start === -1 || end === -1) {
    throw new Error(`Failed to locate JSON object in ${filePath}`)
  }
  const jsonStr = content.slice(start, end + 1)
  return JSON.parse(jsonStr)
}

export function seedStrongs(db: Database): {
  greekAdded: number
  hebrewAdded: number
} {
  // 1. Ensure table schema exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS concordance_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        strongs_number TEXT UNIQUE NOT NULL,
        language TEXT NOT NULL,
        lemma TEXT NOT NULL,
        translit TEXT NOT NULL,
        translit_clean TEXT NOT NULL,
        pronunciation TEXT,
        strongs_def TEXT NOT NULL,
        kjv_def TEXT NOT NULL,
        derivation TEXT,
        aliases TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_concordance_clean ON concordance_entries(translit_clean);
    CREATE INDEX IF NOT EXISTS idx_concordance_strongs ON concordance_entries(strongs_number);
    CREATE INDEX IF NOT EXISTS idx_concordance_lang ON concordance_entries(language);

    CREATE VIRTUAL TABLE IF NOT EXISTS concordance_fts USING fts5(
        strongs_number,
        translit_clean,
        lemma,
        strongs_def,
        kjv_def,
        content='concordance_entries',
        content_rowid='id',
        tokenize='unicode61'
    );

    CREATE TRIGGER IF NOT EXISTS concordance_ai AFTER INSERT ON concordance_entries BEGIN
        INSERT INTO concordance_fts(rowid, strongs_number, translit_clean, lemma, strongs_def, kjv_def)
        VALUES (new.id, new.strongs_number, new.translit_clean, new.lemma, new.strongs_def, new.kjv_def);
    END;

    CREATE TRIGGER IF NOT EXISTS concordance_ad AFTER DELETE ON concordance_entries BEGIN
        INSERT INTO concordance_fts(concordance_fts, rowid, strongs_number, translit_clean, lemma, strongs_def, kjv_def)
        VALUES ('delete', old.id, old.strongs_number, old.translit_clean, old.lemma, old.strongs_def, old.kjv_def);
    END;

    CREATE TRIGGER IF NOT EXISTS concordance_au AFTER UPDATE ON concordance_entries BEGIN
        INSERT INTO concordance_fts(concordance_fts, rowid, strongs_number, translit_clean, lemma, strongs_def, kjv_def)
        VALUES ('delete', old.id, old.strongs_number, old.translit_clean, old.lemma, old.strongs_def, old.kjv_def);
        INSERT INTO concordance_fts(rowid, strongs_number, translit_clean, lemma, strongs_def, kjv_def)
        VALUES (new.id, new.strongs_number, new.translit_clean, new.lemma, new.strongs_def, new.kjv_def);
    END;
  `)

  const countRow = db
    .query("SELECT COUNT(*) as count FROM concordance_entries")
    .get() as { count: number }
  if (countRow && countRow.count > 0) {
    console.log(
      `  ⏭ concordance_entries already populated (${countRow.count} entries), skipping seed`
    )
    return { greekAdded: 0, hebrewAdded: 0 }
  }

  console.log("  Parsing Greek Strong's dictionary...")
  const greekDict = parseDictionaryJs(GREEK_FILE)
  console.log("  Parsing Hebrew Strong's dictionary...")
  const hebrewDict = parseDictionaryJs(HEBREW_FILE)

  const insertStmt = db.prepare(`
    INSERT INTO concordance_entries (
      strongs_number, language, lemma, translit, translit_clean,
      pronunciation, strongs_def, kjv_def, derivation, aliases
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  let greekAdded = 0
  let hebrewAdded = 0

  db.exec("BEGIN TRANSACTION")

  // Greek entries
  for (const [strongsKey, raw] of Object.entries(greekDict)) {
    const entry = raw as RawGreekEntry
    const strongsNumber = strongsKey.toUpperCase()
    const lemma = entry.lemma || ""
    const translit = entry.translit || ""
    const translitClean = cleanTransliteration(translit)
    const pronunciation = entry.pron || null
    const strongsDef = (entry.strongs_def || "").trim()
    const kjvDef = (entry.kjv_def || "").trim()
    const derivation = (entry.derivation || "").trim()

    const aliasesSet = new Set<string>()
    if (translitClean) aliasesSet.add(translitClean)
    if (PREACHING_ALIASES[strongsNumber]) {
      for (const a of PREACHING_ALIASES[strongsNumber]) {
        aliasesSet.add(a.toLowerCase())
      }
    }
    const aliases = JSON.stringify(Array.from(aliasesSet))

    insertStmt.run(
      strongsNumber,
      "greek",
      lemma,
      translit,
      translitClean,
      pronunciation,
      strongsDef,
      kjvDef,
      derivation,
      aliases
    )
    greekAdded++
  }

  // Hebrew entries
  for (const [strongsKey, raw] of Object.entries(hebrewDict)) {
    const entry = raw as RawHebrewEntry
    const strongsNumber = strongsKey.toUpperCase()
    const lemma = entry.lemma || ""
    const translit = entry.xlit || entry.translit || ""
    const translitClean = cleanTransliteration(translit)
    const pronunciation = entry.pron || null
    const strongsDef = (entry.strongs_def || "").trim()
    const kjvDef = (entry.kjv_def || "").trim()
    const derivation = (entry.derivation || "").trim()

    const aliasesSet = new Set<string>()
    if (translitClean) aliasesSet.add(translitClean)
    if (PREACHING_ALIASES[strongsNumber]) {
      for (const a of PREACHING_ALIASES[strongsNumber]) {
        aliasesSet.add(a.toLowerCase())
      }
    }
    const aliases = JSON.stringify(Array.from(aliasesSet))

    insertStmt.run(
      strongsNumber,
      "hebrew",
      lemma,
      translit,
      translitClean,
      pronunciation,
      strongsDef,
      kjvDef,
      derivation,
      aliases
    )
    hebrewAdded++
  }

  db.exec("COMMIT")

  return { greekAdded, hebrewAdded }
}

async function main() {
  console.log("\n📖 Seeding Strong's Greek & Hebrew Concordance...")

  if (!existsSync(SOURCES_DIR)) {
    throw new Error(`sources directory does not exist at ${SOURCES_DIR}`)
  }

  await ensureFileDownloaded(GREEK_URL, GREEK_FILE)
  await ensureFileDownloaded(HEBREW_URL, HEBREW_FILE)

  if (!existsSync(DB_PATH)) {
    throw new Error(`rhema.db does not exist at ${DB_PATH}. Run build:bible first.`)
  }

  const db = new Database(DB_PATH)
  const { greekAdded, hebrewAdded } = seedStrongs(db)

  const total = db
    .query("SELECT COUNT(*) as count FROM concordance_entries")
    .get() as { count: number }
  console.log(`✅ Concordance seeded successfully!`)
  console.log(`   ${greekAdded} Greek entries added`)
  console.log(`   ${hebrewAdded} Hebrew entries added`)
  console.log(`   Total concordance entries: ${total.count}`)

  db.close()
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Error seeding concordance:", err)
    process.exit(1)
  })
}
