import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import Hls from 'hls.js'

interface HlsPlayerProps {
  url: string
  onError?: (err?: Error) => void
  onPlay?: () => void
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

const HlsPlayer = forwardRef<HlsPlayerRef, HlsPlayerProps>(({ url, onError, onPlay }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(true)
  const errorRef = useRef<string | null>(null)
  const retryCountRef = useRef(0)
  const MAX_RETRIES = 3
  const timeoutRef = useRef<number | null>(null)
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
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
  }, [clearAllTimers])

  const finishLoading = useCallback(() => {
    loadingRef.current = false
    onPlay?.()
  }, [onPlay])

  // 安全兜底：onCanPlay/onPlaying 在某些浏览器组合下可能不触发，
  // 视频有足够缓冲后（3s）自动清除加载遮罩
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    let cancelled = false
    const clearOnBuffer = () => {
      if (cancelled || !loadingRef.current) return
      const buffered = v.buffered
      if (buffered.length > 0 && buffered.end(0) > 1) {
        finishLoading()
      }
    }
    const onCanPlay = () => { if (!cancelled) finishLoading() }
    const onPlaying = () => { if (!cancelled) finishLoading() }
    v.addEventListener('canplay', onCanPlay)
    v.addEventListener('playing', onPlaying)
    const t = window.setTimeout(clearOnBuffer, 5000)
    return () => {
      cancelled = true
      v.removeEventListener('canplay', onCanPlay)
      v.removeEventListener('playing', onPlaying)
      clearTimeout(t)
    }
  }, [url, finishLoading])

  const tryPlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.play().then(() => {
      isPlayingRef.current = true
      loadingRef.current = false
      onPlay?.()
    }).catch(() => {
      v.muted = true
      setIsMuted(true)
      v.play().then(() => {
        isPlayingRef.current = true
        loadingRef.current = false
        onPlay?.()
      }).catch(() => {
        isPlayingRef.current = false
      })
    })
  }, [onPlay])

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
    loadingStartRef.current = Date.now()
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
        clearAllTimers()
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
          setError('频道流解析失败，尝试切换备用质量')
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
    // 初始安全检查：如果视频已有缓冲数据（比如切换 URL 过快），立即清除遮罩
    requestAnimationFrame(() => {
      const v = videoRef.current
      if (v && v.buffered.length > 0 && v.buffered.end(0) > 1 && loadingRef.current) {
        finishLoading()
      }
    })
  }, [destroyHls, onError, clearAllTimers, finishLoading, tryPlay])

  useEffect(() => {
    if (!url) return
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
    <div ref={containerRef} className="relative w-full h-full bg-black" style={{ height: '100%', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        muted
        autoPlay
        style={{ maxHeight: '100%', maxWidth: '100%' }}
        onLoadedData={() => {
          clearAllTimers()
          isPlayingRef.current = true
        }}
        onCanPlay={() => {
          clearAllTimers()
          isPlayingRef.current = true
          finishLoading()
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
  )
})

HlsPlayer.displayName = 'HlsPlayer'
export default HlsPlayer
