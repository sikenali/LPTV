<script setup lang="ts">
import { ref, onMounted } from 'vue'
import FavoriteCard from '@/components/FavoriteCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useRouter } from 'vue-router'
import type { Channel } from '@/types/channel'
import { RiHeartLine } from '@remixicon/vue'
import { useFavoriteStore } from '@/stores/favorite'
import { getAllFavoriteChannelIds } from '@/db/queries/favorites'
import { getChannelById } from '@/db/queries/channels'
import { dbInitialized } from '@/db/database'

const router = useRouter()
const favoriteStore = useFavoriteStore()

// 从数据库加载的收藏数据
const favorites = ref<Channel[]>([])
const loading = ref(true)

// 加载收藏数据
async function loadFavorites() {
  try {
    await dbInitialized
    const favoriteIds = getAllFavoriteChannelIds()
    const channels: Channel[] = []

    for (const channelId of favoriteIds) {
      const channel = getChannelById(channelId)
      if (channel) {
        channels.push(channel)
      }
    }

    favorites.value = channels
    favoriteStore.favoriteIds = favoriteIds // Sync store state
  } catch (error) {
    console.error('加载收藏失败:', error)
    favorites.value = []
  } finally {
    loading.value = false
  }
}

const handleRemove = (channelId: string) => {
  favorites.value = favorites.value.filter(ch => ch.id !== channelId)
  favoriteStore.toggleFavorite({ id: channelId } as Channel) // Update store/DB
}

const handlePlay = (channel: Channel) => {
  router.push({ path: '/', query: { channel: channel.id } })
}

const handleAddFavorite = () => {
  router.push('/')
}

onMounted(() => {
  loadFavorites()
})
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
  height: calc(100vh - 56px);
  overflow-y: auto;
  margin-top: 56px;

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
  gap: 24px;
}

.add-favorite-card {
  width: 280px;
  height: 242px;
  background-color: var(--bg-card);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 2px dashed var(--border-color);
  transition: all var(--transition-fast);

  &:hover {
    border-color: var(--brand-primary);
    background-color: rgba(59, 130, 246, 0.05);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: translateY(0) scale(0.98);
  }

  .add-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: var(--bg-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: var(--text-secondary);
    margin-bottom: 8px;
    transition: all var(--transition-fast);
    border: 1px solid var(--border-color);
  }

  .add-text {
    font-size: 16px;
    font-weight: 600;
    font-family: 'SourceHanSans-Medium', sans-serif;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .add-desc {
    font-size: 12px;
    font-family: 'SourceHanSans-Medium', sans-serif;
    color: var(--text-secondary);
    text-align: center;
    opacity: 0.7;
    line-height: 1.4;
  }
}

/* 移动端响应式 */
@media (max-width: 768px) {
  .favorite-view {
    padding: 16px;
  }

  .favorites-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  :deep(.favorite-card) {
    padding: 12px;
  }

  :deep(.channel-name) {
    white-space: normal;
  }
}
</style>
