import React, { useState, useRef, useCallback, useEffect } from 'react';
import { RiArrowLeftLine, RiRefreshLine, RiErrorWarningLine, RiPlayFill, RiPauseFill, RiFullscreenFill, RiFullscreenExitFill } from '@remixicon/react';
import { IptvChannel } from '../../data/iptvChannels';

interface IptvWebPlayerProps {
  channel: IptvChannel;
  onBack: () => void;
}

const IptvWebPlayer: React.FC<IptvWebPlayerProps> = ({ channel, onBack }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const iframeUrl = `/api/proxy/iptv/${channel.tid}/${channel.id}`;

  const clearLoadTimer = useCallback(() => {
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
  }, []);

  const handleTouch = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  const handleRetry = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setIsPaused(false);
    clearLoadTimer();
    setIframeKey(prev => prev + 1);
  }, [clearLoadTimer]);

  const handleToggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleIframeLoad = useCallback(() => {
    clearLoadTimer();
    setIsLoading(false);
    setError(null);
  }, [clearLoadTimer]);

  const handleTogglePlay = useCallback(() => {
    setIsPaused(p => !p);
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      try {
        iframe.contentWindow.postMessage({ type: 'iptv:toggle' }, '*');
      } catch { /* cross-origin, ignore */ }
    }
  }, []);

  // Fallback: force hide spinner after 15s if iframe never fires onLoad
  useEffect(() => {
    loadTimerRef.current = setTimeout(() => {
      if (isLoading) {
        clearLoadTimer();
        setIsLoading(false);
      }
    }, 15000);
    return clearLoadTimer;
  }, [channel.id]); // reset timer on channel change

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <RiErrorWarningLine className="w-16 h-16 text-red-400/60 mx-auto mb-4" />
          <div className="text-white/70 text-sm mb-4">{error}</div>
          <button
            onClick={handleRetry}
            className="px-6 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors"
          >
            重试
          </button>
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
      {/* Top bar */}
      <div className={`transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="sticky top-0 z-50 px-4 py-3 flex items-center gap-4 bg-gradient-to-b from-black/90 to-transparent">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <RiArrowLeftLine className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold truncate">{channel.name}</div>
            <div className="text-white/50 text-xs truncate">{channel.currentProgram}</div>
          </div>
          <button onClick={handleRetry} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors" title="刷新">
            <RiRefreshLine className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Player area */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-black">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent mx-auto mb-4"></div>
              <div className="text-white/60 text-sm">正在加载 {channel.name}...</div>
            </div>
          </div>
        )}
        <iframe
          key={`${channel.tid}-${channel.id}-${iframeKey}`}
          ref={iframeRef}
          src={iframeUrl}
          className="w-full h-full border-0"
          style={{ minHeight: 'calc(100vh - 56px)' }}
          allowFullScreen
          onLoad={handleIframeLoad}
        />
      </div>

      {/* Bottom control bar */}
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