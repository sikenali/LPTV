import { Channel } from '../types'

// 与 Web 模式保持一致：仅展示央视频道和卫视频道
const DISPLAY_GROUPS = ['央视频道', '卫视频道']

export function filterChannels(all: Channel[]): Channel[] {
  const allowed = new Set(DISPLAY_GROUPS)
  return all.filter(c => allowed.has(c.group))
}

export interface GroupedChannels {
  group: string
  channels: Channel[]
}

export function getGroupedChannels(all: Channel[]): GroupedChannels[] {
  return DISPLAY_GROUPS
    .map(group => ({ group, channels: all.filter(c => c.group === group) }))
    .filter(g => g.channels.length > 0)
}



