<script setup lang="ts">
import { ref } from 'vue'
import ChannelGroup from '@/components/ChannelGroup.vue'
import VideoPlayer from '@/components/VideoPlayer.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useChannelStore } from '@/stores/channel'
import { useFavoriteStore } from '@/stores/favorite'
import type { Channel } from '@/types/channel'

const channelStore = useChannelStore()
const favoriteStore = useFavoriteStore()

const demoGroups = ref([
  { id: 'g1', name: '央视频道', channels: [
    { id: 'ch1', name: 'CCTV-1 综合', url: 'http://example.com/cctv1.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
    { id: 'ch2', name: 'CCTV-2 财经', url: 'http://example.com/cctv2.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: true, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
    { id: 'ch3', name: 'CCTV-5 体育', url: 'http://example.com/cctv5.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() }
  ]},
  { id: 'g2', name: '卫视频道', channels: [
    { id: 'ch4', name: '湖南卫视', url: 'http://example.com/hunan.m3u8', groupId: 'g2', groupName: '卫视频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
    { id: 'ch5', name: '东方卫视', url: 'http://example.com/dongfang.m3u8', groupId: 'g2', groupName: '卫视频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() }
  ]},
  { id: 'g3', name: '地方频道', channels: [
    { id: 'ch6', name: '北京卫视', url: 'http://example.com/beijing.m3u8', groupId: 'g3', groupName: '地方频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() }
  ]}
])

const currentChannel = ref<Channel | null>(null)
const isGroupExpanded = (groupId: string) => channelStore.expandedGroups.has(groupId)
const handleToggleGroup = (groupId: string) => channelStore.toggleGroup(groupId)
const handleSelectChannel = (channel: Channel) => { currentChannel.value = channel; channelStore.selectChannel(channel) }
const handleToggleFavorite = (channel: Channel) => {
  channel.isFavorite = !channel.isFavorite
  if (channel.isFavorite) favoriteStore.addFavoriteLocal(channel)
  else favoriteStore.removeFavoriteLocal(channel.id)
}
</script>

<template>
  <div class="channel-view">
    <aside class="channel-sidebar">
      <ChannelGroup v-for="group in demoGroups" :key="group.id" :group-name="group.name" :channel-count="group.channels.length"
        :channels="group.channels" :is-expanded="isGroupExpanded(group.id)" :current-channel-id="currentChannel?.id ?? null"
        @toggle="handleToggleGroup(group.id)" @select="handleSelectChannel" @toggle-favorite="handleToggleFavorite" />
    </aside>
    <main class="channel-main">
      <template v-if="currentChannel">
        <div class="player-wrapper"><VideoPlayer :url="currentChannel.url" /></div>
        <div class="player-info">
          <span class="current-channel">当前频道：{{ currentChannel.name }}</span>
          <button class="favorite-button" @click="handleToggleFavorite(currentChannel)">
            {{ currentChannel.isFavorite ? '❤️ 已收藏' : '🤍 收藏' }}
          </button>
        </div>
      </template>
      <EmptyState v-else icon="📺" title="选择一个频道开始观看" description="从左侧频道列表中选择一个频道" />
    </main>
  </div>
</template>

<style scoped lang="scss">
.channel-view { display: flex; height: calc(100vh - 60px); }
.channel-sidebar { width: 280px; flex-shrink: 0; background-color: var(--bg-secondary); overflow-y: auto; }
.channel-main { flex: 1; display: flex; flex-direction: column; background-color: var(--bg-primary); overflow: hidden; }
.player-wrapper { flex: 1; background-color: #000; }
.player-info { display: flex; align-items: center; justify-content: space-between; padding: var(--spacing-md) var(--spacing-lg); background-color: var(--bg-secondary);
  .current-channel { font-size: var(--font-size-body); color: var(--text-primary); }
}
.favorite-button { display: flex; align-items: center; gap: var(--spacing-xs); padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--bg-card); color: var(--text-primary); border-radius: var(--radius-sm); transition: background-color var(--transition-fast);
  &:hover { background-color: var(--brand-primary); }
}
</style>
