<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import ChannelGroup from '@/components/ChannelGroup.vue'
import VideoPlayer from '@/components/VideoPlayer.vue'
import PlayerView from '@/components/PlayerView.vue'
import NoSignalView from '@/components/NoSignalView.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useChannelStore } from '@/stores/channel'
import { useFavoriteStore } from '@/stores/favorite'
import { useSourceStore } from '@/stores/source'
import { usePlayerStore } from '@/stores/player'
import type { Channel, ChannelGroup as ChannelGroupType } from '@/types/channel'
import { getAllSources } from '@/db/queries/sources'
import { getChannelsGroupedByGroup } from '@/db/queries/channels'
import { dbInitialized } from '@/db/database'
import {
  RiSearchLine, RiTvLine
} from '@remixicon/vue'

const channelStore = useChannelStore()
const favoriteStore = useFavoriteStore()
const sourceStore = useSourceStore()
const playerStore = usePlayerStore()
const route = useRoute()
const searchQuery = ref('')

// 从数据库加载的频道数据
const channelGroups = ref<ChannelGroupType[]>([])
const currentChannel = ref<Channel | null>(null)
const activeSourceId = ref<string | null>(null)
const currentSourceStatus = ref<'active' | 'error' | 'parsing'>('active')

// 根据源状态和播放器错误状态判断是否有信号
const hasSignal = computed(() => {
  return currentSourceStatus.value === 'active' && !playerStore.error
})

// 加载源和频道数据
async function loadData() {
  try {
    // 等待数据库初始化完成
    await dbInitialized

    const sources = getAllSources()
    console.log('加载源列表:', sources)
    sourceStore.setSources(sources)

    if (sources.length === 0) {
      // 没有任何源时，显示空状态
      console.log('没有可用的直播源')
      channelGroups.value = []
      return
    }

    // 使用第一个可用的源（我的直播源优先）
    const primarySource = sources.find(s => s.name === '我的直播源') || sources[0]
    console.log('使用源:', primarySource.name, 'ID:', primarySource.id, '状态:', primarySource.status)
    activeSourceId.value = primarySource.id
    currentSourceStatus.value = primarySource.status
    sourceStore.setActiveSource(primarySource.id)

    // 加载频道数据
    const groups = getChannelsGroupedByGroup(primarySource.id)
    console.log('加载频道分组:', Object.keys(groups).length, '个分组')
    channelGroups.value = Object.entries(groups).map(([name, channels]) => ({
      id: `group-${name}`,
      name,
      channels,
      isExpanded: true
    }))

    // 初始化收藏状态
    channelGroups.value.forEach(group => {
      group.channels.forEach(ch => {
        ch.isFavorite = favoriteStore.isFavorite(ch.id)
      })
    })

    // 恢复上次选择的频道
    if (channelStore.currentChannel) {
      currentChannel.value = channelStore.currentChannel
    }

    // 处理 URL 中的 channel 参数
    const channelIdFromUrl = route.query.channel as string
    if (channelIdFromUrl) {
      const allChannels = channelGroups.value.flatMap(g => g.channels)
      const targetChannel = allChannels.find(ch => ch.id === channelIdFromUrl)
      if (targetChannel) {
        currentChannel.value = targetChannel
        channelStore.selectChannel(targetChannel)
      }
    }
  } catch (error) {
    console.error('加载频道数据失败:', error)
    channelGroups.value = []
  }
}

// 过滤后的频道（支持搜索）
const filteredGroups = computed(() => {
  if (!searchQuery.value) return channelGroups.value
  const query = searchQuery.value.toLowerCase()
  return channelGroups.value
    .map(group => ({
      ...group,
      channels: group.channels.filter(ch => ch.name.toLowerCase().includes(query))
    }))
    .filter(group => group.channels.length > 0)
})

onMounted(() => {
  loadData()
  favoriteStore.loadFavorites()
})

const isGroupExpanded = (groupId: string) => channelStore.expandedGroups.has(groupId)
const handleToggleGroup = (groupId: string) => channelStore.toggleGroup(groupId)

const handleSelectChannel = (channel: Channel) => {
  currentChannel.value = channel
  // 切换频道时重置错误状态
  currentSourceStatus.value = 'active'
  playerStore.setError(null)
  channelStore.selectChannel(channel)
}

const handleToggleFavorite = (channel: Channel) => {
  favoriteStore.toggleFavorite(channel)
}

const handlePlayerError = () => {
  console.warn('播放器发生致命错误，切换到无信号状态')
  playerStore.setError('频道暂时不可用，请稍后重试')
}

const volume = ref(72)

// 计算估计恢复时间（当前时间 + 30 分钟）
const estimatedRecoveryTime = computed(() => {
  const now = new Date()
  const recovery = new Date(now.getTime() + 30 * 60 * 1000)
  const formatTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `预计 ${formatTime(now)} - ${formatTime(recovery)} 恢复`
})

// 播放器控制函数
const togglePlay = () => {
  console.log('Toggle play/pause')
  // TODO: 连接 VideoPlayer 的实际播放状态
}

const prevChannel = () => {
  if (channelGroups.value.length === 0) return
  const allChannels = channelGroups.value.flatMap(g => g.channels)
  if (!currentChannel.value || allChannels.length === 0) return

  const currentIndex = allChannels.findIndex(ch => ch.id === currentChannel.value!.id)
  const prevIndex = currentIndex <= 0 ? allChannels.length - 1 : currentIndex - 1
  handleSelectChannel(allChannels[prevIndex])
}

