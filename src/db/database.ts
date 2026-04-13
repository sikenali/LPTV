import initSqlJs, { type Database } from 'sql.js'

let db: Database | null = null

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('url', 'file')),
    status TEXT NOT NULL DEFAULT 'parsing',
    channel_count INTEGER DEFAULT 0,
    last_update_at DATETIME,
    last_error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    group_id TEXT NOT NULL,
    group_name TEXT NOT NULL,
    logo TEXT,
    tvg_id TEXT,
    tvg_name TEXT,
    source_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_channels_group ON channels(group_id);
  CREATE INDEX IF NOT EXISTS idx_channels_source ON channels(source_id);

  CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL UNIQUE,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_favorites_channel ON favorites(channel_id);

  CREATE TABLE IF NOT EXISTS update_rules (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL UNIQUE,
    interval INTEGER NOT NULL,
    interval_unit TEXT NOT NULL CHECK(interval_unit IN ('minute', 'hour', 'day', 'week')),
    next_update_at DATETIME NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
  );
`

let wasmUrl: string | null = null

export function setWasmUrl(url: string): void {
  wasmUrl = url
}

function getWasmLocation(): string {
  // If URL was set (from test environment), use it
  if (wasmUrl) return wasmUrl
  // In browser, use CDN
  return `https://sql.js.org/dist/sql-wasm.wasm`
}

export async function initDatabase(): Promise<Database> {
  if (db) return db

  const SQL = await initSqlJs({
    locateFile: () => getWasmLocation()
  })

  db = new SQL.Database()
  db.run(SCHEMA_SQL)

  return db
}

export function resetDatabase(): void {
  db = null
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}
