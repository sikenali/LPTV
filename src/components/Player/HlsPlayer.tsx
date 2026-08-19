import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import Hls from 'hls.js'

interface HlsPlayerProps {
  url: string
  onError?: (err: Error) => void
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
  const base = '/api/proxy/stream'
  return `${base}?url=${encodeURIComponent(url)}`
}

const LOADING_TIMEOUT = 30000
const MIN_LOADING_MS = 600

const HlsPlayer = forwardRef<HlsPlayerRef, HlsPlayerProps>(({ url, onError }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const loadingRef = useRef(true)
  const errorRef = useRef<string | null>(null)
  const retryCountRef = useRef(0)
  const MAX_RETRIES = 3
  const timeoutRef = useRef<number | null>(null)
  const minLoadingTimerRef = useRef<number | null>(null)
  const loadingStartRef = useRef(0)
  const errorTypeRef = useRef<string | null>(null)
  const isPlayingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const destroyHls = useCallback(() => {
    clearAllTimers()
    if (minLoadingTimerRef.current) {
      clearTimeout(minLoadingTimerRef.current)
      minLoadingTimerRef.current = null
    }
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
  }, [clearAllTimers])

  const finishLoading = useCallback(() => {
    loadingRef.current = false
    // 加载动画至少显示 MIN_LOADING_MS，避免一闪而过看不清
    const elapsed = Date.now() - loadingStartRef.current
    const remain = MIN_LOADING_MS - elapsed
    if (remain <= 0) {
      setLoading(false)
      return
    }
    if (minLoadingTimerRef.current) {
      clearTimeout(minLoadingTimerRef.current)
    }
    minLoadingTimerRef.current = window.setTimeout(() => {
      minLoadingTimerRef.current = null
      setLoading(false)
    }, remain)
  }, [])

  const tryPlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    // 优先有声播放（点击频道的用户激活窗口内通常会被允许）
    v.play().then(() => {
      isPlayingRef.current = true
    }).catch(() => {
      // 有声被拒（如激活过期）→ 静音兜底，保证必能自动播放
      v.muted = true
      setIsMuted(true)
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

    errorTypeRef.current = null

    if (!Hls.isSupported()) {
      if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = proxyUrl(src)
        timeoutRef.current = window.setTimeout(() => {
          errorRef.current = 'native_hls_timeout'
          setError(`浏览器原生 HLS 不支持或播放超时`)
          onError?.(new Error('native_hls_timeout'))
        }, LOADING_TIMEOUT)
        return
      }
      setError('浏览器不支持 HLS 播放')
      return
    }

    const hls = new Hls({
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
    })
    hlsRef.current = hls
    retryCountRef.current = 0

    loadingRef.current = true
    timeoutRef.current = window.setTimeout(() => {
      if (loadingRef.current && !errorRef.current) {
        setError('加载超时，请检查网络或频道源')
        onError?.(new Error('loading_timeout'))
      }
    }, LOADING_TIMEOUT)

    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      hls.loadSource(proxyUrl(src))
    })

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      clearAllTimers()
      retryCountRef.current = 0
      errorTypeRef.current = null
      setError(null)
      errorRef.current = null
      tryPlay()
    })

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) {
        // 非致命错误（如单个 fragment 超时/重试中）由 hls.js 自动恢复，
        // 不销毁播放器、不提示错误，仅清理加载态避免卡死。
        clearAllTimers()
        finishLoading()
        if (errorTypeRef.current === 'media') {
          retryCountRef.current++
          if (retryCountRef.current > MAX_RETRIES) {
            onError?.(new Error('media_error_max_retries'))
          }
        }
        return
      }

      switch (data.details) {
        case Hls.ErrorDetails.MANIFEST_PARSING_ERROR:
          clearAllTimers()
          setError('无法加载频道列表，该源可能已失效')
          onError?.(new Error('manifest_error'))
          hls.destroy()
          break
        case Hls.ErrorDetails.MANIFEST_LOAD_ERROR:
          clearAllTimers()
          // 网络抖动导致的临时失败，不立即销毁播放器，由 hls.js 自动重试 manifest 拉取
          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current++
            errorTypeRef.current = 'manifest'
          } else {
            errorRef.current = 'manifest_load_error'
            setError('网络连接失败，无法加载频道')
            onError?.(new Error('manifest_load_error_max_retries'))
            hls.destroy()
          }
          break
        case Hls.ErrorDetails.LEVEL_LOAD_ERROR:
        case Hls.ErrorDetails.LEVEL_PARSING_ERROR:
          clearAllTimers()
          setError('频道流解析失败，尝试切换到备用质量')
          errorTypeRef.current = 'level'
          retryCountRef.current++
          if (retryCountRef.current <= MAX_RETRIES) {
            hls.recoverMediaError()
          } else {
            setError('播放失败，该频道源可能不可用')
            onError?.(new Error('max_retries_exceeded'))
            hls.destroy()
          }
          break
        case Hls.ErrorDetails.BUFFER_STALLED_ERROR:
          retryCountRef.current++
          if (retryCountRef.current <= MAX_RETRIES) {
            hls.recoverMediaError()
          } else {
            clearAllTimers()
            setError('播放失败')
            onError?.(new Error('buffer_error_max_retries'))
            hls.destroy()
          }
          break
        case Hls.ErrorDetails.FRAG_LOAD_ERROR:
        case Hls.ErrorDetails.FRAG_LOAD_TIMEOUT:
          retryCountRef.current++
          if (retryCountRef.current <= MAX_RETRIES) {
            hls.recoverMediaError()
          } else {
            clearAllTimers()
            setError('片段加载失败，频道源可能不稳定')
            onError?.(new Error('frag_load_error'))
            hls.destroy()
          }
          break
        case Hls.ErrorDetails.FRAG_PARSING_ERROR:
          clearAllTimers()
          hls.stopLoad()
          hls.recoverMediaError()
          break
        default:
          clearAllTimers()
          setError('播放失败')
          onError?.(new Error('unknown_fatal_error'))
          hls.destroy()
          break
      }
    })

    hls.on(Hls.Events.FRAG_BUFFERED, () => {
      if (loadingRef.current) {
        clearAllTimers()
        finishLoading()
      }
    })

    hls.attachMedia(videoRef.current)
  }, [destroyHls, onError, clearAllTimers, finishLoading, tryPlay])

  useEffect(() => {
    if (!url) return
    setLoading(true)
    loadingRef.current = true
    loadingStartRef.current = Date.now()
    setError(null)
    errorRef.current = null
    initHls(url)
    return destroyHls
  }, [url, initHls, destroyHls])

  const handleRetry = () => {
    retryCountRef.current = 0
    setError(null)
    errorRef.current = null
    setLoading(true)
    loadingRef.current = true
    loadingStartRef.current = Date.now()
    initHls(url)
  }

  const pause = useCallback(() => {
    videoRef.current?.pause()
    isPlayingRef.current = false
  }, [])

  const resume = useCallback(() => {
    tryPlay()
  }, [tryPlay])

  const [videoVolume, setVideoVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  const setVolume = useCallback((v: number) => {
    if (videoRef.current) {
      videoRef.current.volume = Math.max(0, Math.min(1, v))
      setVideoVolume(v)
      setIsMuted(v === 0)
    }
  }, [])

  useImperativeHandle(ref, () => ({
    pause,
    resume,
    toggleFullscreen,
    setVolume,
    get volume() { return videoVolume },
    get mute() { return isMuted },
  }), [pause, resume, toggleFullscreen, setVolume, videoVolume, isMuted])

  return (
    <>
      <style>{`
        @keyframes lptv-color-1 { 0%,100%{color:#ffffff} 50%{color:#f97316} }
        @keyframes lptv-color-2 { 0%,100%{color:#ffffff} 50%{color:#ef4444} }
        @keyframes lptv-color-3 { 0%,100%{color:#ffffff} 50%{color:#3b82f6} }
        @keyframes lptv-color-4 { 0%,100%{color:#ffffff} 50%{color:#22c55e} }
      `}</style>
      <div ref={containerRef} className="relative w-full h-full bg-black" style={{ height: '100%', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        style={{ maxHeight: '100%', maxWidth: '100%' }}
        onLoadedData={() => {
          clearAllTimers()
          isPlayingRef.current = true
        }}
        onPlaying={() => {
          clearAllTimers()
          isPlayingRef.current = true
          finishLoading()
        }}
        onClick={() => {
          if (videoRef.current) {
            if (isPlayingRef.current) {
              videoRef.current.pause()
              isPlayingRef.current = false
            } else {
              tryPlay()
            }
          }
        }}
      />
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-1">
            <span className="text-4xl font-black tracking-widest" style={{ animation: 'lptv-color-1 1.2s ease-in-out infinite' }}>L</span>
            <span className="text-4xl font-black tracking-widest" style={{ animation: 'lptv-color-2 1.2s ease-in-out infinite 0.15s' }}>P</span>
            <span className="text-4xl font-black tracking-widest" style={{ animation: 'lptv-color-3 1.2s ease-in-out infinite 0.3s' }}>T</span>
            <span className="text-4xl font-black tracking-widest" style={{ animation: 'lptv-color-4 1.2s ease-in-out infinite 0.45s' }}>V</span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4">
          <div className="text-white text-lg">{error}</div>
          <button
            onClick={handleRetry}
            className="px-6 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            重试
          </button>
        </div>
      )}
    </div>
    </>
  )
})

HlsPlayer.displayName = 'HlsPlayer'
export default HlsPlayer
