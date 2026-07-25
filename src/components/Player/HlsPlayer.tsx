import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'

interface HlsPlayerProps {
  url: string
  channelName?: string
  channelLogo?: string
  onError?: (err: Error) => void
}

function proxyUrl(url: string) {
  const base = '/api/proxy/stream'
  return `${base}?url=${encodeURIComponent(url)}`
}

const LOADING_TIMEOUT = 30000

export default function HlsPlayer({ url, channelName: _channelName, channelLogo: _channelLogo, onError }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const retryCountRef = useRef(0)
  const MAX_RETRIES = 3
  const timeoutRef = useRef<number | null>(null)
  const errorTypeRef = useRef<string | null>(null)

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

    timeoutRef.current = window.setTimeout(() => {
      if (loading && !error) {
        setError('加载超时，请检查网络或频道源')
        onError?.(new Error('loading_timeout'))
      }
    }, LOADING_TIMEOUT)

    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      hls.loadSource(proxyUrl(src))
    })

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      clearAllTimers()
      setLoading(false)
      setError(null)
      videoRef.current?.play().catch(() => {})
      retryCountRef.current = 0
      errorTypeRef.current = null
    })

    hls.on(Hls.Events.LEVEL_SWITCHED, () => {
      if (loading) {
        clearAllTimers()
        setLoading(false)
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
      if (loading) {
        clearAllTimers()
        setLoading(false)
      }
    })

    hls.attachMedia(videoRef.current)
  }, [destroyHls, onError, loading, clearAllTimers])

  useEffect(() => {
    if (!url) return
    setLoading(true)
    setError(null)
    initHls(url)
    return destroyHls
  }, [url, initHls, destroyHls])

  const handleRetry = () => {
    retryCountRef.current = 0
    setError(null)
    setLoading(true)
    initHls(url)
  }

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        controls
      />
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
}
