import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { IptvWebPlayer } from '../components/Player';
import {
  RiSearchLine, RiArrowDownSLine, RiArrowRightSLine,
  RiTvFill, RiHeartFill, RiHeartLine, RiPlayFill,
} from '@remixicon/react';
import { IptvChannel, cctvChannels, wsChannels } from '../data/iptvChannels';
import { getChannelLogoUrl } from '../utils/logoMap';
import { Channel } from '../types';

type GroupKey = 'cctv' | 'ws';

const LogoCell: React.FC<{ ch: IptvChannel; color: string }> = ({ ch, color }) => {
  const [imgError, setImgError] = useState(false);
  return (
    <div
      className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center overflow-hidden"
      style={{ background: `${color}22`, border: `1px solid ${color}44` }}
    >
      {!imgError ? (
        <img src={getChannelLogoUrl(ch)} alt={ch.name} className="w-full h-full object-contain p-1" onError={() => setImgError(true)} />
      ) : (
        <span className="text-white text-xs font-bold" style={{ color }}>{ch.name.replace(/^[^\u4e00-\u9fa5]+/, '').slice(0, 1)}</span>
      )}
    </div>
  );
};

const groupConfig: Record<GroupKey, { label: string; channels: IptvChannel[]; color: string }> = {
  cctv: { label: '央视频道', channels: cctvChannels, color: '#c43d3d' },
  ws: { label: '卫视频道', channels: wsChannels, color: '#7b9eb3' },
};

