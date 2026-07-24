import { Channel } from '../types'

const API_BASE = '/api'

export async function fetchChannels(refresh = false): Promise<Channel[]> {
  const url = `${API_BASE}/m3u${refresh ? '?refresh=1' : ''}`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) {
    throw new Error(res.status === 502 ? 'M3U 源不可用' : `HTTP ${res.status}`)
  }
  return res.json()
}
