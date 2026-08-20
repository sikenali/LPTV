import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RiArrowLeftLine, RiRefreshLine, RiErrorWarningLine, RiPlayFill, RiPauseFill, RiFullscreenFill, RiFullscreenExitFill, RiComputerLine } from '@remixicon/react';
import { getIptvUrlsUrl, getIptvProxyUrl } from '../../utils/iptv';
import { IptvChannel } from '../../data/iptvChannels';
import { useApp } from '../../context/AppContext';
import HlsPlayer, { HlsPlayerRef } from './HlsPlayer';

interface IptvWebPlayerProps {
  channel: IptvChannel;
  onBack: () => void;
}

type Source = 'hls' | 'web';

const IptvWebPlayer: React.FC<IptvWebPlayerProps> = ({ channel, onBack }) => {
  const { settings } = useApp();
  const globalSource = settings.channelSource;

  const [streamUrls, setStreamUrls] = useState<string[]>([]);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [effectiveSource, setEffectiveSource] = useState<Source>(
    globalSource === 'hls' || globalSource === 'web' ? globalSource : 'hls'
  );
  const [reloadKey, setReloadKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hlsPlayerRef = useRef<HlsPlayerRef>(null);
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  const clearLoadTimer = useCallback(() => {
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
  }, []);

  // 频道变化时重置有效源码
  useEffect(() => {
    setEffectiveSource(globalSource === 'hls' || globalSource === 'web' ? globalSource : 'hls');
    setStreamUrls([]);
    setCurrentUrlIndex(0);
    setError(null);
    setIsLoading(true);
    setIsPaused(false);
  }, [channel.tid, channel.id, globalSource]);

  // HLS：加载解密后的直链
  useEffect(() => {
    if (effectiveSource !== 'hls') return;
    setIsLoading(true);
    setError(null);
    setCurrentUrlIndex(0);
    fetch(getIptvUrlsUrl(channel.tid, channel.id))
      .then(r => r.json())
      .then(data => {
        if (data.urls && data.urls.length > 0) {
          setStreamUrls(data.urls);
        } else {
          if (globalSource === 'auto') {
            setEffectiveSource('web');
          } else {
            setError(data.error || '未找到可用线路');
          }
        }
      })
      .catch(() => {
        if (globalSource === 'auto') {
          setEffectiveSource('web');
        } else {
          setError('获取频道地址失败');
        }
      })
      .finally(() => setIsLoading(false));
  }, [effectiveSource, channel.tid, channel.id, globalSource]);

  // Web：监听页面播放信号以清除加载态
  useEffect(() => {
    if (effectiveSource !== 'web') return;
    const onMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'iptv:playing') {
        clearLoadTimer();
        setIsLoading(false);
        setError(null);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [effectiveSource, clearLoadTimer]);

  // Web：15s 内未收到播放信号则视为失败，弹出重试界面
  useEffect(() => {
    if (effectiveSource !== 'web') return;
    loadTimerRef.current = setTimeout(() => {
      if (isLoadingRef.current) {
        clearLoadTimer();
        setIsLoading(false);
        setError('网页加载超时，请检查网络或重试');
      }
    }, 15000);
    return clearLoadTimer;
  }, [effectiveSource, channel.tid, channel.id, reloadKey, clearLoadTimer]);

  const activeUrl = effectiveSource === 'hls' ? streamUrls[currentUrlIndex] ?? '' : '';

  const handleTouch = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  const switchSource = useCallback(() => {
    setEffectiveSource(prev => (prev === 'hls' ? 'web' : 'hls'));
    setError(null);
    setIsLoading(true);
    setIsPaused(false);
  }, []);

  const handleRetry = useCallback(() => {
    if (effectiveSource === 'hls') {
      if (currentUrlIndex < streamUrls.length - 1) {
        setCurrentUrlIndex(i => i + 1);
      } else {
        setIsLoading(true);
        setError(null);
        fetch(getIptvUrlsUrl(channel.tid, channel.id))
          .then(r => r.json())
          .then(data => {
            if (data.urls && data.urls.length > 0) {
              setStreamUrls(data.urls);
              setCurrentUrlIndex(0);
            } else {
              setError(data.error || '未找到可用线路');
            }
          })
          .catch(() => setError('重试失败'))
          .finally(() => setIsLoading(false));
      }
    } else {
      setIsLoading(true);
      setError(null);
      setReloadKey(k => k + 1);
    }
  }, [effectiveSource, streamUrls, currentUrlIndex, channel]);

  const handleToggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleTogglePlay = useCallback(() => {
    setIsPaused(p => !p);
    if (effectiveSource === 'hls') {
      const player = hlsPlayerRef.current;
      if (player) {
        if (isPaused) {
          player.resume();
        } else {
          player.pause();
        }
      }
    } else if (effectiveSource === 'web' && iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({ type: 'iptv:toggle' }, '*');
      } catch { /* cross-origin, ignore */ }
    }
  }, [effectiveSource, isPaused]);

  const onHlsError = useCallback(() => {
    if (currentUrlIndex < streamUrls.length - 1) {
      setCurrentUrlIndex(i => i + 1);
    } else if (globalSource === 'auto') {
      setEffectiveSource('web');
    } else {
      setError('所有线路均播放失败');
    }
  }, [currentUrlIndex, streamUrls.length, globalSource]);

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <RiErrorWarningLine className="w-16 h-16 text-red-400/60 mx-auto mb-4" />
          <div className="text-white/70 text-sm mb-4">{error}</div>
          <div className="flex items-center justify-center gap-3">
            <button onClick={handleRetry} className="px-6 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors">重试</button>
            {globalSource === 'auto' && (
              <button onClick={switchSource} className="px-6 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors">
                切到{effectiveSource === 'hls' ? '网页' : '直链'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-black flex flex-col"
      ref={containerRef}
      onTouchStart={handleTouch}
      onMouseMove={handleTouch}
    >
      <div className={`transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="sticky top-0 z-50 px-4 py-3 flex items-center gap-4 bg-gradient-to-b from-black/90 to-transparent">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <RiArrowLeftLine className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold truncate">{channel.name}</div>
            <div className="text-white/50 text-xs truncate">{channel.currentProgram}</div>
          </div>
          {globalSource === 'auto' && (
            <button onClick={switchSource} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors" title={`当前${effectiveSource === 'hls' ? '直链' : '网页'}，点击切换`}>
              <RiComputerLine className="w-5 h-5" />
            </button>
          )}
          <button onClick={handleRetry} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors" title="刷新/切线路">
            <RiRefreshLine className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-black">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent mx-auto mb-4"></div>
              <div className="text-white/60 text-sm">正在加载 {channel.name}（{effectiveSource === 'hls' ? '直链' : '网页'}）...</div>
            </div>
          </div>
        )}

        {effectiveSource === 'hls' ? (
          <HlsPlayer
            key={`${channel.tid}-${channel.id}-${currentUrlIndex}`}
            ref={hlsPlayerRef}
            url={activeUrl}
            onError={onHlsError}
          />
        ) : (
          <iframe
            key={`${channel.tid}-${channel.id}-${reloadKey}`}
            ref={iframeRef}
            src={getIptvProxyUrl(channel.tid, channel.id)}
            className="w-full h-full border-0"
            style={{ minHeight: 'calc(100vh - 56px)' }}
            allowFullScreen
          />
        )}
      </div>

      <div className={`absolute inset-x-0 bottom-0 flex items-center justify-between px-4 h-14 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}>
        <div className="flex items-center gap-1">
          <button onClick={handleTogglePlay} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            {isPaused ? <RiPlayFill className="w-5 h-5 text-white" /> : <RiPauseFill className="w-5 h-5 text-white" />}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white/70 text-sm truncate max-w-[200px]">{channel.name}</span>
          <button onClick={handleToggleFullscreen} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            {document.fullscreenElement ? <RiFullscreenExitFill className="w-4 h-4 text-white" /> : <RiFullscreenFill className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IptvWebPlayer;
