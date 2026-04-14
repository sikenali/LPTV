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
let recoveryAttempts = 0
const MAX_RECOVERY_ATTEMPTS = 3
const playerStore = usePlayerStore()
const playerSettings = usePlayerSettingsStore()

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
  const video = document.createElement('video')
  video.controls = false
  video.autoplay = true
  video.style.width = '100%'
  video.style.height = '100%'
  playerContainer.value!.appendChild(video)

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
  hls.attachMedia(video)

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    playerStore.setLoading(false)
    recoveryAttempts = 0
    video.play().catch(() => playerStore.setError('自动播放被阻止，请点击播放按钮'))
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

  video.onplay = () => { playerStore.play(props.url); playerStore.setLoading(false) }
  video.onpause = () => playerStore.pause()
  video.onended = () => playerStore.pause()
  video.ontimeupdate = () => {
    if (video.duration && !isNaN(video.duration)) {
      playerStore.setCurrentTime(video.currentTime)
      playerStore.setTotalTime(video.duration)
    }
  }
  video.onvolumechange = () => {
    playerStore.setVolume(video.volume)
    playerStore.setMuted(video.muted)
  }
}

function initNativePlayer() {
  if (!playerContainer.value) return
  const video = document.createElement('video')
  video.controls = false
  video.autoplay = true
  video.style.width = '100%'
  video.style.height = '100%'
  video.src = toProxyUrl(props.url)
  playerContainer.value.appendChild(video)

  video.onloadeddata = () => playerStore.setLoading(false)
  video.onerror = () => {
    playerStore.setLoading(false)
    playerStore.setError('频道暂时不可用，请稍后重试')
    emit('error')
  }
  video.onplay = () => { playerStore.play(props.url); playerStore.setLoading(false) }
  video.onpause = () => playerStore.pause()
  video.onended = () => playerStore.pause()
  video.ontimeupdate = () => {
    if (video.duration && !isNaN(video.duration)) {
      playerStore.setCurrentTime(video.currentTime)
      playerStore.setTotalTime(video.duration)
    }
  }
  video.onvolumechange = () => {
    playerStore.setVolume(video.volume)
    playerStore.setMuted(video.muted)
  }
}

function initDPlayer() {
  if (!playerContainer.value) return
  playerStore.setLoading(false)

  dp = new DPlayer({
    container: playerContainer.value,
    autoplay: true,
    video: {
      url: props.url,
      type: 'hls',
    },
  })

  dp.on('play', () => playerStore.play(props.url))
  dp.on('pause', () => playerStore.pause())
  dp.on('ended', () => playerStore.pause())
  dp.on('error', () => {
    playerStore.setError('频道暂时不可用，请稍后重试')
    emit('error')
  })
}

function destroyPlayer() {
  if (hls) { hls.destroy(); hls = null }
  if (dp) { dp.destroy(); dp = null }
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
