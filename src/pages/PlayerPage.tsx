import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RiArrowLeftLine, RiHeartFill, RiPlayLine, RiPauseLine, RiVolumeUpLine, RiZoomInLine } from '@remixicon/react';
import { channels } from '../data/channels';
import { useApp } from '../context/AppContext';
import { fetchVideoUrl } from '../utils/iptv';

const PlayerPage: React.FC = () => {
  const { tid, channelId } = useParams<{ tid: string; channelId: string }>();
  const navigate = useNavigate();
  const { favorites, toggleFavorite } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const channel = channels.find(c => c.id === channelId && c.tid === tid);
  const isFavorite = channel ? favorites.includes(`${channel.tid}-${channel.id}`) : false;

  useEffect(() => {
    const loadChannel = async () => {
      if (!channel || !tid || !channelId) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        const url = await fetchVideoUrl(tid, channelId);
        setVideoUrl(url);
        setIsLoading(false);
      } catch (err) {
        console.error('加载频道失败:', err);
        setError('加载失败，请重试');
        setIsLoading(false);
      }
    };

    loadChannel();
  }, [channel, tid, channelId]);

  const handleTouch = () => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (!channel) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-lg mb-4">频道不存在</p>
          <button 
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
          >
            返回
          </button>
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
      {/* 顶部信息栏 */}
      <div className={`absolute top-0 left-0 right-0 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
          <button 
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <RiArrowLeftLine className="w-5 h-5" />
          </button>

          <div className="flex-1 mx-4">
            <div className="text-white font-semibold text-lg">{channel.name}</div>
            <div className="text-white/60 text-sm">{channel.currentProgram}</div>
          </div>

          <button
            onClick={() => channel && toggleFavorite(`${channel.tid}-${channel.id}`)}
            className={`p-2 rounded-lg transition-colors ${
              isFavorite ? 'text-yellow-400' : 'text-white/60 hover:text-white'
            }`}
          >
            <RiHeartFill className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* 视频区域 */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/60">加载中...</p>
            </div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-white/60 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
              >
                重试
              </button>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full"
            src={videoUrl}
            autoPlay
            onClick={togglePlay}
          />
        )}

        {/* 播放/暂停指示器 */}
        {!isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              {isPlaying ? (
                <RiPauseLine className="w-8 h-8" />
              ) : (
                <RiPlayLine className="w-8 h-8 ml-1" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* 底部控制栏 */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-gradient-to-t from-black/80 to-transparent px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                {isPlaying ? <RiPauseLine className="w-6 h-6" /> : <RiPlayLine className="w-6 h-6" />}
              </button>
              
              <div className="flex items-center gap-2">
                <RiVolumeUpLine className="w-5 h-5 text-white/80" />
                <div className="w-24 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div className="w-2/3 h-full bg-white rounded-full" />
                </div>
              </div>
            </div>

            <button 
              onClick={() => navigate('/')}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <RiZoomInLine className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerPage;
