import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiArrowLeftSLine,
  RiHeartFill, RiHeartLine,
  RiTvLine, RiPlayFill,
} from '@remixicon/react';
import { useApp } from '../context/AppContext';
import { IptvChannel, cctvChannels, wsChannels } from '../data/iptvChannels';
import Toast from '../components/Toast';
import { openChannel } from '../utils/openChannel';

const formatDate = (): string => {
  const now = new Date();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${month}/${day} 周${weekdays[now.getDay()]}`;
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
        isSelected ? 'ring-2 ring-red-500 shadow-lg shadow-red-500/20' : 'hover:bg-white/5'
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
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-white/50 truncate">{channel.currentProgram}</div>
          <RiPlayFill className="w-3 h-3 text-white/30 shrink-0" />
        </div>
      </div>
    </button>
  );
};

const TvModePage: React.FC = () => {
  const navigate = useNavigate();
  const { setTvMode, settings } = useApp();
  const [activeGroup, setActiveGroup] = useState<GroupKey>('cctv');
  const [currentTime, setCurrentTime] = useState(formatTime());
  const [currentDate] = useState(formatDate());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.tvMode) setTvMode(true);
    return () => {
      setTvMode(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(formatTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentChannels = activeGroup === 'cctv' ? cctvChannels : wsChannels;

  // Keyboard navigation: 方向键选择, 回车播放
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setTvMode(false);
        navigate('/');
        return;
      }
      const idx = currentChannels.findIndex(c => c.id === selectedId);
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedId(currentChannels[((idx - 1 + currentChannels.length) % currentChannels.length)]?.id ?? currentChannels[0].id);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedId(currentChannels[(idx + 1) % currentChannels.length]?.id ?? currentChannels[0].id);
          break;
        case 'Enter':
          e.preventDefault();
          {
            const target = currentChannels.find(c => c.id === selectedId) ?? currentChannels[0];
            if (target) openChannel(target);
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentChannels, selectedId, navigate, setTvMode]);

  const openSelected = (ch: IptvChannel) => {
    setSelectedId(ch.id);
    openChannel(ch);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <Toast />
      <div className="flex-1 flex flex-col min-h-0">
        {/* 顶部提示区: 表明这是频道启动器, 点击频道即整页跳转直播源 */}
        <div className="flex-1 relative min-h-[300px] flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-red-600/15 flex items-center justify-center mx-auto mb-4">
              <RiTvLine className="w-10 h-10 text-red-500" />
            </div>
            <p className="text-white/80 text-lg font-medium mb-1">选择频道开始观看</p>
            <p className="text-white/40 text-sm">点击频道后整页跳转至 央视官网 / 央视频 直播页</p>
          </div>
        </div>

        {/* Category tabs */}
        <div className="px-6 py-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            {(['cctv', 'ws'] as GroupKey[]).map(key => (
              <button
                key={key}
                onClick={() => { setActiveGroup(key); setSelectedId(null); }}
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
                isSelected={selectedId === ch.id}
                onClick={() => openSelected(ch)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-6 py-2.5 border-t border-white/10 flex items-center justify-between bg-black/90">
        <div className="flex items-center gap-5">
          <div
            onClick={() => { setTvMode(false); navigate('/'); }}
            className="flex items-center gap-2 text-white/60 hover:text-white/90 cursor-pointer transition-colors text-xs"
          >
            <RiArrowLeftSLine className="w-4 h-4" />
            <span>退出 TV</span>
          </div>
          <div className="flex items-center gap-1.5 text-white/40 text-xs">
            <span>↑↓ 切换频道</span>
            <span className="text-white/20">·</span>
            <span>Enter 播放</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/50">{currentDate}</div>
          <div className="text-sm font-bold text-white tracking-wider">{currentTime}</div>
        </div>
      </div>
    </div>
  );
};

export default TvModePage;
