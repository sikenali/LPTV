import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RiHeartFill, RiTvLine } from '@remixicon/react';
import { channels } from '../data/channels';
import { Channel } from '../types';
import { useApp } from '../context/AppContext';
import { getChannelLogo } from '../utils/icons';
import { getBgClass, getTextClass, getTextSecondaryClass, getCardClass } from '../utils/theme';

const FavoritePage: React.FC = () => {
  const navigate = useNavigate();
  const { settings, favorites, toggleFavorite } = useApp();

  const favoriteChannels = channels.filter(c => favorites.includes(`${c.tid}-${c.id}`));

  const handleChannelClick = (channel: Channel) => {
    localStorage.setItem('lastPlayedChannel', `${channel.tid}-${channel.id}`);
    navigate('/');
  };

  return (
    <div className={`min-h-screen ${getBgClass(settings.theme)} transition-colors duration-300`}>
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <RiHeartFill className="w-6 h-6 text-red-500" />
            <h1 className={`text-xl font-bold ${getTextClass(settings.theme)}`}>我的收藏</h1>
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs">
              {favorites.length}个频道
            </span>
          </div>
        </div>

        {favoriteChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className={`w-20 h-20 rounded-full ${settings.theme === 'glass' ? 'bg-white/60' : settings.theme === 'black' ? 'bg-gray-700' : 'bg-gray-100'} flex items-center justify-center mb-6`}>
              <RiHeartFill className={`w-10 h-10 ${settings.theme === 'glass' ? 'text-gray-400' : settings.theme === 'black' ? 'text-gray-500' : 'text-gray-300'}`} />
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
                key={`${channel.tid}-${channel.id}`}
                onClick={() => handleChannelClick(channel)}
                className={`${getCardClass(settings.theme)} border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group`}
              >
                <div className={`relative h-36 overflow-hidden ${settings.theme === 'glass' ? 'bg-gray-100' : settings.theme === 'black' ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <img
                    src={getChannelLogo(channel.name)}
                    alt={channel.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {channel.isLive && (
                    <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-red-500/90 text-white text-xs font-medium">
                      LIVE
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(`${channel.tid}-${channel.id}`);
                      }}
                      className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white cursor-pointer hover:bg-black/70 transition-colors"
                    >
                      <RiHeartFill className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded overflow-hidden ${settings.theme === 'glass' ? 'bg-white/80' : settings.theme === 'black' ? 'bg-gray-700' : 'bg-gray-100'} flex items-center justify-center`}>
                        <img
                          src={getChannelLogo(channel.name)}
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
                  <p className={`${getTextSecondaryClass(settings.theme)} text-xs mt-1 truncate`}>{channel.currentProgram}</p>
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