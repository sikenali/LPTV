export interface ChannelCheckResult {
  id: string
  name: string
  url: string
  status: 'alive' | 'dead' | 'checking' | 'unknown'
  latency: number | null
  lastChecked: string | null
}

async function checkSingleChannel(url: string, timeout: number = 10000): Promise<{ alive: boolean; latency: number | null }> {
  const startTime = performance.now()
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), timeout)

    // 使用 HEAD 请求快速检测
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal })
    const latency = Math.round(performance.now() - startTime)

    return { alive: response.ok || response.status === 200, latency }
  } catch {
    // HEAD 失败，尝试 GET 请求
    try {
      const controller = new AbortController()
      setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, { signal: controller.signal })
      const latency = Math.round(performance.now() - startTime)

      return { alive: response.ok || response.status === 200, latency }
    } catch {
      const latency = Math.round(performance.now() - startTime)
      return { alive: false, latency }
    }
  }
}

export async function checkChannel(url: string, timeout: number = 10000): Promise<{ alive: boolean; latency: number | null }> {
  return checkSingleChannel(url, timeout)
}

export async function checkAllChannels(
  channels: Array<{ id: string; name: string; url: string }>,
  timeout: number = 10000,
  concurrency: number = 5,
  onProgress?: (results: ChannelCheckResult[]) => void
): Promise<ChannelCheckResult[]> {
  const results: ChannelCheckResult[] = channels.map(ch => ({
    id: ch.id,
    name: ch.name,
    url: ch.url,
    status: 'checking',
    latency: null,
    lastChecked: null
  }))

  for (let i = 0; i < channels.length; i += concurrency) {
    const batch = channels.slice(i, i + concurrency)
    await Promise.all(
      batch.map(async (ch) => {
        const result = await checkSingleChannel(ch.url, timeout)
        const idx = results.findIndex(r => r.id === ch.id)
        if (idx !== -1) {
          results[idx].status = result.alive ? 'alive' : 'dead'
          results[idx].latency = result.latency
          results[idx].lastChecked = new Date().toISOString()
        }
      })
    )
    onProgress?.(results)
  }

  return results
}
