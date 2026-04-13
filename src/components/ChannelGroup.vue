<script setup lang="ts">
import type { Channel } from '@/types/channel'
import ChannelItem from './ChannelItem.vue'
interface Props { groupName: string; channelCount: number; channels: Channel[]; isExpanded: boolean; currentChannelId: string | null }
defineProps<Props>()
const emit = defineEmits<{ toggle: []; select: [channel: Channel]; toggleFavorite: [channel: Channel] }>()
</script>

<template>
  <div class="channel-group">
    <div class="group-header" @click="emit('toggle')">
      <span class="group-arrow">{{ isExpanded ? '▼' : '▶' }}</span>
      <span class="group-name">{{ groupName }}</span>
      <span class="group-count">({{ channelCount }})</span>
    </div>
    <div v-if="isExpanded" class="group-content">
      <ChannelItem v-for="channel in channels" :key="channel.id" :channel="channel" :is-active="channel.id === currentChannelId"
        @select="(ch) => emit('select', ch)" @toggle-favorite="(ch) => emit('toggleFavorite', ch)" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.channel-group { border-bottom: 1px solid var(--border-color); }
.group-header { display: flex; align-items: center; padding: var(--spacing-md) var(--spacing-lg); cursor: pointer; transition: background-color var(--transition-fast);
  &:hover { background-color: var(--bg-card); }
  .group-arrow { margin-right: var(--spacing-sm); font-size: var(--font-size-caption); color: var(--text-secondary); }
  .group-name { font-size: var(--font-size-subtitle); font-weight: 600; color: var(--text-primary); }
  .group-count { margin-left: var(--spacing-sm); font-size: var(--font-size-caption); color: var(--text-secondary); }
}
</style>
