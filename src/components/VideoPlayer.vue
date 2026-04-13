<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import Hls from 'hls.js'
import { usePlayerStore } from '@/stores/player'

const props = defineProps<{ url: string }>()
const playerContainer = ref<HTMLElement | null>(null)
let hls: Hls | null = null
const playerStore = usePlayerStore()

onMounted(() => { if (playerContainer.value) initPlayer() })
onBeforeUnmount(() => { destroyPlayer() })
watch(() => props.url, () => { destroyPlayer(); if (playerContainer.value) initPlayer() })

function initPlayer() {
  if (!playerContainer.value) return
  const video = document.createElement('video')
  video.controls = true
  video.autoplay = true
  video.style.width = '100%'
  video.style.height = '100%'
  playerContainer.value.appendChild(video)

  if (Hls.isSupported()) {
    hls = new Hls()
    hls.loadSource(props.url)
    hls.attachMedia(video)
    hls.on(Hls.Events.ERROR, () => playerStore.setError('频道暂时不可用，请稍后重试'))
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = props.url
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
