import { DatabaseSync, type StatementSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

declare global {
  // eslint-disable-next-line no-var
  var __cookingImpulsivelyDb: DatabaseSync | undefined;
}

function open(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      source_name TEXT,
      source_url TEXT,
      yield_text TEXT,
      ingredients_json TEXT NOT NULL,
      instructions_json TEXT NOT NULL,
      pan_type TEXT NOT NULL,
      experience TEXT NOT NULL,
      goal TEXT NOT NULL,
      user_notes TEXT,
      adaptation_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL REFERENCES cards(id),
      rating INTEGER NOT NULL,
      tags_json TEXT NOT NULL,
      actual_temp_f INTEGER,
      step_index INTEGER,
      ingredient_index INTEGER,
      technique TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS community_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER REFERENCES cards(id),
      note TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      decided_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_card ON feedback(card_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
  `);

  // Columns added after the initial schema shipped. CREATE TABLE IF NOT EXISTS
  // won't backfill them into an existing local database, so add them explicitly.
  addColumnIfMissing(db, "cards", "detected_stovetop_steps", "TEXT");
  addColumnIfMissing(db, "cards", "extraction_confidence", "REAL");
  addColumnIfMissing(db, "cards", "device_profile_id", "TEXT");
  addColumnIfMissing(db, "cards", "device_profile_version", "INTEGER");
  addColumnIfMissing(db, "cards", "canonical_url", "TEXT");
  addColumnIfMissing(db, "cards", "content_hash", "TEXT");
  addColumnIfMissing(db, "cards", "extraction_method", "TEXT");

  // Dedup lookups: the same recipe reached through different URLs shares a
  // content hash, and the same page shares a canonical URL.
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_cards_content_hash ON cards(content_hash)"
  );
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_cards_canonical ON cards(canonical_url)"
  );
}

function addColumnIfMissing(
  db: DatabaseSync,
  table: string,
  column: string,
  type: string
) {
  const existing = db
    .prepare(`SELECT name FROM pragma_table_info(?)`)
    .all(table) as { name: string }[];
  if (existing.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

export function getDb(): DatabaseSync {
  if (!global.__cookingImpulsivelyDb) {
    global.__cookingImpulsivelyDb = open();
  }
  return global.__cookingImpulsivelyDb;
}

export type { StatementSync };

export type CardRow = {
  id: number;
  slug: string;
  title: string;
  source_name: string | null;
  source_url: string | null;
  yield_text: string | null;
  ingredients_json: string;
  instructions_json: string;
  pan_type: string;
  experience: string;
  goal: string;
  user_notes: string | null;
  adaptation_json: string;
  created_at: number;
  detected_stovetop_steps: string | null;
  extraction_confidence: number | null;
  device_profile_id: string | null;
  device_profile_version: number | null;
  canonical_url: string | null;
  content_hash: string | null;
  extraction_method: string | null;
};

export type FeedbackRow = {
  id: number;
  card_id: number;
  rating: number;
  tags_json: string;
  actual_temp_f: number | null;
  step_index: number | null;
  ingredient_index: number | null;
  technique: string | null;
  notes: string | null;
  created_at: number;
};

export type CommunityNoteRow = {
  id: number;
  card_id: number | null;
  note: string;
  status: "pending" | "approved" | "rejected";
  created_at: number;
  decided_at: number | null;
};
