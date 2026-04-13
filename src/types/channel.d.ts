export interface Channel {
  id: string
  name: string
  url: string
  groupId: string
  groupName: string
  logo?: string
  tvgId?: string
  tvgName?: string
  isFavorite: boolean
  sourceId: string
  createdAt: Date
  updatedAt: Date
}

export interface ChannelGroup {
  id: string
  name: string
  channels: Channel[]
  isExpanded: boolean
}
