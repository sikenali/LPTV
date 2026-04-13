<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  RiPlayFill,
  RiPauseFill,
  RiSkipBackMiniLine,
  RiSkipForwardMiniLine,
  RiVolumeUpLine,
  RiVolumeMuteLine,
  RiCalendarEventLine,
  RiFullscreenLine,
  RiHeartFill,
  RiHeartLine
} from '@remixicon/vue'

interface ProgramItem {
  time: string
  name: string
  isPlaying?: boolean
}

interface Props {
  channelName: string
  channelDesc: string
  logoText?: string
  isFavorite?: boolean
  currentTime?: string
  totalTime?: string
  progress?: number
  volume?: number
  isMuted?: boolean
  programs?: ProgramItem[]
}

const props = withDefaults(defineProps<Props>(), {
  logoText: 'CCTV1',
  isFavorite: false,
  currentTime: '19:35',
  totalTime: '20:00',
  progress: 35,
  volume: 72,
  isMuted: false,
  programs: () => [
    { time: '19:00', name: '新闻联播', isPlaying: true },
    { time: '19:30', name: '天气预报' },
    { time: '20:00', name: '特约剧场: 我们的日子(23)' },
    { time: '20:56', name: '特约剧场: 我们的日子(24)' },
    { time: '22:00', name: '晚间新闻' }
  ]
})

const emit = defineEmits<{
  toggleFavorite: []
  togglePlay: []
  prevChannel: []
  nextChannel: []
  fullscreen: []
  changeVolume: [volume: number]
  toggleMute: []
  updateProgress: [progress: number]
  playStateChange: [isPlaying: boolean]
}>()

const isPlaying = ref(true)

const currentDate = computed(() => {
  const now = new Date()
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return `${now.getMonth() + 1}月${now.getDate()}日 ${weekDays[now.getDay()]}`
})

const handleProgressClick = (event: MouseEvent) => {
  const bar = (event.currentTarget as HTMLElement).querySelector('.progress-bar')
  if (!bar) return
  const rect = bar.getBoundingClientRect()
  const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))
  emit('updateProgress', percent)
}

const handleVolumeClick = (event: MouseEvent) => {
  const bar = (event.currentTarget as HTMLElement)
  const rect = bar.getBoundingClientRect()
  const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))
  emit('changeVolume', percent)
}

const togglePlayState = () => {
  isPlaying.value = !isPlaying.value
  emit('togglePlay')
  emit('playStateChange', isPlaying.value)
}
</script>

