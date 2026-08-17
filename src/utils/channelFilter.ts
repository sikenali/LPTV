import { Channel } from '../types'

const DEFAULT_GROUPS = ['央视频道', '卫视频道', '地方频道', '数字频道']

export function filterChannels(all: Channel[], groups?: string[]): Channel[] {
  const g = groups ?? DEFAULT_GROUPS
  return all.filter(c => g.includes(c.group))
}

export interface GroupedChannels {
  group: string
  channels: Channel[]
}

function deriveGroups(all: Channel[]): string[] {
  const seen = new Set<string>()
  for (const ch of all) {
    if (!seen.has(ch.group)) {
      seen.add(ch.group)
    }
  }
  const dynamic = [...seen].filter(g => !DEFAULT_GROUPS.includes(g))
  return [...DEFAULT_GROUPS, ...dynamic]
}

export function getGroupedChannels(all: Channel[], groups?: string[]): GroupedChannels[] {
  const g = groups ?? deriveGroups(all)
  return g
    .map(group => ({
      group,
      channels: all.filter(c => c.group === group),
    }))
    .filter(g => g.channels.length > 0)
}

