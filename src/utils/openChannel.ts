import { IptvChannel } from '../data/iptvChannels';

export interface LazcatWindow extends Window {
  lzc_window?: unknown;
  lzc_tab?: {
    SetControlViewVisibility?: (v: boolean) => void;
  };
  lzc_theme?: unknown;
  lzcApp?: unknown;
  lzcSDK?: {
    call?: (method: string) => void;
  };
  sdk?: {
    call?: (method: string) => void;
  };
  SetFullScreen?: () => void;
  CancelFullScreen?: () => void;
  lzcappNavigationBarHidden?: boolean;
  webkit?: {
    messageHandlers?: Record<string, unknown>;
  };
}
/**
 * 懒猫客户端 WebShell 能力探测
 * 懒猫微服的页面运行在客户端(手机/电视 App)的 WebShell WebView 里,
 * 宿主会注入 window.lzc_window / window.lzc_tab / window.lzc_theme 等对象,
 * 也可用 @lazycatcloud/sdk 的 base.isAndroidWebShell() 判断。
 */
export function isLazcatWebShell(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as LazcatWindow;
  if (w.lzc_window || w.lzc_tab || w.lzc_theme) return true;
  if (w.lzcApp !== undefined) return true;
  return false;
}

/** 懒猫容器级全屏(不是 DOM requestFullscreen) */
export function setLazcatFullscreen(on: boolean): void {
  const w = window as LazcatWindow;
  const sdk = w.lzcSDK || w.sdk;
  const fnName = on ? 'SetFullScreen' : 'CancelFullScreen';
  try {
    if (sdk && typeof sdk.call === 'function') {
      sdk.call(fnName);
      return;
    }
    if (typeof w.SetFullScreen === 'function' && on) w.SetFullScreen();
    if (typeof w.CancelFullScreen === 'function' && !on) w.CancelFullScreen();
  } catch {
    /* 忽略, 降级为普通导航 */
  }
}

/** 隐藏/显示懒猫安卓控制栏 */
export function setLazcatControlBar(visible: boolean): void {
  const api = (window as LazcatWindow).lzc_tab;
  try {
    if (api && typeof api.SetControlViewVisibility === 'function') {
      api.SetControlViewVisibility(visible);
    }
  } catch {
    /* 忽略 */
  }
}

/**
 * 打开一个频道：整页跳转至直播源。
 * - 央视官网(tv.cctv.com): 直接跳转官网直播页。
 * - 卫视频道(央视频): 直接跳转央视频直播页。
 * 若在懒猫 WebShell 环境，先做沉浸全屏/隐藏控制栏。
 */
export function openChannel(channel: IptvChannel): void {
  if (!channel?.url) return;

  if (isLazcatWebShell()) {
    setLazcatFullscreen(true);
    setLazcatControlBar(false);
    (window as LazcatWindow).lzcappNavigationBarHidden = true;
  }

  window.location.href = channel.url;
}
