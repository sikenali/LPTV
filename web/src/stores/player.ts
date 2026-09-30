import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePlayerStore = defineStore('player', () => {
  const currentChannel = ref<string>('cctv1')
  const isRecording = ref(false)
  const recordingDuration = ref(0)
  const lastShot = ref<string | null>(null)

  function setChannel(id: string) {
    currentChannel.value = id
  }

  function startRecording() {
    isRecording.value = true
    recordingDuration.value = 0
  }

  function stopRecording() {
    isRecording.value = false
    recordingDuration.value = 0
  }

  function setLastShot(name: string) {
    lastShot.value = name
  }

  return {
    currentChannel,
    isRecording,
    recordingDuration,
    lastShot,
    setChannel,
    startRecording,
    stopRecording,
    setLastShot,
  }
})
