import { getDatabase } from '@/db/database'
import type { UpdateRule, IntervalUnit } from '@/types/source'

export function insertUpdateRule(rule: UpdateRule): void {
  const db = getDatabase()
  db.run(
    `INSERT OR REPLACE INTO update_rules
     (id, source_id, interval, interval_unit, next_update_at, enabled)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      rule.id,
      rule.sourceId,
      rule.interval,
      rule.intervalUnit,
      rule.nextUpdateAt.toISOString(),
      rule.enabled ? 1 : 0
    ]
  )
}

export function getUpdateRuleBySourceId(sourceId: string): UpdateRule | null {
  const db = getDatabase()
  const result = db.exec('SELECT * FROM update_rules WHERE source_id = ?', [sourceId])

  if (result.length === 0 || result[0].values.length === 0) {
    return null
  }

  const columns = result[0].columns
  const row = result[0].values[0]
  const obj = Object.fromEntries(columns.map((col, i) => [col, row[i]]))

  return {
    id: obj.id as string,
    sourceId: obj.source_id as string,
    interval: obj.interval as number,
    intervalUnit: obj.interval_unit as IntervalUnit,
    nextUpdateAt: new Date(obj.next_update_at as string),
    enabled: (obj.enabled as number) === 1
  }
}

export function getAllEnabledUpdateRules(): UpdateRule[] {
  const db = getDatabase()
  const result = db.exec('SELECT * FROM update_rules WHERE enabled = 1')

  if (result.length === 0 || result[0].values.length === 0) {
    return []
  }

  const columns = result[0].columns
  return result[0].values.map(row => {
    const obj = Object.fromEntries(columns.map((col, i) => [col, row[i]]))
    return {
      id: obj.id as string,
      sourceId: obj.source_id as string,
      interval: obj.interval as number,
      intervalUnit: obj.interval_unit as IntervalUnit,
      nextUpdateAt: new Date(obj.next_update_at as string),
      enabled: (obj.enabled as number) === 1
    }
  })
}

export function updateRuleNextUpdateAt(sourceId: string, date: Date): void {
  const db = getDatabase()
  db.run('UPDATE update_rules SET next_update_at = ? WHERE source_id = ?', [
    date.toISOString(),
    sourceId
  ])
}

export function deleteUpdateRule(sourceId: string): void {
  const db = getDatabase()
  db.run('DELETE FROM update_rules WHERE source_id = ?', [sourceId])
}
