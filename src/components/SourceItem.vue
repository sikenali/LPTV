<script setup lang="ts">
import type { Source } from '@/types/source'

interface Props {
  source: Source
  isActive: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  switch: [sourceId: string]
  edit: [source: Source]
  delete: [sourceId: string]
}>()

const statusMap: Record<string, { label: string; class: string }> = {
  active: { label: '正常', class: 'status-active' },
  error: { label: '异常', class: 'status-error' },
  parsing: { label: '解析中', class: 'status-parsing' }
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
    <span class="col-name">{{ source.name }}</span>
    <span class="col-url">{{ source.url }}</span>
    <span class="col-channels">{{ source.channelCount }}</span>
    <span class="col-update">{{ source.lastUpdateAt ? source.lastUpdateAt.toLocaleString() : '未更新' }}</span>
    <span class="col-actions">
      <template v-if="!isActive">
        <button class="action-btn btn-switch" @click="emit('switch', source.id)">切换</button>
      </template>
      <template v-else>
        <span class="current-badge">当前使用</span>
      </template>
      <button class="action-btn btn-edit" @click="emit('edit', source)">编辑</button>
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
  &:hover { background-color: var(--bg-card); }
}

.col-status { width: 70px; text-align: center; flex-shrink: 0; }
.col-name { width: 180px; font-weight: 500; flex-shrink: 0; }
.col-url { flex: 1; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.col-channels { width: 80px; text-align: center; flex-shrink: 0; }
.col-update { width: 160px; text-align: center; color: var(--text-secondary); flex-shrink: 0; font-size: 12px; }
.col-actions { width: 200px; text-align: center; display: flex; gap: 6px; justify-content: center; flex-shrink: 0; }

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
  &.btn-switch { background-color: var(--brand-primary); color: white; &:hover { background-color: var(--brand-hover); } }
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
