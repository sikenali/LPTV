import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiHeartFill, RiTvLine, RiSearchLine, RiArrowDownSLine, RiArrowRightSLine, RiFilterLine, RiPlayFill } from '@remixicon/react';
import { Channel } from '../types';
import { useApp } from '../context/AppContext';
import { filterChannels, getGroupedChannels } from '../utils/channelFilter';

const FavoritePage: React.FC = () => {
  const navigate = useNavigate();
  const { settings, favorites, toggleFavorite, channels } = useApp();
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const isBlack = settings.theme === 'black'
  const bgMain = isBlack ? '#0a0a0a' : '#fbf7f0'
  const borderCol = isBlack ? 'rgba(255,255,255,0.1)' : '#e5d9c4'
  const textPri = isBlack ? '#ffffff' : '#3d2b1f'
  const textSec = isBlack ? 'rgba(255,255,255,0.5)' : '#8b7e6a'
  const subTxt = isBlack ? 'rgba(255,255,255,0.4)' : '#b8a88a'
  const cardBk = isBlack ? 'rgba(255,255,255,0.05)' : '#fdfaf4'

  const allowed = useMemo(() => filterChannels(channels), [channels])
  const favChs = useMemo(() => allowed.filter(c => favorites.includes(c.id)), [allowed, favorites])

  const filteredFavs = useMemo(() => {
    if (!searchQuery.trim()) return favChs
    return favChs.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [favChs, searchQuery])

  const groupedFavs = useMemo(() => getGroupedChannels(filteredFavs), [filteredFavs])

  useEffect(() => {
    const initial: Record<string, boolean> = {}
    groupedFavs.forEach(g => { initial[g.group] = true })
    setExpandedGroups(initial)
  }, [groupedFavs])

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }))
  }

  const handleChannelClick = (channel: Channel) => {
    localStorage.setItem('lastPlayedChannel', channel.id);
    navigate('/');
  };

  if (favChs.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: bgMain }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: cardBk }}>
          <RiHeartFill className="w-10 h-10" style={{ color: subTxt }} />
        </div>
        <h3 className="text-lg font-medium mb-2" style={{ color: textPri }}>还没有收藏任何频道</h3>
        <p className="text-sm mb-6 text-center max-w-md" style={{ color: textSec }}>前往频道页面，点击爱心图标即可收藏喜欢的频道</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 bg-[#c43d3d] text-white rounded-lg font-medium hover:bg-[#a83232] transition-colors flex items-center gap-2"
        >
          <RiTvLine className="w-4 h-4" />
          前往频道页
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: bgMain }}>
      <div className="max-w-[1200px] mx-auto px-8 py-8">
        {/* 页面标题区 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <RiHeartFill className="w-6 h-6" style={{ color: '#c43d3d' }} />
            <h1 className="text-xl font-bold" style={{ color: textPri }}>我的收藏</h1>
            <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(196,61,61,0.2)', color: '#c43d3d' }}>
              {favorites.length}个频道
            </span>
          </div>
          <div className="flex items-center gap-2">
            <RiFilterLine className="w-4 h-4" style={{ color: textSec }} />
            <span className="text-sm" style={{ color: textSec }}>按组排序</span>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="relative mb-6 max-w-md">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: subTxt }} />
          <input
            type="text"
            placeholder="搜索收藏..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border outline-none text-sm"
            style={{ background: bgMain, borderColor: borderCol, color: textPri }}
          />
        </div>

        {/* 分组列表 */}
        <div className="space-y-4">
          {groupedFavs.length === 0 ? (
            <div className="text-center py-12" style={{ color: subTxt }}>
              {searchQuery ? '未找到匹配的收藏' : '暂无收藏频道'}
            </div>
          ) : (
            groupedFavs.map(({ group, channels: groupChs }) => {
              const isExpanded = expandedGroups[group]

              return (
                <div key={group}>
                  <button
                    onClick={() => toggleGroup(group)}
                    className="w-full flex items-center justify-between rounded-lg border px-4 py-3 transition-colors"
                    style={{ background: cardBk, borderColor: borderCol }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-[#c9a96e] flex items-center justify-center">
                        <RiHeartFill className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="font-semibold text-sm" style={{ color: textPri }}>{group}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: '#c9a96e' }}>{`（${groupChs.length}）`}</span>
                      {isExpanded ? (
                        <RiArrowDownSLine className="w-4 h-4" style={{ color: textSec }} />
                      ) : (
                        <RiArrowRightSLine className="w-4 h-4" style={{ color: textSec }} />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-2 grid grid-cols-4 gap-6">
                      {groupChs.map((ch) => (
                        <div
                          key={ch.id}
                          onClick={() => handleChannelClick(ch)}
                          className="rounded-xl overflow-hidden cursor-pointer transition-shadow hover:shadow-md"
                          style={{ background: cardBk, border: `1px solid ${borderCol}` }}
                        >
                          {/* 卡片缩略图 - h-160 fills with image */}
                          <div className="relative h-[160px] flex items-center justify-center" style={{ background: isBlack ? '#1a1a1a' : '#f8f3e8' }}>
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-12 h-12 rounded flex items-center justify-center text-white font-bold" style={{ background: '#c43d3d' }}>
                                {ch.name.substring(0, 2)}
                              </div>
                              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{ch.name.split('-')[0]}</span>
                            </div>

                            <div className="absolute top-2 right-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleFavorite(ch.id)
                                }}
                                className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <RiHeartFill className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          </div>

                          {/* 卡片信息区 - padding: 16 */}
                          <div className="p-4">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm truncate flex-1" style={{ color: textPri }}>{ch.name}</span>
                              <span className="text-[#c43d3d] ml-2"></span>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: borderCol }}>
                              <span className="text-xs" style={{ color: subTxt }}>{ch.group}</span>
                              <div className="flex items-center gap-1.5">
                                <RiPlayFill className="w-4 h-4" style={{ color: '#c43d3d' }} />
                                <span className="text-xs font-medium" style={{ color: textPri }}>立即播放</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default FavoritePage;
