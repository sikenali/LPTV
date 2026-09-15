import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RiErrorWarningLine, RiPlayFill, RiPauseFill, RiFullscreenFill, RiFullscreenExitFill, RiVolumeUpFill, RiVolumeMuteFill, RiVolumeDownFill } from '@remixicon/react';
import { matchM3uUrls } from '../../utils/m3uMatch';
import { IptvChannel, iptvChannels } from '../../data/iptvChannels';
import HlsPlayer, { HlsPlayerRef } from './HlsPlayer';

interface IptvWebPlayerProps {
  channel?: IptvChannel;
}

const LptvSplash: React.FC = () => (
  <>
    <style>{`
      @keyframes lptv-bounce { 0%,80%,100%{transform:scale(1)} 40%{transform:scale(1.25)} }
      @keyframes lptv-fade { 0%,30%{opacity:1} 60%,100%{opacity:0} }
    `}</style>
    <div className="absolute inset-0 flex items-center justify-center z-20">
      <div className="flex gap-3 items-center">
        {(['#f97316','#ef4444','#3b82f6','#22c55e'] as const).map((color, i) => (
          <span key={i} className="text-5xl font-black text-white" style={{
            animation: `lptv-bounce 1.2s ease-in-out ${i*0.15}s infinite, lptv-fade 1.2s ease-in-out ${i*0.15}s infinite`,
            color,
          }}>{['L','P','T','V'][i]}</span>
        ))}
      </div>
    </div>
  </>
);

interface StreamCheckResult {
  status?: 'ok' | 'error';
  latency?: number | null;
  downloadSpeedKbps?: number;
}

const CHECK_INTERVAL_MS = 60_000;
const FAILURE_THRESHOLD = 2;
const CIRCUIT_BREAK_MS = 5 * 60_000;

function channelStorageKey(channel: IptvChannel) {
  return `lptv-last-url:${channel.tid}-${channel.id}`;
}

