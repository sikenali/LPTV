import React from 'react';
import LiquidGlass from '@m0x3mkx/liquid-glass-react';
import { RiHeartFill } from '@remixicon/react';
import { Channel } from '../../types';
import { useApp } from '../../context/AppContext';

interface FavoriteCardProps {
  channel: Channel;
  onClick: () => void;
}

const FavoriteCard: React.FC<FavoriteCardProps> = ({ channel, onClick }) => {
  const { toggleFavorite } = useApp();

  return (
    <LiquidGlass
      cornerRadius={12}
      padding="12px"
      displacementScale={40}
      blurAmount={0.07}
      saturation={120}
      aberrationIntensity={1}
      elasticity={0.15}
      onClick={onClick}
      className="cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
          <span className="text-white font-bold">{channel.name[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-medium truncate">{channel.name}</h4>
          <p className="text-white/50 text-xs truncate">{channel.currentProgram}</p>
        </div>
        <div
          onClick={(e) => { e.stopPropagation(); toggleFavorite(channel.id); }}
          className="p-2 text-yellow-400 hover:text-yellow-300 transition-colors cursor-pointer"
        >
          <RiHeartFill className="w-5 h-5" />
        </div>
      </div>
    </LiquidGlass>
  );
};

export default FavoriteCard;
