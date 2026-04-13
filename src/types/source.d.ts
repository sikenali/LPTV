export type SourceType = 'url' | 'file'
export type SourceStatus = 'active' | 'error' | 'parsing'
export type IntervalUnit = 'minute' | 'hour' | 'day' | 'week'

export interface Source {
  id: string
  name: string
  url: string
  type: SourceType
  status: SourceStatus
  channelCount: number
  lastUpdateAt: Date | null
  lastError?: string
  createdAt: Date
}

export interface UpdateRule {
  id: string
  sourceId: string
  interval: number
  intervalUnit: IntervalUnit
  nextUpdateAt: Date
  enabled: boolean
}
