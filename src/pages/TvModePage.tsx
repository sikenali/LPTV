import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiArrowLeftSLine, RiHeartFill, RiHeartLine,
  RiArrowDownSLine, RiArrowUpSLine,
  RiTvLine,
} from '@remixicon/react';
import { useApp } from '../context/AppContext';
import { IptvWebPlayer } from '../components/Player';
import { IptvChannel, cctvChannels, wsChannels } from '../data/iptvChannels';
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

type GroupKey = 'cctv' | 'ws';

const groupLabels: Record<GroupKey, string> = {
  cctv: '央视频道',
  ws: '卫视频道',
};

const ChannelCard: React.FC<{
  channel: IptvChannel;
  isSelected?: boolean;
  onClick?: () => void;
}> = ({ channel, isSelected, onClick }) => {
  const { favorites, toggleFavorite } = useApp();
  const isFav = favorites.includes(`${channel.tid}-${channel.id}`);

  return (
    <button
      onClick={onClick}
      className={`relative w-[200px] shrink-0 rounded-xl overflow-hidden transition-all duration-200 text-left ${
        isSelected ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : 'hover:bg-white/5'
      }`}
    >
      <div className="h-[90px] bg-gradient-to-br from-gray-800 to-gray-900 p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-white truncate">{channel.name}</div>
          <span
            onClick={(e) => { e.stopPropagation(); toggleFavorite(`${channel.tid}-${channel.id}`); }}
            className="p-0.5"
          >
            {isFav ? (
              <RiHeartFill className="w-3 h-3 text-red-400" />
            ) : (
              <RiHeartLine className="w-3 h-3 text-white/40 hover:text-white/70" />
            )}
          </span>
        </div>
        <div className="text-[10px] text-white/50 truncate">{channel.currentProgram}</div>
      </div>
    </button>
  );
};

const TvModePage: React.FC = () => {
  const navigate = useNavigate();
  const [activeGroup, setActiveGroup] = useState<GroupKey>('cctv');
  const [selectedChannel, setSelectedChannel] = useState<IptvChannel | null>(null);
  const [currentTime, setCurrentTime] = useState(formatTime());
  const [currentDate] = useState(formatDate());
  const allChannels = useMemo(() => [...cctvChannels, ...wsChannels], []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(formatTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Restore last played channel
  useEffect(() => {
    const savedId = localStorage.getItem('lptv-last-channel');
    if (savedId) {
      const [tid, id] = savedId.split('-');
      const ch = allChannels.find(c => c.tid === tid && c.id === id);
      if (ch) setSelectedChannel(ch);
    }
    if (!selectedChannel && cctvChannels[0]) setSelectedChannel(cctvChannels[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChannelSelect = (ch: IptvChannel) => {
    setSelectedChannel(ch);
    localStorage.setItem('lptv-last-channel', `${ch.tid}-${ch.id}`);
  };

  const currentChannels = activeGroup === 'cctv' ? cctvChannels : wsChannels;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const idx = currentChannels.findIndex(c => c.id === selectedChannel?.id);
      if (idx === -1) return;
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          handleChannelSelect(currentChannels[(idx - 1 + currentChannels.length) % currentChannels.length]);
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleChannelSelect(currentChannels[(idx + 1) % currentChannels.length]);
          break;
        case 'Escape':
          e.preventDefault();
          navigate('/');
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedChannel, currentChannels, navigate]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <Toast />
      <div className="flex-1 flex flex-col min-h-0">
        {/* Top bar */}
        <div className="px-6 pt-3 pb-2 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center">
              <RiTvLine className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{selectedChannel?.name || 'LPTV'}</div>
              <div className="text-[10px] text-white/40">{selectedChannel?.currentProgram || '选择频道开始观看'}</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <div className="text-xs text-white/50">{currentDate}</div>
              <div className="text-lg font-bold text-white tracking-wider">{currentTime}</div>
            </div>
          </div>
        </div>

        {/* Video Player */}
        <div className="flex-1 relative min-h-[300px]">
          {selectedChannel ? (
            <IptvWebPlayer
              key={`${selectedChannel.tid}-${selectedChannel.id}`}
              channel={selectedChannel}
              onBack={() => navigate('/')}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <RiTvLine className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <p className="text-white/40 text-sm">选择频道开始观看</p>
              </div>
            </div>
          )}
        </div>

        {/* Info bar */}
        <div className="px-6 py-2 border-b border-white/5">
          <div className="text-lg font-bold text-white">{selectedChannel?.name || '请选择频道'}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-white/50">{selectedChannel?.currentProgram || ''}</span>
            <span className="text-white/20">|</span>
            <span className="text-xs text-green-400">直播中</span>
          </div>
        </div>

        {/* Category tabs */}
        <div className="px-6 py-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            {(['cctv', 'ws'] as GroupKey[]).map(key => (
              <button
                key={key}
                onClick={() => setActiveGroup(key)}
                className={`px-3 py-1 rounded-lg text-sm transition-all ${
                  activeGroup === key
                    ? 'bg-red-600 text-white font-medium'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {groupLabels[key]}
                <span className={`ml-1.5 ${activeGroup === key ? 'text-white/70' : 'text-white/40'}`}>
                  ({key === 'cctv' ? cctvChannels.length : wsChannels.length})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-wrap gap-3">
            {currentChannels.map(ch => (
              <ChannelCard
                key={`${ch.tid}-${ch.id}`}
                channel={ch}
                isSelected={selectedChannel?.id === ch.id && selectedChannel?.tid === ch.tid}
                onClick={() => handleChannelSelect(ch)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-6 py-2.5 border-t border-white/10 flex items-center justify-between bg-black/90">
        <div className="flex items-center gap-5">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/60 hover:text-white/90 cursor-pointer transition-colors text-xs"
          >
            <RiArrowLeftSLine className="w-4 h-4" />
            <span>退出 TV</span>
          </div>
          <div className="flex items-center gap-1.5 text-white/40 text-xs">
            <RiArrowUpSLine className="w-3 h-3" />
            <RiArrowDownSLine className="w-3 h-3" />
            <span>切换频道</span>
          </div>
        </div>
        <div className="text-white/30 text-xs">
          {selectedChannel ? selectedChannel.name : '请选择频道'}
        </div>
      </div>
    </div>
  );
};

export default TvModePage;
