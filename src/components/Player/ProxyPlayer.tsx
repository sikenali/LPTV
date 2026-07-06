import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Channel } from '../../types';

interface ProxyPlayerProps {
  channel: Channel;
  onBack: () => void;
}

const PROXY_BASE_URL = 'http://localhost:3000';

const ProxyPlayer: React.FC<ProxyPlayerProps> = ({ channel, onBack }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const srcCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playUrl = `${PROXY_BASE_URL}/proxy/play?tid=${channel.tid}&id=${channel.id}`;

  const handleVideoSrcMessage = useCallback((event: MessageEvent) => {
    console.log('[ProxyPlayer] Received message from origin:', event.origin, 'data:', event.data);
    const data = event.data;
    if (data?.type === 'videoSrc' && data.src) {
      console.log('[ProxyPlayer] Got videoSrc:', data.src);
      const video = videoRef.current;
      if (video && video.src !== data.src) {
        video.src = data.src;
        video.play().catch(err => {
          console.log('自动播放受限，等待用户交互', err);
        });
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setShowControls(true);

    window.addEventListener('message', handleVideoSrcMessage);

    if (iframeRef.current) {
      iframeRef.current.src = playUrl;
    }

    // Fallback: periodically check iframe for video element
    srcCheckTimerRef.current = setInterval(() => {
      try {
        const iframeDoc = iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document;
        if (iframeDoc) {
          // Try multiple possible video element IDs
          const possibleIds = ['vstPlayer', 'video', 'player', 'myPlayer', 'hlsPlayer', 'videoPlayer'];
          for (const id of possibleIds) {
            const videoElement = iframeDoc.getElementById(id) as HTMLVideoElement;
            if (videoElement && videoElement.src && (videoElement.src.startsWith('blob:') || videoElement.src.startsWith('http'))) {
              console.log('[ProxyPlayer] Fallback found video src:', videoElement.src);
              const video = videoRef.current;
              if (video && video.src !== videoElement.src) {
                video.src = videoElement.src;
                video.play().catch(err => {
                  console.log('自动播放受限，等待用户交互', err);
                });
                setIsLoading(false);
              }
              if (srcCheckTimerRef.current) clearInterval(srcCheckTimerRef.current);
              return;
            }
          }
          // Also check all video tags
          const videos = iframeDoc.querySelectorAll('video');
          if (videos.length > 0) {
            videos.forEach((videoElement: HTMLVideoElement) => {
              if (videoElement.src && (videoElement.src.startsWith('blob:') || videoElement.src.startsWith('http'))) {
                console.log('[ProxyPlayer] Fallback found video tag src:', videoElement.src);
                const video = videoRef.current;
                if (video && video.src !== videoElement.src) {
                  video.src = videoElement.src;
                  video.play().catch(err => {
                    console.log('自动播放受限，等待用户交互', err);
                  });
                  setIsLoading(false);
                }
                if (srcCheckTimerRef.current) clearInterval(srcCheckTimerRef.current);
              }
            });
          }
        }
      } catch (e) {
        // Cross-origin, ignore
      }
    }, 500);

    // Timeout fallback - if no video after 15 seconds, show error
    const timeoutRef = setTimeout(() => {
      if (isLoading) {
        console.log('[ProxyPlayer] Timeout - no video found after 15s');
        setError('视频加载超时，原站可能需要手动选择线路或暂时不可用');
      }
    }, 15000);

    return () => {
      clearTimeout(timeoutRef);

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
      window.removeEventListener('message', handleVideoSrcMessage);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (srcCheckTimerRef.current) clearInterval(srcCheckTimerRef.current);
      if (containerRef.current) {
        containerRef.current.removeEventListener('touchstart', handleTouch);
        containerRef.current.removeEventListener('mousemove', handleTouch);
      }
    };
  }, [channel, playUrl, handleVideoSrcMessage]);
  }, [channel, playUrl, handleVideoSrcMessage]);

  const handleTouch = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const handleVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    console.error('视频播放错误:', e);
    setError('视频加载失败，请求失败，请尝试切换线路或稍后重试');
  }, []);

  const handleVideoWaiting = useCallback(() => {
    setIsLoading(true);
  }, []);

  const handleVideoPlaying = useCallback(() => {
    setIsLoading(false);
  }, []);

  if (isLoading && !videoRef.current?.src) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <div>正在加载 {channel.name}...</div>
        </div>
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
        <div className="sticky top-0 z-50 px-4 py-3 flex items-center gap-4 bg-gradient-to-b from-black/80 to-transparent">
          <button 
            onClick={onBack} 
            className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <div className="text-white font-semibold">{channel.name}</div>
            <div className="text-white/60 text-sm">{channel.currentProgram}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 relative" ref={containerRef}>
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          controls
          playsInline
          onError={handleVideoError}
          onWaiting={handleVideoWaiting}
          onPlaying={handleVideoPlaying}
        />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10">
            <div className="text-center text-white p-4">
              <p className="text-red-400 mb-2">{error}</p>
              <button 
                onClick={() => {
                  setError(null);
                  setIsLoading(true);
                  if (iframeRef.current) {
                    iframeRef.current.src = playUrl;
                  }
                }}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                重试
              </button>
            </div>
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-5">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-500 border-t-transparent"></div>
          </div>
        )}
      </div>

      <iframe
        ref={iframeRef}
        src={playUrl}
        className="absolute inset-0 w-full h-full border-0 opacity-0 pointer-events-none"
        allow="autoplay; fullscreen"
        allowFullScreen
        title={`${channel.name} 代理加载器`}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox allow-modals"
        onLoad={() => console.log('[ProxyPlayer] Iframe loaded:', playUrl)}
        onError={(e) => console.error('[ProxyPlayer] Iframe error:', e)}
      />
    </div>
  );
};

export default ProxyPlayer;