const nextChannel = () => {
  if (channelGroups.value.length === 0) return
  const allChannels = channelGroups.value.flatMap(g => g.channels)
  if (!currentChannel.value || allChannels.length === 0) return

  const currentIndex = allChannels.findIndex(ch => ch.id === currentChannel.value!.id)
  const nextIndex = currentIndex >= allChannels.length - 1 ? 0 : currentIndex + 1
  handleSelectChannel(allChannels[nextIndex])
}

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error('进入全屏失败:', err)
    })
  } else {
    document.exitFullscreen().catch(err => {
      console.error('退出全屏失败:', err)
    })
  }
}
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
        <ChannelGroup v-for="group in filteredGroups" :key="group.id" :group-name="group.name" :channel-count="group.channels.length"
          :channels="group.channels" :is-expanded="isGroupExpanded(group.id)" :current-channel-id="currentChannel?.id ?? null"
          @toggle="handleToggleGroup(group.id)" @select="handleSelectChannel" @toggle-favorite="handleToggleFavorite" />
        <div v-if="filteredGroups.length === 0 && channelGroups.length > 0" class="no-results">
          <RiSearchLine class="no-results-icon" />
          <span>未找到匹配的频道</span>
        </div>
        <div v-if="channelGroups.length === 0 && filteredGroups.length === 0" class="empty-hint">
          <RiTvLine class="empty-icon" />
          <span class="empty-title">暂无直播源</span>
          <span class="empty-desc">请前往设置页面添加直播源</span>
        </div>
      </div>
    </aside>
    <!-- 右侧播放主区域 -->
    <main class="channel-main">
      <!-- 有频道选择时显示播放器 -->
      <PlayerView
        v-if="currentChannel && hasSignal"
        :channel-name="currentChannel.name"
        :channel-desc="`${currentChannel.groupName} · 正在播放`"
        :logo-text="currentChannel.name.split('-')[0]?.trim() || 'TV'"
        :is-favorite="favoriteStore.isFavorite(currentChannel.id)"
        :volume="volume"
        @toggle-favorite="currentChannel && handleToggleFavorite(currentChannel)"
        @toggle-play="togglePlay"
        @prev-channel="prevChannel"
        @next-channel="nextChannel"
        @fullscreen="toggleFullscreen"
      >
        <template #player>
          <VideoPlayer :url="currentChannel.url" @error="handlePlayerError" />
        </template>
      </PlayerView>

      <!-- 无信号时显示无信号界面 -->
      <PlayerView
        v-else-if="currentChannel && !hasSignal"
        :channel-name="currentChannel.name"
        :channel-desc="`${currentChannel.groupName} · 无信号`"
        :logo-text="currentChannel.name.split('-')[0]?.trim() || 'TV'"
        :is-favorite="favoriteStore.isFavorite(currentChannel.id)"
        :volume="volume"
        @toggle-favorite="currentChannel && handleToggleFavorite(currentChannel)"
        @toggle-play="togglePlay"
        @prev-channel="prevChannel"
        @next-channel="nextChannel"
        @fullscreen="toggleFullscreen"
      >
        <template #player>
          <NoSignalView
            message="当前频道无信号"
            check-message="请检查信号源连接或切换至其他频道"
            :estimated-time="estimatedRecoveryTime"
          />
        </template>
      </PlayerView>

      <!-- 未选择频道时显示空状态 -->
      <EmptyState
        v-else
        :icon="RiTvLine"
        title="选择一个频道开始观看"
        description="从左侧频道列表中选择一个频道"
      />
    </main>
  </div>
</template>

<style scoped lang="scss">
.channel-view {
  display: flex;
  height: calc(100vh - 56px);
  margin-top: 56px;
  overflow: hidden;
}

/* 左侧边栏 */
.channel-sidebar {
  width: 210px;
  flex-shrink: 0;
  background-color: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
}

.search-box {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  gap: 10px;
  background-color: var(--bg-card);
  margin: 16px 16px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  transition: all var(--transition-fast);
  &:focus-within {
    border-color: var(--brand-primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
  }
  .search-icon {
    width: 16px;
    height: 16px;
    color: var(--text-secondary);
    flex-shrink: 0;
    opacity: 0.7;
  }
  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 14px;
    line-height: 1.5;
    &::placeholder { color: var(--text-secondary); opacity: 0.6; }
  }
}

.channel-groups {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 16px;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 3px;
    &:hover { background: #4a4e69; }
  }
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 16px;
  color: var(--text-secondary);
  .no-results-icon {
    width: 24px;
    height: 24px;
    opacity: 0.5;
  }
  span {
    font-size: 13px;
    opacity: 0.7;
  }
}

.empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 16px;
  color: var(--text-secondary);
  .empty-icon {
    width: 40px;
    height: 40px;
    opacity: 0.3;
  }
  .empty-title {
    font-size: 14px;
    font-weight: 500;
    opacity: 0.6;
  }
  .empty-desc {
    font-size: 12px;
    opacity: 0.5;
    text-align: center;
  }
}

/* 右侧主区域 */
.channel-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
  overflow: hidden;
  min-width: 0;
  padding: 0;
}
</style>
