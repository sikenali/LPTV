import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { filterChannels, getGroupedChannels } from '../utils/channelFilter'
import HlsPlayer, { type HlsPlayerRef } from '../components/Player/HlsPlayer'
import { RiSearchLine, RiArrowDownSLine, RiArrowRightSLine, RiTvFill, RiHeartFill, RiHeartLine, RiPlayFill, RiPauseFill, RiFullscreenFill, RiFullscreenExitFill } from '@remixicon/react'
import type { Channel } from '../types'

const groupIcons: Record<string, { color: string }> = {
  '央视频道': { color: '#c43d3d' },
  '卫视频道': { color: '#7b9eb3' },
  '其他频道': { color: '#5b8c5a' },
}

const VALIDATED_URLS_KEY = 'lptv_validated_urls'

export default function ChannelPage() {
  const { channels, channelsLoading, channelsError, loadChannels, settings, favorites, toggleFavorite, setChannelStatus } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({})
  const [channelStatus, setLocalChannelStatus] = useState<Record<string, 'ok' | 'error' | 'unknown'>>({})
  const [isPaused, setIsPaused] = useState(false)
  const playerRef = useRef<HlsPlayerRef>(null)
  const location = useLocation()

  useEffect(() => {
    const allowed = filterChannels(channels)
    if (allowed.length === 0) return

    const current = { ...channelStatus }
    let stored: string[] = []
    try { stored = JSON.parse(localStorage.getItem(VALIDATED_URLS_KEY) || '[]') } catch (_e) { /* ignore */ }

    // 并发限制：最多同时探测 5 个频道
    const MAX_CONCURRENT = 5
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let running = 0
    const queue = allowed.filter(ch => {
      if (current[ch.id] !== undefined) return false
      return true
    })

    const runProbe = (ch: Channel) => {
      running++
      const signal = AbortSignal.timeout(3000)
      fetch(`/api/probe?url=${encodeURIComponent(ch.url)}`, { signal })
        .then(resp => resp.json().then(d => ({ ok: d.status === 'ok' })))
        .catch(() => ({ ok: false }))
        .then(({ ok }) => {
          if (ok) {
            stored.push(ch.url)
            try { localStorage.setItem(VALIDATED_URLS_KEY, JSON.stringify(stored)) } catch (_e) { /* ignore */ }
            current[ch.id] = 'ok'
          } else {
            current[ch.id] = 'error'
          }
          setLocalChannelStatus({ ...current }); setChannelStatus({ ...current })
          running--
          // 调度下一个
          const next = queue.find(c => current[c.id] === undefined)
          if (next) runProbe(next)
        })
    }

    // 启动第一批
    for (let i = 0; i < Math.min(MAX_CONCURRENT, queue.length); i++) {
      runProbe(queue[i])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    const allowed = filterChannels(channels)
    if (allowed.length === 0) return

    const groups = getGroupedChannels(allowed)
    const initial: Record<string, boolean> = {}
    groups.forEach(g => { initial[g.group] = g.group === '央视频道' })
    setExpandedCategories(initial)

    const cctv1 = allowed.find(c => /^cctv1(\+?)$/i.test(c.name))
    if (cctv1) {
      setSelectedChannel(cctv1)
    }

    // Handle channel selection from favorites navigation
    const state = location.state as { selectChannel?: Channel } | null
    if (state?.selectChannel) {
      setSelectedChannel(state.selectChannel)
      window.history.replaceState({}, '')
    }
  }, [channels, location])

  const filtered = useMemo(() => {
    const allowed = filterChannels(channels)
    if (!debouncedQuery.trim()) return allowed
    return allowed.filter(c => c.name.toLowerCase().includes(debouncedQuery.toLowerCase()))
  }, [channels, debouncedQuery])

  const grouped = useMemo(() => getGroupedChannels(filtered), [filtered])

  const toggleCategory = (group: string) => {
    setExpandedCategories(prev => ({ ...prev, [group]: !prev[group] }))
  }

  const handlePause = () => {
    playerRef.current?.pause()
    setIsPaused(true)
  }

  const handlePlay = () => {
    playerRef.current?.resume()
    setIsPaused(false)
  }

  const handleToggleFullscreen = () => {
    playerRef.current?.toggleFullscreen()
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
      <div className="w-[360px] flex flex-col min-h-0 overflow-hidden shrink-0" style={{ background: sidebarBg, borderRight: `1px solid ${borderCol}` }}>
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
                  <motion.button
                    onClick={() => toggleCategory(group)}
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.015 }}
                    animate={isExpanded
                      ? { scale: [1, 1.04, 0.97, 1.02, 1], backgroundColor: cardBk }
                      : { scale: 1, backgroundColor: bgMain }
                    }
                    transition={isExpanded
                      ? { duration: 0.5, times: [0, 0.2, 0.4, 0.7, 1], ease: 'easeInOut' }
                      : { duration: 0.2 }
                    }
                    className="w-full flex items-center justify-between rounded-lg border px-3 py-3"
                    style={{ borderColor: borderCol }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ background: iconData.color }}>
                        <RiTvFill className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="font-semibold text-sm" style={{ color: textPri }}>{group}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: '#c9a96e' }}>{`（${groupChs.length}）`}</span>
                      <motion.span
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                      >
                        {isExpanded ? (
                          <RiArrowDownSLine className="w-4 h-4" style={{ color: textSec }} />
                        ) : (
                          <RiArrowRightSLine className="w-4 h-4" style={{ color: textSec }} />
                        )}
                      </motion.span>
                    </div>
                  </motion.button>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key={group}
                        initial={{ opacity: 0, height: 0, translateY: -6 }}
                        animate={{ opacity: 1, height: 'auto', translateY: 0 }}
                        exit={{ opacity: 0, height: 0, translateY: -4 }}
                        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="mt-1 space-y-1 pb-1">
                          {groupChs.map(ch => {
                            const isSelected = selectedChannel?.id === ch.id
                            const isFav = favorites.includes(ch.id)

                            return (
                              <motion.button
                                key={ch.id}
                                onClick={() => setSelectedChannel(ch)}
                                whileTap={{ scale: 0.97 }}
                                whileHover={{ x: 3 }}
                                animate={isSelected
                                  ? { scale: [1, 1.03, 0.98, 1], background: cardBk, borderColor: borderCol, borderWidth: '1px' }
                                  : { scale: 1, background: bgMain, borderColor: 'transparent', borderWidth: '0px' }
                                }
                                transition={isSelected
                                  ? { duration: 0.4, times: [0, 0.2, 0.5, 1], ease: 'easeInOut' }
                                  : { duration: 0.15 }
                                }
                                className="w-full flex items-center justify-between rounded-lg px-2 py-2.5"
                                style={{
                                  background: isSelected ? cardBk : bgMain,
                                  borderColor: isSelected ? borderCol : 'transparent',
                                  borderWidth: isSelected ? '1px' : '0px',
                                }}
                              >
                                <div className="flex items-center gap-3 pl-2 pr-2 flex-1 min-w-0">
                                  <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden"
                                    style={{ background: isSelected ? '#c43d3d' : '#5b8c5a' }}
                                  >
                                     {ch.logo && !logoErrors[ch.logo] ? (
                                       <img
                                         src={`/api/proxy/image?url=${encodeURIComponent(ch.logo)}&name=${encodeURIComponent(ch.name)}`}
                                         alt=""
                                         className="w-full h-full object-contain"
                                         onError={() => setLogoErrors(prev => ({ ...prev, [ch.logo]: true }))}
                                       />
                                     ) : (
                                       <img
                                         src="/icon.png"
                                         alt=""
                                         className="w-full h-full object-contain"
                                       />
                                     )}
                                  </div>
                                  <div className="flex-1 text-left min-w-0">
                                    <div className="font-medium text-sm truncate" style={{ color: textPri }}>{ch.name}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 pr-1 shrink-0">
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleFavorite(ch.id)
                                    }}
                                    className="p-[3px] cursor-pointer transition-transform hover:bg-white/10 rounded"
                                  >
                                    {isFav ? (
                                      <RiHeartFill className="w-4 h-4" style={{ color: '#c43d3d' }} />
                                    ) : (
                                      <RiHeartLine className="w-4 h-4" style={{ color: subTxt }} />
                                    )}
                                  </span>
                                  <span className="shrink-0 flex items-center justify-center" style={{ width: '6px' }}>
                                    {channelStatus[ch.id] === 'ok' && (
                                      <span className="block w-[5px] h-[5px] rounded-full bg-green-500" style={{ margin: 'auto' }} />
                                    )}
                                    {channelStatus[ch.id] === 'error' && (
                                      <span className="block w-[5px] h-[5px] rounded-full bg-red-500" style={{ margin: 'auto' }} />
                                    )}
                                  </span>
                                </div>
                              </motion.button>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: '#1a1410' }}>
        <div className="flex-1 min-h-0 relative bg-[#0d0a08] overflow-hidden">
          {selectedChannel ? (
            <HlsPlayer
              ref={playerRef}
              url={selectedChannel.url}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(196,61,61,0.15)' }}>
                  <RiPlayFill className="w-8 h-8" style={{ color: '#c43d3d' }} />
                </div>
                <div className="text-white/30 text-sm mt-4">选择一个频道开始观看</div>
              </div>
            </div>
          )}

          {/* Bottom control bar - overlay on top of player, always visible */}
          {selectedChannel && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-4 h-14 z-10" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.35) 60%, transparent)' }}>
              <div className="flex items-center gap-1 shrink-0">
                {isPaused ? (
                  <button onClick={handlePlay} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                    <RiPlayFill className="w-5 h-5 text-white" />
                  </button>
                ) : (
                  <button onClick={handlePause} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                    <RiPauseFill className="w-5 h-5 text-white" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  const muted = playerRef.current?.mute ?? false
                  playerRef.current?.setVolume(muted ? 1 : 0)
                }}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              >
                {(playerRef.current as any)?.mute !== undefined ? (
                  ((playerRef.current as any).mute ? (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                  ) : (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                  ))
                ) : (
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                defaultValue="1"
                onChange={(e) => playerRef.current?.setVolume(parseFloat(e.target.value))}
                className="w-20 h-1 accent-white cursor-pointer"
                style={{ accentColor: 'white' }}
              />
              <button onClick={handleToggleFullscreen} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                {document.fullscreenElement ? (
                  <RiFullscreenExitFill className="w-4 h-4 text-white" />
                ) : (
                  <RiFullscreenFill className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
