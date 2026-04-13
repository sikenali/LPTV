import { defineStore } from 'pinia'
import type { Channel } from '@/types/channel'
import { insertFavorite, removeFavorite, getAllFavoriteChannelIds } from '@/db/queries/favorites'

export const useFavoriteStore = defineStore('favorite', {
  state: () => ({
    favoriteIds: [] as string[],
    loading: false
  }),
  actions: {
    // 从数据库加载收藏列表
    async loadFavorites() {
      this.loading = true
      try {
        this.favoriteIds = getAllFavoriteChannelIds()
      } catch (error) {
        console.error('加载收藏失败:', error)
      } finally {
        this.loading = false
      }
    },
    // 检查是否已收藏
    isFavorite(channelId: string): boolean {
      return this.favoriteIds.includes(channelId)
    },
    // 切换收藏状态
    toggleFavorite(channel: Channel) {
      if (this.isFavorite(channel.id)) {
        this.favoriteIds = this.favoriteIds.filter(id => id !== channel.id)
        try {
          removeFavorite(channel.id)
        } catch (error) {
          console.error('取消收藏失败:', error)
        }
      } else {
        this.favoriteIds.push(channel.id)
        try {
          insertFavorite(channel.id)
        } catch (error) {
          console.error('添加收藏失败:', error)
        }
      }
    }
  }
})