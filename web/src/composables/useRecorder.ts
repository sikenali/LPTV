/**
 * useRecorder — 基于 MediaRecorder 的视频录制 Composable
 *
 * 后端 API:
 *   POST /api/record/open   → { ok, id }
 *   POST /api/record/append → { ok, size }   (base64 分片)
 *   POST /api/record/close  → { ok, path, size_mb }
 *
 * 要点:
 *   1. captureStream(0) 不会自动产帧, 必须在每帧绘制后调用 track.requestFrame(),
 *      否则录出来是空的 —— 这里手动驱动。
 *   2. createMediaElementSource 对同一个 <video> 只能调用一次, 且建立后音频必须
 *      持续连到 destination, 所以 AudioContext 按元素缓存复用, 绝不 close。
 *   3. append 必须串行, 否则后端写文件顺序错乱。
 */

/** video 元素 → 已建好的音频图 (AudioContext 只能有一个, 且不能关) */
const audioGraphs = new WeakMap<HTMLVideoElement, {
  ctx: AudioContext
  dest: MediaStreamAudioDestinationNode
  src: MediaElementAudioSourceNode
}>()

/** video 元素 → captureStream 的 video track (元素重载后需重建) */
const canvasTracks = new WeakMap<HTMLVideoElement, MediaStreamTrack>()

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => {
      const s = String(fr.result || '')
      const i = s.indexOf(',')
      resolve(i >= 0 ? s.slice(i + 1) : s)
    }
    fr.onerror = () => reject(fr.error || new Error('read failed'))
    fr.readAsDataURL(blob)
  })
}

export function useRecorder() {
  const isSupported = () =>
    !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream)

  const use = (videoEl: HTMLVideoElement | null, channel: string = '直播', base: string = '') => {
    let mediaRecorder: MediaRecorder | null = null
    let rid: string | null = null
    let startTime = 0
    let timer: ReturnType<typeof setInterval> | null = null
    let totalBytes = 0
    let rafId = 0
    let stopped = false
    let chain: Promise<void> = Promise.resolve()
    let uploadError = ''

    const duration = { value: 0 }
    const bytes = { value: 0 }
    const hasAudio = { value: false }
    const status = { value: 'idle' as 'idle' | 'recording' | 'paused' | 'error' }

    async function post(path: string, body: unknown) {
      const r = await fetch(base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return r.json()
    }

    async function open() {
      if (!videoEl || !videoEl.videoWidth) throw new Error('视频尚未就绪')
      if (!isSupported()) throw new Error('浏览器不支持录制')

      const mime = pickMimeType()
      if (!mime) throw new Error('不支持 webm 编码')

      // ── 画面轨 ──
      const canvas = document.createElement('canvas')
      canvas.width = videoEl.videoWidth
      canvas.height = videoEl.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('无法创建 canvas')

      // captureStream(0) = 只在 requestFrame() 时产帧, 精确控制
      const videoStream = canvas.captureStream(0)
      const videoTrack = videoStream.getVideoTracks()[0]
      if (!videoTrack) throw new Error('无法创建视频轨')
      canvasTracks.set(videoEl, videoTrack)

      // ── 音轨 (按元素缓存, 不可重复 createMediaElementSource) ──
      let mergedStream: MediaStream = videoStream
      try {
        let g = audioGraphs.get(videoEl)
        if (!g) {
          const Ctor = window.AudioContext || (window as any).webkitAudioContext
          const ctx2 = new Ctor()
          if (ctx2.state === 'suspended') await ctx2.resume()
          const src = ctx2.createMediaElementSource(videoEl)
          const dest = ctx2.createMediaStreamDestination()
          src.connect(dest)
          // 必须连到 destination, 否则元素静音 (且这个连接要一直留着)
          src.connect(ctx2.destination)
          g = { ctx: ctx2, dest, src }
          audioGraphs.set(videoEl, g)
        }
        const aTracks = g.dest.stream.getAudioTracks()
        if (aTracks.length) {
          hasAudio.value = true
          mergedStream = new MediaStream([...videoStream.getVideoTracks(), ...aTracks])
        }
      } catch (e) {
        // 自动播放策略/解码器限制下拿不到音频, 退化为纯画面
        hasAudio.value = false
        console.warn('[useRecorder] audio unavailable:', e)
      }

      mediaRecorder = new MediaRecorder(mergedStream, {
        mimeType: mime,
        videoBitsPerSecond: 4_000_000,
      })

      // ── 先开服务端会话, 拿到 rid 再开始收数据 ──
      const data = await post('/api/record/open', { channel })
      if (!data || !data.ok) throw new Error((data && (data.error || data.msg)) || 'open failed')
      rid = data.id

      mediaRecorder.ondataavailable = (e) => {
        if (!e.data || !e.data.size) return
        const blob = e.data
        totalBytes += blob.size
        bytes.value = totalBytes
        // 串行上传, 保证后端写文件顺序正确
        chain = chain.then(async () => {
          try {
            const b64 = await blobToBase64(blob)
            const r = await post('/api/record/append', { id: rid, data: b64 })
            if (r && r.ok === false) throw new Error(r.error || r.msg || 'append failed')
          } catch (err) {
            uploadError = String(err)
            console.warn('[useRecorder] append failed:', err)
          }
        })
      }

      mediaRecorder.onerror = () => { status.value = 'error' }

      startTime = Date.now()
      status.value = 'recording'
      timer = setInterval(() => {
        duration.value = Math.floor((Date.now() - startTime) / 1000)
      }, 1000)

      // 帧绘制循环: 画完必须 requestFrame(), 否则 captureStream(0) 不出帧
      function drawFrame() {
        if (stopped) return
        try {
          if (videoEl && !videoEl.paused && videoEl.videoWidth) {
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
            const t = canvasTracks.get(videoEl)
            if (t && t.requestFrame) t.requestFrame()
          }
        } catch {}
        rafId = requestAnimationFrame(drawFrame)
      }
      drawFrame()

      mediaRecorder.start(1000) // 每秒一个分片
      return { rid, stop: stopRecording }
    }

    async function stopRecording() {
      stopped = true
      if (timer) clearInterval(timer)
      cancelAnimationFrame(rafId)
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          mediaRecorder!.onstop = () => resolve()
          try { mediaRecorder!.stop() } catch { resolve() }
        })
      }
      // 等待所有分片上传完成后再关闭, 否则尾部数据会丢
      try { await chain } catch {}

      const curRid = rid
      rid = null
      // 注意: 不关 AudioContext, 也不 disconnect —— 元素下次还要用
      mediaRecorder = null
      timer = null
      rafId = 0

      duration.value = 0
      bytes.value = 0
      const finalStatus = uploadError ? 'error' : 'idle'
      status.value = 'idle'

      if (!curRid) return { ok: false, error: uploadError || '未开启录制会话' }
      const res = await post('/api/record/close', { id: curRid })
      if (uploadError && res && res.ok) {
        return { ...res, ok: false, error: uploadError }
      }
      return { ...res, recorded: totalBytes, uploadError }
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
