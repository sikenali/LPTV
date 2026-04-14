<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import Hls from 'hls.js'
import DPlayer from 'dplayer'
import { usePlayerStore } from '@/stores/player'
import { usePlayerSettingsStore } from '@/stores/player-settings'
import { isExternalUrl, toProxyUrl } from '@/services/http'

const props = defineProps<{ url: string }>()
const emit = defineEmits<{ error: [] }>()
const playerContainer = ref<HTMLElement | null>(null)
let hls: Hls | null = null
let dp: DPlayer | null = null
let videoEl: HTMLVideoElement | null = null
let recoveryAttempts = 0
const MAX_RECOVERY_ATTEMPTS = 3
const playerStore = usePlayerStore()
const playerSettings = usePlayerSettingsStore()

// 暴露播放器方法供父组件调用
defineExpose({
  togglePlay: () => {
    if (!videoEl) return
    if (videoEl.paused) {
      videoEl.play().catch(() => playerStore.setError('播放失败，请稍后重试'))
    } else {
      videoEl.pause()
    }
  },
  seek: (ratio: number) => {
    if (!videoEl || !videoEl.duration || isNaN(videoEl.duration) || !isFinite(videoEl.duration)) return
    videoEl.currentTime = ratio * videoEl.duration
  },
  setVolume: (percent: number) => {
    if (!videoEl) return
    videoEl.volume = percent
    playerStore.setVolume(percent)
  },
  toggleMute: () => {
    if (!videoEl) return
    videoEl.muted = !videoEl.muted
    playerStore.setMuted(videoEl.muted)
  }
})

onMounted(() => { if (playerContainer.value) initPlayer() })
onBeforeUnmount(() => { destroyPlayer() })
watch(() => props.url, () => { destroyPlayer(); if (playerContainer.value) initPlayer() })
// 监听内核设置变化
watch(() => playerSettings.core, () => { destroyPlayer(); if (playerContainer.value) initPlayer() })

function initPlayer() {
  if (!playerContainer.value) return
  playerStore.setLoading(true)
  recoveryAttempts = 0

  const core = playerSettings.core
  switch (core) {
    case 'hls':
      initHlsPlayer()
      break
    case 'native':
      initNativePlayer()
      break
    case 'dplayer':
      initDPlayer()
      break
    default:
      initHlsPlayer()
  }
}

function initHlsPlayer() {
  if (!Hls.isSupported()) { initNativePlayer(); return }
  videoEl = document.createElement('video')
  videoEl.controls = false
  videoEl.autoplay = true
  videoEl.style.width = '100%'
  videoEl.style.height = '100%'
  playerContainer.value!.appendChild(videoEl)

  hls = new Hls({
    maxLoadingDelay: 10,
    maxMaxBufferLength: 30,
    maxBufferLength: 10,
    maxBufferSize: 60 * 1000 * 1000,
    startLevel: -1,
    capLevelToPlayerSize: true,
    enableWorker: true,
    xhrSetup: (xhr, requestUrl) => {
      if (import.meta.env.DEV && isExternalUrl(requestUrl)) {
        xhr.open('GET', toProxyUrl(requestUrl), true)
      }
    }
  })

  hls.loadSource(toProxyUrl(props.url))
  hls.attachMedia(videoEl)

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    playerStore.setLoading(false)
    recoveryAttempts = 0
    videoEl!.play().catch(() => playerStore.setError('自动播放被阻止，请点击播放按钮'))
  })

  hls.on(Hls.Events.ERROR, (_event, data) => {
    playerStore.setLoading(false)
    if (data.fatal) {
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR && recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
        recoveryAttempts++
        hls?.startLoad()
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
        recoveryAttempts++
        hls?.recoverMediaError()
      } else {
        playerStore.setError('频道暂时不可用，请稍后重试')
        emit('error')
      }
    }
  })

  hls.on(Hls.Events.LEVEL_LOADED, () => { playerStore.setLoading(false); recoveryAttempts = 0 })
  hls.on(Hls.Events.FRAG_LOADED, () => { recoveryAttempts = 0 })

  videoEl.onplay = () => { playerStore.play(props.url); playerStore.setLoading(false) }
  videoEl.onpause = () => playerStore.pause()
  videoEl.onended = () => playerStore.pause()
  videoEl.ontimeupdate = () => {
    if (videoEl!.duration && !isNaN(videoEl!.duration)) {
      playerStore.setCurrentTime(videoEl!.currentTime)
      playerStore.setTotalTime(videoEl!.duration)
    }
  }
  videoEl.onvolumechange = () => {
    playerStore.setVolume(videoEl!.volume)
    playerStore.setMuted(videoEl!.muted)
  }
}

function initNativePlayer() {
  if (!playerContainer.value) return
  videoEl = document.createElement('video')
  videoEl.controls = false
  videoEl.autoplay = true
  videoEl.style.width = '100%'
  videoEl.style.height = '100%'
  videoEl.src = toProxyUrl(props.url)
  playerContainer.value.appendChild(videoEl)

  videoEl.onloadeddata = () => playerStore.setLoading(false)
  videoEl.onerror = () => {
    playerStore.setLoading(false)
    playerStore.setError('频道暂时不可用，请稍后重试')
    emit('error')
  }
  videoEl.onplay = () => { playerStore.play(props.url); playerStore.setLoading(false) }
  videoEl.onpause = () => playerStore.pause()
  videoEl.onended = () => playerStore.pause()
  videoEl.ontimeupdate = () => {
    if (videoEl!.duration && !isNaN(videoEl!.duration)) {
      playerStore.setCurrentTime(videoEl!.currentTime)
      playerStore.setTotalTime(videoEl!.duration)
    }
  }
  videoEl.onvolumechange = () => {
    playerStore.setVolume(videoEl!.volume)
    playerStore.setMuted(videoEl!.muted)
  }
}

function initDPlayer() {
  if (!playerContainer.value) return
  dp = new DPlayer({
    container: playerContainer.value,
    autoplay: true,
    video: {
      url: toProxyUrl(props.url),
      type: 'hls',
    },
  })

  // DPlayer 初始化后获取 video 元素
  videoEl = dp.video

  dp.on('canplay', () => {
    playerStore.setLoading(false)
  })

  dp.on('play', () => { playerStore.play(props.url); playerStore.setLoading(false) })
  dp.on('pause', () => playerStore.pause())
  dp.on('ended', () => playerStore.pause())
  dp.on('error', () => {
    playerStore.setLoading(false)
    // DPlayer 错误恢复机制：尝试重新播放
    if (recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
      recoveryAttempts++
      if (videoEl) {
        videoEl.currentTime = 0
        videoEl.load()
        videoEl.play().catch(() => {})
      }
    } else {
      playerStore.setError('频道暂时不可用，请稍后重试')
      emit('error')
    }
  })
}

function destroyPlayer() {
  if (hls) { hls.destroy(); hls = null }
  if (dp) { dp.destroy(); dp = null }
  videoEl = null
  recoveryAttempts = 0
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
