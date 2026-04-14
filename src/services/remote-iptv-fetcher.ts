/**
 * 远程直播源爬虫服务
 * 从 GitHub 仓库抓取并解析 m3u/m3u8 直播源
 */

import type { Channel } from '@/types/channel'

// 远程直播源仓库配置
const IPTV_REPOS = [
  {
    name: 'Collect-IPTV',
    m3uUrl: 'https://raw.githubusercontent.com/zilong7728/Collect-IPTV/refs/heads/main/best_sorted.m3u',
    description: '自动生成的 IPTV 直播源（每4小时更新）'
  }
]

/**
 * 解析 M3U 文件内容为频道列表
 */
function parseM3U(content: string): Channel[] {
  const channels: Channel[] = []
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)

  let currentName = ''
  let currentGroup = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 解析 #EXTINF 行
    if (line.startsWith('#EXTINF:')) {
      // 提取频道名称（最后一个逗号后的内容）
      const commaIdx = line.lastIndexOf(',')
      if (commaIdx !== -1) {
        currentName = line.substring(commaIdx + 1).trim()
      }

      // 提取分组
      const groupMatch = line.match(/group-title="([^"]*)"/)
      if (groupMatch) {
        currentGroup = groupMatch[1]
      }
    }
    // 解析 URL 行
    else if (line.startsWith('http://') || line.startsWith('https://')) {
      if (currentName) {
        channels.push({
          id: `remote_${Date.now()}_${i}`,
          name: currentName,
          url: line,
          groupId: currentGroup || 'default',
          groupName: currentGroup || '未分组',
          logo: '',
          tvgId: '',
          tvgName: currentName,
          isFavorite: false,
          sourceId: 'remote_import',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        currentName = ''
        currentGroup = ''
      }
    }
  }

  return channels
}

/**
 * 从远程仓库抓取直播源
 */
export async function fetchRemoteIPTV(): Promise<{ channels: Channel[]; sourceName: string }> {
  const repo = IPTV_REPOS[0] // 使用第一个仓库

  try {
    console.log(`正在抓取远程直播源: ${repo.name}`)

    const response = await fetch(repo.m3uUrl)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const content = await response.text()
    const channels = parseM3U(content)

    console.log(`成功抓取 ${channels.length} 个频道`)

    return {
      channels,
      sourceName: repo.name
    }
  } catch (error) {
    console.error('抓取远程直播源失败:', error)
    throw error
  }
}

/**
 * 获取所有可用的远程直播源仓库信息
 */
export function getIPTVRepos() {
  return IPTV_REPOS
}
