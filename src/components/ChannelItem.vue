<script setup lang="ts">
import type { Channel } from '@/types/channel'
interface Props { channel: Channel; isActive: boolean }
defineProps<Props>()
const emit = defineEmits<{ select: [channel: Channel]; toggleFavorite: [channel: Channel] }>()
</script>

<template>
  <div class="channel-item" :class="{ active: isActive }" @click="emit('select', channel)">
    <span class="channel-name">{{ channel.name }}</span>
    <button class="favorite-btn" @click.stop="emit('toggleFavorite', channel)">
      {{ channel.isFavorite ? '❤️' : '🤍' }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.channel-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg); cursor: pointer;
  transition: background-color var(--transition-fast);
  &:hover { background-color: #333333; }
  &.active { background-color: var(--bg-card); border-left: 3px solid var(--brand-primary); }
  .channel-name { font-size: var(--font-size-body); color: var(--text-primary); }
  .favorite-btn { background: transparent; padding: var(--spacing-xs); font-size: 16px; transition: transform var(--transition-fast);
    &:hover { transform: scale(1.2); }
  }
}
</style>
