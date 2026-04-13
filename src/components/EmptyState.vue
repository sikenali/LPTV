<script setup lang="ts">
interface Props { icon?: string; title: string; description?: string }
withDefaults(defineProps<Props>(), { icon: '📺' })
</script>

<template>
  <div class="empty-state">
    <div class="empty-icon">{{ icon }}</div>
    <div class="empty-title">{{ title }}</div>
    <div v-if="description" class="empty-description">{{ description }}</div>
    <slot></slot>
  </div>
</template>

<style scoped lang="scss">
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: calc(var(--spacing-xl) * 4); text-align: center; }
.empty-icon { font-size: 64px; color: var(--border-color); margin-bottom: var(--spacing-lg); }
.empty-title { font-size: var(--font-size-subtitle); color: var(--text-disabled); margin-bottom: var(--spacing-sm); }
.empty-description { font-size: var(--font-size-body); color: var(--text-secondary); }
</style>
