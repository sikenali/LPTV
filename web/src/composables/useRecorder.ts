/**
 * useRecorder — 基于 MediaRecorder 的视频录制 Composable
 *
 * 后端 API:
 *   POST /api/record/open   → { ok, id }
 *   POST /api/record/append → { ok, size }
 *   POST /api/record/close  → { ok, path }
 */

export function useRecorder() {
  const isSupported = () =>
    !!(window.MediaRecorder && HTMLVideoElement.prototype.captureStream)

  const use = (videoEl: HTMLVideoElement | null, channel: string = '直播') => {
    let mediaRecorder: MediaRecorder | null = null
    let audioCtx: AudioContext | null = null
    let audioSrcNode: MediaElementAudioSourceNode | null = null
    let rid: string | null = null
    let startTime = 0
    let timer: ReturnType<typeof setInterval> | null = null
    let totalBytes = 0
    let rafId = 0
    let stopped = false

    const duration = { value: 0 }
    const bytes = { value: 0 }
    const hasAudio = { value: false }
    const status = { value: 'idle' as 'idle' | 'recording' | 'paused' | 'error' }

    const apiBase = (import.meta as any).env?.VITE_API_BASE || '/_page'

    async function open() {
      if (!videoEl || !videoEl.videoWidth) throw new Error('视频尚未就绪')
      if (!isSupported()) throw new Error('浏览器不支持录制')

      const mime = pickMimeType()
      if (!mime) throw new Error('不支持 webm 编码')

      // 创建 canvas + captureStream
      const canvas = document.createElement('canvas')
      canvas.width = videoEl.videoWidth
      canvas.height = videoEl.videoHeight
      const ctx = canvas.getContext('2d')!
      const videoStream = canvas.captureStream(0)

      // 音频混音（可选）
      let mergedStream = videoStream
      try {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        if (audioCtx.state === 'suspended') await audioCtx.resume()
        audioSrcNode = audioCtx.createMediaElementSource(videoEl)
        const dest = audioCtx.createMediaStreamDestination()
        audioSrcNode.connect(dest)
        audioSrcNode.connect(audioCtx.destination)
        const tracks = [...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()]
        if (tracks.some(t => t.kind === 'audio')) {
          hasAudio.value = true
          mergedStream = new MediaStream(tracks)
        }
      } catch { hasAudio.value = false }

      mediaRecorder = new MediaRecorder(mergedStream, {
        mimeType: mime,
        videoBitsPerSecond: 4_000_000,
      })

      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (e) => {
        if (!e.data || !e.data.size) return
        totalBytes += e.data.size
        bytes.value = totalBytes
        // 直接本地预览，暂不推流（LPK 场景用 base64 上传）
        chunks.push(e.data)
      }

      mediaRecorder.onerror = () => { status.value = 'error' }

      const res = await fetch('/api/record/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'open failed')
      rid = data.id
      startTime = Date.now()
      status.value = 'recording'
      timer = setInterval(() => {
        duration.value = Math.floor((Date.now() - startTime) / 1000)
      }, 1000)

      // 帧绘制循环
      function drawFrame() {
        if (stopped || !videoEl || videoEl.paused) { rafId = requestAnimationFrame(drawFrame); return }
        try { ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height) } catch {}
        rafId = requestAnimationFrame(drawFrame)
      }
      drawFrame()

      mediaRecorder.start(1000) // 每秒收集一次数据
      return { rid: data.id, stop: stopRecording }
    }

    async function stopRecording() {
      stopped = true
      if (timer) clearInterval(timer)
      cancelAnimationFrame(rafId)
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          mediaRecorder!.onstop = () => resolve()
          mediaRecorder!.stop()
        })
      }
      try { audioSrcNode?.disconnect() } catch {}
      try { audioCtx?.close() } catch {}
      audioCtx = null
      audioSrcNode = null
      mediaRecorder = null
      timer = null
      rafId = 0

      if (!rid) return null
      const res = await fetch('/api/record/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rid }),
      })
      const data = await res.json()
      rid = null
      duration.value = 0
      bytes.value = 0
      status.value = 'idle'
      return data
    }

    function pickMimeType() {
      const types = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ]
      for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) return t
      }
      return null
    }

    return {
      open,
      stopRecording,
      duration,
      bytes,
      hasAudio,
      status,
    }
  }

  return { isSupported, use }
}
