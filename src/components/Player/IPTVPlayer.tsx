import React, { useState, useEffect, useRef } from 'react';
import LiquidGlass from '@m0x3mkx/liquid-glass-react';
import { RiArrowLeftLine } from '@remixicon/react';
import { Channel, ChannelLine } from '../../types';
import { fetchVideoUrl, fetchChannelLines } from '../../utils/iptv';
import ChannelLineList from './ChannelLineList';

interface IPTVPlayerProps {
  channel: Channel;
  onBack: () => void;
}

const IPTVPlayer: React.FC<IPTVPlayerProps> = ({ channel, onBack }) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [lines, setLines] = useState<ChannelLine[]>([]);
  const [currentLine, setCurrentLine] = useState<ChannelLine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadChannel = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const channelLines = await fetchChannelLines(channel.tid, channel.id);
        setLines(channelLines);
        
        const firstLine = channelLines[0];
        setCurrentLine({ ...firstLine, isActive: true });
        
        const url = await fetchVideoUrl(channel.tid, channel.id, firstLine.id);
        setVideoUrl(url);
        
        setIsLoading(false);
      } catch (err) {
        setError('加载失败，请重试');
        setIsLoading(false);
      }
    };
    
    loadChannel();
  }, [channel]);

  const handleLineSwitch = async (line: ChannelLine) => {
    if (currentLine?.id === line.id) return;
    
    try {
      setIsLoading(true);
      const url = await fetchVideoUrl(channel.tid, channel.id, line.id);
      
      setLines(lines.map(l => ({ ...l, isActive: l.id === line.id })));
      setCurrentLine({ ...line, url, isActive: true });
      setVideoUrl(url);
      setIsLoading(false);
    } catch (err) {
      setError('切换线路失败');
      setIsLoading(false);
    }
  };

  const handleTouch = () => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="text-white">{error}</div>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-white/10 text-white rounded-lg">
          重试
        </button>
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
        <video
          ref={videoRef}
          id="vstPlayer"
          className="w-full h-full"
          webkit-playsinline
          playsInline
          src={videoUrl}
          autoPlay
        />
      </div>

      <div className={`transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <LiquidGlass
          cornerRadius={16}
          padding="16px"
          displacementScale={30}
          blurAmount={0.1}
          elasticity={0.15}
          className="mx-4 mb-4"
        >
          <div className="text-white/60 text-sm mb-3">线路选择</div>
          <ChannelLineList lines={lines} currentLine={currentLine} onLineSwitch={handleLineSwitch} />
        </LiquidGlass>
      </div>
    </div>
  );
};

export default IPTVPlayer;