<template>
  <div class="player-view">
    <!-- 播放信息栏 -->
    <div class="player-info-bar">
      <div class="channel-info">
        <div class="channel-logo">
          <span class="logo-text">{{ logoText }}</span>
        </div>
        <div class="channel-details">
          <span class="channel-name">{{ channelName }}</span>
          <span class="channel-desc">{{ channelDesc }}</span>
        </div>
      </div>
      <div class="info-actions">
        <button class="action-btn favorite-btn" @click="emit('toggleFavorite')">
          <RiHeartFill v-if="isFavorite" class="action-icon favorite-icon" />
          <RiHeartLine v-else class="action-icon favorite-icon" />
        </button>
        <button class="action-btn fullscreen-btn" @click="emit('fullscreen')">
          <RiFullscreenLine class="action-icon" />
        </button>
      </div>
    </div>

    <!-- 视频播放窗口 -->
    <div class="video-player-wrapper">
      <slot name="player">
        <div class="player-placeholder">
          <div class="preview-image"></div>
        </div>
      </slot>
    </div>

    <!-- 播放控制栏 -->
    <div class="playback-controls">
      <!-- 进度条 -->
      <div class="progress-bar-container" @click="handleProgressClick">
        <div class="progress-bar">
          <div class="progress-filled" :style="{ width: progress + '%' }"></div>
          <div class="progress-thumb" :style="{ left: progress + '%' }"></div>
        </div>
      </div>

      <!-- 控制按钮区 -->
      <div class="control-buttons">
        <div class="controls-left">
          <button class="ctrl-btn play-btn" @click="togglePlayState">
            <RiPauseFill v-if="isPlaying" class="ctrl-icon play-icon" />
            <RiPlayFill v-else class="ctrl-icon play-icon" />
          </button>
          <span class="ctrl-spacer"></span>
          <button class="ctrl-btn prev-btn" @click="emit('prevChannel')">
            <RiSkipBackMiniLine class="ctrl-icon prev-icon" />
          </button>
          <span class="ctrl-spacer"></span>
          <button class="ctrl-btn next-btn" @click="emit('nextChannel')">
            <RiSkipForwardMiniLine class="ctrl-icon next-icon" />
          </button>
          <span class="time-spacer"></span>
          <div class="time-display">
            <span class="current-time">{{ currentTime }}</span>
            <span class="time-separator">/</span>
            <span class="total-time">{{ totalTime }}</span>
          </div>
        </div>

        <div class="controls-right">
          <div class="volume-control">
            <button class="volume-icon-btn" @click="emit('toggleMute')">
              <RiVolumeMuteLine v-if="isMuted" class="volume-icon" />
              <RiVolumeUpLine v-else class="volume-icon" />
            </button>
            <span class="volume-spacer"></span>
            <div class="volume-bar" @click="handleVolumeClick">
              <div class="volume-filled" :style="{ width: (isMuted ? 0 : volume) + '%' }"></div>
            </div>
          </div>
          <span class="right-spacer"></span>
          <button class="ctrl-btn program-btn">
            <RiCalendarEventLine class="ctrl-icon program-icon" />
          </button>
          <span class="right-spacer"></span>
          <button class="ctrl-btn quality-btn">
            <span class="quality-text">高清</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 节目预告栏 -->
    <div class="program-guide">
      <div class="guide-header">
        <span class="guide-title">今日节目预告</span>
        <div class="date-selector">
          <span class="date-text">{{ currentDate }}</span>
        </div>
      </div>
      <div class="program-list">
        <div
          v-for="(program, index) in programs"
          :key="index"
          class="program-item"
          :class="{ active: program.isPlaying }"
        >
          <span class="program-time">{{ program.time }}</span>
          <span class="program-name">{{ program.name }}</span>
          <span v-if="program.isPlaying" class="program-status">正在播放</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.player-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background-color: var(--bg-primary);
}

/* 播放信息栏 */
.player-info-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  min-height: 52px;
}

.channel-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.channel-logo {
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  background-color: var(--brand-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .logo-text {
    color: var(--text-primary);
    font-size: 14px;
    font-family: 'SourceHanSans-Medium', sans-serif;
    line-height: 1.2;
  }
}

.channel-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.channel-name {
  font-size: 24px;
  font-weight: 600;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
  line-height: 1.2;
}

.channel-desc {
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-secondary);
  line-height: 1.2;
}

.info-actions {
  display: flex;
  gap: 16px;
}

.action-btn {
  width: 48px;
  height: 48px;
  border-radius: 9999px;
  background-color: var(--bg-card);
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background-color: var(--bg-secondary);
  }

  &:active {
    transform: scale(0.95);
  }
}

.favorite-icon {
  width: 22px;
  height: 22px;
  color: var(--favorite);
}

.action-icon {
  width: 22px;
  height: 22px;
  color: var(--text-secondary);
}

/* 视频播放窗口 */
.video-player-wrapper {
  flex: 1;
  width: 100%;
  min-height: 0;
  background-color: rgba(0, 0, 0, 1);
  position: relative;
  overflow: hidden;
}

.player-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-image {
  width: 100%;
  height: 100%;
  background-image: url('https://prototype-prod-1254106194.cos.ap-beijing.myqcloud.com/calicat/file/ai/canvas/image/2043515297770835968.jpg');
  background-size: cover;
  background-position: center;
}

/* 播放控制栏 */
.playback-controls {
  background-color: var(--bg-card);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid var(--border-color);
}

.progress-bar-container {
  margin-bottom: 16px;
}

.progress-bar {
  position: relative;
  height: 8px;
  background-color: var(--bg-secondary);
  border-radius: 9999px;
  cursor: pointer;
  transition: height 0.15s;

  &:hover {
    height: 10px;
  }
}

