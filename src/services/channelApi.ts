import { Channel } from '../types'

const API_BASE = '/api'

export async function fetchChannels(refresh = false): Promise<Channel[]> {
  const url = `${API_BASE}/m3u${refresh ? '?refresh=1' : ''}`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) {
    const text = await res.text()
    if (text.includes('sys/login') || text.includes('login')) {
      throw new Error('请先在微服平台登录，然后刷新页面重试')
    }
    throw new Error(`HTTP ${res.status}: ${text.substring(0, 100)}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('json')) {
    const text = await res.text()
    if (text.includes('sys/login') || text.includes('login')) {
      throw new Error('请先在微服平台登录，然后刷新页面重试')
    }
    throw new Error('API 返回了非 JSON 数据，请检查网络连接')
  }
  return res.json()
}
