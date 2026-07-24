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

export default function HlsPlayer({ url, onError }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const retryCountRef = useRef(0)
  const MAX_RETRIES = 3

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
  }, [])

  const initHls = useCallback((src: string) => {
    destroyHls()
    if (!videoRef.current) return

    if (!Hls.isSupported()) {
      if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = proxyUrl(src)
        return
      }
      setError('浏览器不支持 HLS 播放')
      return
    }

    const hls = new Hls()
    hlsRef.current = hls
    retryCountRef.current = 0

    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      hls.loadSource(proxyUrl(src))
    })

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setLoading(false)
      setError(null)
      videoRef.current?.play().catch(() => {})
    })

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        retryCountRef.current++
        if (retryCountRef.current <= MAX_RETRIES) {
          hls.recoverMediaError()
        } else {
          setError('播放失败')
          onError?.(new Error('播放失败'))
        }
      }
    })

    hls.attachMedia(videoRef.current)
  }, [destroyHls, onError])

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
