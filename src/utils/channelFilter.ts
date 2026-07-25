import { Channel } from '../types'

export const ALLOWED_GROUPS = ['央视频道', '卫视频道']
export const GROUP_PRIORITY = ['央视频道', '卫视频道']

export function filterChannels(all: Channel[], groups = ALLOWED_GROUPS): Channel[] {
  return all.filter(c => groups.includes(c.group))
}

export function deduplicateChannels(channels: Channel[], priority = GROUP_PRIORITY): Channel[] {
  const nameMap = new Map<string, Channel>()

  for (const channel of channels) {
    const key = channel.name.toLowerCase()
    if (!nameMap.has(key)) {
      nameMap.set(key, channel)
      continue
    }

    const existing = nameMap.get(key)!
    const existingPriority = priority.indexOf(existing.group)
    const newPriority = priority.indexOf(channel.group)

    if (newPriority > existingPriority) {
      nameMap.set(key, channel)
    }
  }

  return Array.from(nameMap.values())
}

export interface GroupedChannels {
  group: string
  channels: Channel[]
}

export function getGroupedChannels(all: Channel[], groups = ALLOWED_GROUPS): GroupedChannels[] {
  return groups
    .map(group => ({
      group,
      channels: all.filter(c => c.group === group),
    }))
    .filter(g => g.channels.length > 0)
}
