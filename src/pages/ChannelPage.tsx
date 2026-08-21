import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { IptvPlayer } from '../components/Player';
import {
  RiSearchLine, RiArrowDownSLine, RiArrowRightSLine,
  RiTvFill, RiHeartFill, RiHeartLine,
  RiPlayFill, RiPauseFill, RiFullscreenFill, RiFullscreenExitFill,
} from '@remixicon/react';
import { IptvChannel, cctvChannels, wsChannels } from '../data/iptvChannels';
import { getChannelLogoUrl } from '../utils/logoMap';

type GroupKey = 'cctv' | 'ws';

const groupConfig: Record<GroupKey, { label: string; channels: IptvChannel[]; color: string }> = {
  cctv: { label: '央视频道', channels: cctvChannels, color: '#c43d3d' },
  ws: { label: '卫视频道', channels: wsChannels, color: '#7b9eb3' },
};

export default function ChannelPage() {
  const { settings, favorites, toggleFavorite, channelStatus, probeChannel } = useApp();
  const probedRef = useRef<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<IptvChannel | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<GroupKey, boolean>>({
    cctv: true,
    ws: false,
  });
  const [isPaused, setIsPaused] = useState(false);

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

  useEffect(() => {
    const all = [...cctvChannels, ...wsChannels];
    const toProbe = all.filter(ch => {
      const key = `${ch.tid}-${ch.id}`;
      if (probedRef.current.has(key)) return false;
      if (!expandedGroups[ch.tid === 'ys' ? 'cctv' : 'ws'] && !debouncedQuery.trim()) return false;
      probedRef.current.add(key);
      return true;
    });
    let i = 0;
    const timer = setInterval(() => {
      if (i >= toProbe.length) { clearInterval(timer); return; }
      probeChannel(toProbe[i].tid, toProbe[i].id);
      i++;
    }, 200);
    return () => clearInterval(timer);
  }, [expandedGroups, debouncedQuery, probeChannel]);

  const selectChannel = (ch: IptvChannel) => {
    setSelectedChannel(ch);
    setIsPaused(false);
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
                    <div className="flex items-center gap-2 px-2 py-2">
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
                        <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ background: color }}>
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
                        <div className="mt-1 space-y-1 pb-1">
                          {channels.map(ch => {
                            const isSelected = selectedChannel?.id === ch.id && selectedChannel?.tid === ch.tid;
                            const isFav = favorites.includes(`${ch.tid}-${ch.id}`);
                            return (
                              <motion.button
                                key={`${ch.tid}-${ch.id}`}
                                onClick={() => selectChannel(ch)}
                                whileTap={{ scale: 0.97 }}
                                whileHover={{ x: 3 }}
                                className="w-full flex items-center justify-between rounded-lg px-2 py-2.5"
                                style={{
                                  background: isSelected ? cardBk : 'transparent',
                                  borderColor: isSelected ? borderCol : 'transparent',
                                  borderWidth: isSelected ? '1px' : '0px',
                                }}
                              >
                                <div className="flex items-center gap-3 pl-2 pr-2 flex-1 min-w-0">
                                  <div
                                    className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center overflow-hidden bg-black/10"
                                    style={{ border: isSelected ? `2px solid ${color}` : '2px solid transparent' }}
                                  >
                                    <img
                                      src={getChannelLogoUrl(ch)}
                                      alt={ch.name}
                                      className="w-7 h-7 object-contain"
                                      loading="lazy"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                      }}
                                    />
                                    <span className="hidden text-white text-xs font-bold">
                                      {ch.name.replace(/^[^\u4e00-\u9fa5]+/, '').slice(0, 2)}
                                    </span>
                                  </div>
                                  <div className="flex-1 text-left min-w-0">
                                    <div className="font-medium text-sm truncate" style={{ color: textPri }}>{ch.name}</div>
                                    <div className="text-xs truncate" style={{ color: textSec }}>{ch.currentProgram}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span
                                    onClick={(e) => { e.stopPropagation(); toggleFavorite(`${ch.tid}-${ch.id}`); }}
                                    className="p-1.5 cursor-pointer rounded hover:bg-white/10 transition-colors"
                                  >
                                    {isFav ? (
                                      <RiHeartFill className="w-4 h-4" style={{ color: '#c43d3d' }} />
                                    ) : (
                                      <RiHeartLine className="w-4 h-4" style={{ color: subTxt }} />
                                    )}
                                  </span>
                                  <span className="flex items-center">
                                    {channelStatus[`${ch.tid}-${ch.id}`] === 'ok' && (
                                      <span className="w-2 h-2 rounded-full bg-green-500" />
                                    )}
                                    {channelStatus[`${ch.tid}-${ch.id}`] === 'error' && (
                                      <span className="w-2 h-2 rounded-full bg-red-500" />
                                    )}
                                    {!channelStatus[`${ch.tid}-${ch.id}`] && (
                                      <span className="w-2 h-2 rounded-full bg-gray-400" />
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
            <IptvPlayer
              key={`${selectedChannel.tid}-${selectedChannel.id}`}
              tid={selectedChannel.tid}
              id={selectedChannel.id}
              channelName={selectedChannel.name}
              onBack={() => {}}
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

        {/* Bottom control bar */}
        {selectedChannel && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-4 h-14 z-20" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.35) 60%, transparent)' }}>
            <div className="flex items-center gap-1 shrink-0">
              {isPaused ? (
                <button
                  onClick={() => setIsPaused(false)}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <RiPlayFill className="w-5 h-5 text-white" />
                </button>
              ) : (
                <button
                  onClick={() => setIsPaused(true)}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <RiPauseFill className="w-5 h-5 text-white" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-white/70 text-sm truncate max-w-[200px]">{selectedChannel.name}</span>
              <button
                onClick={() => {
                  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                  else document.documentElement.requestFullscreen().catch(() => {});
                }}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                {document.fullscreenElement ? (
                  <RiFullscreenExitFill className="w-4 h-4 text-white" />
                ) : (
                  <RiFullscreenFill className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
