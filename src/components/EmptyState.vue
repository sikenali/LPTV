<script setup lang="ts">
import { RiTvLine } from '@remixicon/vue'

interface Props {
  icon?: typeof RiTvLine
  title: string
  description?: string
}

withDefaults(defineProps<Props>(), { icon: () => RiTvLine })
</script>

<template>
  <div class="empty-state">
    <div class="empty-icon">
      <component :is="icon" class="empty-icon-component" />
    </div>
    <div class="empty-title">{{ title }}</div>
    <div v-if="description" class="empty-description">{{ description }}</div>
    <slot></slot>
  </div>
</template>

<style scoped lang="scss">
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: calc(var(--spacing-xl) * 4); text-align: center;
}
.empty-icon-component {
  width: 64px; height: 64px;
  color: var(--text-disabled); margin-bottom: var(--spacing-lg);
}
.empty-title {
  font-size: var(--font-size-subtitle);
  color: var(--text-disabled); margin-bottom: var(--spacing-sm);
}
.empty-description {
  font-size: var(--font-size-body);
  color: var(--text-secondary);
}
</style>
