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
  const [videoUrl, setVideoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoLoadedRef = useRef(false);
  const loadCheckTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    videoLoadedRef.current = false;
    setIsLoading(true);
    setShowPlayer(false);
    
    if (loadCheckTimer.current) clearInterval(loadCheckTimer.current);
    
    const playUrl = getPlayUrl(channel.tid, channel.id);
    setVideoUrl(playUrl);
    
    loadCheckTimer.current = setInterval(() => {
      try {
        const iframeDoc = iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document;
        if (iframeDoc) {
          const videoElement = iframeDoc.getElementById('vstPlayer') as HTMLVideoElement;
          if (videoElement && videoElement.src && videoElement.src.startsWith('blob:')) {
            videoLoadedRef.current = true;
            setIsLoading(false);
            setShowPlayer(true);
            if (loadCheckTimer.current) clearInterval(loadCheckTimer.current);
          }
        }
      } catch (e) {
        console.log('跨域检查失败，等待视频加载');
      }
    }, 500);
    
    return () => {
      if (loadCheckTimer.current) clearInterval(loadCheckTimer.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
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

      <div className="flex-1 relative">
        {showPlayer && videoUrl && (
          <iframe
            ref={iframeRef}
            src={videoUrl}
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
