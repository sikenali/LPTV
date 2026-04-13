<script setup lang="ts">
import type { Channel } from '@/types/channel'
import { RiPlayCircleLine, RiHeartFill } from '@remixicon/vue'

defineProps<{ channel: Channel }>()
const emit = defineEmits<{ remove: [channelId: string]; play: [channel: Channel] }>()
</script>

<template>
  <div class="favorite-card" @click="emit('play', channel)">
    <!-- 频道预览图占位 -->
    <div class="channel-preview">
      <div class="preview-placeholder">
        <RiPlayCircleLine class="preview-icon" />
      </div>
    </div>
    <!-- 卡片内容区 -->
    <div class="card-content">
      <div class="channel-info">
        <div class="channel-logo-small">
          <RiPlayCircleLine class="logo-icon" />
        </div>
        <span class="channel-name">{{ channel.name }}</span>
      </div>
      <button class="favorite-btn" @click.stop="emit('remove', channel.id)">
        <RiHeartFill class="heart-icon" />
      </button>
    </div>
    <!-- 频道分组信息 -->
    <div class="channel-meta">
      <span class="meta-item">{{ channel.groupName }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.favorite-card {
  background-color: var(--bg-card);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid transparent;
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
    border-color: var(--border-color);
  }
}

.channel-preview {
  height: 150px;
  background: linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at 30% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 60%);
  }
}

.preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.preview-icon {
  width: 44px;
  height: 44px;
  opacity: 0.5;
  color: var(--text-secondary);
}

.card-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
}

.channel-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.channel-logo-small {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--bg-secondary), var(--bg-card));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--border-color);
}

.logo-icon {
  width: 18px;
  height: 18px;
  color: var(--text-secondary);
}

.channel-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.favorite-btn {
  background: transparent;
  border: none;
  padding: 6px;
  cursor: pointer;
  transition: all var(--transition-fast);
  border-radius: 6px;
  flex-shrink: 0;
  &:hover {
    transform: scale(1.15);
    background-color: rgba(239, 68, 68, 0.1);
  }
}

.heart-icon {
  width: 18px;
  height: 18px;
  color: var(--favorite);
}

.channel-meta {
  padding: 10px 16px;
  display: flex;
  gap: 8px;
}

.meta-item {
  font-size: 11px;
  color: var(--text-secondary);
  background-color: var(--bg-secondary);
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 500;
}
</style>
