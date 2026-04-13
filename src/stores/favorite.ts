import { defineStore } from 'pinia'
import type { Channel } from '@/types/channel'
import * as favoritesQueries from '@/db/queries/favorites'

export const useFavoriteStore = defineStore('favorite', {
  state: () => ({ favorites: [] as Channel[], loading: false }),
  actions: {
    addFavoriteLocal(channel: Channel) { if (!this.isFavorite(channel.id)) this.favorites.push(channel) },
    removeFavoriteLocal(channelId: string) { this.favorites = this.favorites.filter(ch => ch.id !== channelId) },
    isFavorite(channelId: string): boolean { return favoritesQueries.isFavorite(channelId) },
    setFavorites(channels: Channel[]) { this.favorites = channels },
    setLoading(loading: boolean) { this.loading = loading }
  }
})
