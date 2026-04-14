import type { Channel } from '@/types/channel'

export interface DuplicateGroup {
  name: string
  channels: Channel[]
  bestChannel: Channel
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

export function findDuplicates(channels: Channel[]): DuplicateGroup[] {
  const groups = new Map<string, Channel[]>()

  for (const ch of channels) {
    const key = normalizeName(ch.name)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(ch)
  }

  const duplicates: DuplicateGroup[] = []
  for (const [_name, group] of groups.entries()) {
    if (group.length > 1) {
      duplicates.push({
        name: group[0].name, // 保留原始名称
        channels: group,
        bestChannel: group[0] // 简化：选第一个
      })
    }
  }

  return duplicates.sort((a, b) => b.channels.length - a.channels.length)
}

export function deduplicateChannels(channels: Channel[]): Channel[] {
  const groups = new Map<string, Channel>()

  for (const ch of channels) {
    const key = normalizeName(ch.name)
    if (!groups.has(key)) {
      groups.set(key, ch)
    }
  }

  return Array.from(groups.values())
}

export function getDuplicateStats(channels: Channel[]): { total: number; duplicates: number; unique: number } {
  const groups = new Map<string, Channel[]>()

  for (const ch of channels) {
    const key = normalizeName(ch.name)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(ch)
  }

  const duplicates = Array.from(groups.values()).filter(g => g.length > 1).reduce((sum, g) => sum + g.length - 1, 0)

  return {
    total: channels.length,
    duplicates,
    unique: groups.size
  }
}
