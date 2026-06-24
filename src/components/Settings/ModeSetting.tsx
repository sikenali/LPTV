import React from 'react';
import LiquidGlass from '@m0x3mkx/liquid-glass-react';
import { useApp } from '../../context/AppContext';

const ModeSetting: React.FC = () => {
  const { settings, updateSettings } = useApp();

  const qualities = [
    { value: 'high', label: '高清' },
    { value: 'medium', label: '标清' },
    { value: 'low', label: '流畅' },
  ];

  return (
    <LiquidGlass
      cornerRadius={16}
      padding="24px"
      displacementScale={30}
      blurAmount={0.08}
      saturation={120}
      elasticity={0.15}
      className="w-full max-w-md"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-medium">自动播放</div>
            <div className="text-white/40 text-sm mt-1">进入播放页后自动开始播放</div>
          </div>
          <button
            onClick={() => updateSettings({ autoPlay: !settings.autoPlay })}
            className={`w-14 h-8 rounded-full transition-all ${
              settings.autoPlay ? 'bg-blue-500' : 'bg-white/20'
            }`}
          >
            <div className={`w-7 h-7 rounded-full bg-white shadow-md transition-transform ${
              settings.autoPlay ? 'translate-x-7' : 'translate-x-0.5'
            }`} />
          </button>
        </div>

        <div>
          <div className="text-white font-medium mb-3">默认画质</div>
          <div className="grid grid-cols-3 gap-3">
            {qualities.map((quality) => (
              <button
                key={quality.value}
                onClick={() => updateSettings({ quality: quality.value as 'high' | 'medium' | 'low' })}
                className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                  settings.quality === quality.value
                    ? 'bg-blue-500/30 border-2 border-blue-500 text-white'
                    : 'bg-white/5 border-2 border-transparent text-white/60 hover:bg-white/10'
                }`}
              >
                {quality.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </LiquidGlass>
  );
};

export default ModeSetting;
