<script setup lang="ts">
import { ref } from 'vue'
import ChannelGroup from '@/components/ChannelGroup.vue'
import { useChannelStore } from '@/stores/channel'
import { useFavoriteStore } from '@/stores/favorite'
import type { Channel } from '@/types/channel'
import {
  RiSearchLine, RiTvLine, RiHeartFill, RiHeartLine,
  RiVolumeUpLine, RiPlayFill, RiSkipBackMiniLine, RiSkipForwardMiniLine,
  RiFullscreenLine, RiCalendarEventLine, RiHdLine
} from '@remixicon/vue'

const channelStore = useChannelStore()
const favoriteStore = useFavoriteStore()
const searchQuery = ref('')

const demoGroups = ref([
  { id: 'g1', name: '央视频道', channels: [
    { id: 'ch1', name: 'CCTV-1 综合', url: 'http://example.com/cctv1.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
    { id: 'ch2', name: 'CCTV-2 财经', url: 'http://example.com/cctv2.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: true, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
    { id: 'ch3', name: 'CCTV-5 体育', url: 'http://example.com/cctv5.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
    { id: 'ch7', name: 'CCTV-6 电影', url: 'http://example.com/cctv6.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
    { id: 'ch8', name: 'CCTV-8 电视剧', url: 'http://example.com/cctv8.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
    { id: 'ch9', name: 'CCTV-10 科教', url: 'http://example.com/cctv10.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() }
  ]},
  { id: 'g2', name: '卫视频道', channels: [
    { id: 'ch4', name: '湖南卫视', url: 'http://example.com/hunan.m3u8', groupId: 'g2', groupName: '卫视频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
    { id: 'ch5', name: '东方卫视', url: 'http://example.com/dongfang.m3u8', groupId: 'g2', groupName: '卫视频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() }
  ]},
  { id: 'g3', name: '地方频道', channels: [
    { id: 'ch6', name: '北京卫视', url: 'http://example.com/beijing.m3u8', groupId: 'g3', groupName: '地方频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() }
  ]},
  { id: 'g4', name: '其他频道', channels: [
    { id: 'ch10', name: '测试频道', url: 'http://example.com/test.m3u8', groupId: 'g4', groupName: '其他频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() }
  ]}
])

const currentChannel = ref<Channel | null>(null)
const isFavorite = ref(false)
const isGroupExpanded = (groupId: string) => channelStore.expandedGroups.has(groupId)
const handleToggleGroup = (groupId: string) => channelStore.toggleGroup(groupId)
const handleSelectChannel = (channel: Channel) => { currentChannel.value = channel; channelStore.selectChannel(channel) }
const handleToggleFavorite = (channel: Channel) => {
  channel.isFavorite = !channel.isFavorite
  isFavorite.value = channel.isFavorite
  if (channel.isFavorite) favoriteStore.addFavoriteLocal(channel)
  else favoriteStore.removeFavoriteLocal(channel.id)
}

const currentTime = ref('01:23:45')
const totalTime = ref('LIVE')
const volume = ref(80)
</script>

<template>
  <div class="channel-view">
    <!-- 左侧频道列表区 -->
    <aside class="channel-sidebar">
      <!-- 搜索框 -->
      <div class="search-box">
        <RiSearchLine class="search-icon" />
        <input v-model="searchQuery" type="text" placeholder="搜索频道..." class="search-input" />
      </div>
      <!-- 频道分组列表 -->
      <div class="channel-groups">
        <ChannelGroup v-for="group in demoGroups" :key="group.id" :group-name="group.name" :channel-count="group.channels.length"
          :channels="group.channels" :is-expanded="isGroupExpanded(group.id)" :current-channel-id="currentChannel?.id ?? null"
          @toggle="handleToggleGroup(group.id)" @select="handleSelectChannel" @toggle-favorite="handleToggleFavorite" />
      </div>
    </aside>
    <!-- 右侧播放主区域 -->
    <main class="channel-main">
      <!-- 播放信息栏 -->
      <div class="player-info-bar">
        <div class="channel-info">
          <div class="channel-logo-placeholder">
            <RiTvLine class="logo-icon" />
          </div>
          <div class="channel-details">
            <span class="channel-name-large">{{ currentChannel?.name ?? '未选择频道' }}</span>
            <span class="channel-desc">{{ currentChannel?.groupName ?? '请先选择频道' }}</span>
          </div>
        </div>
        <div class="info-actions">
          <button class="action-btn" @click="currentChannel && handleToggleFavorite(currentChannel)">
            <RiHeartFill v-if="isFavorite" class="action-icon" />
            <RiHeartLine v-else class="action-icon" />
          </button>
          <button class="action-btn">
            <RiFullscreenLine class="action-icon" />
          </button>
        </div>
      </div>
      <!-- 视频播放窗口 -->
      <div class="video-player-wrapper">
        <div class="player-placeholder">
          <RiPlayFill class="play-icon" />
          <span class="placeholder-text">{{ currentChannel ? '正在加载...' : '选择频道开始播放' }}</span>
        </div>
      </div>
      <!-- 播放控制栏 -->
      <div class="playback-controls">
        <div class="progress-bar">
          <div class="progress-filled" style="width: 35%;"></div>
          <div class="progress-thumb" style="left: 35%;"></div>
        </div>
        <div class="control-buttons">
          <div class="controls-left">
            <button class="ctrl-btn"><RiPlayFill class="ctrl-icon" /></button>
            <button class="ctrl-btn"><RiSkipBackMiniLine class="ctrl-icon" /></button>
            <button class="ctrl-btn"><RiSkipForwardMiniLine class="ctrl-icon" /></button>
            <span class="time-display">{{ currentTime }} / {{ totalTime }}</span>
          </div>
          <div class="controls-right">
            <div class="volume-control">
              <RiVolumeUpLine class="volume-icon" />
              <div class="volume-bar">
                <div class="volume-filled" :style="{ width: volume + '%' }"></div>
              </div>
            </div>
            <button class="ctrl-btn">
              <RiCalendarEventLine class="ctrl-icon" />
              <span>节目单</span>
            </button>
            <button class="ctrl-btn">
              <RiHdLine class="ctrl-icon" />
              <span>画质</span>
            </button>
          </div>
        </div>
      </div>
      <!-- 节目预告栏 -->
      <div class="program-guide">
        <div class="guide-header">
          <span class="guide-title">节目预告</span>
          <span class="guide-date">2026年4月13日 周一</span>
        </div>
        <div class="program-list">
          <div class="program-item active">
            <span class="program-time">08:00</span>
            <span class="program-name">早间新闻</span>
            <span class="program-status">正在播放</span>
          </div>
          <div class="program-item">
            <span class="program-time">09:00</span>
            <span class="program-name">朝闻天下</span>
          </div>
          <div class="program-item">
            <span class="program-time">10:00</span>
            <span class="program-name">新闻30分</span>
          </div>
          <div class="program-item">
            <span class="program-time">12:00</span>
            <span class="program-name">法治在线</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.channel-view { display: flex; height: calc(100vh - 80px); margin-top: 80px; }

/* 左侧边栏 */
.channel-sidebar {
  width: 380px; flex-shrink: 0; background-color: var(--bg-secondary);
  display: flex; flex-direction: column; border-right: 1px solid var(--border-color);
}

.search-box {
  display: flex; align-items: center; padding: 16px 24px; gap: 12px;
  background-color: var(--bg-card); margin: 16px; border-radius: 12px;
  .search-icon { width: 18px; height: 18px; color: var(--text-secondary); }
  .search-input {
    flex: 1; background: transparent; border: none; outline: none;
    color: var(--text-primary); font-size: 14px;
    &::placeholder { color: var(--text-secondary); }
  }
}

.channel-groups {
  flex: 1; overflow-y: auto; padding: 0 16px 16px;
}

/* 右侧主区域 */
.channel-main {
  flex: 1; display: flex; flex-direction: column; background-color: var(--bg-primary);
  padding: 24px 40px; gap: 16px; overflow-y: auto;
}

/* 播放信息栏 */
.player-info-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px; background-color: var(--bg-card); border-radius: 12px;
}

.channel-info { display: flex; align-items: center; gap: 16px; }

.channel-logo-placeholder {
  width: 48px; height: 48px; border-radius: 10px;
  background-color: var(--bg-secondary); display: flex; align-items: center;
  justify-content: center;
}

.logo-icon {
  width: 24px; height: 24px; color: var(--text-secondary);
}

.channel-details { display: flex; flex-direction: column; gap: 4px; }
.channel-name-large { font-size: 20px; font-weight: 600; color: var(--text-primary); }
.channel-desc { font-size: 13px; color: var(--text-secondary); }

.info-actions { display: flex; gap: 16px; }
.action-btn {
  width: 48px; height: 48px; border-radius: 10px; background-color: var(--bg-secondary);
  border: none; color: var(--text-primary); cursor: pointer;
  transition: background-color var(--transition-fast);
  display: flex; align-items: center; justify-content: center;
  &:hover { background-color: var(--brand-primary); }
}
.action-icon { width: 20px; height: 20px; }

/* 视频播放窗口 */
.video-player-wrapper {
  flex: 1; min-height: 400px; background-color: #000; border-radius: 16px;
  display: flex; align-items: center; justify-content: center; position: relative;
  overflow: hidden;
}

.player-placeholder {
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  color: var(--text-secondary);
  .play-icon { width: 64px; height: 64px; opacity: 0.5; }
  .placeholder-text { font-size: 16px; }
}

/* 播放控制栏 */
.playback-controls {
  background-color: var(--bg-card); border-radius: 12px; padding: 16px 24px;
}

.progress-bar {
  position: relative; height: 8px; background-color: var(--bg-secondary);
  border-radius: 4px; margin-bottom: 16px; cursor: pointer;
}

.progress-filled {
  position: absolute; left: 0; top: 0; height: 100%;
  background-color: var(--brand-primary); border-radius: 4px;
}

.progress-thumb {
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  width: 16px; height: 16px; border-radius: 50%;
  background-color: var(--brand-primary); cursor: grab;
}

.control-buttons { display: flex; align-items: center; justify-content: space-between; }
.controls-left, .controls-right { display: flex; align-items: center; gap: 16px; }

.ctrl-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; background-color: var(--bg-secondary);
  border: none; color: var(--text-primary); font-size: 14px; cursor: pointer;
  transition: background-color var(--transition-fast);
  &:hover { background-color: var(--brand-primary); }
}
.ctrl-icon { width: 18px; height: 18px; }

.time-display { font-size: 13px; color: var(--text-secondary); margin-left: 8px; }

.volume-control { display: flex; align-items: center; gap: 8px; }
.volume-icon { width: 18px; height: 18px; color: var(--text-primary); }
.volume-bar {
  width: 96px; height: 6px; background-color: var(--bg-secondary);
  border-radius: 3px; position: relative; cursor: pointer;
}
.volume-filled {
  position: absolute; left: 0; top: 0; height: 100%;
  background-color: var(--brand-primary); border-radius: 3px;
}

/* 节目预告栏 */
.program-guide {
  background-color: var(--bg-card); border-radius: 12px; padding: 20px 24px;
}

.guide-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.guide-title { font-size: 16px; font-weight: 600; color: var(--text-primary); }
.guide-date { font-size: 13px; color: var(--text-secondary); }

.program-list { display: flex; flex-direction: column; gap: 8px; }

.program-item {
  display: flex; align-items: center; padding: 12px 16px;
  border-radius: 8px; gap: 16px;
  &.active { background-color: rgba(59, 130, 246, 0.1); }
}

.program-time { font-size: 14px; color: var(--text-secondary); min-width: 60px; }
.program-name { flex: 1; font-size: 14px; color: var(--text-primary); }
.program-status { font-size: 12px; color: var(--brand-primary); }
</style>
