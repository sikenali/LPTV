<script setup lang="ts">
import type { Source } from '@/types/source'
defineProps<{ source: Source }>()
const emit = defineEmits<{ use: [sourceId: string]; edit: [source: Source]; delete: [sourceId: string] }>()
const statusMap = { active: { label: '正常', class: 'status-active' }, error: { label: '异常', class: 'status-error' }, parsing: { label: '解析中', class: 'status-parsing' } }
</script>

<template>
  <div class="source-item">
    <div class="source-header">
      <span class="source-name">{{ source.name }}</span>
      <span class="source-status" :class="statusMap[source.status].class">{{ statusMap[source.status].label }}</span>
    </div>
    <div class="source-url">{{ source.url }}</div>
    <div class="source-footer">
      <span class="source-update-time">更新: {{ source.lastUpdateAt?.toLocaleString() ?? '未更新' }}</span>
      <div class="source-actions">
        <button class="btn btn-primary" @click="emit('use', source.id)">使用此源</button>
        <button class="btn btn-secondary" @click="emit('edit', source)">编辑</button>
        <button class="btn btn-danger" @click="emit('delete', source.id)">删除</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.source-item { background-color: var(--bg-card); border-radius: var(--radius-md); padding: var(--spacing-lg); margin-bottom: var(--spacing-md); }
.source-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm); .source-name { font-size: var(--font-size-subtitle); font-weight: 600; color: var(--text-primary); } }
.source-status { font-size: var(--font-size-caption); padding: 2px var(--spacing-sm); border-radius: var(--radius-sm); &.status-active { color: var(--success); } &.status-error { color: var(--error); } &.status-parsing { color: var(--warning); } }
.source-url { font-size: var(--font-size-caption); color: var(--text-secondary); margin-bottom: var(--spacing-md); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.source-footer { display: flex; align-items: center; justify-content: space-between; .source-update-time { font-size: var(--font-size-caption); color: var(--text-secondary); } }
.source-actions { display: flex; gap: var(--spacing-sm); }
.btn { padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-sm); font-size: var(--font-size-caption); transition: background-color var(--transition-fast);
  &.btn-primary { background-color: var(--brand-primary); color: white; &:hover { background-color: var(--brand-hover); } }
  &.btn-secondary { background-color: var(--bg-secondary); color: var(--text-secondary); &:hover { color: var(--text-primary); } }
  &.btn-danger { background: transparent; color: var(--error); &:hover { background-color: rgba(239, 68, 68, 0.1); } }
}
</style>
