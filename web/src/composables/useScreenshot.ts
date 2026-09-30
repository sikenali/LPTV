/**
 * useScreenshot — 截图 Composable
 *
 * 后端 API:
 *   POST /api/shot → { ok, name }
 */

export function useScreenshot() {
  /**
   * 从 video 元素截取当前帧并上传
   * @returns { ok, name } 或 null（失败）
   */
  async function capture(
    videoEl: HTMLVideoElement | null,
    channel: string = '直播',
    format: 'image/png' | 'image/jpeg' = 'image/png'
  ): Promise<{ ok: boolean; name?: string; error?: string } | null> {
    if (!videoEl || !videoEl.videoWidth) {
      return { ok: false, error: '视频尚未就绪' }
    }

    const canvas = document.createElement('canvas')
    canvas.width = videoEl.videoWidth
    canvas.height = videoEl.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return { ok: false, error: '无法创建 canvas' }

    ctx.drawImage(videoEl, 0, 0)
    const dataUrl = canvas.toDataURL(format, 0.92)
    const base64 = dataUrl.split(',')[1]

    try {
      const res = await fetch('/api/shot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, data: base64 }),
      })
      const data = await res.json()
      if (!data.ok) return { ok: false, error: data.error }
      return { ok: true, name: data.name }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  }

  /**
   * 触发浏览器下载截图（本地预览用）
   */
  function download(canvas: HTMLCanvasElement, filename: string) {
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = filename
    a.click()
  }

  return { capture, download }
}