const IptvWebPlayer: React.FC<IptvWebPlayerProps> = ({ channel }) => {
  const defaultChannel = useRef<IptvChannel>(iptvChannels[0] ?? { id: '1', name: 'CCTV1', category: '央视频道', currentProgram: '', tid: 'ys' });
  const initChannel = channel ?? defaultChannel.current;

  const [currentChannel, setCurrentChannel] = useState<IptvChannel>(initChannel);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const [m3uLoaded, setM3uLoaded] = useState(false);
  const [allUrls, setAllUrls] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  // 每条线路的探测结果（key = url）
  const [urlStatuses, setUrlStatuses] = useState<Record<string, StreamCheckResult>>({});
  // 标记是否已经播放过（用于控制 splash 只显示一次）
  const [hasPlayed, setHasPlayed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hlsPlayerRef = useRef<HlsPlayerRef>(null);
  const currentUrlRef = useRef('');
  const failureCountRef = useRef<Record<string, number>>({});
  const circuitOpenUntilRef = useRef<Record<string, number>>({});
  const rankingAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (channel) {
      setCurrentChannel(channel);
      resetPlayer();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const resetPlayer = useCallback(() => {
    setCurrentUrlIndex(0);
    setError(null);
    setM3uLoaded(false);
    setAllUrls([]);
    setUrlStatuses({});
    setIsChecking(false);
    setIsPaused(false);
    setIsMuted(true);
    setShowControls(false);
    // 切换频道时重置 hasPlayed，确保 splash 重新显示
    setHasPlayed(false);
  }, []);

  const checkUrl = useCallback(async (url: string, signal?: AbortSignal): Promise<StreamCheckResult> => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const response = await fetch(`/api/stream/check?url=${encodeURIComponent(url)}`, { signal: controller.signal });
      if (!response.ok) return { status: 'error' };
      return await response.json() as StreamCheckResult;
    } catch {
      return { status: 'error' };
    } finally {
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }, []);

  const rankUrls = useCallback(async (urls: string[], channelForStorage: IptvChannel, signal: AbortSignal) => {
    const uniqueUrls = [...new Set(urls.filter(Boolean))];
    const recentUrl = localStorage.getItem(channelStorageKey(channelForStorage));
    const checks = await Promise.all(uniqueUrls.map(async (url) => ({ url, result: await checkUrl(url, signal) })));
    // 保存每条线路的探测结果
    const statuses: Record<string, StreamCheckResult> = {};
    checks.forEach(({ url, result }) => { statuses[url] = result; });
    setUrlStatuses(statuses);
    const healthy = checks
      .filter(({ result }) => result.status === 'ok')
      .sort((a, b) => {
        const score = (item: { url: string; result: StreamCheckResult }) => {
          const speed = Math.min(1, (item.result.downloadSpeedKbps ?? 0) / 2048);
          const latency = Math.max(0, 1 - (item.result.latency ?? 9) / 5);
          return speed * 0.55 + latency * 0.45 + (item.url === recentUrl ? 0.03 : 0);
        };
        return score(b) - score(a);
      })
      .map(({ url }) => url);
    const remainder = uniqueUrls.filter(url => !healthy.includes(url));
    const fallback = recentUrl && uniqueUrls.includes(recentUrl)
      ? [recentUrl, ...uniqueUrls.filter(url => url !== recentUrl)]
      : uniqueUrls;
    return healthy.length > 0 ? [...healthy, ...remainder] : fallback;
  }, [checkUrl]);

  useEffect(() => {
    setError(null);
    setM3uLoaded(false);
    rankingAbortRef.current?.abort();
    const controller = new AbortController();
    rankingAbortRef.current = controller;
    setIsChecking(true);
    (async () => {
      try {
        const response = await fetch('/api/m3u', { signal: controller.signal });
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) throw new Error('empty_m3u');
        const urls = matchM3uUrls(currentChannel, data);
        if (urls.length === 0) { setError('未找到该频道的播放地址'); return; }
        const ranked = await rankUrls(urls, currentChannel, controller.signal);
        if (controller.signal.aborted) return;
        setAllUrls(ranked);
        setCurrentUrlIndex(0);
        setM3uLoaded(true);
      } catch (err) {
        if (!controller.signal.aborted) { setError(err instanceof Error && err.message === 'empty_m3u' ? 'M3U 源无可播放频道' : 'M3U 源加载失败'); setM3uLoaded(true); }
      } finally {
        if (!controller.signal.aborted) setIsChecking(false);
      }
    })();
    return () => controller.abort();
  }, [currentChannel, rankUrls]);

  const activeUrl = m3uLoaded ? (allUrls[currentUrlIndex] ?? '') : '';

  // 当前线路在全部线路中的序号（1-based）
  const routeTotal = allUrls.length;

  useEffect(() => {
    currentUrlRef.current = activeUrl;
  }, [activeUrl]);

  const switchToNextAvailable = useCallback(() => {
    const current = currentUrlRef.current;
    if (current) {
      const failures = (failureCountRef.current[current] ?? 0) + 1;
      failureCountRef.current[current] = failures;
      if (failures >= FAILURE_THRESHOLD) circuitOpenUntilRef.current[current] = Date.now() + CIRCUIT_BREAK_MS;
    }
    const now = Date.now();
    const nextIndex = allUrls.findIndex((url, index) => index !== currentUrlIndex && (circuitOpenUntilRef.current[url] ?? 0) <= now);
    if (nextIndex >= 0) {
      setCurrentUrlIndex(nextIndex);
      setError(null);
      return true;
    }
    return false;
  }, [allUrls, currentUrlIndex]);

   useEffect(() => {
     if (!m3uLoaded || !activeUrl) return;
     let disposed = false;
     const checkCurrent = async () => {
       const url = currentUrlRef.current;
       if (!url || disposed) return;
       const result = await checkUrl(url);
       if (disposed) return;
       setUrlStatuses(prev => ({ ...prev, [url]: result }));
       if (result.status === 'ok') {
         failureCountRef.current[url] = 0;
         circuitOpenUntilRef.current[url] = 0;
         localStorage.setItem(channelStorageKey(currentChannel), url);
       } else if ((failureCountRef.current[url] ?? 0) + 1 >= FAILURE_THRESHOLD && !switchToNextAvailable()) {
         setError('当前频道线路均不可用，请重试');
       } else {
         failureCountRef.current[url] = (failureCountRef.current[url] ?? 0) + 1;
       }
     };
     const timer = window.setInterval(checkCurrent, CHECK_INTERVAL_MS);
     return () => { disposed = true; window.clearInterval(timer); };
   }, [activeUrl, checkUrl, currentChannel, m3uLoaded, switchToNextAvailable]);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const handleTouch = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  const handleRetry = useCallback(() => {
    if (switchToNextAvailable()) {
      setError(null);
      return;
    }
    setError(null);
    fetch('/api/m3u')
      .then(r => r.json())
      .then(data => {
        if (data && data.length > 0) {
          const urls = matchM3uUrls(currentChannel, data);
          if (urls.length > 0) { setAllUrls(urls); setCurrentUrlIndex(0); }
          else setError('未找到该频道的播放地址');
        }
      })
      .catch(() => setError('M3U 源加载失败'));
  }, [currentChannel, switchToNextAvailable]);

  const handleTogglePlay = useCallback(() => {
    setIsPaused(p => !p);
    const player = hlsPlayerRef.current;
    if (!player) return;
    isPaused ? player.resume() : player.pause();
  }, [isPaused]);

  const handleToggleMute = useCallback(() => {
    const player = hlsPlayerRef.current;
    if (!player) return;
    const next = !isMuted;
    setIsMuted(next);
    player.setVolume(next ? 0 : volume || 0.8);
  }, [isMuted, volume]);

  const handleVolumeChange = useCallback((v: number) => {
    const player = hlsPlayerRef.current;
    if (!player) return;
    setVolume(v);
    setIsMuted(v === 0);
    player.setVolume(v);
  }, []);

  const handleVideoReady = useCallback(() => {
    setHasPlayed(true);
    const url = currentUrlRef.current;
    if (url) {
      failureCountRef.current[url] = 0;
      circuitOpenUntilRef.current[url] = 0;
      localStorage.setItem(channelStorageKey(currentChannel), url);
    }
  }, [currentChannel]);

  if (error) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <RiErrorWarningLine className="w-16 h-16 text-red-400/60 mx-auto mb-4" />
          <div className="text-white/70 text-sm mb-4">{error}</div>
          <button onClick={handleRetry} className="px-6 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors">重试</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full bg-black overflow-hidden"
      ref={containerRef}
      onTouchStart={handleTouch}
      onMouseMove={handleTouch}
    >
      {/* LPTV 加载动画：仅在 M3U 加载且未播放过时显示 */}
      {(!m3uLoaded || isChecking) && !hasPlayed && <LptvSplash />}

      {/* 视频区域：绝对定位占满容器 */}
       <div className="absolute inset-0">
         <HlsPlayer
           key={`${currentChannel.tid}-${currentChannel.id}-m3u-${currentUrlIndex}`}
           ref={hlsPlayerRef}
           url={activeUrl}
           onReady={handleVideoReady}
           onError={() => {
             if (!switchToNextAvailable()) setError('播放失败，请重试');
           }}
           onRouteChange={() => {
             // 线路切换后重新探测当前线路状态
             if (activeUrl) {
               checkUrl(activeUrl).then(result => {
                 setUrlStatuses(prev => ({ ...prev, [activeUrl]: result }));
               });
             }
           }}
         />
       </div>

      {/* 控制栏：点击显示，3秒后自动隐藏 */}
      <div
        className={`absolute inset-x-0 bottom-0 flex items-center justify-between px-4 h-14 z-20 transition-opacity duration-200 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}
      >
        <div className="flex items-center gap-1">
          <button onClick={handleTogglePlay} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            {isPaused ? <RiPlayFill className="w-5 h-5 text-white" /> : <RiPauseFill className="w-5 h-5 text-white" />}
          </button>
          <button onClick={handleToggleMute} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            {isMuted || volume === 0
              ? <RiVolumeMuteFill className="w-5 h-5 text-white" />
              : volume < 0.5 ? <RiVolumeDownFill className="w-5 h-5 text-white" />
              : <RiVolumeUpFill className="w-5 h-5 text-white" />}
          </button>
          <input
            type="range" min="0" max="1" step="0.01"
            value={isMuted ? 0 : volume}
            onChange={e => handleVolumeChange(parseFloat(e.target.value))}
            className="w-16 accent-red-500 cursor-pointer"
            style={{ opacity: 0.7 }}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white/70 text-sm truncate max-w-[200px]">{currentChannel.name}</span>
          {routeTotal > 1 && (
            <div className="flex items-center gap-1" title={`共 ${routeTotal} 条线路`}>
              {allUrls.map((u, i) => {
                const st = urlStatuses[u]?.status;
                const isActive = i === currentUrlIndex;
                const dotColor = st === 'ok' ? '#22c55e' : st === 'error' ? '#ef4444' : 'rgba(255,255,255,0.3)';
                return (
                  <div key={u} className="flex items-center gap-0.5">
                    <div
                      className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                      style={{ background: dotColor, boxShadow: isActive ? `0 0 4px ${dotColor}` : 'none', opacity: isActive ? 1 : 0.5 }}
                    />
                    {i === currentUrlIndex && (
                      <span className="text-white/60 text-xs font-mono">#{i + 1}/{routeTotal}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <button
            onClick={() => hlsPlayerRef.current?.toggleFullscreen()}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            {document.fullscreenElement
              ? <RiFullscreenExitFill className="w-4 h-4 text-white" />
              : <RiFullscreenFill className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IptvWebPlayer;
