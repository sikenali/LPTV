<script setup lang="ts">
import type { Channel } from '@/types/channel'
defineProps<{ channel: Channel }>()
const emit = defineEmits<{ remove: [channelId: string]; play: [channel: Channel] }>()
</script>

<template>
  <div class="favorite-card" @click="emit('play', channel)">
    <div class="card-content">
      <div class="channel-name">{{ channel.name }}</div>
      <button class="favorite-icon" @click.stop="emit('remove', channel.id)">❤️</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.favorite-card { background-color: var(--bg-card); border-radius: var(--radius-md); padding: var(--spacing-lg); cursor: pointer; transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  &:hover { transform: translateY(-2px); box-shadow: var(--shadow-card); }
  .card-content { display: flex; align-items: center; justify-content: space-between; }
  .channel-name { font-size: var(--font-size-subtitle); font-weight: 600; color: var(--text-primary); }
  .favorite-icon { background: transparent; font-size: 20px; padding: var(--spacing-xs); transition: transform var(--transition-fast); &:hover { transform: scale(1.2); } }
}
</style>
