import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { filterChannels, getGroupedChannels } from '../utils/channelFilter'
import { HlsPlayer } from '../components/Player'
import { RiSearchLine, RiArrowDownSLine, RiArrowRightSLine } from '@remixicon/react'
import type { Channel } from '../types'

export default function ChannelPage() {
  const { channels, channelsLoading, channelsError, loadChannels } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    '央视频道': true,
    '卫视频道': true,
  })

  const filtered = useMemo(() => {
    const allowed = filterChannels(channels)
    if (!searchQuery.trim()) return allowed
    return allowed.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [channels, searchQuery])

  const grouped = useMemo(() => getGroupedChannels(filtered), [filtered])

  const toggleCategory = (group: string) => {
    setExpandedCategories(prev => ({ ...prev, [group]: !prev[group] }))
  }

  if (channelsLoading && channels.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white/60 text-lg">加载频道列表...</div>
      </div>
    )
  }

  if (channelsError && channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-white/60 text-lg">{channelsError}</div>
        <button
          onClick={() => loadChannels(true)}
          className="px-6 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-4 h-full">
      {/* 左侧频道列表 */}
      <div className="w-full lg:w-96 xl:w-[420px] flex flex-col gap-3 min-h-0">
        {/* 搜索框 */}
        <div className="relative">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="text"
            placeholder="搜索频道..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 text-white placeholder-white/40 border border-white/10 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* 分组折叠列表 */}
        <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
          {grouped.length === 0 ? (
            <div className="text-center text-white/40 py-8">
              {searchQuery ? '未找到匹配的频道' : '暂无可用频道'}
            </div>
          ) : (
            grouped.map(({ group, channels: groupChannels }) => (
              <div key={group} className="rounded-xl bg-white/5">
                <button
                  onClick={() => toggleCategory(group)}
                  className="w-full flex items-center justify-between px-4 py-3 text-white font-semibold"
                >
                  <span>{group} ({groupChannels.length})</span>
                  {expandedCategories[group] ? (
                    <RiArrowDownSLine className="w-5 h-5" />
                  ) : (
                    <RiArrowRightSLine className="w-5 h-5" />
                  )}
                </button>
                {expandedCategories[group] && (
                  <div className="px-2 pb-2 space-y-1">
                    {groupChannels.map(ch => (
                      <button
                        key={ch.id}
                        onClick={() => setSelectedChannel(ch)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          selectedChannel?.id === ch.id
                            ? 'bg-white/15'
                            : 'hover:bg-white/10'
                        }`}
                      >
                        {ch.logo ? (
                          <img src={ch.logo} alt="" className="w-8 h-8 rounded object-contain" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                            <span className="text-white text-sm font-bold">{ch.name[0]}</span>
                          </div>
                        )}
                        <div className="flex-1 text-left min-w-0">
                          <div className="text-white text-sm truncate">{ch.name}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右侧播放器 */}
      <div className="hidden lg:flex flex-1 rounded-xl overflow-hidden bg-black">
        {selectedChannel ? (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 relative">
              <HlsPlayer
                url={selectedChannel.url}
                channelName={selectedChannel.name}
                channelLogo={selectedChannel.logo}
              />
            </div>
            <div className="px-4 py-2 bg-white/5">
              <div className="text-white font-semibold">{selectedChannel.name}</div>
              <div className="text-white/50 text-sm">{selectedChannel.group}</div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-white/30 text-6xl mb-4">📺</div>
              <div className="text-white/40 text-lg">选择一个频道开始观看</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
