<script setup lang="ts">
import type { Channel } from '@/types/channel'
import { RiHeartFill, RiHeartLine } from '@remixicon/vue'

interface Props {
  channel: Channel
  isActive: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  select: [channel: Channel]
  toggleFavorite: [channel: Channel]
}>()
</script>

<template>
  <div class="channel-item" :class="{ active: isActive }" @click="emit('select', channel)">
    <div class="channel-info-row">
      <span class="channel-name">{{ channel.name }}</span>
      <span class="channel-spacer"></span>
      <button class="favorite-btn" @click.stop="emit('toggleFavorite', channel)">
        <RiHeartFill v-if="channel.isFavorite" class="favorite-icon" />
        <RiHeartLine v-else class="favorite-icon" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.channel-item {
  display: flex; align-items: center; padding: 12px 16px;
  border-radius: 8px; cursor: pointer;
  transition: all var(--transition-fast);
  &:hover { background-color: var(--bg-card); }
  &.active {
    background-color: rgba(59, 130, 246, 0.15);
    border-left: 3px solid var(--brand-primary);
  }
}

.channel-info-row {
  display: flex; align-items: center; width: 100%; gap: 8px;
}

.channel-name {
  font-size: 14px; color: var(--text-primary);
  flex: 1;
}

.channel-spacer { flex: 1; }

.favorite-btn {
  background: transparent; border: none; padding: 4px;
  cursor: pointer;
  transition: transform var(--transition-fast);
  &:hover { transform: scale(1.3); }
}

.favorite-icon {
  width: 18px;
  height: 18px;
  color: var(--favorite);
}
</style>
