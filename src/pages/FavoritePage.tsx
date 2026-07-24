import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiHeartFill, RiTvLine, RiSearchLine, RiArrowDownSLine, RiArrowRightSLine } from '@remixicon/react';
import { Channel } from '../types';
import { useApp } from '../context/AppContext';
import { filterChannels } from '../utils/channelFilter';

const FavoritePage: React.FC = () => {
  const navigate = useNavigate();
  const { settings, favorites, toggleFavorite, channels } = useApp();

  const allowed = useMemo(() => filterChannels(channels), [channels])
  const favoriteChannels = useMemo(() => allowed.filter(c => favorites.includes(c.id)), [allowed, favorites])

  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const groups = [...new Set(favoriteChannels.map(c => c.group))]
    const initial: Record<string, boolean> = {}
    groups.forEach(g => { initial[g] = true })
    setExpandedCategories(initial)
  }, [favoriteChannels])

  const filteredFavorites = useMemo(() => {
    if (!searchQuery.trim()) return favoriteChannels
    return favoriteChannels.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [favoriteChannels, searchQuery])

  const groupedFavorites = useMemo(() => {
    const groups: Record<string, Channel[]> = {}
    filteredFavorites.forEach(ch => {
      if (!groups[ch.group]) groups[ch.group] = []
      groups[ch.group].push(ch)
    })
    return Object.entries(groups).map(([group, channels]) => ({ group, channels }))
  }, [filteredFavorites])

  const toggleCategory = (group: string) => {
    setExpandedCategories(prev => ({ ...prev, [group]: !prev[group] }))
  }

  const handleChannelClick = (channel: Channel) => {
    localStorage.setItem('lastPlayedChannel', channel.id);
    navigate('/');
  };

  const bgColor = settings.theme === 'black' ? '#0a0a0a' : settings.theme === 'white' ? '#f8f8f8' : '#fbf7f0'
  const borderColor = settings.theme === 'black' ? 'rgba(255,255,255,0.1)' : '#e5d9c4'
  const textPrimary = settings.theme === 'black' ? '#ffffff' : '#3d2b1f'
  const textSecondary = settings.theme === 'black' ? 'rgba(255,255,255,0.5)' : '#8b7e6a'
  const cardBg = settings.theme === 'black' ? 'rgba(255,255,255,0.05)' : '#fdfaf4'
  const inputBg = settings.theme === 'black' ? 'rgba(255,255,255,0.05)' : '#fbf7f0'
  const subText = settings.theme === 'black' ? 'rgba(255,255,255,0.4)' : '#b8a88a'

  if (favoriteChannels.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: bgColor }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: cardBg }}>
          <RiHeartFill className="w-10 h-10" style={{ color: subText }} />
        </div>
        <h3 className="text-lg font-medium mb-2" style={{ color: textPrimary }}>还没有收藏任何频道</h3>
        <p className="text-sm mb-6" style={{ color: textSecondary }}>前往频道页面，点击爱心图标即可收藏喜欢的频道</p>
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
    <div className="min-h-screen" style={{ background: bgColor }}>
      <div className="max-w-[1200px] mx-auto px-8 py-8">
        {/* 顶部标题区 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <RiHeartFill className="w-6 h-6" style={{ color: '#c43d3d' }} />
            <h1 className="text-xl font-bold" style={{ color: textPrimary }}>我的收藏</h1>
            <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(196,61,61,0.2)', color: '#c43d3d' }}>
              {favorites.length}个频道
            </span>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="relative mb-6 max-w-md">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: subText }} />
          <input
            type="text"
            placeholder="搜索收藏..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border outline-none text-sm"
            style={{ background: inputBg, borderColor, color: textPrimary }}
          />
        </div>

        {/* 分组列表 */}
        <div className="space-y-4">
          {groupedFavorites.length === 0 ? (
            <div className="text-center py-12" style={{ color: subText }}>
              {searchQuery ? '未找到匹配的收藏' : '暂无收藏频道'}
            </div>
          ) : (
            groupedFavorites.map(({ group, channels: groupChannels }) => (
              <div key={group}>
                <button
                  onClick={() => toggleCategory(group)}
                  className="w-full flex items-center justify-between rounded-lg border px-4 py-3 transition-colors"
                  style={{ background: cardBg, borderColor }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: '#c9a96e' }}>
                      <span className="text-white text-xs font-bold"></span>
                    </div>
                    <span className="font-semibold text-sm" style={{ color: textPrimary }}>{group}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: '#c9a96e' }}>{`（${groupChannels.length}）`}</span>
                    {expandedCategories[group] ? (
                      <RiArrowDownSLine className="w-4 h-4" style={{ color: textSecondary }} />
                    ) : (
                      <RiArrowRightSLine className="w-4 h-4" style={{ color: textSecondary }} />
                    )}
                  </div>
                </button>

                {expandedCategories[group] && (
                  <div className="mt-2 grid grid-cols-4 gap-4">
                    {groupChannels.map((channel) => (
                      <div
                        key={channel.id}
                        onClick={() => handleChannelClick(channel)}
                        className="rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                        style={{ background: cardBg, border: `1px solid ${borderColor}` }}
                      >
                        <div className="relative h-36 overflow-hidden flex items-center justify-center" style={{ background: inputBg }}>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(196,61,61,0.15)' }}>
                            <RiHeartFill className="w-6 h-6" style={{ color: '#c43d3d' }} />
                          </div>

                          <div className="absolute top-2 right-2">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(channel.id);
                              }}
                              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors bg-black/50 hover:bg-black/70"
                            >
                              <RiHeartFill className="w-4 h-4 text-red-500" />
                            </div>
                          </div>
                        </div>
                        <div className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate" style={{ color: textPrimary }}>{channel.name}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FavoritePage;
