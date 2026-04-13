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
  padding: 40px 60px;
  height: calc(100vh - 80px);
  overflow-y: auto;
  margin-top: 80px;

  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
    &:hover { background: #4a4e69; }
  }
}

.page-header {
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.page-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px;
  letter-spacing: -0.3px;
  line-height: 1.3;
}

.page-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
  opacity: 0.8;
}

.favorites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
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
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  &:active { transform: translateY(0) scale(0.98); }
  .add-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: var(--bg-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    color: var(--text-secondary);
    margin-bottom: 14px;
    transition: all var(--transition-fast);
    border: 1px solid var(--border-color);
  }
  .add-text {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 6px;
  }
  .add-desc {
    font-size: 12px;
    color: var(--text-secondary);
    text-align: center;
    opacity: 0.7;
    line-height: 1.4;
  }
}
</style>
