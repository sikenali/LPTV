interface FetchOptions { retries?: number; timeout?: number; baseDelay?: number }

export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<string> {
  const { retries = 3, timeout = 30000, baseDelay = 1000 } = options
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      const response = await fetch(url, { signal: controller.signal })
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
