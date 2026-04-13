import type { UpdateRule, IntervalUnit } from '@/types/source'
import * as updateRulesQueries from '@/db/queries/updateRules'

type TaskCallback = (sourceId: string) => Promise<void>

class Scheduler {
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private callback: TaskCallback | null = null

  setCallback(callback: TaskCallback) { this.callback = callback }

  scheduleRule(rule: UpdateRule) {
    this.cancelRule(rule.sourceId)
    const intervalMs = this.toMilliseconds(rule.interval, rule.intervalUnit)
    const delay = Math.max(0, rule.nextUpdateAt.getTime() - Date.now())
    const timer = setTimeout(() => {
      this.executeRule(rule.sourceId)
      const nextTime = new Date(Date.now() + intervalMs)
      updateRulesQueries.updateRuleNextUpdateAt(rule.sourceId, nextTime)
      if (rule.enabled) this.scheduleRule({ ...rule, nextUpdateAt: nextTime })
    }, delay)
    this.timers.set(rule.sourceId, timer)
  }

  cancelRule(sourceId: string) {
    const timer = this.timers.get(sourceId)
    if (timer) { clearTimeout(timer); this.timers.delete(sourceId) }
  }

  startAll(rules: UpdateRule[]) { for (const rule of rules) { if (rule.enabled) this.scheduleRule(rule) } }
  stopAll() { for (const [sourceId] of this.timers) this.cancelRule(sourceId) }

  private async executeRule(sourceId: string) {
    if (this.callback) { try { await this.callback(sourceId) } catch (error) { console.error(`Scheduler: Failed to update source ${sourceId}:`, error) } }
  }

  private toMilliseconds(interval: number, unit: IntervalUnit): number {
    switch (unit) {
      case 'minute': return interval * 60 * 1000
      case 'hour': return interval * 60 * 60 * 1000
      case 'day': return interval * 24 * 60 * 60 * 1000
      case 'week': return interval * 7 * 24 * 60 * 60 * 1000
    }
  }
}

export const scheduler = new Scheduler()
