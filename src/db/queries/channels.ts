import { getDatabase } from '@/db/database'
import type { Channel } from '@/types/channel'

export function insertChannels(channels: Channel[]): void {
  const db = getDatabase()
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO channels
     (id, name, url, group_id, group_name, logo, tvg_id, tvg_name, source_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  for (const ch of channels) {
    stmt.run([
      ch.id,
      ch.name,
      ch.url,
      ch.groupId,
      ch.groupName,
      ch.logo ?? null,
      ch.tvgId ?? null,
      ch.tvgName ?? null,
      ch.sourceId,
      ch.createdAt.toISOString(),
      ch.updatedAt.toISOString()
    ])
  }

  stmt.free()
}

export function getChannelsBySourceId(sourceId: string): Channel[] {
  const db = getDatabase()
  const result = db.exec('SELECT * FROM channels WHERE source_id = ? ORDER BY group_id, name', [sourceId])

  if (result.length === 0 || result[0].values.length === 0) {
    return []
  }

  return mapResultToChannels(result[0])
}

export function getChannelsGroupedByGroup(sourceId: string): Record<string, Channel[]> {
  const channels = getChannelsBySourceId(sourceId)
  const groups: Record<string, Channel[]> = {}

  for (const ch of channels) {
    if (!groups[ch.groupName]) {
      groups[ch.groupName] = []
    }
    groups[ch.groupName].push(ch)
  }

  return groups
}

export function getChannelById(id: string): Channel | null {
  const db = getDatabase()
  const result = db.exec('SELECT * FROM channels WHERE id = ?', [id])

  if (result.length === 0 || result[0].values.length === 0) {
    return null
  }

  return mapResultToChannel(result[0].columns, result[0].values[0])
}

export function deleteChannelsBySourceId(sourceId: string): void {
  const db = getDatabase()
  db.run('DELETE FROM channels WHERE source_id = ?', [sourceId])
}

function mapResultToChannels(result: { columns: string[]; values: unknown[][] }): Channel[] {
  return result.values.map(row => mapResultToChannel(result.columns, row))
}

function mapResultToChannel(columns: string[], row: unknown[]): Channel {
  const obj = Object.fromEntries(columns.map((col, i) => [col, row[i]])) as Record<string, unknown>
  return {
    id: obj.id as string,
    name: obj.name as string,
    url: obj.url as string,
    groupId: obj.group_id as string,
    groupName: obj.group_name as string,
    logo: obj.logo as string | undefined,
    tvgId: obj.tvg_id as string | undefined,
    tvgName: obj.tvg_name as string | undefined,
    isFavorite: false,
    sourceId: obj.source_id as string,
    createdAt: new Date(obj.created_at as string),
    updatedAt: new Date(obj.updated_at as string)
  }
}
