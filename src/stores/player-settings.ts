import { defineStore } from 'pinia'

export type PlayerCore = 'hls' | 'native' | 'dplayer'
export type DecodeMode = 'soft' | 'hard' | 'auto'
export type Quality = 'auto' | '1080p' | '720p' | '480p'

const STORAGE_KEY = 'lptv_player_settings'

interface PlayerSettings {
  core: PlayerCore
  decodeMode: DecodeMode
  quality: Quality
  autoplay: boolean
  hideMouse: boolean
  rememberVolume: boolean
  autoFullscreen: boolean
}

function loadDefaults(): PlayerSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return { core: 'hls', decodeMode: 'auto', quality: 'auto', autoplay: true, hideMouse: false, rememberVolume: true, autoFullscreen: false }
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
    setAutoplay(autoplay: boolean) {
      this.autoplay = autoplay
      this._save()
    },
    setHideMouse(hideMouse: boolean) {
      this.hideMouse = hideMouse
      this._save()
    },
    setRememberVolume(rememberVolume: boolean) {
      this.rememberVolume = rememberVolume
      this._save()
    },
    setAutoFullscreen(autoFullscreen: boolean) {
      this.autoFullscreen = autoFullscreen
      this._save()
    },
    _save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        core: this.core,
        decodeMode: this.decodeMode,
        quality: this.quality,
        autoplay: this.autoplay,
        hideMouse: this.hideMouse,
        rememberVolume: this.rememberVolume,
        autoFullscreen: this.autoFullscreen
      }))
    }
  }
})
