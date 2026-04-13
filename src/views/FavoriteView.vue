<script setup lang="ts">
import { ref } from 'vue'
import FavoriteCard from '@/components/FavoriteCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useRouter } from 'vue-router'
import type { Channel } from '@/types/channel'
import { RiHeartLine } from '@remixicon/vue'

const router = useRouter()

const favorites = ref<Channel[]>([
  { id: 'ch1', name: 'CCTV-1 综合', url: 'http://example.com/cctv1.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: true, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
  { id: 'ch2', name: 'CCTV-2 财经', url: 'http://example.com/cctv2.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: true, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
  { id: 'ch4', name: '湖南卫视', url: 'http://example.com/hunan.m3u8', groupId: 'g2', groupName: '卫视频道', isFavorite: true, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
  { id: 'ch5', name: '东方卫视', url: 'http://example.com/dongfang.m3u8', groupId: 'g2', groupName: '卫视频道', isFavorite: true, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
  { id: 'ch6', name: '北京卫视', url: 'http://example.com/beijing.m3u8', groupId: 'g3', groupName: '地方频道', isFavorite: true, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
  { id: 'ch3', name: 'CCTV-5 体育', url: 'http://example.com/cctv5.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: true, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() }
])

const handleRemove = (channelId: string) => { favorites.value = favorites.value.filter(ch => ch.id !== channelId) }
const handlePlay = (channel: Channel) => { router.push({ path: '/', query: { channel: channel.id } }) }
const handleAddFavorite = () => { router.push('/') }
</script>

<template>
  <div class="favorite-view">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">我的收藏</h1>
      <p class="page-subtitle">管理你收藏的频道，快速访问常看的节目</p>
    </div>
    <!-- 收藏卡片网格 -->
    <template v-if="favorites.length > 0">
      <div class="favorites-grid">
        <FavoriteCard
          v-for="channel in favorites"
          :key="channel.id"
          :channel="channel"
          @remove="handleRemove"
          @play="handlePlay"
        />
        <!-- 添加收藏卡片 -->
        <div class="add-favorite-card" @click="handleAddFavorite">
          <div class="add-icon">+</div>
          <div class="add-text">添加收藏</div>
          <div class="add-desc">前往频道页添加更多收藏</div>
        </div>
      </div>
    </template>
    <!-- 空状态 -->
    <EmptyState
      v-else
      :icon="RiHeartLine"
      title="还没有收藏任何频道"
      description="前往频道页添加你的收藏吧"
    />
  </div>
</template>

<style scoped lang="scss">
.favorite-view {
  padding: 32px 80px;
  height: calc(100vh - 80px);
  overflow-y: auto;
  margin-top: 80px;
}

.page-header {
  margin-bottom: 32px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.page-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.favorites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.add-favorite-card {
  background-color: var(--bg-card);
  border-radius: 12px;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 274px;
  cursor: pointer;
  border: 2px dashed var(--border-color);
  transition: all var(--transition-fast);
  &:hover {
    border-color: var(--brand-primary);
    background-color: rgba(59, 130, 246, 0.05);
  }
  .add-icon {
    font-size: 40px;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }
  .add-text {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
  }
  .add-desc {
    font-size: 13px;
    color: var(--text-secondary);
    text-align: center;
  }
}
</style>
