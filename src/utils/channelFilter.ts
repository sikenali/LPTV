import { Channel } from '../types'

// 前端只展示这两个分组（其他频道、省份频道等暂隐藏）
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



