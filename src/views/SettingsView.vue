<script setup lang="ts">
import { ref } from 'vue'
import SourceItem from '@/components/SourceItem.vue'
import ImportSourceModal from '@/components/ImportSourceModal.vue'
import type { Source } from '@/types/source'

const activeTab = ref<'source' | 'schedule'>('source')
const showImportModal = ref(false)
const sources = ref<Source[]>([
  { id: 'source-1', name: '我的直播源', url: 'http://example.com/live.m3u', type: 'url', status: 'active', channelCount: 50, lastUpdateAt: new Date('2026-04-13T10:00:00'), createdAt: new Date('2026-04-10T09:00:00') }
])
const updateInterval = ref('6')
const handleImport = (data: { name: string; url: string; type: 'url' | 'file' }) => {
  const newSource: Source = { id: `source-${Date.now()}`, name: data.name, url: data.url, type: data.type, status: 'parsing', channelCount: 0, lastUpdateAt: null, createdAt: new Date() }
  sources.value.push(newSource)
}
const handleDelete = (sourceId: string) => { sources.value = sources.value.filter(s => s.id !== sourceId) }
</script>

<template>
  <div class="settings-view">
    <aside class="settings-sidebar">
      <button class="menu-item" :class="{ active: activeTab === 'source' }" @click="activeTab = 'source'">源管理</button>
      <button class="menu-item" :class="{ active: activeTab === 'schedule' }" @click="activeTab = 'schedule'">定时更新</button>
    </aside>
    <main class="settings-main">
      <div v-if="activeTab === 'source'" class="source-panel">
        <button class="btn-add" @click="showImportModal = true">+ 导入源</button>
        <SourceItem v-for="source in sources" :key="source.id" :source="source" @delete="handleDelete" />
      </div>
      <div v-else class="schedule-panel">
        <div class="schedule-card">
          <h3 class="schedule-title">全局更新设置</h3>
          <div class="form-group"><label>更新周期</label>
            <select v-model="updateInterval" class="select">
              <option value="1">每 1 小时</option><option value="6">每 6 小时</option>
              <option value="24">每天</option><option value="168">每周</option>
            </select>
          </div>
          <div class="schedule-info"><div>下次自动更新: 2026-04-13 16:00</div><div>上次更新: 2026-04-13 10:00</div></div>
          <div class="schedule-actions">
            <button class="btn btn-secondary">立即更新</button>
            <button class="btn btn-primary">保存设置</button>
          </div>
        </div>
      </div>
    </main>
    <ImportSourceModal :visible="showImportModal" @close="showImportModal = false" @import="handleImport" />
  </div>
</template>

<style scoped lang="scss">
.settings-view { display: flex; height: 100%; }
.settings-sidebar { width: 200px; background-color: var(--bg-secondary); padding: var(--spacing-md) 0; }
.menu-item { width: 100%; padding: var(--spacing-md) var(--spacing-lg); text-align: left; background: transparent; color: var(--text-secondary); transition: all var(--transition-fast); position: relative; &:hover { background-color: var(--bg-card); } &.active { background-color: var(--bg-card); color: var(--brand-primary); border-left: 3px solid var(--brand-primary); } }
.settings-main { flex: 1; padding: var(--spacing-xl); overflow-y: auto; }
.btn-add { padding: var(--spacing-md) var(--spacing-lg); background-color: var(--brand-primary); color: white; border-radius: var(--radius-sm); margin-bottom: var(--spacing-lg); &:hover { background-color: var(--brand-hover); } }
.schedule-card { background-color: var(--bg-card); border-radius: var(--radius-md); padding: var(--spacing-xl); }
.schedule-title { font-size: var(--font-size-subtitle); font-weight: 600; margin-bottom: var(--spacing-lg); }
.form-group { margin-bottom: var(--spacing-lg); label { display: block; font-size: var(--font-size-caption); color: var(--text-secondary); margin-bottom: var(--spacing-xs); } }
.select { width: 100%; padding: var(--spacing-md); background-color: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary); }
.schedule-info { font-size: var(--font-size-caption); color: var(--text-secondary); margin-bottom: var(--spacing-lg); div { margin-bottom: var(--spacing-xs); } }
.schedule-actions { display: flex; gap: var(--spacing-md); .btn { padding: var(--spacing-md) var(--spacing-xl); border-radius: var(--radius-sm); &.btn-primary { background-color: var(--brand-primary); color: white; &:hover { background-color: var(--brand-hover); } } &.btn-secondary { background-color: var(--bg-secondary); color: var(--text-secondary); &:hover { color: var(--text-primary); } } } }
</style>
