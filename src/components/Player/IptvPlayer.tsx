import { useState, useRef, useCallback, useEffect } from 'react'
import {
  RiRefreshLine, RiArrowDownSLine, RiArrowUpSLine,
  RiTimeFill, RiLiveFill, RiFullscreenFill, RiFullscreenExitFill,
} from '@remixicon/react'

interface EpgItem {
  time: string
  title: string
  isLive: boolean
  isLookback: boolean
}

interface EpgData {
  channelName: string
  epg: EpgItem[]
}

interface IptvPlayerProps {
  tid: string
  id: string
  channelName: string
  onBack?: () => void
}

export default function IptvPlayer({ tid, id, channelName, onBack }: IptvPlayerProps) {
  const [epgData, setEpgData] = useState<EpgData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [epgOpen, setEpgOpen] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Fetch EPG data from proxy
  useEffect(() => {
    setLoading(true)
    setError(null)
    setEpgOpen(false)
    fetch(`/api/iptv/info/${tid}/${id}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`) ; return r.json() })
      .then(data => {
        setEpgData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message || '获取频道信息失败')
        setLoading(false)
      })
  }, [tid, id])

  const handleRetry = useCallback(() => {
    setIframeKey(k => k + 1)
    setEpgData(null)
    setError(null)
    setLoading(true)
    fetch(`/api/iptv/info/${tid}/${id}`)
      .then(r => r.json())
      .then(data => { setEpgData(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [tid, id])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const liveEpg = epgData?.epg.find(e => e.isLive)

  return (
    <div ref={containerRef} className="iptv-player-wrap w-full h-full relative bg-black flex flex-col">
      {/* Iframe player */}
      <iframe
        key={iframeKey}
        src={`/api/proxy/iptv/${tid}/${id}`}
        className="w-full flex-1 border-0"
        style={{ minHeight: 0 }}
        allowFullScreen
        onLoad={() => setLoading(false)}
      />

      {/* Top bar overlay */}
      <div className="absolute top-0 inset-x-0 z-20 px-4 py-3 flex items-center gap-3 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)' }}>
        {onBack && (
          <button onClick={onBack}
            className="pointer-events-auto w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <RiArrowDownSLine className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1 min-w-0 pointer-events-none">
          <div className="text-white font-semibold text-sm truncate">{channelName || epgData?.channelName || `${tid}-${id}`}</div>
          {liveEpg && (
            <div className="flex items-center gap-1 text-xs text-red-400 truncate">
              <RiLiveFill className="w-3 h-3 shrink-0" /><span className="truncate">{liveEpg.time} {liveEpg.title}</span>
            </div>
          )}
        </div>
        <button onClick={handleRetry}
          className="pointer-events-auto w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors" title="刷新">
          <RiRefreshLine className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 inset-x-0 z-20 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }}>
        {/* EPG toggle */}
        <div className="flex items-center justify-between px-4 py-3 pointer-events-auto">
          <div className="text-white/40 text-xs truncate max-w-[60%]">
            {loading ? '加载中...' : error ? error : (epgData?.epg.length ? `${epgData.epg.length} 个节目` : '')}
          </div>
          <div className="flex items-center gap-2">
            {epgData && epgData.epg.length > 0 && (
              <button onClick={() => setEpgOpen(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors ${
                  epgOpen ? 'bg-red-600/80 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}>
                <RiTimeFill className="w-3.5 h-3.5" />
                <span>节目单</span>
                {epgOpen ? <RiArrowUpSLine className="w-3.5 h-3.5" /> : <RiArrowDownSLine className="w-3.5 h-3.5" />}
              </button>
            )}
            <button onClick={toggleFullscreen}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
              {isFullscreen
                ? <RiFullscreenExitFill className="w-4 h-4" />
                : <RiFullscreenFill className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* EPG panel */}
        {epgOpen && epgData && epgData.epg.length > 0 && (
          <div className="px-4 pb-4 max-h-48 overflow-y-auto pointer-events-auto" style={{ scrollbarWidth: 'thin' }}>
            <div className="space-y-0.5">
              {epgData.epg.map((item, idx) => (
                <div key={idx}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${
                    item.isLive ? 'bg-red-600/20 border-l-2 border-red-500' : 'bg-white/5'
                  }`}>
                  <span className={`w-10 shrink-0 font-mono ${item.isLive ? 'text-red-400' : 'text-white/40'}`}>{item.time}</span>
                  <span className={`flex-1 truncate ${item.isLive ? 'text-white font-medium' : 'text-white/60'}`}>
                    {item.title}
                  </span>
                  {item.isLive && (
                    <span className="flex items-center gap-0.5 text-red-400 shrink-0">
                      <RiLiveFill className="w-3 h-3" /><span>直播中</span>
                    </span>
                  )}
                  {item.isLookback && !item.isLive && (
                    <span className="text-white/30 shrink-0">回看</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
