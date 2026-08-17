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
}

function proxyUrl(url: string) {
  const base = '/api/proxy/stream'
  return `${base}?url=${encodeURIComponent(url)}`
}

const LOADING_TIMEOUT = 30000

const HlsPlayer = forwardRef<HlsPlayerRef, HlsPlayerProps>(({ url, onError }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPlayOverlay, setShowPlayOverlay] = useState(false)
  const loadingRef = useRef(true)
  const errorRef = useRef<string | null>(null)
  const retryCountRef = useRef(0)
  const MAX_RETRIES = 3
  const timeoutRef = useRef<number | null>(null)
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
      loadingRef.current = false
      setError(null)
      videoRef.current?.play().then(() => {
        isPlayingRef.current = true
        setShowPlayOverlay(false)
      }).catch(() => {
        setShowPlayOverlay(true)
      })
      retryCountRef.current = 0
      errorTypeRef.current = null
    })

    hls.on(Hls.Events.LEVEL_SWITCHED, () => {
      if (loadingRef.current) {
        clearAllTimers()
        loadingRef.current = false
        setError(null)
      }
    })

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          clearAllTimers()
          setError('网络连接失败，无法加载频道')
          onError?.(new Error('network_error'))
          hls.destroy()
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          clearAllTimers()
          setError('播放器错误，尝试切换清晰度重试')
          errorTypeRef.current = 'media'
          retryCountRef.current++
          if (retryCountRef.current <= MAX_RETRIES) {
            hls.recoverMediaError()
          } else {
            onError?.(new Error('media_error_max_retries'))
          }
        } else {
          hls.recoverMediaError()
        }
        return
      }

      switch (data.details) {
        case Hls.ErrorDetails.MANIFEST_PARSING_ERROR:
        case Hls.ErrorDetails.MANIFEST_LOAD_ERROR:
          clearAllTimers()
          setError('无法加载频道列表，该源可能已失效')
          onError?.(new Error('manifest_error'))
          hls.destroy()
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
        loadingRef.current = false
      }
    })

    hls.attachMedia(videoRef.current)
  }, [destroyHls, onError, clearAllTimers])

  useEffect(() => {
    if (!url) return
    setLoading(true)
    loadingRef.current = true
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
    initHls(url)
  }

  const pause = useCallback(() => {
    videoRef.current?.pause()
    isPlayingRef.current = false
    setShowPlayOverlay(false)
  }, [])

  const resume = useCallback(() => {
    videoRef.current?.play().then(() => {
      isPlayingRef.current = true
      setShowPlayOverlay(false)
    }).catch(() => setShowPlayOverlay(true))
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  useImperativeHandle(ref, () => ({
    pause,
    resume,
    toggleFullscreen,
  }), [pause, resume, toggleFullscreen])

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black" style={{ height: '100%', minHeight: 0 }}>
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        onLoadedData={() => {
          isPlayingRef.current = true
          setShowPlayOverlay(false)
        }}
        onClick={() => {
          if (videoRef.current) {
            if (isPlayingRef.current) {
              videoRef.current.pause()
            } else {
              videoRef.current.play()
                .then(() => {
                  isPlayingRef.current = true
                  setShowPlayOverlay(false)
                })
                .catch(() => setShowPlayOverlay(true))
            }
          }
        }}
      />
      {showPlayOverlay && !error && (
        <button
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.play()
                .then(() => {
                  isPlayingRef.current = true
                  setShowPlayOverlay(false)
                })
                .catch(() => setShowPlayOverlay(true))
            }
          }}
          className="absolute inset-0 w-full h-full flex items-center justify-center bg-transparent cursor-pointer"
        >
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm hover:bg-black/70 transition-colors">
            <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </button>
      )}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white text-lg">加载中...</div>
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
  )
})

HlsPlayer.displayName = 'HlsPlayer'
export default HlsPlayer
