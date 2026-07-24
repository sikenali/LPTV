import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiHeartFill, RiTvLine } from '@remixicon/react';
import { Channel } from '../types';
import { useApp } from '../context/AppContext';
import { filterChannels } from '../utils/channelFilter';
import { getBgClass, getTextClass, getTextSecondaryClass, getCardClass, getLogoBgClass, getCardImageBgClass, getEmptyStateIconClass } from '../utils/theme';

const FavoritePage: React.FC = () => {
  const navigate = useNavigate();
  const { settings, favorites, toggleFavorite, channels } = useApp();

  const allowed = useMemo(() => filterChannels(channels), [channels])
  const favoriteChannels = useMemo(() => allowed.filter(c => favorites.includes(c.id)), [allowed, favorites])

  const handleChannelClick = (channel: Channel) => {
    localStorage.setItem('lastPlayedChannel', channel.id);
    navigate('/');
  };

  return (
    <div className={`min-h-screen ${getBgClass(settings.theme)} transition-colors duration-300`}>
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <RiHeartFill className="w-6 h-6 text-red-500" />
          <h1 className={`text-xl font-bold ${getTextClass(settings.theme)}`}>我的收藏</h1>
          <span className={`px-2 py-0.5 rounded-full text-xs ${settings.theme === 'black' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'}`}>
            {favorites.length}个频道
          </span>
        </div>
      </div>

        {favoriteChannels.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-20">
        <div className={`w-20 h-20 rounded-full ${getCardImageBgClass(settings.theme)} flex items-center justify-center mb-6`}>
          <RiHeartFill className={`w-10 h-10 ${getEmptyStateIconClass(settings.theme)}`} />
        </div>
            <h3 className={`text-lg font-medium ${getTextClass(settings.theme)} mb-2`}>还没有收藏任何频道</h3>
            <p className={`${getTextSecondaryClass(settings.theme)} text-sm mb-6`}>前往频道页面，点击爱心图标即可收藏喜欢的频道</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <RiTvLine className="w-4 h-4" />
              前往频道页
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {favoriteChannels.map((channel) => (
              <div
                key={channel.id}
                onClick={() => handleChannelClick(channel)}
                className={`${getCardClass(settings.theme)} border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group`}
              >
                <div className={`relative h-36 overflow-hidden ${getCardImageBgClass(settings.theme)}`}>
                  <img
                          src={channel.logo}
                    alt={channel.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />

                  <div className="absolute top-2 right-2">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(channel.id);
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors ${settings.theme === 'black' ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-black/50 text-white hover:bg-black/70'}`}
                  >
                    <RiHeartFill className="w-4 h-4" />
                  </div>
                </div>
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded overflow-hidden ${getLogoBgClass(settings.theme)} flex items-center justify-center`}>
                        <img
                    src={channel.logo}
                          alt={channel.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <span className={`font-medium ${getTextClass(settings.theme)} text-sm`}>{channel.name}</span>
                    </div>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritePage;