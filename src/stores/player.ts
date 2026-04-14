import { defineStore } from 'pinia'

export const usePlayerStore = defineStore('player', {
  state: () => ({
    isPlaying: false,
    currentUrl: null as string | null,
    error: null as string | null,
    volume: 1,
    muted: false,
    loading: false,
    currentTime: 0,
    totalTime: 0
  }),
  actions: {
    play(url: string) { this.currentUrl = url; this.isPlaying = true; this.error = null },
    pause() { this.isPlaying = false },
    setCurrentTime(time: number) { this.currentTime = time },
    setTotalTime(time: number) { this.totalTime = time },
    setVolume(vol: number) { this.volume = Math.max(0, Math.min(1, vol)) },
    setMuted(muted: boolean) { this.muted = muted },
    toggleMute() { this.muted = !this.muted },
    setError(msg: string | null) { this.error = msg },
    setLoading(loading: boolean) { this.loading = loading },
    reset() {
      this.isPlaying = false
      this.currentUrl = null
      this.error = null
      this.loading = false
      this.currentTime = 0
      this.totalTime = 0
      this.volume = 1
      this.muted = false
    }
  }
})
