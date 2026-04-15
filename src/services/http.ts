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
  const { retries = 3, timeout = 60000, baseDelay = 1000 } = options
  const targetUrl = toProxyUrl(url)
  let lastError: Error | null = null
  
  console.log(`[HTTP] 尝试获取: ${targetUrl === url ? url : '通过代理: ' + url}`)
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`[HTTP] 尝试 ${attempt + 1}/${retries + 1}...`)
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'text/plain,application/octet-stream,*/*;q=0.9',
        }
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const text = await response.text()
      console.log(`[HTTP] 成功获取，大小: ${(text.length / 1024).toFixed(2)} KB`)
      return text
    } catch (error: any) {
      lastError = error
      
      if (error.name === 'AbortError') {
        console.warn(`[HTTP] 请求超时 (${timeout}ms)`)
        throw new Error(`请求超时 (${timeout}ms)，请检查网络连接或代理配置`)
      }
      
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt)
        console.warn(`[HTTP] 失败，${delay}ms 后重试...`, error.message)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError ?? new Error('Unknown error')
}
