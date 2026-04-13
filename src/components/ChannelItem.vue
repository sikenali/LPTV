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
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  &:hover {
    background-color: var(--bg-card);
  }
  &.active {
    background-color: rgba(59, 130, 246, 0.12);
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 60%;
      background-color: var(--brand-primary);
      border-radius: 0 2px 2px 0;
    }
  }
}

.channel-info-row {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;
}

.channel-name {
  font-size: 14px;
  color: var(--text-primary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.channel-spacer { flex: 1; }

.favorite-btn {
  background: transparent;
  border: none;
  padding: 4px;
  cursor: pointer;
  transition: all var(--transition-fast);
  border-radius: 4px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover {
    transform: scale(1.2);
    background-color: rgba(239, 68, 68, 0.1);
  }
}

.favorite-icon {
  width: 16px;
  height: 16px;
  color: var(--favorite);
}
</style>
