<script setup lang="ts">
import type { Channel } from '@/types/channel'
import { RiArrowDownSLine, RiArrowRightSLine } from '@remixicon/vue'
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
        <RiArrowDownSLine v-if="isExpanded" class="group-arrow" />
        <RiArrowRightSLine v-else class="group-arrow" />
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
  margin-bottom: 4px;
  border-radius: 8px;
  overflow: hidden;
  transition: background-color var(--transition-fast);
  &:hover {
    background-color: rgba(255, 255, 255, 0.015);
  }
}

.group-header {
  cursor: pointer;
  padding: 10px 14px;
  transition: all var(--transition-fast);
  &:hover {
    background-color: var(--bg-card);
  }
  &:active {
    transform: scale(0.98);
  }
}

.group-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-arrow {
  width: 16px;
  height: 16px;
  color: var(--text-secondary);
  transition: transform var(--transition-normal);
  flex-shrink: 0;
  opacity: 0.7;
}

.group-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.group-count {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  margin-left: auto;
  opacity: 0.7;
}

.group-content {
  padding: 4px 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
