import { Channel } from '../types'

export const ALLOWED_GROUPS = ['央视频道', '卫视频道']

export function filterChannels(all: Channel[]): Channel[] {
  return all.filter(c => ALLOWED_GROUPS.includes(c.group))
}

export interface GroupedChannels {
  group: string
  channels: Channel[]
}

export function getGroupedChannels(all: Channel[]): GroupedChannels[] {
  return ALLOWED_GROUPS
    .map(group => ({
      group,
      channels: all.filter(c => c.group === group),
    }))
    .filter(g => g.channels.length > 0)
}
