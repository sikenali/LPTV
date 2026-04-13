import type { Channel } from '@/types/channel'
import { randomUUID } from 'crypto'

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

  return {
    duration,
    tvgId: tvgIdMatch?.[1],
    tvgName: tvgNameMatch?.[1],
    tvgLogo: tvgLogoMatch?.[1],
    groupTitle: groupTitleMatch?.[1] || '未分组',
    name: name || 'Unknown'
  }
}

function createChannel(extInfo: ExtInfo, url: string, sourceId: string): Channel {
  const now = new Date()
  const groupId = extInfo.groupTitle || '未分组'

  return {
    id: randomUUID(),
    name: extInfo.name,
    url,
    groupId,
    groupName: extInfo.groupTitle || '未分组',
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

  return {
    id: randomUUID(),
    name,
    url,
    groupId: '未分组',
    groupName: '未分组',
    isFavorite: false,
    sourceId,
    createdAt: now,
    updatedAt: now
  }
}
