import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RiErrorWarningLine, RiPlayFill, RiPauseFill, RiFullscreenFill, RiFullscreenExitFill } from '@remixicon/react';
import { getChannelLogoUrl } from '../../utils/logoMap';
import { IptvChannel } from '../../data/iptvChannels';
import { matchM3uUrls } from '../../utils/m3uMatch';
import HlsPlayer, { HlsPlayerRef } from './HlsPlayer';

interface IptvWebPlayerProps {
  channel: IptvChannel;
}

const IptvWebPlayer: React.FC<IptvWebPlayerProps> = ({ channel }) => {
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [m3uLoaded, setM3uLoaded] = useState(false);
  const [allUrls, setAllUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hlsPlayerRef = useRef<HlsPlayerRef>(null);

  useEffect(() => {
    setCurrentUrlIndex(0);
    setError(null);
    setM3uLoaded(false);
    setAllUrls([]);
    setIsPaused(false);
  }, [channel.tid, channel.id]);

  useEffect(() => {
    setError(null);
    setM3uLoaded(false);

    fetch('/api/m3u')
      .then(r => r.json())
      .then(data => {
        if (data && data.length > 0) {
          const urls = matchM3uUrls(channel, data);
          if (urls.length === 0) {
            setError('未找到 M3U8 播放地址');
            setM3uLoaded(true);
            return;
          }
          setAllUrls(urls);
          setCurrentUrlIndex(0);
          setM3uLoaded(true);
        } else {
          setError('M3U 源无可播放频道');
          setM3uLoaded(true);
        }
      })
      .catch(() => {
        setError('M3U 源加载失败');
        setM3uLoaded(true);
      });
  }, [channel]);

  const activeUrl = m3uLoaded ? (allUrls[currentUrlIndex] ?? '') : '';

  const handleTouch = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  const handleHlsPlay = useCallback(() => {
    setIsBuffering(false);
  }, []);

  const handleRetry = useCallback(() => {
    if (allUrls.length > 0 && currentUrlIndex < allUrls.length - 1) {
      setCurrentUrlIndex(i => i + 1);
      setError(null);
      setIsBuffering(true);
      return;
    }
    setIsLoading(true);
    setError(null);
    fetch('/api/m3u')
      .then(r => r.json())
      .then(data => {
        if (data && data.length > 0) {
          const urls = matchM3uUrls(channel, data);
          if (urls.length > 0) {
            setAllUrls(urls);
            setCurrentUrlIndex(0);
          } else {
            setError('未找到 M3U8 播放地址');
          }
        }
      })
      .catch(() => setError('M3U 源加载失败'))
      .finally(() => setIsLoading(false));
  }, [channel, allUrls, currentUrlIndex]);

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
    const player = hlsPlayerRef.current;
    if (player) {
      if (isPaused) {
        player.resume();
      } else {
        player.pause();
      }
    }
  }, [isPaused]);

  const onHlsError = useCallback((err?: Error) => {
    if (allUrls.length > 0 && currentUrlIndex < allUrls.length - 1) {
      console.log(`[IptvWebPlayer] URL ${currentUrlIndex} failed, trying next...`, err?.message);
      setCurrentUrlIndex(i => i + 1);
      setError(null);
      setIsBuffering(true);
      return;
    }
    setError('M3U8 播放失败');
  }, [allUrls, currentUrlIndex]);

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
    <>
      <style>{`
        @keyframes lptv-color-1 { 0%,100%{color:#ffffff} 50%{color:#f97316} }
        @keyframes lptv-color-2 { 0%,100%{color:#ffffff} 50%{color:#ef4444} }
        @keyframes lptv-color-3 { 0%,100%{color:#ffffff} 50%{color:#3b82f6} }
        @keyframes lptv-color-4 { 0%,100%{color:#ffffff} 50%{color:#22c55e} }
      `}</style>
      <div
        className="relative w-full h-full bg-black flex flex-col overflow-hidden"
        ref={containerRef}
        onTouchStart={handleTouch}
        onMouseMove={handleTouch}
      >
        <div className="flex-1 relative min-h-0">
          {(isLoading || isBuffering) && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/60">
              <div className="flex items-center gap-1">
                <span className="text-4xl font-black tracking-widest"
                  style={{ animation: 'lptv-color-1 1.2s ease-in-out infinite' }}>L</span>
                <span className="text-4xl font-black tracking-widest"
                  style={{ animation: 'lptv-color-2 1.2s ease-in-out infinite 0.15s' }}>P</span>
                <span className="text-4xl font-black tracking-widest"
                  style={{ animation: 'lptv-color-3 1.2s ease-in-out infinite 0.3s' }}>T</span>
                <span className="text-4xl font-black tracking-widest"
                  style={{ animation: 'lptv-color-4 1.2s ease-in-out infinite 0.45s' }}>V</span>
              </div>
            </div>
          )}

          <HlsPlayer
            key={`${channel.tid}-${channel.id}-m3u-${currentUrlIndex}`}
            ref={hlsPlayerRef}
            url={activeUrl}
            onError={onHlsError}
            onPlay={handleHlsPlay}
          />

          {getChannelLogoUrl(channel) && (
            <img
              src={getChannelLogoUrl(channel)}
              alt={channel.name}
              className="absolute top-3 left-3 z-10 h-9 w-auto object-contain pointer-events-none select-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
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
    </>
  );
};

export default IptvWebPlayer;
