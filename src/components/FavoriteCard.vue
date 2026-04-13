<script setup lang="ts">
import type { Channel } from '@/types/channel'
defineProps<{ channel: Channel }>()
const emit = defineEmits<{ remove: [channelId: string]; play: [channel: Channel] }>()
</script>

<template>
  <div class="favorite-card" @click="emit('play', channel)">
    <!-- 频道预览图占位 -->
    <div class="channel-preview">
      <div class="preview-placeholder">
        {{ channel.logo || '📺' }}
      </div>
    </div>
    <!-- 卡片内容区 -->
    <div class="card-content">
      <div class="channel-info">
        <div class="channel-logo-small">
          {{ channel.logo || '📺' }}
        </div>
        <span class="channel-name">{{ channel.name }}</span>
      </div>
      <button class="favorite-btn" @click.stop="emit('remove', channel.id)">
        ❤️
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
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }
}

.channel-preview {
  height: 160px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-placeholder {
  font-size: 64px;
  opacity: 0.6;
}

.card-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
}

.channel-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.channel-logo-small {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.channel-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.favorite-btn {
  background: transparent;
  border: none;
  font-size: 20px;
  padding: 4px;
  cursor: pointer;
  transition: transform var(--transition-fast);
  &:hover {
    transform: scale(1.3);
  }
}

.channel-meta {
  padding: 0 20px 16px;
}

.meta-item {
  font-size: 12px;
  color: var(--text-secondary);
  background-color: var(--bg-secondary);
  padding: 4px 10px;
  border-radius: 4px;
}
</style>
