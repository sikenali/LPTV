import { IptvChannel } from '../data/iptvChannels'
import { Channel } from '../types'

const SUFFIXES = ['频道', '电视台', '电视', '卫视', '电视网']

function normalizeName(name: string): string {
  let n = name
  for (const suffix of SUFFIXES) {
    if (n.endsWith(suffix)) {
      n = n.slice(0, -suffix.length)
      break
    }
  }
  return n
}

/**
 * 从 iptv345 频道名提取关键词
 * 例: "CCTV1 综合" → ["CCTV1"], "CCTV5+ 体育赛事" → ["CCTV5+"]
 * 纯中文无空格名（如"广东珠江频道"）提取双字子串用于匹配
 */
export function extractKeywords(name: string): string[] {
  const keywords: string[] = []
  name
    .replace(/[\s（(].*$/, ' ')
    .split(/\s+/)
    .forEach(word => {
      if (word.length >= 2) keywords.push(word)
    })
  if (keywords.length === 0) {
    for (let i = 0; i < name.length - 1; i++) {
      keywords.push(name.substring(i, i + 2))
    }
  }
  return keywords
}

/**
 * 将 IPTV345 频道名匹配到 M3U 频道 URL（返回所有匹配的 URL）
 * 匹配策略：
 *  1. 所有关键词都匹配
 *  2. 仅第一个关键词匹配
 *  3. 归一化名称（去除"频道/卫视/电视台"等后缀）匹配
 */
export function matchM3uUrls(
  iptvChannel: IptvChannel,
  m3uChannels: Channel[]
): string[] {
  const keywords = extractKeywords(iptvChannel.name)
  if (keywords.length === 0) return []

  const allMatches = m3uChannels.filter(c =>
    keywords.some(kw => c.name.toLowerCase().includes(kw.toLowerCase()))
  )
  if (allMatches.length > 0) return allMatches.flatMap(c => [c.url, ...(c.urls ?? [])])

  const firstMatches = m3uChannels.filter(c =>
    c.name.toLowerCase().includes(keywords[0].toLowerCase())
  )
  if (firstMatches.length > 0) return firstMatches.flatMap(c => [c.url, ...(c.urls ?? [])])

  const normDefined = normalizeName(iptvChannel.name)
  const normMatches = m3uChannels.filter(c => normalizeName(c.name) === normDefined)
  if (normMatches.length > 0) return normMatches.flatMap(c => [c.url, ...(c.urls ?? [])])

  return []
}
