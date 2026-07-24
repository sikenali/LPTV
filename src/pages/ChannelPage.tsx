import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { filterChannels, getGroupedChannels } from '../utils/channelFilter'
import { HlsPlayer, ChannelLineList } from '../components/Player'
import { RiSearchLine, RiArrowDownSLine, RiArrowRightSLine } from '@remixicon/react'
import type { Channel, ChannelLine } from '../types'
import { probeChannel } from '../services/channelApi'

export default function ChannelPage() {
  const { channels, channelsLoading, channelsError, loadChannels, settings } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [, setProbeStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [currentLines, setCurrentLines] = useState<ChannelLine[]>([])
  const [activeLine, setActiveLine] = useState<ChannelLine | null>(null)

  useEffect(() => {
    const allowed = filterChannels(channels)
    const groups = getGroupedChannels(allowed)
    const initial: Record<string, boolean> = {}
    groups.forEach(g => { initial[g.group] = true })
    setExpandedCategories(initial)
  }, [channels])

  useEffect(() => {
    if (!selectedChannel) return
    setProbeStatus('checking')
    probeChannel(selectedChannel.url)
      .then(r => setProbeStatus(r.status === 'ok' ? 'ok' : 'error'))
      .catch(() => setProbeStatus('error'))
    
    const lines: ChannelLine[] = [
      { id: '1', name: '源 1', url: selectedChannel.url, quality: '1080P' },
      { id: '2', name: '源 2', url: selectedChannel.url, quality: '720P' },
      { id: '3', name: '源 3', url: selectedChannel.url, quality: '4K' },
    ]
    setCurrentLines(lines)
    setActiveLine(lines[0])
  }, [selectedChannel])

  const filtered = useMemo(() => {
    const allowed = filterChannels(channels)
    if (!searchQuery.trim()) return allowed
    return allowed.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [channels, searchQuery])

  const grouped = useMemo(() => getGroupedChannels(filtered), [filtered])

  const toggleCategory = (group: string) => {
    setExpandedCategories(prev => ({ ...prev, [group]: !prev[group] }))
  }

  const bgColor = settings.theme === 'black' ? '#0a0a0a' : settings.theme === 'white' ? '#f8f8f8' : '#fbf7f0'
  const sidebarBg = settings.theme === 'black' ? '#1a1a1a' : settings.theme === 'white' ? '#eee' : '#f8f3e8'
  const borderColor = settings.theme === 'black' ? 'rgba(255,255,255,0.1)' : '#e5d9c4'
  const textPrimary = settings.theme === 'black' ? '#ffffff' : '#3d2b1f'
  const textSecondary = settings.theme === 'black' ? 'rgba(255,255,255,0.5)' : '#8b7e6a'
  const subText = settings.theme === 'black' ? 'rgba(255,255,255,0.4)' : '#b8a88a'
  const cardBg = settings.theme === 'black' ? 'rgba(255,255,255,0.05)' : '#fdfaf4'

  if (channelsLoading && channels.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: bgColor }}>
        <div className="text-white/60 text-lg">加载频道列表...</div>
      </div>
    )
  }

  if (channelsError && channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4" style={{ background: bgColor }}>
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
    <div className="flex h-screen overflow-hidden" style={{ background: bgColor }}>
      {/* 左侧频道列表区 */}
      <div className="w-[360px] flex flex-col min-h-0 overflow-hidden" style={{ background: sidebarBg, borderRight: `1px solid ${borderColor}` }}>
        {/* 搜索区 */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5"
            style={{ background: bgColor, borderColor, color: subText }}
          >
            <RiSearchLine className="w-4 h-4" style={{ color: subText }} />
            <input
              type="text"
              placeholder="搜索频道..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: textPrimary }}
            />
          </div>
        </div>

        {/* 频道分组列表 */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
          {grouped.length === 0 ? (
            <div className="text-center text-white/40 py-8">
              {searchQuery ? '未找到匹配的频道' : '暂无可用频道'}
            </div>
          ) : (
            grouped.map(({ group, channels: groupChannels }) => (
              <div key={group}>
                <button
                  onClick={() => toggleCategory(group)}
                  className="w-full flex items-center justify-between rounded-lg border px-3 py-3 transition-colors"
                  style={{ background: bgColor, borderColor }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: group === '央视频道' ? '#c43d3d' : group === '卫视频道' ? '#7b9eb3' : '#c9a96e' }}>
                      <span className="text-white text-xs font-bold">
                        {group === '央视频道' ? '' : group === '卫视频道' ? '' : ''}
                      </span>
                    </div>
                    <span className="font-semibold text-sm" style={{ color: textPrimary }}>{group}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: '#c9a96e' }}>{`（${groupChannels.length}）`}</span>
                    {expandedCategories[group] ? (
                      <RiArrowDownSLine className="w-4 h-4" style={{ color: textSecondary }} />
                    ) : (
                      <RiArrowRightSLine className="w-4 h-4" style={{ color: textSecondary }} />
                    )}
                  </div>
                </button>

                {expandedCategories[group] && (
                  <div className="mt-1 space-y-1">
                    {groupChannels.map(ch => (
                      <button
                        key={ch.id}
                        onClick={() => setSelectedChannel(ch)}
                        className={`w-full flex items-center justify-between rounded-lg transition-colors`}
                        style={{
                          background: selectedChannel?.id === ch.id ? cardBg : bgColor,
                          borderColor: selectedChannel?.id === ch.id ? borderColor : 'transparent',
                          borderWidth: selectedChannel?.id === ch.id ? '1px' : '0px'
                        }}
                      >
                        <div className="flex items-center gap-3 pl-3 pr-2 py-2.5 flex-1 min-w-0">
                          <div className="w-9 h-9 rounded flex items-center justify-center text-white font-bold text-xs shrink-0"
                            style={{ background: ch.id.includes('1') ? '#c43d3d' : ch.id.includes('2') ? '#5b8c5a' : ch.id.includes('3') ? '#7b9eb3' : ch.id.includes('4') ? '#c9a96e' : '#5b8c5a' }}
                          >
                            {ch.name.substring(0, 2)}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <div className="font-medium text-sm truncate" style={{ color: textPrimary }}>{ch.name}</div>
                          </div>
                        </div>
                        <div>
                          {selectedChannel?.id === ch.id ? (
                            <span style={{ color: '#c43d3d' }}></span>
                          ) : (
                            <span style={{ color: '#c9a96e' }}></span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 底部状态栏 */}
        <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#5b8c5a]" />
            <span className="text-xs" style={{ color: textSecondary }}>频道源已连接</span>
          </div>
          <span className="text-xs" style={{ color: subText }}>{`共 ${filtered.length} 个频道`}</span>
        </div>
      </div>

      {/* 右侧播放区 */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* 视频播放器 - 沿用已有的 HlsPlayer 组件 */}
        <div className="flex-1 relative bg-black">
          {selectedChannel && activeLine ? (
            <HlsPlayer
              url={activeLine.url}
              channelName={selectedChannel.name}
              channelLogo={selectedChannel.logo}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-white/30 text-6xl mb-4">📺</div>
                <div className="text-white/40 text-lg">选择一个频道开始观看</div>
              </div>
            </div>
          )}
        </div>

        {/* 源切换区 - 沿用已有的 ChannelLineList 组件 */}
        {selectedChannel && currentLines.length > 0 && (
          <div className="px-6 py-4" style={{ background: settings.theme === 'black' ? '#1a1a1a' : '#f8f3e8', borderTop: `1px solid ${borderColor}` }}>
            <ChannelLineList
              lines={currentLines}
              currentLine={activeLine}
              onLineSwitch={setActiveLine}
              theme={settings.theme}
            />
          </div>
        )}
      </div>
    </div>
  )
}
