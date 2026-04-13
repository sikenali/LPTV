<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import Hls from 'hls.js'
import { usePlayerStore } from '@/stores/player'
import { isExternalUrl } from '@/services/http'

const props = defineProps<{ url: string }>()
const emit = defineEmits<{ error: [] }>()
const playerContainer = ref<HTMLElement | null>(null)
let hls: Hls | null = null
const playerStore = usePlayerStore()

onMounted(() => { if (playerContainer.value) initPlayer() })
onBeforeUnmount(() => { destroyPlayer() })
watch(() => props.url, () => { destroyPlayer(); if (playerContainer.value) initPlayer() })

/**
 * 将 URL 转换为代理路径（与 http.ts 中的逻辑一致）
 */
function toProxyUrl(url: string): string {
  if (!import.meta.env.DEV) return url
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return url
  return `/api/proxy?url=${encodeURIComponent(url)}`
}

function initPlayer() {
  if (!playerContainer.value) return
  const video = document.createElement('video')
  video.controls = true
  video.autoplay = true
  video.style.width = '100%'
  video.style.height = '100%'
  playerContainer.value.appendChild(video)

  if (Hls.isSupported()) {
    hls = new Hls({
      // 开发环境下通过代理获取 .m3u8 和 .ts 文件
      xhrSetup: (xhr, requestUrl) => {
        if (import.meta.env.DEV && isExternalUrl(requestUrl)) {
          const proxyUrl = toProxyUrl(requestUrl)
          xhr.open('GET', proxyUrl, true)
        }
      }
    })
    
    // 加载源时使用代理 URL（开发环境）
    const sourceUrl = import.meta.env.DEV ? toProxyUrl(props.url) : props.url
    hls.loadSource(sourceUrl)
    hls.attachMedia(video)
    hls.on(Hls.Events.ERROR, (_event, data) => {
      playerStore.setError('频道暂时不可用，请稍后重试')
      // 致命错误触发无信号页面
      if (data.fatal) {
        emit('error')
      }
    })
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari 原生 HLS 支持
    video.src = import.meta.env.DEV ? toProxyUrl(props.url) : props.url
    video.onerror = () => {
      playerStore.setError('频道暂时不可用，请稍后重试')
      emit('error')
    }
  }
  video.onplay = () => playerStore.play(props.url)
  video.onpause = () => playerStore.pause()
}

function destroyPlayer() {
  if (hls) { hls.destroy(); hls = null }
  if (playerContainer.value) {
    while (playerContainer.value.firstChild) playerContainer.value.removeChild(playerContainer.value.firstChild)
  }
}
</script>

<template>
  <div ref="playerContainer" class="video-player"></div>
</template>

<style scoped lang="scss">
.video-player { width: 100%; height: 100%; background-color: #000; }
</style>
