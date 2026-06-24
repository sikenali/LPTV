import React, { useState } from 'react';
import { RiSearchLine, RiHeartFill, RiPlayLine, RiArrowDownSLine, RiArrowUpSLine } from '@remixicon/react';
import { Channel } from '../types';
import { useApp } from '../context/AppContext';
import { getChannelLogo } from '../utils/icons';
import { cctvChannels, wsChannels } from '../data/channels';
import ChannelLineList from '../components/Player/ChannelLineList';

interface ChannelLine {
  id: string;
  name: string;
  url: string;
  quality: string;
  isActive?: boolean;
}

const ChannelPage: React.FC = () => {
  const { favorites, toggleFavorite } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [lines, setLines] = useState<ChannelLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<{ cctv: boolean; ws: boolean }>({
    cctv: true,  // 央视频道默认展开
    ws: false,   // 卫视频道默认折叠
  });

  const toggleCategory = (category: 'cctv' | 'ws') => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const handleChannelClick = async (channel: Channel) => {
    setSelectedChannel(channel);
    setIsLoading(true);
    setVideoUrl('');
    setLines([]);
    
    try {
      // 使用Vite代理解决CORS问题
      const apiUrl = `/api/?act=play&token=94102973569333ec596b874e5a401fd0&tid=${channel.tid}&id=${channel.id}`;
      
      const response = await fetch(apiUrl);
      const html = await response.text();
      
      // 解析线路列表
      const selectMatch = html.match(/<select[^>]*id="playURL"[^>]*>[\s\S]*?<\/select>/);
      if (selectMatch) {
        const optionPattern = /<option[^>]*value="([^"]*)"[^>]*>([^<]+)<\/option>/g;
        const parsedLines: ChannelLine[] = [];
        let match;
        let index = 0;
        while ((match = optionPattern.exec(selectMatch[0])) !== null) {
          parsedLines.push({
            id: match[1],
            name: match[2].replace('線路', '线路'),
            url: match[1],
            quality: index === 0 ? '高清' : '标清',
            isActive: index === 0,
          });
          index++;
        }
        setLines(parsedLines);
      } else {
        // 如果没有找到线路，使用默认线路
        setLines([{ id: '1', name: '默认线路', url: '', quality: '高清', isActive: true }]);
      }
      
      // 设置iframe URL
      setVideoUrl(apiUrl);
    } catch (error) {
      console.error('获取频道信息失败:', error);
      // 使用默认数据
      setVideoUrl('');
      setLines([
        { id: '1', name: '线路1', url: '', quality: '高清', isActive: true },
        { id: '2', name: '线路2', url: '', quality: '标清', isActive: false },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLineSwitch = (line: ChannelLine) => {
    setLines(lines.map(l => ({ ...l, isActive: l.id === line.id })));
    // 切换线路时重新加载iframe
    if (selectedChannel) {
      const apiUrl = `/api/?act=play&token=94102973569333ec596b874e5a401fd0&tid=${selectedChannel.tid}&id=${selectedChannel.id}&line=${line.id}`;
      setVideoUrl(apiUrl);
    }
  };

  const filteredChannels = (category: 'cctv' | 'ws') => {
    const channels = category === 'cctv' ? cctvChannels : wsChannels;
    return channels.filter(channel => {
      const matchSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 左侧频道列表区域 */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* 搜索栏 */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索频道..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* 频道列表 */}
        <div className="flex-1 overflow-y-auto">
          {/* 央视频道分组 */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleCategory('cctv')}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-semibold">央视频道</span>
                <span className="text-xs text-gray-500">({filteredChannels('cctv').length})</span>
              </div>
              {expandedCategories.cctv ? (
                <RiArrowUpSLine className="w-4 h-4 text-gray-500" />
              ) : (
                <RiArrowDownSLine className="w-4 h-4 text-gray-500" />
              )}
            </button>
            
            {expandedCategories.cctv && (
              <div className="max-h-80 overflow-y-auto">
                {filteredChannels('cctv').map((channel) => {
                  const isFavorite = favorites.includes(`${channel.tid}-${channel.id}`);
                  const isSelected = selectedChannel?.id === channel.id && selectedChannel?.tid === channel.tid;
                  return (
                    <button
                      key={`${channel.tid}-${channel.id}`}
                      onClick={() => handleChannelClick(channel)}
                      className={`w-full flex items-center justify-between px-4 py-3 transition-colors border-l-4 ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-500' 
                          : 'hover:bg-gray-50 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
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
                          <div className="text-gray-800 text-sm font-medium truncate">{channel.name}</div>
                          <div className="text-gray-500 text-xs truncate max-w-[140px]">{channel.currentProgram}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {channel.isLive && (
                          <span className="px-1.5 py-0.5 rounded bg-red-500/80 text-white text-xs">
                            LIVE
                          </span>
                        )}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(`${channel.tid}-${channel.id}`);
                          }}
                          className={`p-1 transition-colors cursor-pointer ${
                            isFavorite ? 'text-red-500' : 'text-gray-300 hover:text-gray-500'
                          }`}
                        >
                          <RiHeartFill className="w-4 h-4" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 卫视频道分组 */}
          <div>
            <button
              onClick={() => toggleCategory('ws')}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-green-600 font-semibold">卫视频道</span>
                <span className="text-xs text-gray-500">({filteredChannels('ws').length})</span>
              </div>
              {expandedCategories.ws ? (
                <RiArrowUpSLine className="w-4 h-4 text-gray-500" />
              ) : (
                <RiArrowDownSLine className="w-4 h-4 text-gray-500" />
              )}
            </button>
            
            {expandedCategories.ws && (
              <div className="max-h-80 overflow-y-auto">
                {filteredChannels('ws').map((channel) => {
                  const isFavorite = favorites.includes(`${channel.tid}-${channel.id}`);
                  const isSelected = selectedChannel?.id === channel.id && selectedChannel?.tid === channel.tid;
                  return (
                    <button
                      key={`${channel.tid}-${channel.id}`}
                      onClick={() => handleChannelClick(channel)}
                      className={`w-full flex items-center justify-between px-4 py-3 transition-colors border-l-4 ${
                        isSelected 
                          ? 'bg-green-50 border-green-500' 
                          : 'hover:bg-gray-50 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
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
                          <div className="text-gray-800 text-sm font-medium truncate">{channel.name}</div>
                          <div className="text-gray-500 text-xs truncate max-w-[140px]">{channel.currentProgram}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {channel.isLive && (
                          <span className="px-1.5 py-0.5 rounded bg-red-500/80 text-white text-xs">
                            LIVE
                          </span>
                        )}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(`${channel.tid}-${channel.id}`);
                          }}
                          className={`p-1 transition-colors cursor-pointer ${
                            isFavorite ? 'text-red-500' : 'text-gray-300 hover:text-gray-500'
                          }`}
                        >
                          <RiHeartFill className="w-4 h-4" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右侧播放器区域 */}
      <div className="flex-1 flex flex-col bg-black">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full h-full max-w-[1318.67px] max-h-[741.75px] bg-black rounded-lg overflow-hidden shadow-lg relative">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-white/60">加载中...</p>
                </div>
              </div>
            ) : videoUrl ? (
              <>
                {/* 使用iframe嵌入IPTV播放页面 */}
                <iframe
                  src={videoUrl}
                  className="w-full h-full border-0"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  title={`${selectedChannel?.name} 播放器`}
                />
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                    <RiPlayLine className="w-12 h-12 text-gray-400" />
                  </div>
                  <p className="text-gray-400 text-lg">选择一个频道开始观看</p>
                  <p className="text-gray-500 text-sm mt-1">点击左侧频道列表</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 播放器控制栏 - 线路切换 */}
        <div className="p-4 bg-gray-900 border-t border-gray-800">
          {selectedChannel && lines.length > 0 && (
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
      </div>
    </div>
  );
};

export default ChannelPage;