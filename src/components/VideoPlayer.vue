<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import Hls from 'hls.js'
import { usePlayerStore } from '@/stores/player'
import { isExternalUrl, toProxyUrl } from '@/services/http'

const props = defineProps<{ url: string }>()
const emit = defineEmits<{ error: [] }>()
const playerContainer = ref<HTMLElement | null>(null)
let hls: Hls | null = null
const playerStore = usePlayerStore()

onMounted(() => { if (playerContainer.value) initPlayer() })
onBeforeUnmount(() => { destroyPlayer() })
watch(() => props.url, () => { destroyPlayer(); if (playerContainer.value) initPlayer() })

function initPlayer() {
  if (!playerContainer.value) return
  const video = document.createElement('video')
  video.controls = false  // 由 PlayerView 控制
  video.autoplay = true
  video.style.width = '100%'
  video.style.height = '100%'
  playerContainer.value.appendChild(video)

  playerStore.setLoading(true)

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
    const sourceUrl = toProxyUrl(props.url)
    hls.loadSource(sourceUrl)
    hls.attachMedia(video)

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      playerStore.setLoading(false)
      video.play().catch(() => {
        playerStore.setError('自动播放被阻止，请点击播放按钮')
      })
    })

    hls.on(Hls.Events.ERROR, (_event, data) => {
      playerStore.setLoading(false)
      if (data.fatal) {
        playerStore.setError('频道暂时不可用，请稍后重试')
        emit('error')
      }
    })
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari 原生 HLS 支持
    video.src = toProxyUrl(props.url)
    video.onerror = () => {
      playerStore.setLoading(false)
      playerStore.setError('频道暂时不可用，请稍后重试')
      emit('error')
    }
  }

  // 同步播放状态到 store
  video.onplay = () => {
    playerStore.play(props.url)
    playerStore.setLoading(false)
  }
  video.onpause = () => playerStore.pause()
  video.onended = () => playerStore.pause()

  // 同步时间和音量
  video.ontimeupdate = () => {
    if (video.duration && !isNaN(video.duration)) {
      playerStore.setCurrentTime(video.currentTime)
      playerStore.setTotalTime(video.duration)
    }
  }
  video.onvolumechange = () => {
    playerStore.setVolume(video.volume)
    if (video.muted !== playerStore.muted) {
      playerStore.toggleMute()
    }
  }
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
