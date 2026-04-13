/**
 * 本地 M3U 文件缓存服务
 * 使用 localStorage 存储 M3U 内容，减少网络请求
 */

const STORAGE_PREFIX = 'lptv_m3u_cache_'
const TIMESTAMP_PREFIX = 'lptv_m3u_timestamp_'

interface CacheEntry {
  content: string
  timestamp: number
  url: string
}

/**
 * 从本地缓存获取 M3U 内容
 */
export function getCachedM3U(url: string): CacheEntry | null {
  try {
    const key = STORAGE_PREFIX + hashUrl(url)
    const timestampKey = TIMESTAMP_PREFIX + hashUrl(url)

    const content = localStorage.getItem(key)
    const timestampStr = localStorage.getItem(timestampKey)

    if (!content || !timestampStr) {
      return null
    }

    return {
      content,
      timestamp: parseInt(timestampStr, 10),
      url
    }
  } catch (error) {
    console.warn('读取本地缓存失败:', error)
    return null
  }
}

/**
 * 将 M3U 内容存储到本地缓存
 */
export function cacheM3U(url: string, content: string): void {
  try {
    const key = STORAGE_PREFIX + hashUrl(url)
    const timestampKey = TIMESTAMP_PREFIX + hashUrl(url)

    localStorage.setItem(key, content)
    localStorage.setItem(timestampKey, Date.now().toString())
    console.log(`M3U 内容已缓存: ${url}`)
  } catch (error) {
    console.warn('写入本地缓存失败:', error)
  }
}

/**
 * 清除指定 URL 的本地缓存
 */
export function clearCache(url: string): void {
  try {
    const key = STORAGE_PREFIX + hashUrl(url)
    const timestampKey = TIMESTAMP_PREFIX + hashUrl(url)

    localStorage.removeItem(key)
    localStorage.removeItem(timestampKey)
  } catch (error) {
    console.warn('清除缓存失败:', error)
  }
}

/**
 * 清除所有本地缓存
 */
export function clearAllCache(): void {
  try {
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(STORAGE_PREFIX) || key?.startsWith(TIMESTAMP_PREFIX)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
    console.log('所有 M3U 缓存已清除')
  } catch (error) {
    console.warn('清除所有缓存失败:', error)
  }
}

/**
 * 简单的 URL 哈希函数
 */
function hashUrl(url: string): string {
  let hash = 0
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}
