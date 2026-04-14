<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import Hls from 'hls.js'
import { usePlayerStore } from '@/stores/player'
import { isExternalUrl, toProxyUrl } from '@/services/http'

const props = defineProps<{ url: string }>()
const emit = defineEmits<{ error: [] }>()
const playerContainer = ref<HTMLElement | null>(null)
let hls: Hls | null = null
let recoveryAttempts = 0
const MAX_RECOVERY_ATTEMPTS = 3
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
  recoveryAttempts = 0

  if (Hls.isSupported()) {
    hls = new Hls({
      // 重试配置
      maxLoadingDelay: 10,
      maxMaxBufferLength: 30,
      maxBufferLength: 10,
      maxBufferSize: 60 * 1000 * 1000, // 60MB
      // 自适应码率
      startLevel: -1,
      capLevelToPlayerSize: true,
      // 启用 worker 提高性能
      enableWorker: true,
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

    // 清单解析完成后开始播放
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      playerStore.setLoading(false)
      recoveryAttempts = 0
      video.play().catch(() => {
        playerStore.setError('自动播放被阻止，请点击播放按钮')
      })
    })

    // 错误恢复策略
    hls.on(Hls.Events.ERROR, (_event, data) => {
      playerStore.setLoading(false)

      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            // 网络致命错误：尝试恢复
            console.warn('HLS 网络致命错误，尝试恢复...', data.details)
            if (recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
              recoveryAttempts++
              hls?.startLoad()
            } else {
              playerStore.setError('网络连接失败，请稍后重试')
              emit('error')
            }
            break

          case Hls.ErrorTypes.MEDIA_ERROR:
            // 媒体致命错误：尝试恢复媒体错误
            console.warn('HLS 媒体致命错误，尝试恢复...', data.details)
            if (recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
              recoveryAttempts++
              hls?.recoverMediaError()
            } else {
              playerStore.setError('视频格式不支持或源已失效')
              emit('error')
            }
            break

          default:
            // 其他致命错误：直接放弃
            console.error('HLS 未知致命错误', data.details)
            playerStore.setError('频道暂时不可用，请稍后重试')
            emit('error')
            break
        }
      } else {
        // 非致命错误：根据类型尝试恢复
        switch (data.details) {
          case Hls.ErrorDetails.MANIFEST_LOAD_ERROR:
          case Hls.ErrorDetails.LEVEL_LOAD_ERROR:
          case Hls.ErrorDetails.FRAG_LOAD_ERROR:
            console.warn('HLS 加载错误（非致命），重试中...', data.details)
            // hls.js 会自动重试，这里只记录日志
            break

          case Hls.ErrorDetails.BUFFER_STALLED_ERROR:
            console.warn('HLS 缓冲区停滞，尝试恢复...')
            hls?.startLoad()
            break

          default:
            console.warn('HLS 非致命错误', data.details)
            break
        }
      }
    })

    // 级别加载完成 - 记录当前清晰度
    hls.on(Hls.Events.LEVEL_LOADED, () => {
      playerStore.setLoading(false)
      recoveryAttempts = 0 // 成功加载后重置恢复计数
    })

    // 片段加载完成
    hls.on(Hls.Events.FRAG_LOADED, () => {
      recoveryAttempts = 0 // 成功加载片段后重置恢复计数
    })

  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari 原生 HLS 支持
    video.src = toProxyUrl(props.url)
    video.onerror = () => {
      playerStore.setLoading(false)
      playerStore.setError('频道暂时不可用，请稍后重试')
      emit('error')
    }
    video.onloadeddata = () => {
      playerStore.setLoading(false)
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
    playerStore.setMuted(video.muted)
  }
}

function destroyPlayer() {
  if (hls) { hls.destroy(); hls = null }
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
