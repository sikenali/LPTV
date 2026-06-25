import React, { useState, useRef, useEffect } from 'react';
import { RiSearchLine, RiHeartFill, RiHeartLine, RiArrowDownSLine, RiArrowUpSLine, RiLoader2Line } from '@remixicon/react';
import { Channel, ChannelLine } from '../types';
import { useApp } from '../context/AppContext';
import { getChannelLogo } from '../utils/icons';
import { cctvChannels, wsChannels } from '../data/channels';
import ChannelLineList from '../components/Player/ChannelLineList';
import { getBgClass, getPanelClass, getTextSecondaryClass, getSearchContainerClass, getChannelItemSelectedClass, getTextClass, getHoverClass, getLogoBgClass, getHeartIconClass, getBorderClass, getInputTextClass } from '../utils/theme';

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

  useEffect(() => {
    const lastChannelId = localStorage.getItem('lastPlayedChannel');
    
    if (lastChannelId) {
      const [tid, id] = lastChannelId.split('-');
      if (tid && id) {
        const channel = [...cctvChannels, ...wsChannels].find(c => c.id === id && c.tid === tid);
        if (channel) {
          setSelectedChannel(channel);
          loadChannel(channel);
          return;
        }
      }
    }
    
    if (cctvChannels[0]) {
      loadChannel(cctvChannels[0]);
    }
  }, []);

  useEffect(() => {
    if (videoUrl) {
      videoLoadedRef.current = false;
      setLoading(true);
      setShowPlayer(false);
      
      if (loadCheckTimer.current) clearInterval(loadCheckTimer.current);
      
      const maxCheckCount = 2;
      let checkCount = 0;
      
      loadCheckTimer.current = setInterval(() => {
        checkCount++;
        
        try {
          const iframeDoc = iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document;
          if (iframeDoc) {
            const videoElement = iframeDoc.getElementById('vstPlayer') as HTMLVideoElement;
            if (videoElement && videoElement.src && videoElement.src.startsWith('blob:')) {
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
              }
              videoLoadedRef.current = true;
              setLoading(false);
              setShowPlayer(true);
              if (loadCheckTimer.current) clearInterval(loadCheckTimer.current);
              return;
            }
          }
        } catch (e) {
          console.log('跨域检查失败');
        }
        
        if (checkCount >= maxCheckCount) {
          setLoading(false);
          setShowPlayer(true);
          setLines([
            { id: '1', name: '线路1', url: '', quality: '高清', isActive: true },
            { id: '2', name: '线路2', url: '', quality: '标清', isActive: false },
            { id: '3', name: '线路3', url: '', quality: '标清', isActive: false },
          ]);
          if (loadCheckTimer.current) clearInterval(loadCheckTimer.current);
        }
      }, 500);
    }
    
    return () => {
      if (loadCheckTimer.current) clearInterval(loadCheckTimer.current);
    };
  }, [videoUrl]);

  const loadChannel = (channel: Channel) => {
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
      console.log('线路切换失败');
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
          <div className={`w-[41px] h-10 rounded-lg overflow-hidden ${getLogoBgClass(settings.theme)} flex items-center justify-center shrink-0`}>
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
            <div className={`text-sm font-medium ${getTextClass(settings.theme)} truncate`}>{channel.name}</div>
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
            <RiHeartLine className={`w-[18px] h-[18px] ${getHeartIconClass(settings.theme)}`} />
          )}
        </div>
      </button>
    );
  };

  return (
    <div className={`flex h-screen ${getBgClass(settings.theme)} transition-colors duration-300`}>
      <div className={`w-[340px] ${getPanelClass(settings.theme)} border-r ${getBorderClass(settings.theme)} flex flex-col shrink-0 transition-colors duration-300`}>
        <div className={`px-4 pt-4 pb-3 border-b ${getBorderClass(settings.theme)}`}>
          <div className={`flex items-center gap-2 ${getSearchContainerClass(settings.theme)} border ${getBorderClass(settings.theme)} rounded-lg px-3 h-10`}>
            <RiSearchLine className={`w-[18px] h-[18px] ${getTextSecondaryClass(settings.theme)} shrink-0`} />
            <input
              type="text"
              placeholder="搜索频道..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`flex-1 bg-transparent text-sm ${getInputTextClass(settings.theme)} focus:outline-none`}
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
                    isActive ? 'bg-blue-50' : getHoverClass(settings.theme)
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <RiArrowUpSLine className={`w-[18px] h-[18px] ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    ) : (
                      <RiArrowDownSLine className={`w-[18px] h-[18px] ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    )}
                    <span className={`text-sm font-semibold ${getTextClass(settings.theme)}`}>{label}</span>
                    <span className={`text-xs ${getTextSecondaryClass(settings.theme)}`}>（{filtered.length}）</span>
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

      <div className="flex-1 flex flex-col bg-black relative overflow-hidden">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-black">
              <RiLoader2Line className="w-10 h-10 text-blue-500 animate-spin" />
              <span className="text-sm text-gray-400">正在加载 {selectedChannel?.name}...</span>
            </div>
          ) : null}
          {showPlayer && videoUrl && (
            <iframe
              ref={iframeRef}
              src={videoUrl}
              className="flex-1 w-full h-[160%] border-0 transform -translate-y-[28%]"
              allow="autoplay; fullscreen"
              allowFullScreen
              title={`${selectedChannel?.name} 播放器`}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          )}

          {settings.showLines && showPlayer && (
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
                    theme={settings.theme}
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