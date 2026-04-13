import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePlayerStore = defineStore('player', () => {
  const isPlaying = ref(false)
  const currentUrl = ref<string | null>(null)
  const error = ref<string | null>(null)
  const volume = ref(1)
  const muted = ref(false)
  const loading = ref(false)

  function play(url: string) {
    isPlaying.value = true
    currentUrl.value = url
    error.value = null
  }

  function pause() {
    isPlaying.value = false
  }

  function setError(message: string) {
    error.value = message
    isPlaying.value = false
  }

  function clearError() {
    error.value = null
  }

  function setVolume(vol: number) {
    volume.value = Math.max(0, Math.min(1, vol))
  }

  function toggleMute() {
    muted.value = !muted.value
  }

  function reset() {
    isPlaying.value = false
    currentUrl.value = null
    error.value = null
    loading.value = false
  }

  return {
    isPlaying,
    currentUrl,
    error,
    volume,
    muted,
    loading,
    play,
    pause,
    setError,
    clearError,
    setVolume,
    toggleMute,
    reset
  }
})
