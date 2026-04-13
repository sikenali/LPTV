<script setup lang="ts">
import type { Channel } from '@/types/channel'
import { RiHeartFill, RiHeartLine } from '@remixicon/vue'
import { computed } from 'vue'

interface Props {
  channel: Channel
  isActive: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [channel: Channel]
  toggleFavorite: [channel: Channel]
}>()

// 生成频道图标 URL
const channelLogo = computed(() => {
  if (props.channel.logo) return props.channel.logo
  
  // 从频道名提取频道标识（如 CCTV-1 综合 -> CCTV1）
  const name = props.channel.name || ''
  let logoName = ''
  
  // 匹配 CCTV 格式
  const cctvMatch = name.match(/CCTV[-\s]*(\d+[^，]*)/)
  if (cctvMatch) {
    logoName = `CCTV${cctvMatch[1]}`
  }
  
  // 匹配卫视频道
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

// 获取频道短名称
function getChannelShortName(name: string): string {
  if (!name) return '?'
  // 提取 CCTV 数字
  const cctvMatch = name.match(/CCTV[-\s]*(\d+)/)
  if (cctvMatch) return cctvMatch[1]
  
  // 提取卫视名称
  const weishiMatch = name.match(/(.+?)卫视/)
  if (weishiMatch) return weishiMatch[1]
  
  // 默认取第一个字符
  return name.charAt(0)
}

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  // 隐藏破损图片
  img.style.display = 'none'
  // 显示占位符
  const wrapper = img.parentElement
  if (wrapper) {
    const placeholder = wrapper.querySelector('.channel-logo-placeholder') as HTMLElement
    if (placeholder) {
      placeholder.style.display = 'flex'
    }
  }
}

// 图片加载成功，隐藏占位符
const handleImageLoad = (event: Event) => {
  const img = event.target as HTMLImageElement
  const wrapper = img.parentElement
  if (wrapper) {
    const placeholder = wrapper.querySelector('.channel-logo-placeholder') as HTMLElement
    if (placeholder) {
      placeholder.style.display = 'none'
    }
  }
}
</script>

<template>
  <div class="channel-item" :class="{ active: isActive }" @click="emit('select', channel)">
    <div class="channel-info-row">
      <div class="channel-logo-wrapper">
        <!-- 尝试加载网络图标，如果失败则通过 CSS 隐藏并显示下方的占位符 -->
        <img 
          v-if="hasLogo" 
          :src="channelLogo" 
          :alt="channel.name"
          class="channel-logo"
          @error="handleImageError"
          @load="handleImageLoad"
        />
        <div class="channel-logo-placeholder">
          <span class="logo-text">{{ getChannelShortName(channel.name) }}</span>
        </div>
      </div>
      <span class="channel-name" :title="channel.name">{{ channel.name }}</span>
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
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  &:hover {
    background-color: var(--bg-card);
  }
  &:active {
    transform: scale(0.98);
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
  gap: 10px;
}

.channel-logo-wrapper {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  position: relative;
}

.channel-logo {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  object-fit: contain;
  background-color: var(--bg-secondary);
}

.channel-logo-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  
  .logo-text {
    font-size: 12px;
    font-weight: 600;
    color: var(--brand-primary);
  }
}

.channel-name {
  font-size: 14px;
  color: var(--text-primary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color var(--transition-fast);
}

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
  &:active { transform: scale(0.95); }
}

.favorite-icon {
  width: 16px;
  height: 16px;
  color: var(--favorite);
}
</style>
