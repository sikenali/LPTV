import React, { useState, useRef, useEffect } from 'react';
import { RiSearchLine, RiHeartFill, RiHeartLine, RiArrowDownSLine, RiArrowUpSLine, RiLoader2Line } from '@remixicon/react';
import { Channel } from '../types';
import { useApp } from '../context/AppContext';
import { getChannelLogo } from '../utils/icons';
import { cctvChannels, wsChannels } from '../data/channels';
import ChannelLineList from '../components/Player/ChannelLineList';
import { getBgClass, getPanelClass, getTextSecondaryClass, getSearchContainerClass, getChannelItemSelectedClass } from '../utils/theme';

interface ChannelLine {
  id: string;
  name: string;
  url: string;
  quality: string;
  isActive?: boolean;
}

type CategoryKey = 'cctv' | 'ws';

const categoryConfig: Record<CategoryKey, { label: string; channels: Channel[] }> = {
  cctv: { label: '央视频道', channels: cctvChannels },
  ws: { label: '卫视频道', channels: wsChannels },
};

const ChannelPage: React.FC = () => {
  const { settings, favorites, toggleFavorite } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(cctvChannels[0] || null);
  const [lines, setLines] = useState<ChannelLine[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<CategoryKey, boolean>>({
    cctv: true,
    ws: false,
  });
  const [loading, setLoading] = useState(true);
  const [showPlayer, setShowPlayer] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoLoadedRef = useRef(false);
  const loadCheckTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const lastChannelId = useState<string | null>(() => {
    return localStorage.getItem('lastPlayedChannel');
  })[0];

  useEffect(() => {
    const loadLastChannel = async () => {
      if (lastChannelId) {
        const [tid, id] = lastChannelId.split('-');
        if (tid && id) {
          const channel = [...cctvChannels, ...wsChannels].find(c => c.id === id && c.tid === tid);
          if (channel) {
            setSelectedChannel(channel);
            await loadChannel(channel);
            return;
          }
        }
      }
      if (cctvChannels[0]) {
        await loadChannel(cctvChannels[0]);
      }
    };
    loadLastChannel();
    
    return () => {
      if (loadCheckTimer.current) clearInterval(loadCheckTimer.current);
    };
  }, []);

  useEffect(() => {
    if (videoUrl) {
      videoLoadedRef.current = false;
      setLoading(true);
      setShowPlayer(false);
      
      if (loadCheckTimer.current) clearInterval(loadCheckTimer.current);
      
      loadCheckTimer.current = setInterval(() => {
        try {
          const iframeDoc = iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document;
          if (iframeDoc) {
            const videoElement = iframeDoc.getElementById('vstPlayer') as HTMLVideoElement;
            if (videoElement) {
              const playURLSelect = iframeDoc.getElementById('playURL') as HTMLSelectElement;
              if (playURLSelect) {
                const options = playURLSelect.options;
                const parsedLines: ChannelLine[] = [];
                for (let i = 0; i < options.length; i++) {
                  parsedLines.push({
                    id: String(i + 1),
                    name: options[i].text.replace('線路', '线路'),
                    url: options[i].value,
                    quality: i === 0 ? '高清' : '标清',
                    isActive: i === 0,
                  });
                }
                setLines(parsedLines);
              } else {
                setLines([
                  { id: '1', name: '线路1', url: '', quality: '高清', isActive: true },
                  { id: '2', name: '线路2', url: '', quality: '标清', isActive: false },
                  { id: '3', name: '线路3', url: '', quality: '标清', isActive: false },
                ]);
              }
              videoLoadedRef.current = true;
              setLoading(false);
              setShowPlayer(true);
              if (loadCheckTimer.current) clearInterval(loadCheckTimer.current);
            }
          }
        } catch (e) {
          console.log('跨域检查失败，等待视频加载');
        }
      }, 300);
    }
    
    return () => {
      if (loadCheckTimer.current) clearInterval(loadCheckTimer.current);
    };
  }, [videoUrl]);

  const loadChannel = async (channel: Channel) => {
    setSelectedChannel(channel);
    localStorage.setItem('lastPlayedChannel', `${channel.tid}-${channel.id}`);
    setVideoUrl('');
    setLoading(true);
    setShowPlayer(false);
    videoLoadedRef.current = false;
    
    setTimeout(() => {
      const playUrl = `https://iptv345.com/?act=play&token=94102973569333ec596b874e5a401fd0&tid=${channel.tid}&id=${channel.id}`;
      setVideoUrl(playUrl);
    }, 300);
  };

  const toggleCategory = (category: CategoryKey) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const handleChannelClick = (channel: Channel) => {
    loadChannel(channel);
  };

  const handleLineSwitch = (line: ChannelLine) => {
    setLines(lines.map(l => ({ ...l, isActive: l.id === line.id })));
    try {
      const iframeDoc = iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document;
      if (iframeDoc) {
        const playURLSelect = iframeDoc.getElementById('playURL') as HTMLSelectElement;
        if (playURLSelect) {
          playURLSelect.selectedIndex = parseInt(line.id) - 1;
          const event = new Event('change');
          playURLSelect.dispatchEvent(event);
        }
      }
    } catch (e) {
      console.log('跨域切换线路失败');
    }
  };

  const filteredChannels = (category: CategoryKey) => {
    const channels = categoryConfig[category].channels;
    return channels.filter(channel =>
      channel.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const ChannelItem: React.FC<{ channel: Channel }> = ({ channel }) => {
    const isFavorite = favorites.includes(`${channel.tid}-${channel.id}`);
    const isSelected = selectedChannel?.id === channel.id && selectedChannel?.tid === channel.tid;

    return (
      <button
        key={`${channel.tid}-${channel.id}`}
        onClick={() => handleChannelClick(channel)}
        className={`w-full flex items-center justify-between px-3 py-[10px] transition-colors ${getChannelItemSelectedClass(isSelected, settings.theme)}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-[41px] h-10 rounded-lg overflow-hidden ${settings.theme === 'glass' ? 'bg-white/80' : settings.theme === 'black' ? 'bg-gray-700' : 'bg-gray-100'} flex items-center justify-center shrink-0`}>
            <img
              src={getChannelLogo(channel.name)}
              alt={channel.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <div className="text-left min-w-0">
            <div className={`text-sm font-medium ${settings.theme === 'glass' ? 'text-gray-800' : settings.theme === 'black' ? 'text-gray-200' : 'text-slate-700'} truncate`}>{channel.name}</div>
            <div className={`text-[11px] ${getTextSecondaryClass(settings.theme)} truncate max-w-[140px] mt-0.5`}>{channel.currentProgram}</div>
          </div>
        </div>
        <div
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(`${channel.tid}-${channel.id}`);
          }}
          className="p-1 shrink-0 cursor-pointer"
        >
          {isFavorite ? (
            <RiHeartFill className="w-[18px] h-[18px] text-red-500" />
          ) : (
            <RiHeartLine className="w-[18px] h-[18px] text-slate-300 hover:text-slate-500" />
          )}
        </div>
      </button>
    );
  };

  return (
    <div className={`flex h-screen ${getBgClass(settings.theme)} transition-colors duration-300`}>
      <div className={`w-[340px] ${getPanelClass(settings.theme)} border-r flex flex-col shrink-0 transition-colors duration-300`}>
        <div className={`px-4 pt-4 pb-3 border-b ${settings.theme === 'black' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className={`flex items-center gap-2 ${getSearchContainerClass(settings.theme)} border rounded-lg px-3 h-10`}>
            <RiSearchLine className={`w-[18px] h-[18px] ${getTextSecondaryClass(settings.theme)} shrink-0`} />
            <input
              type="text"
              placeholder="搜索频道..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`flex-1 bg-transparent text-sm ${settings.theme === 'glass' ? 'text-gray-800 placeholder:text-gray-400' : settings.theme === 'black' ? 'text-gray-200 placeholder:text-gray-400' : 'text-slate-700 placeholder:text-slate-400'} focus:outline-none`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          {(Object.keys(categoryConfig) as CategoryKey[]).map((key) => {
            const { label } = categoryConfig[key];
            const filtered = filteredChannels(key);
            const isExpanded = expandedCategories[key];
            const isActive = key === 'ws';

            return (
              <div key={key}>
                <button
                  onClick={() => toggleCategory(key)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-lg my-1 transition-colors ${
                    isActive ? 'bg-blue-50' : settings.theme === 'glass' ? 'hover:bg-white/50' : settings.theme === 'black' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <RiArrowUpSLine className={`w-[18px] h-[18px] ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    ) : (
                      <RiArrowDownSLine className={`w-[18px] h-[18px] ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    )}
                    <span className={`text-sm font-semibold ${settings.theme === 'glass' ? 'text-gray-800' : settings.theme === 'black' ? 'text-gray-200' : 'text-slate-800'}`}>{label}</span>
                    <span className="text-xs text-slate-400">（{filtered.length}）</span>
                  </div>
                  {isExpanded ? (
                    <RiArrowUpSLine className={`w-[18px] h-[18px] ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  ) : (
                    <RiArrowDownSLine className={`w-[18px] h-[18px] ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  )}
                </button>

                {isExpanded && (
                  <div className="pb-1">
                    {filtered.map((channel) => (
                      <ChannelItem key={`${channel.tid}-${channel.id}`} channel={channel} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-black">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full h-full max-w-[1318.67px] max-h-[741.75px] bg-black rounded-lg overflow-hidden shadow-lg relative">
            {loading ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <RiLoader2Line className="w-10 h-10 text-blue-500 animate-spin" />
                <span className="text-sm text-gray-400">正在加载 {selectedChannel?.name}...</span>
              </div>
            ) : showPlayer && videoUrl && (
              <iframe
                ref={iframeRef}
                src={videoUrl}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen"
                allowFullScreen
                title={`${selectedChannel?.name} 播放器`}
              />
            )}
          </div>
        </div>

        {settings.showLines !== false && showPlayer && (
          <div className="p-4 bg-gray-900 border-t border-gray-800">
            {!loading && selectedChannel && lines.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-blue-400 text-sm font-medium">线路切换</span>
                  <span className="text-gray-400 text-xs">当前：{lines.find(l => l.isActive)?.name || '未选择'}</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  <ChannelLineList
                    lines={lines}
                    currentLine={lines.find(l => l.isActive) || null}
                    onLineSwitch={handleLineSwitch}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChannelPage;