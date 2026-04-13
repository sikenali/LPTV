import { defineStore } from 'pinia'
import type { Channel, ChannelGroup } from '@/types/channel'

export const useChannelStore = defineStore('channel', {
  state: () => ({ groups: [] as ChannelGroup[], expandedGroups: new Set<string>(), currentChannel: null as Channel | null, loading: false }),
  actions: {
    setGroups(groups: ChannelGroup[]) { this.groups = groups; this.expandedGroups = new Set() },
    toggleGroup(groupId: string) { if (this.expandedGroups.has(groupId)) this.expandedGroups.delete(groupId); else this.expandedGroups.add(groupId) },
    selectChannel(channel: Channel) { this.currentChannel = channel },
    setLoading(loading: boolean) { this.loading = loading }
  }
})
