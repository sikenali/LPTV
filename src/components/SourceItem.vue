<script setup lang="ts">
import type { Source } from '@/types/source'
import { useScheduleSettingsStore } from '@/stores/schedule-settings'

interface Props {
  source: Source
  isActive: boolean
}

defineProps<Props>()

const scheduleSettings = useScheduleSettingsStore()

const emit = defineEmits<{
  switch: [sourceId: string]
  edit: [source: Source]
  delete: [sourceId: string]
  update: [sourceId: string]
}>()

const statusMap: Record<string, { label: string; class: string }> = {
  active: { label: '正常', class: 'status-active' },
  error: { label: '异常', class: 'status-error' },
  parsing: { label: '解析中', class: 'status-parsing' }
}

// 辅助函数：频率标签映射
function frequencyLabel(freq: string): string {
  const map: Record<string, string> = { '1h': '每小时', '6h': '每6小时', '12h': '每12小时', '24h': '每天', '7d': '每周' }
  return map[freq] || freq
}

// 辅助函数：频率转毫秒
function frequencyToMs(freq: string): number {
  const map: Record<string, number> = { '1h': 3600000, '6h': 21600000, '12h': 43200000, '24h': 86400000, '7d': 604800000 }
  return map[freq] || 21600000
}

// 辅助函数：格式化下次更新时间
function formatNextUpdate(lastUpdate: Date | null, frequency: string): string {
  if (!lastUpdate) return '未更新'
  const next = new Date(new Date(lastUpdate).getTime() + frequencyToMs(frequency))
  return `下次: ${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div class="source-row" :class="{ active: isActive }">
    <span class="col-status">
      <span class="status-badge" :class="statusMap[source.status].class">
        <span class="status-dot"></span>
        {{ statusMap[source.status].label }}
      </span>
    </span>
    <span class="col-name">
      {{ source.name }}
      <span class="source-type-badge" :class="source.type === 'url' ? 'type-url' : 'type-file'">
        {{ source.type === 'url' ? 'URL' : '本地' }}
      </span>
    </span>
    <span class="col-url">{{ source.url }}</span>
    <span class="col-channels">{{ source.channelCount }}</span>
    <span class="col-schedule">
      <div class="schedule-info">
        <span class="freq-tag">{{ frequencyLabel(scheduleSettings.perSource[source.id]?.frequency ?? scheduleSettings.frequency) }}</span>
        <span class="next-update">{{ formatNextUpdate(source.lastUpdateAt, scheduleSettings.perSource[source.id]?.frequency ?? scheduleSettings.frequency) }}</span>
      </div>
    </span>
    <span class="col-update">{{ source.lastUpdateAt ? new Date(source.lastUpdateAt).toLocaleString() : '未更新' }}</span>
    <span class="col-actions">
      <template v-if="!isActive">
        <button class="action-btn btn-switch" @click="emit('switch', source.id)">切换</button>
      </template>
      <template v-else>
        <span class="current-badge">当前使用</span>
      </template>
      <button class="action-btn btn-edit" @click="emit('edit', source)">编辑</button>
      <button class="action-btn btn-update" @click="emit('update', source.id)">更新</button>
      <button class="action-btn btn-delete" @click="emit('delete', source.id)">删除</button>
    </span>
  </div>
</template>

<style scoped lang="scss">
.source-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  transition: all var(--transition-fast);
  font-size: 13px;
  color: var(--text-primary);
  border: 1px solid transparent;
  &.active {
    background-color: rgba(59, 130, 246, 0.08);
    border-color: rgba(59, 130, 246, 0.2);
  }
  &:hover {
    background-color: var(--bg-card);
    border-color: var(--border-color);
  }
}

.col-status { width: 70px; text-align: center; flex-shrink: 0; }
.col-name { width: 160px; font-weight: 500; flex-shrink: 0; display: flex; align-items: center; gap: 8px; }
.col-url { flex: 1; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.col-channels { width: 70px; text-align: center; flex-shrink: 0; }
.col-schedule { width: 180px; flex-shrink: 0; }
.col-update { width: 140px; text-align: center; color: var(--text-secondary); flex-shrink: 0; font-size: 12px; opacity: 0.8; }
.col-actions { width: 220px; text-align: center; display: flex; gap: 6px; justify-content: center; flex-shrink: 0; }

.schedule-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.freq-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 500;
  background-color: rgba(59, 130, 246, 0.12);
  color: var(--brand-primary);
}

.next-update {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.7;
}

.source-type-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  &.type-url {
    background-color: rgba(59, 130, 246, 0.12);
    color: var(--brand-primary);
  }
  &.type-file {
    background-color: rgba(34, 197, 94, 0.12);
    color: var(--success);
  }
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  &.status-active { background-color: rgba(34, 197, 94, 0.12); color: var(--success); }
  &.status-error { background-color: rgba(239, 68, 68, 0.12); color: var(--error); }
  &.status-parsing { background-color: rgba(234, 179, 8, 0.12); color: var(--warning); }
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
}

.action-btn {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  background: transparent;
  transition: all var(--transition-fast);
  white-space: nowrap;
  &:active { transform: scale(0.95); }
  &.btn-switch { background-color: var(--brand-primary); color: white; &:hover { background-color: var(--brand-hover); } }
  &.btn-update { background-color: var(--success); color: white; &:hover { opacity: 0.9; } }
  &.btn-edit { color: var(--text-secondary); &:hover { color: var(--text-primary); background-color: var(--bg-card); } }
  &.btn-delete { color: var(--error); &:hover { background-color: rgba(239, 68, 68, 0.1); } }
}

.current-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 20px;
  background-color: rgba(59, 130, 246, 0.12);
  color: var(--brand-primary);
  font-size: 12px;
  font-weight: 500;
}
</style>