export default function ChannelPage() {
  const { settings, favorites, toggleFavorite } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<IptvChannel | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<GroupKey, boolean>>({
    cctv: true,
    ws: false,
  });
  const [m3uChannels, setM3uChannels] = useState<Channel[]>([]);
  const [channelStatus, setChannelStatus] = useState<Record<string, 'ok' | 'error' | 'unknown'>>({});

  useEffect(() => {
    fetch('/api/m3u')
      .then(r => r.json())
      .then(data => {
        if (data && data.length > 0) {
          setM3uChannels(data);
          // 批量测试频道状态（通过后端代理，避免 CORS）
          testChannelStatus(data);
        }
      })
      .catch(() => {});
  }, []);

  const testChannelStatus = async (channels: Channel[]) => {
    const status: Record<string, 'ok' | 'error' | 'unknown'> = {};
    const batchSize = 15;
    for (let i = 0; i < channels.length; i += batchSize) {
      const batch = channels.slice(i, i + batchSize);
      await Promise.all(batch.map(async (ch) => {
        if (!ch.url) {
          status[ch.id] = 'unknown';
          return;
        }
        try {
          const resp = await fetch(`/api/stream/check?url=${encodeURIComponent(ch.url)}`);
          const data = await resp.json();
          status[ch.id] = data.status || 'unknown';
        } catch {
          status[ch.id] = 'unknown';
        }
      }));
      setChannelStatus(prev => ({ ...prev, ...status }));
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const allChannels = [...cctvChannels, ...wsChannels];
    const savedId = localStorage.getItem('lptv-last-channel');
    if (savedId) {
      const [tid, id] = savedId.split('-');
      const ch = allChannels.find(c => c.tid === tid && c.id === id);
      if (ch) {
        setSelectedChannel(ch);
        return;
      }
    }
    // 默认选中 CCTV1
    const cctv1 = allChannels.find(c => /^cctv1(\+?)$/i.test(c.name));
    if (cctv1) setSelectedChannel(cctv1);
  }, []);

  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    const q = debouncedQuery.toLowerCase();
    return [...cctvChannels, ...wsChannels].filter(
      ch => ch.name.toLowerCase().includes(q) || ch.category.includes(q)
    );
  }, [debouncedQuery]);

  const grouped = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return (Object.keys(groupConfig) as GroupKey[]).map(key => ({
        key,
        label: groupConfig[key].label,
        channels: groupConfig[key].channels,
        color: groupConfig[key].color,
      }));
    }
    const map = new Map<string, IptvChannel[]>();
    for (const ch of filtered) {
      if (!map.has(ch.category)) map.set(ch.category, []);
      map.get(ch.category)!.push(ch);
    }
    return Array.from(map.entries()).map(([label, channels]) => ({
      key: (label === '央视频道' ? 'cctv' : 'ws') as GroupKey,
      label,
      channels,
      color: groupConfig[label === '央视频道' ? 'cctv' : 'ws']?.color || '#c9a96e',
    }));
  }, [filtered, debouncedQuery]);

  const toggleGroup = (key: GroupKey) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectChannel = (ch: IptvChannel) => {
    setSelectedChannel(ch);
    localStorage.setItem('lptv-last-channel', `${ch.tid}-${ch.id}`);
  };

  const isBlack = settings.theme === 'black';
  const bgMain = isBlack ? '#0a0a0a' : '#fbf7f0';
  const sidebarBg = isBlack ? '#1a1a1a' : '#f8f3e8';
  const borderCol = isBlack ? 'rgba(255,255,255,0.1)' : '#e5d9c4';
  const textPri = isBlack ? '#ffffff' : '#3d2b1f';
  const textSec = isBlack ? 'rgba(255,255,255,0.5)' : '#8b7e6a';
  const subTxt = isBlack ? 'rgba(255,255,255,0.4)' : '#b8a88a';
  const cardBk = isBlack ? 'rgba(255,255,255,0.05)' : '#fdfaf4';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: bgMain }}>
      {/* Sidebar */}
      <div className="w-[360px] flex flex-col min-h-0 overflow-hidden shrink-0" style={{ background: sidebarBg, borderRight: `1px solid ${borderCol}` }}>
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5" style={{ background: bgMain, borderColor: borderCol }}>
            <RiSearchLine className="w-4 h-4 shrink-0" style={{ color: subTxt }} />
            <input
              type="text"
              placeholder="搜索频道..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: textPri }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3" style={{ scrollbarWidth: 'thin' }}>
          {grouped.length === 0 ? (
            <div className="text-center py-8" style={{ color: subTxt }}>
              {debouncedQuery ? '未找到匹配的频道' : '暂无频道'}
            </div>
          ) : (
            grouped.map(({ key: groupKey, label, channels, color }: { key: GroupKey; label: string; channels: IptvChannel[]; color: string }) => {
              const isExpanded = !debouncedQuery.trim() ? expandedGroups[groupKey as GroupKey] : true;
              return (
                <div key={groupKey}>
                  {debouncedQuery.trim() ? (
                    <div className="flex items-center gap-2 px-2 py-3">
                      <span className="text-xs font-medium" style={{ color: textSec }}>{label}</span>
                      <span className="text-xs" style={{ color: subTxt }}>（{channels.length}）</span>
                    </div>
                  ) : (
                    <motion.button
                      onClick={() => toggleGroup(groupKey)}
                      whileTap={{ scale: 0.97 }}
                      className="w-full flex items-center justify-between rounded-lg border px-3 py-3"
                      style={{ borderColor: borderCol, background: isExpanded ? cardBk : 'transparent' }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded flex items-center justify-center shrink-0" style={{ background: color }}>
                          <RiTvFill className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="font-semibold text-sm" style={{ color: textPri }}>{label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: '#c9a96e' }}>（{channels.length}）</span>
                        {isExpanded ? (
                          <RiArrowDownSLine className="w-4 h-4" style={{ color: textSec }} />
                        ) : (
                          <RiArrowRightSLine className="w-4 h-4" style={{ color: textSec }} />
                        )}
                      </div>
                    </motion.button>
                  )}

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key={label}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-1 space-y-0.5 pb-1">
                          {channels.map(ch => {
                            const isSelected = selectedChannel?.id === ch.id && selectedChannel?.tid === ch.tid;
                            const isFav = favorites.includes(`${ch.tid}-${ch.id}`);
                            // 从 M3U 数据中找到对应的频道
                            const m3uCh = m3uChannels.find(m => m.name === ch.name) || ch;
                            const status = channelStatus[m3uCh.id] || 'unknown';
                            return (
                              <motion.button
                                key={`${ch.tid}-${ch.id}`}
                                onClick={() => selectChannel(ch)}
                                whileTap={{ scale: 0.97 }}
                                whileHover={{ x: 3 }}
                                className="w-full flex items-center justify-between rounded-lg px-2 py-3"
                                style={{
                                  background: isSelected ? cardBk : 'transparent',
                                  borderColor: isSelected ? borderCol : 'transparent',
                                  borderWidth: isSelected ? '1px' : '0px',
                                }}
                              >
                                <div className="flex items-center gap-2 pl-2 pr-1 flex-1 min-w-0">
                                  <LogoCell ch={ch} color={color} />
                                  <div className="flex-1 text-left min-w-0">
                                    <div className="font-medium text-xs truncate" style={{ color: textPri }}>{ch.name}</div>
                                    <div className="text-xs truncate" style={{ color: textSec }}>{ch.currentProgram}</div>
                                  </div>
                                </div>
                                <div className="shrink-0 flex items-center gap-1 pr-1">
                                  {/* 频道状态指示点 */}
                                  <div
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{
                                      background: status === 'ok' ? '#22c55e' : status === 'error' ? '#ef4444' : 'rgba(128,128,128,0.3)',
                                      boxShadow: status === 'ok' ? '0 0 4px #22c55e' : status === 'error' ? '0 0 4px #ef4444' : 'none',
                                    }}
                                    title={status === 'ok' ? '在线' : status === 'error' ? '离线' : '检测中'}
                                  />
                                  {/* 收藏按钮 */}
                                  <span
                                    onClick={(e) => { e.stopPropagation(); toggleFavorite(`${ch.tid}-${ch.id}`); }}
                                    className="p-1 cursor-pointer rounded hover:bg-white/10 transition-colors"
                                  >
                                    {isFav ? (
                                      <RiHeartFill className="w-3.5 h-3.5" style={{ color: '#c43d3d' }} />
                                    ) : (
                                      <RiHeartLine className="w-3.5 h-3.5" style={{ color: subTxt }} />
                                    )}
                                  </span>
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>

        <div className="px-5 py-3 border-t" style={{ borderColor: borderCol }}>
          <span className="text-xs" style={{ color: subTxt }}>
            {`共 ${[...cctvChannels, ...wsChannels].length} 个频道`}
          </span>
        </div>
      </div>

      {/* Player area */}
      <div className="flex-1 min-h-0 relative overflow-hidden" style={{ background: '#0a0a0a' }}>
        <div className="absolute inset-0">
          {selectedChannel ? (
            <IptvWebPlayer
              key={`${selectedChannel.tid}-${selectedChannel.id}`}
              channel={selectedChannel}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(196,61,61,0.15)' }}>
                  <RiPlayFill className="w-8 h-8" style={{ color: '#c43d3d' }} />
                </div>
                <div className="text-white/30 text-sm mt-4">选择一个频道开始观看</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
