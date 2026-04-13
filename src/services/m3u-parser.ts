import type { Channel } from '@/types/channel'

interface ExtInfo {
  duration: number
  tvgId?: string
  tvgName?: string
  tvgLogo?: string
  groupTitle?: string
  name: string
}

export function parseM3U(content: string, sourceId: string): Channel[] {
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean)

  if (!lines[0]?.startsWith('#EXTM3U')) {
    return []
  }

  const channels: Channel[] = []
  let currentExtInfo: ExtInfo | null = null

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('#EXTINF:')) {
      currentExtInfo = parseExtInfo(line)
    } else if (line.startsWith('#')) {
      continue
    } else if (currentExtInfo) {
      const channel = createChannel(currentExtInfo, line, sourceId)
      channels.push(channel)
      currentExtInfo = null
    } else if (!line.startsWith('#')) {
      const channel = createChannelFromUrl(line, sourceId)
      channels.push(channel)
    }
  }

  return channels
}

function parseExtInfo(line: string): ExtInfo {
  const match = line.match(/^#EXTINF:(-?\d+)\s*(.*),(.*)$/)
  if (!match) {
    return { duration: -1, name: 'Unknown' }
  }

  const duration = parseInt(match[1], 10)
  const attributes = match[2]
  const name = match[3].trim()

  const tvgIdMatch = attributes.match(/tvg-id="([^"]*)"/)
  const tvgNameMatch = attributes.match(/tvg-name="([^"]*)"/)
  const tvgLogoMatch = attributes.match(/tvg-logo="([^"]*)"/)
  const groupTitleMatch = attributes.match(/group-title="([^"]*)"/)

  let groupTitle = groupTitleMatch?.[1]
  
  // 如果没有 group-title，根据频道名称自动分类
  if (!groupTitle) {
    groupTitle = categorizeChannel(name)
  } else {
    // 如果有的话，也进行规范化处理
    groupTitle = normalizeGroupTitle(groupTitle)
  }

  return {
    duration,
    tvgId: tvgIdMatch?.[1],
    tvgName: tvgNameMatch?.[1],
    tvgLogo: tvgLogoMatch?.[1],
    groupTitle,
    name: name || 'Unknown'
  }
}

/**
 * 根据频道名称自动分类
 */
function categorizeChannel(name: string): string {
  if (!name) return '其他频道'
  
  // 央视频道（包含 CCTV、CGTN 等）
  if (/^CCTV/i.test(name) || /^CGTN/i.test(name) || /^央视/i.test(name)) {
    return '央视频道'
  }
  
  // 卫视频道
  if (/卫视/i.test(name)) {
    return '卫视频道'
  }
  
  // 其他频道
  return '其他频道'
}

/**
 * 规范化分组名称
 */
function normalizeGroupTitle(groupTitle: string): string {
  if (!groupTitle) return '其他频道'
  
  // 央视频道相关
  if (/CCTV|CGTN|央视|CHC/i.test(groupTitle)) {
    return '央视频道'
  }
  
  // 卫视频道
  if (/卫视/i.test(groupTitle)) {
    return '卫视频道'
  }
  
  // 其他分组名称保留原样，但去除特殊字符
  return groupTitle.trim() || '其他频道'
}

function createChannel(extInfo: ExtInfo, url: string, sourceId: string): Channel {
  const now = new Date()
  const groupId = extInfo.groupTitle || '其他频道'

  return {
    id: self.crypto.randomUUID(),
    name: extInfo.name,
    url,
    groupId,
    groupName: extInfo.groupTitle || '其他频道',
    logo: extInfo.tvgLogo,
    tvgId: extInfo.tvgId,
    tvgName: extInfo.tvgName,
    isFavorite: false,
    sourceId,
    createdAt: now,
    updatedAt: now
  }
}

function createChannelFromUrl(url: string, sourceId: string): Channel {
  const now = new Date()
  const name = url.split('/').pop() || url
  
  // 根据 URL 尝试分类
  let groupName = '其他频道'
  if (/cctv/i.test(name) || /CCTV/.test(name)) {
    groupName = '央视频道'
  } else if (/卫视/i.test(name)) {
    groupName = '卫视频道'
  }

  return {
    id: self.crypto.randomUUID(),
    name,
    url,
    groupId: groupName,
    groupName,
    isFavorite: false,
    sourceId,
    createdAt: now,
    updatedAt: now
  }
}
