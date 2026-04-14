declare module 'dplayer' {
  interface DPlayerVideoOptions {
    url: string
    pic?: string
    type?: string
    customType?: Record<string, any>
  }

  interface DPlayerOptions {
    container?: HTMLElement
    autoplay?: boolean
    video: DPlayerVideoOptions
  }

  interface DPlayerEvents {
    play: () => void
    pause: () => void
    ended: () => void
    error: () => void
    canplay: () => void
    seeking: () => void
    seeked: () => void
    timeupdate: () => void
  }

  export default class DPlayer {
    constructor(options: DPlayerOptions)
    play(): void
    pause(): void
    seek(time: number): void
    toggle(): void
    destroy(): void
    on<T extends keyof DPlayerEvents>(event: T, handler: DPlayerEvents[T]): void
    off<T extends keyof DPlayerEvents>(event: T, handler: DPlayerEvents[T]): void
    video: HTMLVideoElement
  }
}
