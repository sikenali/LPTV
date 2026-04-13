import { getDatabase } from '@/db/database'

export function insertFavorite(channelId: string): void {
  const db = getDatabase()
  db.run('INSERT OR IGNORE INTO favorites (id, channel_id, added_at) VALUES (?, ?, ?)', [
    `fav_${channelId}`,
    channelId,
    new Date().toISOString()
  ])
}

export function removeFavorite(channelId: string): void {
  const db = getDatabase()
  db.run('DELETE FROM favorites WHERE channel_id = ?', [channelId])
}

export function getAllFavoriteChannelIds(): string[] {
  const db = getDatabase()
  const result = db.exec('SELECT channel_id FROM favorites ORDER BY added_at DESC')

  if (result.length === 0 || result[0].values.length === 0) {
    return []
  }

  return result[0].values.map(row => row[0] as string)
}

export function isFavorite(channelId: string): boolean {
  const db = getDatabase()
  const result = db.exec('SELECT 1 FROM favorites WHERE channel_id = ?', [channelId])
  return result.length > 0 && result[0].values.length > 0
}
