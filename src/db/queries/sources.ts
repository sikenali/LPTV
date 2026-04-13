import { getDatabase } from '@/db/database'
import type { Source, SourceStatus } from '@/types/source'

export function insertSource(source: Source): void {
  const db = getDatabase()
  db.run(
    `INSERT INTO sources (id, name, url, type, status, channel_count, last_update_at, last_error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      source.id,
      source.name,
      source.url,
      source.type,
      source.status,
      source.channelCount,
      source.lastUpdateAt?.toISOString() ?? null,
      source.lastError ?? null,
      source.createdAt.toISOString()
    ]
  )
}

export function updateSourceStatus(id: string, status: SourceStatus, lastError?: string): void {
  const db = getDatabase()
  db.run(
    `UPDATE sources SET status = ?, last_error = ? WHERE id = ?`,
    [status, lastError ?? null, id]
  )
}

export function updateSourceChannelCount(id: string, count: number): void {
  const db = getDatabase()
  db.run(
    `UPDATE sources SET channel_count = ? WHERE id = ?`,
    [count, id]
  )
}

export function updateSourceLastUpdateAt(id: string, date: Date): void {
  const db = getDatabase()
  db.run(
    `UPDATE sources SET last_update_at = ? WHERE id = ?`,
    [date.toISOString(), id]
  )
}

export function getAllSources(): Source[] {
  const db = getDatabase()
  const result = db.exec('SELECT * FROM sources ORDER BY created_at DESC')

  if (result.length === 0 || result[0].values.length === 0) {
    return []
  }

  const columns = result[0].columns
  return result[0].values.map(row => {
    const obj = Object.fromEntries(columns.map((col, i) => [col, row[i]]))
    return {
      id: obj.id as string,
      name: obj.name as string,
      url: obj.url as string,
      type: obj.type as 'url' | 'file',
      status: obj.status as SourceStatus,
      channelCount: obj.channel_count as number,
      lastUpdateAt: obj.last_update_at ? new Date(obj.last_update_at as string) : null,
      lastError: obj.last_error as string | undefined,
      createdAt: new Date(obj.created_at as string)
    }
  })
}

export function getSourceById(id: string): Source | null {
  const db = getDatabase()
  const result = db.exec('SELECT * FROM sources WHERE id = ?', [id])

  if (result.length === 0 || result[0].values.length === 0) {
    return null
  }

  const columns = result[0].columns
  const row = result[0].values[0]
  const obj = Object.fromEntries(columns.map((col, i) => [col, row[i]]))

  return {
    id: obj.id as string,
    name: obj.name as string,
    url: obj.url as string,
    type: obj.type as 'url' | 'file',
    status: obj.status as SourceStatus,
    channelCount: obj.channel_count as number,
    lastUpdateAt: obj.last_update_at ? new Date(obj.last_update_at as string) : null,
    lastError: obj.last_error as string | undefined,
    createdAt: new Date(obj.created_at as string)
  }
}

export function deleteSource(id: string): void {
  const db = getDatabase()
  db.run('DELETE FROM sources WHERE id = ?', [id])
}
