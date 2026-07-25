import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { filterChannels, getGroupedChannels } from '../utils/channelFilter'
import HlsPlayer from '../components/Player/HlsPlayer'
import { RiSearchLine, RiArrowDownSLine, RiArrowRightSLine, RiTvFill, RiHeartFill, RiHeartLine, RiPlayFill } from '@remixicon/react'
import type { Channel } from '../types'

const groupIcons: Record<string, { color: string }> = {
  '央视频道': { color: '#c43d3d' },
  '卫视频道': { color: '#7b9eb3' },
  '地方频道': { color: '#c9a96e' },
  '数字频道': { color: '#5b8c5a' },
}

export default function ChannelPage() {
  const { channels, channelsLoading, channelsError, loadChannels, settings, favorites, toggleFavorite } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const allowed = filterChannels(channels)
    if (allowed.length === 0) return

    const groups = getGroupedChannels(allowed)
    const initial: Record<string, boolean> = {}
    groups.forEach(g => { initial[g.group] = g.group !== '卫视频道' })
    setExpandedCategories(initial)

    const cctv1 = allowed.find(c => c.name.toLowerCase().includes('cctv1'))
    if (cctv1 && !selectedChannel) {
      setSelectedChannel(cctv1)
    }
  }, [channels])

  const filtered = useMemo(() => {
    const allowed = filterChannels(channels)
    if (!searchQuery.trim()) return allowed
    return allowed.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [channels, searchQuery])

  const grouped = useMemo(() => getGroupedChannels(filtered), [filtered])

  const toggleCategory = (group: string) => {
    setExpandedCategories(prev => ({ ...prev, [group]: !prev[group] }))
  }

  const isBlack = settings.theme === 'black'
  const bgMain = isBlack ? '#0a0a0a' : '#fbf7f0'
  const sidebarBg = isBlack ? '#1a1a1a' : '#f8f3e8'
  const borderCol = isBlack ? 'rgba(255,255,255,0.1)' : '#e5d9c4'
  const textPri = isBlack ? '#ffffff' : '#3d2b1f'
  const textSec = isBlack ? 'rgba(255,255,255,0.5)' : '#8b7e6a'
  const subTxt = isBlack ? 'rgba(255,255,255,0.4)' : '#b8a88a'
  const cardBk = isBlack ? 'rgba(255,255,255,0.05)' : '#fdfaf4'

  if (channelsLoading && channels.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: bgMain }}>
        <div className="text-white/60 text-lg">加载频道列表...</div>
      </div>
    )
  }

  if (channelsError && channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4" style={{ background: bgMain }}>
        <div className="text-white/60 text-lg">{channelsError}</div>
        <button onClick={() => loadChannels(true)} className="px-6 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20">重试</button>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: bgMain }}>
      <div className="w-[360px] flex flex-col min-h-0 overflow-hidden" style={{ background: sidebarBg, borderRight: `1px solid ${borderCol}` }}>
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5"
            style={{ background: bgMain, borderColor: borderCol }}
          >
            <RiSearchLine className="w-4 h-4 shrink-0" style={{ color: subTxt }} />
            <input
              type="text"
              placeholder="搜索频道..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: textPri }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3" style={{ scrollbarWidth: 'thin' }}>
          {grouped.length === 0 ? (
            <div className="text-center py-8" style={{ color: subTxt }}>
              {searchQuery ? '未找到匹配的频道' : '暂无可用频道'}
            </div>
          ) : (
            grouped.map(({ group, channels: groupChs }) => {
              const iconData = groupIcons[group] || { color: '#c9a96e' }
              const isExpanded = expandedCategories[group]

              return (
                <div key={group}>
                  <button
                    onClick={() => toggleCategory(group)}
                    className="w-full flex items-center justify-between rounded-lg border px-3 py-3 transition-colors"
                    style={{ background: bgMain, borderColor: borderCol }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ background: iconData.color }}>
                        <RiTvFill className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="font-semibold text-sm" style={{ color: textPri }}>{group}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: '#c9a96e' }}>{`（${groupChs.length}）`}</span>
                      {isExpanded ? (
                        <RiArrowDownSLine className="w-4 h-4" style={{ color: textSec }} />
                      ) : (
                        <RiArrowRightSLine className="w-4 h-4" style={{ color: textSec }} />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-1 space-y-1">
                      {groupChs.map(ch => {
                        const isSelected = selectedChannel?.id === ch.id
                        const isFav = favorites.includes(ch.id)

                        return (
                          <button
                            key={ch.id}
                            onClick={() => setSelectedChannel(ch)}
                            className="w-full flex items-center justify-between rounded-lg transition-colors"
                            style={{
                              background: isSelected ? cardBk : bgMain,
                              borderColor: isSelected ? borderCol : 'transparent',
                              borderWidth: isSelected ? '1px' : '0px',
                            }}
                          >
                            <div className="flex items-center gap-3 pl-3 pr-2 py-2.5 flex-1 min-w-0">
                              <div className="w-9 h-9 rounded flex items-center justify-center text-white font-bold text-xs shrink-0"
                                style={{ background: isSelected ? '#c43d3d' : '#5b8c5a' }}
                              >
                                {ch.name.substring(0, 2)}
                              </div>
                              <div className="flex-1 text-left min-w-0">
                                <div className="font-medium text-sm truncate" style={{ color: textPri }}>{ch.name}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pr-2">
                              <span
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleFavorite(ch.id)
                                }}
                                className="p-1 cursor-pointer"
                              >
                                {isFav ? (
                                  <RiHeartFill className="w-4 h-4" style={{ color: '#c43d3d' }} />
                                ) : (
                                  <RiHeartLine className="w-4 h-4" style={{ color: subTxt }} />
                                )}
                              </span>
                              {isSelected ? (
                                <span style={{ color: '#c43d3d' }}><RiPlayFill className="w-4 h-4" /></span>
                              ) : (
                                <span style={{ color: '#999' }}><RiPlayFill className="w-4 h-4" /></span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: borderCol }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#5b8c5a]" />
            <span className="text-xs" style={{ color: textSec }}>频道源已连接</span>
          </div>
          <span className="text-xs" style={{ color: subTxt }}>{`共 ${filtered.length} 个频道`}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0" style={{ background: '#1a1410' }}>
        <div className="flex-1 relative bg-[#0d0a08]">
          {selectedChannel ? (
            <HlsPlayer
              url={selectedChannel.url}
              channelName={selectedChannel.name}
              channelLogo={selectedChannel.logo}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(196,61,61,0.15)' }}>
                  <RiPlayFill className="w-8 h-8" style={{ color: '#c43d3d' }} />
                </div>
                <div className="text-white/30 text-sm mt-4">选择一个频道开始观看</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
