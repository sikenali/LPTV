<script setup lang="ts">
import type { Channel } from '@/types/channel'
import { RiHeartFill } from '@remixicon/vue'
import { computed } from 'vue'

interface Props {
  channel: Channel
}

const props = defineProps<Props>()
const emit = defineEmits<{ remove: [channelId: string]; play: [channel: Channel] }>()

// 生成频道图标 URL (与 ChannelItem 保持一致)
const channelLogo = computed(() => {
  if (props.channel.logo) return props.channel.logo
  
  const name = props.channel.name || ''
  let logoName = ''
  
  const cctvMatch = name.match(/CCTV[-\s]*(\d+[^，]*)/)
  if (cctvMatch) {
    logoName = `CCTV${cctvMatch[1]}`
  }
  
  const weishiMatch = name.match(/(.+?)卫视/)
  if (weishiMatch) {
    logoName = weishiMatch[1]
  }
  
  if (logoName) {
    return `https://live.fanmingming.cn/tv/${encodeURIComponent(logoName)}.png`
  }
  
  return ''
})

const hasLogo = computed(() => !!channelLogo.value)

function getChannelShortName(name: string): string {
  if (!name) return '?'
  const cctvMatch = name.match(/CCTV[-\s]*(\d+)/)
  if (cctvMatch) return cctvMatch[1]
  
  const weishiMatch = name.match(/(.+?)卫视/)
  if (weishiMatch) return weishiMatch[1]
  
  return name.charAt(0)
}

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
  const placeholder = img.parentElement?.querySelector('.logo-placeholder')
  if (placeholder) {
    (placeholder as HTMLElement).style.display = 'flex'
  }
}
</script>

<template>
  <div class="favorite-card" @click="emit('play', channel)">
    <!-- 频道预览图占位 -->
    <div class="channel-preview">
      <div class="preview-placeholder">
        <div class="preview-logo-wrapper">
          <img 
            v-if="hasLogo" 
            :src="channelLogo" 
            :alt="channel.name"
            class="preview-logo"
            @error="handleImageError"
            crossorigin="anonymous"
          />
          <div class="logo-placeholder">
            <span class="placeholder-text">{{ getChannelShortName(channel.name) }}</span>
          </div>
        </div>
      </div>
    </div>
    <!-- 卡片内容区 -->
    <div class="card-content">
      <div class="channel-header">
        <div class="channel-info">
          <div class="channel-logo-small">
             <img 
               v-if="hasLogo" 
               :src="channelLogo" 
               :alt="channel.name"
               class="small-logo"
               @error="handleImageError"
             />
             <div v-else class="small-logo-placeholder">
               <span class="logo-text">{{ getChannelShortName(channel.name) }}</span>
             </div>
          </div>
          <span class="channel-name">{{ channel.name }}</span>
        </div>
        <button class="favorite-btn" @click.stop="emit('remove', channel.id)">
          <RiHeartFill class="heart-icon" />
        </button>
      </div>
      <div class="program-info">
        <span class="program-current">分组：{{ channel.groupName }}</span>
        <span class="program-next">点击播放 →</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.favorite-card {
  width: 280px;
  height: 274px;
  background-color: var(--bg-card);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid var(--border-color);

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
    border-color: var(--brand-primary);
  }

  &:active {
    transform: translateY(-2px) scale(0.98);
  }
}

.channel-preview {
  width: 100%;
  height: 160px;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
}

.preview-logo-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.preview-logo {
  max-width: 80%;
  max-height: 80%;
  object-fit: contain;
}

.logo-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 16px;
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);

  .placeholder-text {
    font-size: 24px;
    font-weight: 600;
    color: var(--brand-primary);
  }
}

.card-content {
  padding: 14px 16px;
  height: 114px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.channel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
}

.channel-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.channel-logo-small {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.small-logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.small-logo-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: var(--bg-card);
  
  .logo-text {
    font-size: 11px;
    font-family: 'SourceHanSans-Medium', sans-serif;
    color: var(--brand-primary);
    white-space: nowrap;
  }
}

.channel-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'SourceHanSans-Medium', sans-serif;
}

.favorite-btn {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: all var(--transition-fast);
  border-radius: 6px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;

  &:hover {
    transform: scale(1.15);
    background-color: rgba(239, 68, 68, 0.1);
  }

  &:active {
    transform: scale(0.95);
  }
}

.heart-icon {
  width: 20px;
  height: 20px;
  color: var(--favorite);
}

.program-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
}

.program-current {
  font-size: 13px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-secondary);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.program-next {
  font-size: 12px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-disabled);
  line-height: 1.4;
}
</style>