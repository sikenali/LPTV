import { defineStore } from 'pinia'

export type UpdateFrequency = '1h' | '6h' | '12h' | '24h' | '7d'

export interface SourceSchedule {
  enabled: boolean
  frequency: UpdateFrequency
  time: string
}

export interface ScheduleHistoryEntry {
  id: string
  sourceId: string
  sourceName: string
  timestamp: string
  status: 'success' | 'failed' | 'partial'
  channelCount: number
  message: string
}

interface ScheduleSettings {
  globalEnabled: boolean
  frequency: UpdateFrequency
  time: string
  retries: number
  notification: boolean
  wifiOnly: boolean
  perSource: Record<string, SourceSchedule>
  history: ScheduleHistoryEntry[]
}

const STORAGE_KEY = 'lptv_schedule_settings'
const MAX_HISTORY = 50

function loadDefaults(): ScheduleSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return {
    globalEnabled: true,
    frequency: '6h',
    time: '03:00',
    retries: 3,
    notification: true,
    wifiOnly: false,
    perSource: {},
    history: []
  }
}

export const useScheduleSettingsStore = defineStore('scheduleSettings', {
  state: () => loadDefaults(),
  actions: {
    setGlobalEnabled(enabled: boolean) {
      this.globalEnabled = enabled
      this._save()
    },
    setFrequency(frequency: UpdateFrequency) {
      this.frequency = frequency
      this._save()
    },
    setTime(time: string) {
      this.time = time
      this._save()
    },
    setRetries(retries: number) {
      this.retries = retries
      this._save()
    },
    setNotification(notification: boolean) {
      this.notification = notification
      this._save()
    },
    setWifiOnly(wifiOnly: boolean) {
      this.wifiOnly = wifiOnly
      this._save()
    },
    setSourceSchedule(sourceId: string, schedule: SourceSchedule) {
      this.perSource[sourceId] = schedule
      this._save()
    },
    addHistory(entry: ScheduleHistoryEntry) {
      this.history.unshift(entry)
      if (this.history.length > MAX_HISTORY) {
        this.history = this.history.slice(0, MAX_HISTORY)
      }
      this._save()
    },
    clearHistory() {
      this.history = []
      this._save()
    },
    _save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        globalEnabled: this.globalEnabled,
        frequency: this.frequency,
        time: this.time,
        retries: this.retries,
        notification: this.notification,
        wifiOnly: this.wifiOnly,
        perSource: this.perSource,
        history: this.history
      }))
    }
  }
})
