import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import Hls from 'hls.js'

interface HlsPlayerProps {
  url: string
  onError?: (err?: Error) => void
  onPlay?: () => void
  onReady?: () => void
}

export interface HlsPlayerRef {
  pause: () => void
  resume: () => void
  toggleFullscreen: () => void
  setVolume: (v: number) => void
  volume: number
  mute: boolean
}

function proxyUrl(url: string) {
  return `/api/proxy/stream?url=${encodeURIComponent(url)}`
}

const PLAY_TIMEOUT_MS = 12000

const HlsPlayer = forwardRef<HlsPlayerRef, HlsPlayerProps>(({ url, onError, onPlay, onReady }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isPlayingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)
  const safetyTimerRef = useRef<number | null>(null)

  const clearSafetyTimer = useCallback(() => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current)
      safetyTimerRef.current = null
    }
  }, [])

  const destroyHls = useCallback(() => {
    clearSafetyTimer()
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
  }, [clearSafetyTimer])

  const handlePlaying = useCallback(() => {
    if (!mountedRef.current) return
    isPlayingRef.current = true
    clearSafetyTimer()
    onPlay?.()
    onReady?.()
  }, [clearSafetyTimer, onPlay, onReady])

  // 监听视频事件
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.addEventListener('playing', handlePlaying)
    v.addEventListener('pause', () => {
      isPlayingRef.current = false
    })
    return () => {
      v.removeEventListener('playing', handlePlaying)
      v.removeEventListener('pause', () => {
        isPlayingRef.current = false
      })
    }
  }, [url, handlePlaying])

  const tryPlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.play().then(() => {
      isPlayingRef.current = true
      // 等待 playing 事件触发
    }).catch(() => {
      // autoplay 被阻止，静音重试
      v.muted = true
      v.play().then(() => {
        isPlayingRef.current = true
      }).catch(() => {
        isPlayingRef.current = false
      })
    })
  }, [])

  const initHls = useCallback((src: string) => {
    destroyHls()
    if (!videoRef.current) return

    setError(null)
    isPlayingRef.current = false

    if (!Hls.isSupported()) {
      if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = proxyUrl(src)
        safetyTimerRef.current = window.setTimeout(() => {
          if (!mountedRef.current) return
          setError('浏览器原生 HLS 不支持或播放超时')
          onError?.(new Error('native_hls_timeout'))
        }, PLAY_TIMEOUT_MS)
        return
      }
      setError('浏览器不支持 HLS 播放')
      return
    }

    const hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60, lowLatencyMode: true, liveDurationInfinity: true })
    hlsRef.current = hls

    // 兜底计时器：12秒后仍未播放则标记为 ready
    safetyTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current && !isPlayingRef.current) {
        isPlayingRef.current = true
      }
    }, PLAY_TIMEOUT_MS)

    hls.on(Hls.Events.MEDIA_ATTACHED, () => { hls.loadSource(proxyUrl(src)) })

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      tryPlay()
    })

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return
      switch (data.details) {
        case Hls.ErrorDetails.MANIFEST_PARSING_ERROR:
          setError('无法加载频道列表'); onError?.(new Error('manifest_error')); hls.destroy(); break
        case Hls.ErrorDetails.MANIFEST_LOAD_ERROR:
          setError('网络连接失败'); onError?.(new Error('manifest_load_error')); hls.destroy(); break
        case Hls.ErrorDetails.LEVEL_LOAD_ERROR:
        case Hls.ErrorDetails.LEVEL_PARSING_ERROR:
          if (hlsRef.current) hlsRef.current.recoverMediaError()
          else { setError('频道源不可用'); hls.destroy() }
          break
        default:
          setError('播放失败'); onError?.(new Error(data.details)); hls.destroy(); break
      }
    })

    hls.attachMedia(videoRef.current)
  }, [destroyHls, onError, tryPlay])

  useEffect(() => {
    mountedRef.current = true
    if (!url) return
    initHls(url)
    return () => { mountedRef.current = false; destroyHls() }
  }, [url, initHls, destroyHls])

  const handleRetry = useCallback(() => {
    setError(null)
    initHls(url)
  }, [url, initHls])

  const pause = useCallback(() => { videoRef.current?.pause(); isPlayingRef.current = false }, [])
  const resume = useCallback(() => { tryPlay() }, [tryPlay])
  const [videoVolume, setVideoVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    document.fullscreenElement ? document.exitFullscreen().catch(() => {}) : el.requestFullscreen().catch(() => {})
  }, [])

  const setVolume = useCallback((v: number) => {
    if (videoRef.current) { videoRef.current.volume = Math.max(0, Math.min(1, v)); setVideoVolume(v); setIsMuted(v === 0) }
  }, [])

  useImperativeHandle(ref, () => ({ pause, resume, toggleFullscreen, setVolume, get volume() { return videoVolume }, get mute() { return isMuted } }),
    [pause, resume, toggleFullscreen, setVolume, videoVolume, isMuted])

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black" style={{ height: '100%', width: '100%' }}>
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        muted
        autoPlay
        style={{ height: '100%', width: '100%', display: 'block' }}
        onClick={() => {
          const v = videoRef.current
          if (!v) return
          isPlayingRef.current ? v.pause() : v.play().catch(() => { v.muted = true; v.play() })
        }}
      />
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4">
          <div className="text-white text-lg">{error}</div>
          <button onClick={handleRetry} className="px-6 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors">重试</button>
        </div>
      )}
    </div>
  )
})

HlsPlayer.displayName = 'HlsPlayer'
export default HlsPlayer
