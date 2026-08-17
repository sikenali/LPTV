import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiArrowLeftSLine, RiHeartFill, RiHeartLine, RiArrowDownSLine,
  RiArrowUpSLine, RiCloseLine, RiPlayListLine, RiTvLine, RiFullscreenLine,
} from '@remixicon/react';
import { Channel } from '../types';
import { useApp } from '../context/AppContext';
import HlsPlayer from '../components/Player/HlsPlayer';
import { filterChannels, getGroupedChannels } from '../utils/channelFilter';
import Toast from '../components/Toast';

const formatDate = (): string => {
  const now = new Date();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `星期${weekdays[now.getDay()]} ${month}/${day}`;
};

const formatTime = (): string => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const ChannelRow: React.FC<{
  channel: Channel;
  isSelected?: boolean;
  onClick?: () => void;
  channelStatus?: Record<string, 'ok' | 'error' | 'unknown'>;
}> = ({ channel, isSelected, onClick, channelStatus }) => {
  const { favorites, toggleFavorite } = useApp();
  const isFav = favorites.includes(channel.id);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
      className={`relative w-[300px] shrink-0 rounded-xl overflow-hidden transition-all duration-200 text-left cursor-pointer ${
        isSelected
          ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20'
          : 'hover:bg-white/5'
      }`}
    >
      <div className="h-[114px] bg-gradient-to-br from-gray-800 to-gray-900 p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {channel.logo ? (
              <img
                src={`/api/proxy/image?url=${encodeURIComponent(channel.logo)}&name=${encodeURIComponent(channel.name)}`}
                alt=""
                className="w-6 h-6 rounded object-contain shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : null}
            <div className="text-sm font-medium text-white truncate">{channel.name}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(channel.id);
              }}
              className="p-0.5 transition-transform active:scale-150 hover:bg-white/10 rounded"
            >
              {isFav ? (
                <RiHeartFill className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <RiHeartLine className="w-3.5 h-3.5 text-white/40 hover:text-white/70" />
              )}
            </button>
            {(channelStatus?.[channel.id] === 'ok' || channelStatus?.[channel.id] === 'error') && (
              <span className="shrink-0 w-[6px]">
                {channelStatus[channel.id] === 'ok' && (
                  <span className="block w-[5px] h-[5px] rounded-full bg-green-500" />
                )}
                {channelStatus[channel.id] === 'error' && (
                  <span className="block w-[5px] h-[5px] rounded-full bg-red-500" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const TvModePage: React.FC = () => {
  const navigate = useNavigate();
  const { channels, favorites, channelStatus } = useApp();
  const [activeCategory, setActiveCategory] = useState<string>('央视频道');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [currentTime, setCurrentTime] = useState(formatTime());
  const [currentDate] = useState(formatDate());

  const allowed = useMemo(() => filterChannels(channels), [channels])
  const grouped = useMemo(() => getGroupedChannels(allowed), [allowed])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Restore last played channel on mount
  useEffect(() => {
    if (selectedChannel || allowed.length === 0) return;
    const savedId = localStorage.getItem('lastPlayedChannel');
    if (savedId) {
      const saved = allowed.find(c => c.id === savedId);
      if (saved) {
        setSelectedChannel(saved);
      }
    }
  }, [allowed]);

  const handleChannelSelect = (channel: Channel) => {
    setSelectedChannel(channel)
    localStorage.setItem('lastPlayedChannel', channel.id)
  };

  const activeGroup = grouped.find(g => g.group === activeCategory)
  const filteredChannels = activeGroup?.channels ?? []

  // Keyboard navigation for TV remote / directional pad
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const groupChannels = grouped.find(g => g.group === activeCategory)?.channels ?? [];
      if (!groupChannels.length) return;

      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault();
          const currentIndex = groupChannels.findIndex(c => c.id === selectedChannel?.id);
          const prevIndex = currentIndex <= 0 ? groupChannels.length - 1 : currentIndex - 1;
          handleChannelSelect(groupChannels[prevIndex]);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const currentIndex = groupChannels.findIndex(c => c.id === selectedChannel?.id);
          const nextIndex = currentIndex >= groupChannels.length - 1 ? 0 : currentIndex + 1;
          handleChannelSelect(groupChannels[nextIndex]);
          break;
        }
        case 'Enter': {
          break;
        }
        case 'Escape': {
          e.preventDefault();
          navigate('/');
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedChannel, grouped, activeCategory, navigate]);

  const isFavSelected = selectedChannel ? favorites.includes(selectedChannel.id) : false;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <Toast />
      <div className="flex-1 flex flex-col min-h-0">
        {/* Top bar: channel info + date/time */}
        <div className="px-8 pt-4 pb-2 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
              <RiTvLine className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{selectedChannel?.name || 'LPTV'}</div>
              <div className="text-[10px] text-white/40">{selectedChannel?.group}</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <div className="text-xs text-white/60">{currentDate}</div>
              <div className="text-lg font-bold text-white tracking-wider">{currentTime}</div>
            </div>
          </div>
        </div>

        {/* Video Player Area */}
        <div className="flex-1 relative min-h-[400px]">
          {selectedChannel ? (
            <HlsPlayer
              url={selectedChannel.url}
              channelName={selectedChannel.name}
              channelLogo={selectedChannel.logo}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <RiTvLine className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <p className="text-white/40">选择频道开始观看</p>
              </div>
            </div>
          )}
        </div>

        {/* Play info area */}
        <div className="px-8 py-3 border-b border-white/5">
          <div className="text-2xl font-bold text-white">{selectedChannel?.name || '请选择频道'}</div>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1">
              {isFavSelected ? (
                <RiHeartFill className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <RiHeartLine className="w-3.5 h-3.5 text-white/50" />
              )}
              <span className="text-xs text-white/60">{isFavSelected ? '已收藏' : '收藏'}</span>
            </div>
          </div>
        </div>

        {/* Category tabs */}
        <div className="px-8 py-3 border-b border-white/5">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {grouped.map((g) => {
              const isActive = activeCategory === g.group;
              return (
                <button
                  key={g.group}
                  onClick={() => setActiveCategory(g.group)}
                  className={`shrink-0 px-4 py-1.5 rounded-lg text-sm transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white font-medium shadow-lg shadow-blue-600/20'
                      : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white/80'
                  }`}
                >
                  {g.group}
                  <span className={`ml-1.5 ${isActive ? 'text-white/70' : 'text-white/40'}`}>({g.channels.length})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Channel content */}
        <div className="h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent px-8 py-4">
          <div className="flex flex-wrap gap-3">
            {filteredChannels.map((ch) => (
              <ChannelRow
                key={ch.id}
                channel={ch}
                isSelected={selectedChannel?.id === ch.id}
                onClick={() => handleChannelSelect(ch)}
                channelStatus={channelStatus}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="px-8 py-3 border-t border-white/10 flex items-center justify-between bg-black/80 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/60 hover:text-white/90 cursor-pointer transition-colors"
          >
            <RiArrowLeftSLine className="w-5 h-5" />
            <span className="text-xs">返回</span>
          </div>
          <div className="flex items-center gap-2 text-white/40">
            <RiArrowUpSLine className="w-4 h-4" />
            <RiArrowDownSLine className="w-4 h-4" />
            <span className="text-xs">切换频道</span>
          </div>
          <div className="flex items-center gap-2 text-white/40">
            <RiPlayListLine className="w-4 h-4" />
            <span className="text-xs">节目列表</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-white/40">
            <RiFullscreenLine className="w-4 h-4" />
            <span className="text-xs">画面比例</span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-5 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white/80 text-sm transition-all"
          >
            <RiCloseLine className="w-5 h-5" />
            <span>退出 TV 模式</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TvModePage;
