import { defineStore } from 'pinia'

export type PlayerCore = 'hls' | 'native' | 'dplayer'
export type DecodeMode = 'soft' | 'hard' | 'auto'
export type Quality = 'auto' | '1080p' | '720p' | '480p'

const STORAGE_KEY = 'lptv_player_settings'

function loadDefaults(): { core: PlayerCore; decodeMode: DecodeMode; quality: Quality } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return { core: 'hls', decodeMode: 'auto', quality: 'auto' }
}

export const usePlayerSettingsStore = defineStore('playerSettings', {
  state: () => loadDefaults(),
  actions: {
    setCore(core: PlayerCore) {
      this.core = core
      this._save()
    },
    setDecodeMode(decodeMode: DecodeMode) {
      this.decodeMode = decodeMode
      this._save()
    },
    setQuality(quality: Quality) {
      this.quality = quality
      this._save()
    },
    _save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        core: this.core,
        decodeMode: this.decodeMode,
        quality: this.quality
      }))
    }
  }
})
