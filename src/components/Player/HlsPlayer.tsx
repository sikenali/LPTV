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

// 最长等待时间：超过此时间认为加载失败，直接显示错误
const MAX_LOAD_TIME_MS = 20000

const HlsPlayer = forwardRef<HlsPlayerRef, HlsPlayerProps>(({ url, onError, onPlay, onReady }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [error, setError] = useState<string | null>(null)
  // loadingRef: false = 视频已就绪，可以显示内容
  const loadingRef = useRef(true)
  const errorRef = useRef<string | null>(null)
  const retryCountRef = useRef(0)
  const MAX_RETRIES = 3
  const timeoutRef = useRef<number | null>(null)
  const errorTypeRef = useRef<string | null>(null)
  const isPlayingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)
  // 记录首次成功的时间，用于兜底超时
  const startTimeRef = useRef(0)

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
  }, [])

  const destroyHls = useCallback(() => {
    clearTimer()
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
  }, [clearTimer])

  // 标记加载完成（安全调用：多次调用无副作用）
  const markReady = useCallback(() => {
    if (!loadingRef.current) return
    loadingRef.current = false
    onPlay?.()
  }, [onPlay])

  // 兜底超时：MAX_LOAD_TIME_MS 后无论是否播放都标记为 ready
  const startSafetyTimer = useCallback(() => {
    clearTimer()
    timeoutRef.current = window.setTimeout(() => {
      if (loadingRef.current && mountedRef.current) {
        // 仍未播放，尝试强制清除遮罩（可能是 live 流，无法触发 canplay）
        markReady()
      }
    }, MAX_LOAD_TIME_MS)
  }, [clearTimer, markReady])

  // 监听真正播放开始（最可靠）
  const onPlayingCb = useCallback(() => {
    if (!mountedRef.current) return
    isPlayingRef.current = true
    clearTimer()
    markReady()
    onReady?.()
  }, [clearTimer, markReady, onReady])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.addEventListener('playing', onPlayingCb)
    v.addEventListener('pause', () => { isPlayingRef.current = false })
    return () => {
      v.removeEventListener('playing', onPlayingCb)
      v.removeEventListener('pause', () => { isPlayingRef.current = false })
    }
  }, [url, onPlayingCb])

  const tryPlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.play().then(() => {
      isPlayingRef.current = true
      clearTimer()
      // 等待 playing 事件触发 markReady
    }).catch(() => {
      // autoplay 被阻止：静音后重试
      v.muted = true
      v.play().then(() => {
        isPlayingRef.current = true
        clearTimer()
      }).catch(() => {
        isPlayingRef.current = false
        // 完全无法播放，等待兜底超时
      })
    })
  }, [clearTimer])

  const initHls = useCallback((src: string) => {
    destroyHls()
    if (!videoRef.current) return

    errorTypeRef.current = null
    errorRef.current = null
    retryCountRef.current = 0
    loadingRef.current = true
    startTimeRef.current = Date.now()
    setError(null)

    if (!Hls.isSupported()) {
      if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = proxyUrl(src)
        timeoutRef.current = window.setTimeout(() => {
          if (!mountedRef.current) return
          errorRef.current = 'native_timeout'
          setError('浏览器原生 HLS 不支持或播放超时')
          onError?.(new Error('native_hls_timeout'))
        }, MAX_LOAD_TIME_MS)
        return
      }
      setError('浏览器不支持 HLS 播放')
      return
    }

    const hls = new Hls({
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      // 启用低延迟模式
      lowLatencyMode: true,
      liveDurationInfinity: true,
    })
    hlsRef.current = hls

    // 兜底超时
    timeoutRef.current = window.setTimeout(() => {
      if (loadingRef.current && !errorRef.current && mountedRef.current) {
        errorRef.current = 'timeout'
        setError('加载超时，请检查网络或频道源')
        onError?.(new Error('loading_timeout'))
      }
    }, MAX_LOAD_TIME_MS)

    hls.on(Hls.Events.MEDIA_ATTACHED, () => { hls.loadSource(proxyUrl(src)) })

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      clearTimer()
      retryCountRef.current = 0
      errorTypeRef.current = null
      setError(null)
      errorRef.current = null
      tryPlay()
      // 启动兜底安全计时器
      startSafetyTimer()
    })

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) {
        clearTimer()
        if (errorTypeRef.current === 'media') {
          retryCountRef.current++
          if (retryCountRef.current > MAX_RETRIES) onError?.(new Error('media_error_max_retries'))
        }
        return
      }
      switch (data.details) {
        case Hls.ErrorDetails.MANIFEST_PARSING_ERROR:
          clearTimer(); setError('无法加载频道列表，该源可能已失效'); onError?.(new Error('manifest_error')); hls.destroy(); break
        case Hls.ErrorDetails.MANIFEST_LOAD_ERROR:
          clearTimer()
          if (retryCountRef.current < MAX_RETRIES) { retryCountRef.current++; errorTypeRef.current = 'manifest' }
          else { errorRef.current = 'manifest_error'; setError('网络连接失败，无法加载频道'); onError?.(new Error('manifest_load_error_max_retries')); hls.destroy() }
          break
        case Hls.ErrorDetails.LEVEL_LOAD_ERROR:
        case Hls.ErrorDetails.LEVEL_PARSING_ERROR:
          clearTimer()
          if (retryCountRef.current <= MAX_RETRIES) { errorTypeRef.current = 'level'; retryCountRef.current++; hls.recoverMediaError() }
          else { setError('播放失败，该频道源可能不可用'); onError?.(new Error('max_retries_exceeded')); hls.destroy() }
          break
        case Hls.ErrorDetails.BUFFER_STALLED_ERROR:
          if (retryCountRef.current <= MAX_RETRIES) { retryCountRef.current++; hls.recoverMediaError() }
          else { clearTimer(); setError('播放失败'); onError?.(new Error('buffer_error_max_retries')); hls.destroy() }
          break
        case Hls.ErrorDetails.FRAG_LOAD_ERROR:
        case Hls.ErrorDetails.FRAG_LOAD_TIMEOUT:
          if (retryCountRef.current <= MAX_RETRIES) { retryCountRef.current++; hls.recoverMediaError() }
          else { clearTimer(); setError('片段加载失败，频道源可能不稳定'); onError?.(new Error('frag_load_error')); hls.destroy() }
          break
        case Hls.ErrorDetails.FRAG_PARSING_ERROR:
          clearTimer(); hls.stopLoad(); hls.recoverMediaError(); break
        default:
          clearTimer(); setError('播放失败'); onError?.(new Error('unknown_fatal_error')); hls.destroy(); break
      }
    })

    hls.attachMedia(videoRef.current)
  }, [destroyHls, onError, clearTimer, tryPlay, startSafetyTimer])

  useEffect(() => {
    mountedRef.current = true
    if (!url) return
    loadingRef.current = true
    setError(null)
    errorRef.current = null
    initHls(url)
    return () => { mountedRef.current = false; destroyHls() }
  }, [url, initHls, destroyHls])

  const handleRetry = () => {
    retryCountRef.current = 0
    setError(null)
    errorRef.current = null
    loadingRef.current = true
    initHls(url)
  }

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
    <div ref={containerRef} className="relative w-full h-full bg-black" style={{ height: '100%', minHeight: 0 }}>
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        muted
        autoPlay
        style={{ maxHeight: '100%', maxWidth: '100%' }}
        onClick={() => {
          const v = videoRef.current
          if (!v) return
          if (isPlayingRef.current) { v.pause(); isPlayingRef.current = false }
          else { tryPlay() }
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
