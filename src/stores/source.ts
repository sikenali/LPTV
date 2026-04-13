import { defineStore } from 'pinia'
import type { Source, UpdateRule } from '@/types/source'

export const useSourceStore = defineStore('source', {
  state: () => ({ sources: [] as Source[], activeSourceId: null as string | null, updateRules: new Map<string, UpdateRule>(), lastUpdateTime: null as Date | null }),
  actions: {
    setSources(sources: Source[]) { this.sources = sources },
    addSourceLocal(source: Source) { this.sources.push(source) },
    removeSourceLocal(sourceId: string) { this.sources = this.sources.filter(s => s.id !== sourceId) },
    setActiveSource(sourceId: string) { this.activeSourceId = sourceId },
    setUpdateRule(rule: UpdateRule) { this.updateRules.set(rule.sourceId, rule) }
  }
})
