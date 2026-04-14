import { useScheduleSettingsStore, type ScheduleHistoryEntry } from '@/stores/schedule-settings'
import { reloadSource } from '@/services/source-loader'
import { getSourceById, getAllSources } from '@/db/queries/sources'

let globalTimerId: number | null = null

function frequencyToMs(freq: string): number {
  const map: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000
  }
  return map[freq] || 6 * 60 * 60 * 1000
}

function shouldUpdate(lastUpdateAt: Date | null, frequency: string): boolean {
  if (!lastUpdateAt) return true
  const elapsed = Date.now() - new Date(lastUpdateAt).getTime()
  return elapsed > frequencyToMs(frequency)
}

async function checkConnectionType(): Promise<boolean> {
  const conn = (navigator as any).connection
  if (!conn) return true
  return conn.type !== 'cellular'
}

function sendNotification(title: string, status: string, message: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`[LPTV] ${title}`, {
      body: `${status}: ${message}`,
      icon: '/logo.svg'
    })
  }
}

export async function executeSourceUpdate(sourceId: string): Promise<void> {
  const store = useScheduleSettingsStore()
  const source = getSourceById(sourceId)
  if (!source) return

  const startTime = new Date().toISOString()
  try {
    const success = await reloadSource(sourceId)
    const updatedSource = getSourceById(sourceId)

    const entry: ScheduleHistoryEntry = {
      id: self.crypto.randomUUID(),
      sourceId,
      sourceName: source.name,
      timestamp: startTime,
      status: success ? 'success' : 'failed',
      channelCount: updatedSource?.channelCount || 0,
      message: success ? `成功更新 ${updatedSource?.channelCount || 0} 个频道` : '更新失败'
    }
    store.addHistory(entry)

    if (store.notification) {
      sendNotification(source.name, entry.status === 'success' ? '更新成功' : '更新失败', entry.message)
    }
  } catch (error: any) {
    const entry: ScheduleHistoryEntry = {
      id: self.crypto.randomUUID(),
      sourceId,
      sourceName: source.name || sourceId,
      timestamp: startTime,
      status: 'failed',
      channelCount: 0,
      message: error?.message || '未知错误'
    }
    store.addHistory(entry)
  }
}

export async function updateAllEnabledSources(): Promise<void> {
  const sources = getAllSources()
  const store = useScheduleSettingsStore()

  for (const source of sources) {
    const perSource = store.perSource[source.id]
    if (perSource?.enabled) {
      await executeSourceUpdate(source.id)
    } else if (store.globalEnabled) {
      await executeSourceUpdate(source.id)
    }
  }
}

export function initScheduleManager(): void {
  const store = useScheduleSettingsStore()

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }

  checkAndUpdateOnStartup()

  if (store.globalEnabled) {
    registerGlobalTimer()
  }
}

export function destroyScheduleManager(): void {
  if (globalTimerId !== null) {
    clearInterval(globalTimerId)
    globalTimerId = null
  }
}

async function checkAndUpdateOnStartup(): Promise<void> {
  const sources = getAllSources()
  const store = useScheduleSettingsStore()

  for (const source of sources) {
    const perSource = store.perSource[source.id]
    const frequency = perSource?.enabled ? perSource.frequency : store.frequency
    const lastUpdate = source.lastUpdateAt

    if (shouldUpdate(lastUpdate, frequency)) {
      await executeSourceUpdate(source.id)
    }
  }
}

function registerGlobalTimer(): void {
  const store = useScheduleSettingsStore()
  const interval = frequencyToMs(store.frequency)

  if (globalTimerId !== null) clearInterval(globalTimerId)
  globalTimerId = window.setInterval(async () => {
    if (store.wifiOnly) {
      const isWifi = await checkConnectionType()
      if (!isWifi) return
    }
    await updateAllEnabledSources()
  }, interval)
}

export function rescheduleTimer(): void {
  destroyScheduleManager()
  const store = useScheduleSettingsStore()
  if (store.globalEnabled) {
    registerGlobalTimer()
  }
}
