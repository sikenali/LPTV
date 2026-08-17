import { Channel } from '../types'

export const ALLOWED_GROUPS = ['央视频道', '卫视频道']

export function filterChannels(all: Channel[], groups = ALLOWED_GROUPS): Channel[] {
  return all.filter(c => groups.includes(c.group))
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