.progress-filled {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background-color: var(--brand-primary);
  border-radius: 9999px;
  transition: background-color 0.15s;
}

.progress-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 17px;
  height: 16px;
  border-radius: 9999px;
  background-color: rgba(255, 255, 255, 1);
  cursor: grab;
  opacity: 0;
  transition: all 0.15s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);

  &:active {
    cursor: grabbing;
  }
}

.progress-bar:hover .progress-thumb {
  opacity: 1;
}

.control-buttons {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.controls-left,
.controls-right {
  display: flex;
  align-items: center;
}

.ctrl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background-color: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
  padding: 0;

  &:hover {
    background-color: var(--bg-secondary);
  }

  &:active {
    transform: scale(0.95);
  }
}

.ctrl-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-btn {
  width: 48px;
  height: 48px;
  border-radius: 9999px;
  background-color: var(--brand-primary);

  &:hover {
    background-color: var(--brand-hover);
  }
}

.play-icon {
  width: 22px;
  height: 22px;
  color: rgba(255, 255, 255, 1);
}

.prev-btn,
.next-btn {
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  background-color: var(--bg-secondary);

  &:hover {
    background-color: var(--border-color);
  }
}

.prev-icon,
.next-icon {
  width: 20px;
  height: 20px;
  color: var(--text-primary);
}

.ctrl-spacer {
  width: 16px;
  height: 40px;
}

.time-spacer {
  width: 32px;
  height: 24px;
}

.time-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.current-time {
  font-size: 16px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
}

.time-separator {
  font-size: 16px;
  font-family: 'SourceHanSans-Regular', sans-serif;
  color: var(--text-secondary);
}

.total-time {
  font-size: 16px;
  font-family: 'SourceHanSans-Regular', sans-serif;
  color: var(--text-secondary);
}

.volume-control {
  display: flex;
  align-items: center;
}

.volume-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: all var(--transition-fast);

  &:hover {
    opacity: 0.8;
  }
}

.volume-icon {
  width: 22px;
  height: 22px;
  color: var(--text-secondary);
}

.volume-spacer {
  width: 12px;
  height: 6px;
}

.volume-bar {
  width: 96px;
  height: 6px;
  background-color: var(--bg-secondary);
  border-radius: 9999px;
  position: relative;
  cursor: pointer;
  transition: height 0.15s;

  &:hover {
    height: 8px;
  }
}

.volume-filled {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background-color: var(--brand-primary);
  border-radius: 9999px;
}

.right-spacer {
  width: 24px;
  height: 40px;
}

.program-btn {
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  background-color: var(--bg-secondary);

  &:hover {
    background-color: var(--border-color);
  }
}

.program-icon {
  width: 20px;
  height: 20px;
  color: var(--text-primary);
}

.quality-btn {
  height: 40px;
  padding: 0 16px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background-color: var(--border-color);
  }
}

.quality-text {
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
}

/* 节目预告栏 */
.program-guide {
  background-color: var(--bg-card);
  border-radius: 12px;
  padding: 16px;
}

.guide-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.guide-title {
  font-size: 18px;
  font-weight: 600;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
}

.date-selector {
  .date-text {
    font-size: 14px;
    font-family: 'SourceHanSans-Medium', sans-serif;
    color: var(--text-secondary);
  }
}

.program-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.program-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  gap: 16px;
  transition: all 0.15s;
  cursor: pointer;

  &:hover:not(.active) {
    background-color: var(--bg-secondary);
  }

  &.active {
    background-color: rgba(59, 130, 246, 0.12);
    border-color: var(--brand-primary);
    padding: 8px;
  }
}

.program-time {
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--brand-hover);
  min-width: 81px;
}

.program-item:not(.active) .program-time {
  color: var(--text-secondary);
  font-family: 'SourceHanSans-Medium', sans-serif;
}

.program-name {
  flex: 1;
  font-size: 16px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
}

.program-item:not(.active) .program-name {
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
}

.program-status {
  font-size: 12px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--brand-hover);
  background-color: rgba(59, 130, 246, 0.12);
  padding: 4px 8px;
  border-radius: 4px;
}
</style>
