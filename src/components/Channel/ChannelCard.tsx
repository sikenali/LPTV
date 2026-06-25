import React from 'react';
import LiquidGlass from '@m0x3mkx/liquid-glass-react';
import { RiHeartFill, RiHeartLine } from '@remixicon/react';
import { Channel } from '../../types';
import { useApp } from '../../context/AppContext';

interface ChannelCardProps {
  channel: Channel;
  onClick: () => void;
}

const ChannelCard: React.FC<ChannelCardProps> = ({ channel, onClick }) => {
  const { favorites, toggleFavorite } = useApp();
  const isFavorite = favorites.includes(`${channel.tid}-${channel.id}`);

  return (
    <LiquidGlass
      cornerRadius={16}
      padding="16px"
      displacementScale={50}
      blurAmount={0.08}
      saturation={130}
      aberrationIntensity={1.5}
      elasticity={0.2}
      onClick={onClick}
      className="cursor-pointer transition-transform hover:scale-105"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
          <span className="text-white font-bold text-lg">{channel.name[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold truncate">{channel.name}</h3>
          <p className="text-white/60 text-sm truncate">{channel.currentProgram}</p>
        </div>
        <div className="flex items-center gap-2">
          {channel.isLive && (
            <span className="px-2 py-1 rounded-full bg-red-500/80 text-white text-xs font-medium">
              LIVE
            </span>
          )}
          <div
            onClick={(e) => { e.stopPropagation(); toggleFavorite(`${channel.tid}-${channel.id}`); }}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${isFavorite ? 'text-yellow-400' : 'text-white/60 hover:text-white'}`}
          >
            {isFavorite ? <RiHeartFill className="w-5 h-5" /> : <RiHeartLine className="w-5 h-5" />}
          </div>
        </div>
      </div>
    </LiquidGlass>
  );
};

export default ChannelCard;
