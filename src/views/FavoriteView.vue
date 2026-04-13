<script setup lang="ts">
import { ref } from 'vue'
import FavoriteCard from '@/components/FavoriteCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useRouter } from 'vue-router'
import type { Channel } from '@/types/channel'

const router = useRouter()
const favorites = ref<Channel[]>([
  { id: 'ch1', name: 'CCTV-1 综合', url: 'http://example.com/cctv1.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: true, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
  { id: 'ch2', name: 'CCTV-2 财经', url: 'http://example.com/cctv2.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: true, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
  { id: 'ch4', name: '湖南卫视', url: 'http://example.com/hunan.m3u8', groupId: 'g2', groupName: '卫视频道', isFavorite: true, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() }
])

const handleRemove = (channelId: string) => { favorites.value = favorites.value.filter(ch => ch.id !== channelId) }
const handlePlay = (channel: Channel) => { router.push({ path: '/', query: { channel: channel.id } }) }
</script>

<template>
  <div class="favorite-view">
    <EmptyState v-if="favorites.length === 0" icon="❤️" title="还没有收藏任何频道" description="前往频道页添加你的收藏吧" />
    <div v-else class="favorites-grid">
      <FavoriteCard v-for="channel in favorites" :key="channel.id" :channel="channel" @remove="handleRemove" @play="handlePlay" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.favorite-view { padding: var(--spacing-xl); height: 100%; overflow-y: auto; }
.favorites-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--spacing-lg); }
</style>
