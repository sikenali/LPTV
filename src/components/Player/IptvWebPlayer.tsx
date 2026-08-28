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
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hlsPlayerRef = useRef<HlsPlayerRef>(null);

  useEffect(() => {
    if (channel) { setCurrentChannel(channel); resetPlayer(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const resetPlayer = useCallback(() => {
    setCurrentUrlIndex(0);
    setError(null);
    setM3uLoaded(false);
    setAllUrls([]);
    setIsPaused(false);
    setIsMuted(true);
    setShowControls(false);
  }, []);

  useEffect(() => {
    setError(null);
    setM3uLoaded(false);
    fetch('/api/m3u')
      .then(r => r.json())
      .then(data => {
        if (data && data.length > 0) {
          const urls = matchM3uUrls(currentChannel, data);
          if (urls.length === 0) { setError('未找到该频道的播放地址'); setM3uLoaded(true); return; }
          setAllUrls(urls);
          setCurrentUrlIndex(0);
          setM3uLoaded(true);
        } else {
          setError('M3U 源无可播放频道');
          setM3uLoaded(true);
        }
      })
      .catch(() => { setError('M3U 源加载失败'); setM3uLoaded(true); });
  }, [currentChannel]);

  const activeUrl = m3uLoaded ? (allUrls[currentUrlIndex] ?? '') : '';

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const handleTouch = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  const handleRetry = useCallback(() => {
    if (allUrls.length > 0 && currentUrlIndex < allUrls.length - 1) {
      setCurrentUrlIndex(i => i + 1);
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
  }, [currentChannel, allUrls, currentUrlIndex]);

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
      {/* LPTV 加载动画：仅 M3U 加载期间 */}
      {!m3uLoaded && <LptvSplash />}

      {/* 视频区域：占满整个容器，无黑边 */}
      <div className="absolute inset-0">
        <HlsPlayer
          key={`${currentChannel.tid}-${currentChannel.id}-m3u-${currentUrlIndex}`}
          ref={hlsPlayerRef}
          url={activeUrl}
          onError={() => {
            if (allUrls.length > 0 && currentUrlIndex < allUrls.length - 1) {
              setCurrentUrlIndex(i => i + 1);
              setError(null);
              return;
            }
            setError('播放失败，请重试');
          }}
        />
      </div>

      {/* 控制栏：3秒无操作自动隐藏 */}
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
