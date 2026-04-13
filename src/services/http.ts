interface FetchOptions { retries?: number; timeout?: number; baseDelay?: number }

/**
 * 将外部 URL 转换为代理路径（仅开发环境）
 */
export function toProxyUrl(url: string): string {
  if (!import.meta.env.DEV) return url
  // 保持相对路径不变
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return url
  return `/api/proxy?url=${encodeURIComponent(url)}`
}

/**
 * 判断 URL 是否为外部地址
 */
export function isExternalUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<string> {
  const { retries = 3, timeout = 30000, baseDelay = 1000 } = options
  const targetUrl = toProxyUrl(url)
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      const response = await fetch(targetUrl, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      return await response.text()
    } catch (error: any) {
      lastError = error
      if (error.name === 'AbortError') throw new Error('请求超时')
      if (attempt < retries) await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt)))
    }
  }
  throw lastError ?? new Error('Unknown error')
}
