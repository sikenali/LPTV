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
  const byGroup = new Map<string, Channel[]>()
  for (const c of all) {
    if (!byGroup.has(c.group)) byGroup.set(c.group, [])
    byGroup.get(c.group)!.push(c)
  }
  // 按优先级排序：央视频道 / 卫视频道 在前，其余按字母序
  const priority = new Set(['央视频道', '卫视频道'])
  const sorted = Array.from(byGroup.keys()).sort((a, b) => {
    const pa = priority.has(a) ? 0 : 1
    const pb = priority.has(b) ? 0 : 1
    return pa !== pb ? pa - pb : a.localeCompare(b, 'zh')
  })
  return sorted
    .map(group => ({ group, channels: byGroup.get(group)! }))
    .filter(g => g.channels.length > 0)
}



