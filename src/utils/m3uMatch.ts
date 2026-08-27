import { IptvChannel } from '../data/iptvChannels'
import { Channel } from '../types'

/**
 * 从 iptv345 频道名提取关键词
 * 例: "CCTV1 综合" → ["CCTV1"], "CCTV5+ 体育赛事" → ["CCTV5+"]
 */
export function extractKeywords(name: string): string[] {
  return name
    .replace(/[\s（(].*$/, ' ')
    .split(/\s+/)
    .filter(k => k.length >= 2)
}

/**
 * 将 IPTV345 频道名匹配到 M3U 频道 URL（返回所有匹配的 URL）
 * 匹配策略：先尝试所有关键词都匹配，再尝试第一个关键词匹配
 */
export function matchM3uUrls(
  iptvChannel: IptvChannel,
  m3uChannels: Channel[]
): string[] {
  const keywords = extractKeywords(iptvChannel.name)
  if (keywords.length === 0) return []

  const allMatches = m3uChannels.filter(c =>
    keywords.every(kw => c.name.toLowerCase().includes(kw.toLowerCase()))
  )
  if (allMatches.length > 0) return allMatches.flatMap(c => [c.url, ...(c.urls?.filter(u => u.startsWith('http://') || u.startsWith('https://')) ?? [])])

  const firstMatches = m3uChannels.filter(c =>
    c.name.toLowerCase().includes(keywords[0].toLowerCase())
  )
  if (firstMatches.length > 0) return firstMatches.flatMap(c => [c.url, ...(c.urls?.filter(u => u.startsWith('http://') || u.startsWith('https://')) ?? [])])

  return []
}
