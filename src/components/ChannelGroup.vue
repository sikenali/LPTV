<script setup lang="ts">
import type { Channel } from '@/types/channel'
import ChannelItem from './ChannelItem.vue'

interface Props {
  groupName: string
  channelCount: number
  channels: Channel[]
  isExpanded: boolean
  currentChannelId: string | null
}

defineProps<Props>()

const emit = defineEmits<{
  toggle: []
  select: [channel: Channel]
  toggleFavorite: [channel: Channel]
}>()
</script>

<template>
  <div class="channel-group">
    <div class="group-header" @click="emit('toggle')">
      <div class="group-title-row">
        <span class="group-arrow">{{ isExpanded ? '▼' : '▶' }}</span>
        <span class="group-name">{{ groupName }}</span>
        <span class="group-count">({{ channelCount }})</span>
      </div>
    </div>
    <div v-if="isExpanded" class="group-content">
      <ChannelItem
        v-for="channel in channels"
        :key="channel.id"
        :channel="channel"
        :is-active="channel.id === currentChannelId"
        @select="(ch) => emit('select', ch)"
        @toggle-favorite="(ch) => emit('toggleFavorite', ch)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.channel-group {
  margin-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 8px;
}

.group-header {
  cursor: pointer;
  padding: 8px 0;
  transition: opacity var(--transition-fast);
  &:hover { opacity: 0.8; }
}

.group-title-row {
  display: flex; align-items: center; gap: 8px;
}

.group-arrow {
  font-size: 11px; color: var(--text-secondary);
  transition: transform var(--transition-normal);
}

.group-name {
  font-size: 16px; font-weight: 600; color: var(--text-primary);
}

.group-count {
  font-size: 13px; color: var(--text-secondary);
}

.group-content {
  margin-top: 8px;
  display: flex; flex-direction: column; gap: 4px;
}
</style>
