interface TelemetryEvent {
  type: 'play_error' | 'load_timeout' | 'url_fetch_error' | 'web_timeout';
  channel: string;
  tid: string;
  id: string;
  source: string;
  detail: string;
  ts: number;
}

const STORE_KEY = 'lptv-telemetry'
const MAX_EVENTS = 50

export function pushTelemetry(event: Omit<TelemetryEvent, 'ts'>): void {
  try {
    const stored = localStorage.getItem(STORE_KEY)
    const list: TelemetryEvent[] = stored ? JSON.parse(stored) : []
    list.push({ ...event, ts: Date.now() })
    if (list.length > MAX_EVENTS) list.splice(0, list.length - MAX_EVENTS)
    localStorage.setItem(STORE_KEY, JSON.stringify(list))
  } catch { /* ignore */ }
}

export function flushTelemetry(onSend?: (events: TelemetryEvent[]) => void): void {
  try {
    const stored = localStorage.getItem(STORE_KEY)
    if (!stored) return
    const list: TelemetryEvent[] = JSON.parse(stored)
    if (list.length === 0) return
    localStorage.removeItem(STORE_KEY)
    onSend?.(list)
  } catch { /* ignore */ }
}
