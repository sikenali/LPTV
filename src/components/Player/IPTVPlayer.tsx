import React, { useState, useEffect, useRef } from 'react';
import LiquidGlass from '@m0x3mkx/liquid-glass-react';
import { RiArrowLeftLine } from '@remixicon/react';
import { Channel } from '../../types';
import { getPlayUrl } from '../../utils/iptv';

interface IPTVPlayerProps {
  channel: Channel;
  onBack: () => void;
}

const IPTVPlayer: React.FC<IPTVPlayerProps> = ({ channel, onBack }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setShowControls(true);
    
    const loadIframeContent = () => {
      try {
        const iframeDoc = iframeRef.current?.contentDocument;
        if (iframeDoc) {
          const videoElement = iframeDoc.getElementById('vstPlayer') as HTMLVideoElement;
          if (videoElement && videoElement.src && videoElement.src.startsWith('blob:')) {
            videoElement.controls = true;
            videoElement.playsInline = true;
            videoElement.autoplay = true;
            videoElement.muted = false;
            videoElement.volume = 1.0;
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        console.log('跨域检查失败，等待视频加载');
      }
      setTimeout(loadIframeContent, 100);
    };
    
    const playUrl = getPlayUrl(channel.tid, channel.id);
    if (iframeRef.current) {
      iframeRef.current.src = playUrl;
      loadIframeContent();
    }
    
    const handleTouch = () => {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    };
    
    if (containerRef.current) {
      containerRef.current.addEventListener('touchstart', handleTouch);
      containerRef.current.addEventListener('mousemove', handleTouch);
    }
    
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (containerRef.current) {
        containerRef.current.removeEventListener('touchstart', handleTouch);
        containerRef.current.removeEventListener('mousemove', handleTouch);
      }
    };
  }, [channel]);

  const handleTouch = () => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">加载中...</div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-black flex flex-col"
      onTouchStart={handleTouch}
      onMouseMove={handleTouch}
    >
      <div className={`transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <LiquidGlass
          cornerRadius={0}
          padding="0"
          displacementScale={20}
          blurAmount={0.1}
          saturation={110}
          elasticity={0.1}
          className="sticky top-0 z-50"
        >
          <div className="px-4 py-3 flex items-center gap-4">
            <button 
              onClick={onBack} 
              className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <RiArrowLeftLine className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <div className="text-white font-semibold">{channel.name}</div>
              <div className="text-white/60 text-sm">{channel.currentProgram}</div>
            </div>
          </div>
        </LiquidGlass>
      </div>

      <div className="flex-1 relative" ref={containerRef}>
        {!isLoading && (
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen"
            allowFullScreen
            title={`${channel.name} 播放器`}
          />
        )}
      </div>
    </div>
  );
};

export default IPTVPlayer;
