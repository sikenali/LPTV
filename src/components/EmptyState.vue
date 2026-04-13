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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 40px;
  text-align: center;
  min-height: 400px;
}

.empty-icon-component {
  width: 72px;
  height: 72px;
  color: var(--text-disabled);
  margin-bottom: 20px;
  opacity: 0.35;
  transition: all var(--transition-fast);
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1.4;
}

.empty-description {
  font-size: 14px;
  color: var(--text-secondary);
  opacity: 0.7;
  line-height: 1.5;
}
</style>
