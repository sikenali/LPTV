export interface PlayerState {
  isPlaying: boolean
  currentUrl: string | null
  error: string | null
  volume: number
  muted: boolean
  loading: boolean
}
